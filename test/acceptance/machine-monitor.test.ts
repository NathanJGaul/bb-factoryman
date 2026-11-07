import { afterEach, describe, expect, it } from "vitest";
import { makeCheckout, removeCheckouts } from "../fixtures/checkout";
import { hostFixture, loadWorld, settle, type World } from "../fixtures/plugin-host";

afterEach(removeCheckouts);

const TASK = { kind: "ship", description: "Add a --json flag to the status command." } as const;
const gpu = (overrides: { status?: string; phase?: string } = {}) => hostFixture("host_gpu", "gpu-box", overrides);

async function setup(): Promise<World> {
  const checkout = makeCheckout();
  const sources = [
    { hostId: "host_local", path: checkout, isDefault: true },
    { hostId: "host_gpu", path: "/work/gpu", isDefault: false },
  ];
  const world = await loadWorld({ machines: [hostFixture("host_local", "local-box"), gpu()], sources, checkout });
  expect((await world.call("factoryman_dispatch", { ...TASK, machine: "gpu-box" })).isError).toBe(false);
  world.sent("thr-sup").length = 0;
  return world;
}

const setGpu = (world: World, host: ReturnType<typeof gpu> | null) => {
  world.machines.splice(1, world.machines.length, ...(host === null ? [] : [host]));
};
const state = (world: World, id = "t1") => world.store.getTask(id)?.state;
const hostReads = (world: World) => world.sdkCalls("hosts.list").length;
/** Wait until the monitor has read the machines `count` more times, so a negative result has had its chance to fail. */
async function ticks(world: World, count = 3): Promise<void> {
  const target = hostReads(world) + count;
  await settle(() => hostReads(world) >= target, 2000);
}

describe("the machine monitor through the plugin factory", () => {
  it("[A809] blocks a working task whose machine goes offline and wakes the supervisor once", async () => {
    const world = await setup();
    const monitor = world.startMonitor();
    setGpu(world, gpu({ status: "disconnected" }));
    await settle(() => state(world) === "blocked");
    await ticks(world);
    await monitor.stop();
    expect(state(world)).toBe("blocked");
    const wakes = world.sent("thr-sup");
    expect(wakes).toHaveLength(1);
    expect(wakes[0]).toMatch(/Task t1 .* is now blocked/);
    expect(wakes[0]).toContain("machine offline");
    expect(world.store.listEvents({ taskId: "t1" }).filter((row) => row.event === "block")).toHaveLength(1);
  });

  it("[A810] returns a monitor-blocked task to work when its machine is back, and leaves a worker's block alone", async () => {
    const world = await setup();
    expect((await world.call("factoryman_dispatch", { ...TASK, machine: "gpu-box" })).isError).toBe(false);
    await world.call("factoryman_report", { outcome: "blocked", evidence: "Need a decision." }, { threadId: "thr-w2" });
    expect(state(world, "t2")).toBe("blocked");

    const monitor = world.startMonitor();
    setGpu(world, gpu({ phase: "suspended" }));
    await settle(() => state(world, "t1") === "blocked");
    setGpu(world, gpu());
    await settle(() => state(world, "t1") === "working");
    await ticks(world);
    await monitor.stop();
    expect(state(world, "t1")).toBe("working");
    expect(state(world, "t2")).toBe("blocked");
    expect(world.store.listEvents({ taskId: "t2" }).filter((row) => row.event === "unblock")).toEqual([]);
  });

  it("[A811] blocks the working tasks of a deleted machine at once, and nothing unblocks them", async () => {
    const world = await setup();
    await world.host.harness.behavior.emitThreadEvent("experimental_host.deleted", { host: gpu() } as never);
    expect(state(world)).toBe("blocked");
    expect(world.sent("thr-sup")).toHaveLength(1);
    setGpu(world, null);
    const monitor = world.startMonitor();
    await ticks(world);
    await monitor.stop();
    expect(state(world)).toBe("blocked");
  });

  it("[A813] only logs a warning for a task in a state other than working on an offline machine", async () => {
    const world = await setup();
    world.setProject({ deliveryMode: "direct-PR" });
    expect((await world.call("factoryman_dispatch", { ...TASK, machine: "gpu-box" })).isError).toBe(false);
    const ready = await world.call("factoryman_report", { outcome: "done", evidence: "Pushed.", prUrl: "https://github.com/acme/widgets/pull/7" }, { threadId: "thr-w2" });
    expect(ready.isError).toBe(false);
    expect(state(world, "t2")).toBe("review_ready");
    world.sent("thr-sup").length = 0;
    const before = world.store.listEvents({ taskId: "t2" }).length;
    const monitor = world.startMonitor();
    setGpu(world, gpu({ status: "disconnected" }));
    await settle(() => state(world, "t1") === "blocked");
    await ticks(world);
    await monitor.stop();
    expect(state(world, "t2")).toBe("review_ready");
    expect(world.store.listEvents({ taskId: "t2" })).toHaveLength(before);
    expect(world.host.harness.inspection.logEntries.some((entry) => entry.level === "warn" && entry.message.includes("t2") && entry.message.includes("review_ready"))).toBe(true);
  });
});
