import { afterEach, describe, expect, it } from "vitest";
import { TaskLog } from "../../src/store/task-log";
import { makeCheckout, removeCheckouts } from "../fixtures/checkout";
import { hostFixture, loadWorld, settle, type World } from "../fixtures/plugin-host";

afterEach(removeCheckouts);

const TASK = { kind: "ship", description: "Add a --json flag to the status command." } as const;
const state = (world: World, id: string) => world.store.getTask(id)?.state;
const fail = (world: World, thread: string) => world.call("factoryman_report", { outcome: "failed", evidence: "Gave up." }, { threadId: thread });

async function setup(options: Parameters<typeof loadWorld>[0] & { limits?: Record<string, unknown> } = {}): Promise<World> {
  const { limits, ...rest } = options;
  const checkout = makeCheckout({ workflow: limits === undefined ? undefined : { version: 1, limits } });
  return loadWorld({ checkout, ...rest });
}

describe("worker caps and the queue through the plugin factory", () => {
  it("[A1001] queues the next task at a project cap: the task is queued, no worker spawns, and the result says so", async () => {
    const world = await setup({ limits: { maxWorkers: 1 } });
    expect((await world.call("factoryman_dispatch", TASK)).isError).toBe(false);
    const queued = await world.call("factoryman_dispatch", TASK);
    expect(queued.isError).toBe(false);
    expect(queued.text).toMatch(/Task t2 is queued/);
    expect(queued.text).toMatch(/project cap of 1/);
    expect([state(world, "t1"), state(world, "t2")]).toEqual(["working", "queued"]);
    expect(world.sdkCalls("threads.spawn")).toHaveLength(1);
    const create = world.store.listEvents({ taskId: "t2" }).find((row) => row.event === "create");
    expect(create?.payload).toMatchObject({ request: { v: 1, description: TASK.description, parentThreadId: "thr-sup" } });
  });

  it("[A1002] queues across projects at the global cap in the settings", async () => {
    const world = await setup({ settings: { maxWorkers: 1 } });
    world.addThread({ id: "thr-sup2", projectId: "proj-2" });
    expect((await world.call("factoryman_dispatch", TASK)).isError).toBe(false);
    const queued = await world.call("factoryman_dispatch", TASK, { threadId: "thr-sup2", projectId: "proj-2" });
    expect(queued.isError).toBe(false);
    expect(queued.text).toMatch(/global cap of 1/);
    expect(state(world, "t2")).toBe("queued");
    expect(world.store.getTask("t2")?.projectId).toBe("proj-2");
  });

  it("[A1003] starts the oldest queued task when a worker leaves the running states, in order", async () => {
    const world = await setup({ limits: { maxWorkers: 1 } });
    for (let i = 0; i < 3; i += 1) await world.call("factoryman_dispatch", TASK);
    expect([state(world, "t1"), state(world, "t2"), state(world, "t3")]).toEqual(["working", "queued", "queued"]);
    await fail(world, "thr-w1");
    expect([state(world, "t1"), state(world, "t2"), state(world, "t3")]).toEqual(["failed", "working", "queued"]);
    expect(world.store.getTask("t2")?.workerThreadId).toBe("thr-w2");
    await fail(world, "thr-w2");
    expect([state(world, "t2"), state(world, "t3")]).toEqual(["failed", "working"]);
    expect(world.metadata.get("thr-w3")).toMatchObject({ role: "worker", taskId: "t3", kind: "ship" });
  });

  it("[A1004] shows a queued task and its description in factoryman_status", async () => {
    const world = await setup({ limits: { maxWorkers: 1 } });
    await world.call("factoryman_dispatch", TASK);
    await world.call("factoryman_dispatch", { ...TASK, description: "Second task\nwith details." });
    const status = await world.call("factoryman_status", { taskId: "t2" });
    expect(status.text).toContain("state queued");
    expect(status.text).toContain("description: Second task");
  });

  it("[A1005] queues nothing when no cap is set", async () => {
    const world = await setup();
    for (let i = 0; i < 3; i += 1) expect((await world.call("factoryman_dispatch", TASK)).isError).toBe(false);
    expect([state(world, "t1"), state(world, "t2"), state(world, "t3")]).toEqual(["working", "working", "working"]);
  });

  it("[A1005] queues nothing when the global cap is 0", async () => {
    const world = await setup({ settings: { maxWorkers: 0 } });
    for (let i = 0; i < 3; i += 1) expect((await world.call("factoryman_dispatch", TASK)).isError).toBe(false);
    expect([state(world, "t1"), state(world, "t2"), state(world, "t3")]).toEqual(["working", "working", "working"]);
  });

  it("[A1006] starts queued tasks at start-up when slots are free, and when the cap setting changes", async () => {
    const world = await setup({ limits: { maxWorkers: 1 }, settings: { maxWorkers: 1 } });
    await world.call("factoryman_dispatch", TASK);
    await world.call("factoryman_dispatch", TASK);
    expect(state(world, "t2")).toBe("queued");
    // The worker ends while the plugin is off, so no listener starts the next task.
    new TaskLog(world.store).apply("t1", { type: "fail", actor: "system", evidence: "Ended while the plugin was off." });
    await world.restart();
    await world.runStartup();
    expect(state(world, "t2")).toBe("working");
  });

  it("[A1006] starts queued tasks when the owner raises the global cap", async () => {
    const world = await setup({ settings: { maxWorkers: 1 } });
    await world.call("factoryman_dispatch", TASK);
    await world.call("factoryman_dispatch", TASK);
    expect(state(world, "t2")).toBe("queued");
    await world.host.setSettings({ maxWorkers: 2 });
    await settle(() => state(world, "t2") === "working");
    expect(state(world, "t2")).toBe("working");
  });

  it("[A1007] fails a queued task whose request is unreadable, and keeps one whose machine is offline", async () => {
    const checkout = makeCheckout();
    const world = await loadWorld({
      checkout,
      machines: [hostFixture("host_local", "local-box"), hostFixture("host_gpu", "gpu-box", { status: "disconnected" })],
      sources: [{ hostId: "host_local", path: checkout, isDefault: true }, { hostId: "host_gpu", path: "/work/gpu" }],
    });
    const log = new TaskLog(world.store);
    const profile = { provider: "claude", model: "opus", reasoningLevel: "high", permissionMode: "accept-edits" };
    const request = { v: 1, description: "Pinned work.", tags: [], profile, machine: "host_gpu", cloneHost: "host_local", parentThreadId: "thr-sup", branchPrefix: null, baseBranch: null };
    log.create({ type: "create", actor: "supervisor", taskId: "pinned", projectId: "proj-1", kind: "ship", mode: "no-mistakes", request });
    log.create({ type: "create", actor: "supervisor", taskId: "broken", projectId: "proj-1", kind: "ship", mode: "no-mistakes", request: { nonsense: true } });
    await world.restart();
    await world.runStartup();
    expect(state(world, "pinned")).toBe("queued");
    expect(state(world, "broken")).toBe("failed");
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
  });

  it.each([
    ["a count of zero", { maxWorkers: 0 }],
    ["an unknown key", { maxWorkers: 1, burst: 2 }],
    ["a negative budget", { perDayBudget: -1 }],
  ])("[A1024] blocks dispatch for a limits section with %s, like any bad workflow file", async (_label, limits) => {
    const world = await setup({ limits });
    const result = await world.call("factoryman_dispatch", TASK);
    expect(result.isError).toBe(true);
    expect(result.text).toContain("workflow.json");
    expect(world.store.listTasks()).toEqual([]);
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
  });
});
