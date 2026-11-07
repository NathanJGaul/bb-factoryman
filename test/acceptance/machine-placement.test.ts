import { afterEach, describe, expect, it } from "vitest";
import { makeCheckout, removeCheckouts } from "../fixtures/checkout";
import { hostFixture, loadWorld, type World } from "../fixtures/plugin-host";

afterEach(removeCheckouts);

const MACHINES = [hostFixture("host_local", "local-box"), hostFixture("host_gpu", "gpu-box")];
const remoteSources = (clonePath: string) => [
  { hostId: "host_local", path: clonePath, isDefault: true },
  { hostId: "host_gpu", path: "/work/gpu", isDefault: false },
];
const SOURCES = remoteSources("/work/repo");
const PROFILES = {
  deep: { provider: "claude", model: "opus", reasoningLevel: "xhigh", permissionMode: "auto" },
};
const rules = (...list: Array<Record<string, unknown>>) => ({ version: 1, profiles: PROFILES, rules: list });
const TASK = { kind: "ship", description: "Add a --json flag to the status command." } as const;

async function setup(options: Parameters<typeof loadWorld>[0] = {}, dispatch?: unknown): Promise<World> {
  const checkout = makeCheckout({ dispatch });
  return loadWorld({ machines: MACHINES, sources: remoteSources(checkout), checkout, ...options });
}

function spawned(world: World): { environment: { hostId: string } } {
  const [[spawn]] = world.sdkCalls("threads.spawn") as [[{ environment: { hostId: string } }]];
  return spawn;
}

function startPayload(world: World, taskId = "t1"): Record<string, unknown> | undefined {
  return world.store.listEvents({ taskId }).find((row) => row.event === "start")?.payload as Record<string, unknown> | undefined;
}

describe("machine placement through factoryman_dispatch", () => {
  it("[A801] spawns on the explicit machine, records its host ID, and gives the start event the clone host", async () => {
    const world = await setup();
    const result = await world.call("factoryman_dispatch", { ...TASK, machine: "gpu-box" });
    expect(result.isError).toBe(false);
    expect(result.text).toContain("gpu-box");
    expect(spawned(world).environment.hostId).toBe("host_gpu");
    expect(world.store.getTask("t1")?.machine).toBe("host_gpu");
    expect(startPayload(world)).toMatchObject({ machine: "host_gpu", cloneMachine: "host_local" });
  });

  it("[A802] takes the machine of the matching rule when no machine is given", async () => {
    const world = await setup({}, rules({ id: "gpu", when: { kind: "ship" }, profile: "deep", machine: "gpu-box" }));
    expect((await world.call("factoryman_dispatch", TASK)).isError).toBe(false);
    expect(spawned(world).environment.hostId).toBe("host_gpu");
  });

  it("[A803] takes the project's default machine when no rule names one", async () => {
    const world = await setup();
    world.setProject({ defaultMachine: "gpu-box" });
    expect((await world.call("factoryman_dispatch", TASK)).isError).toBe(false);
    expect(spawned(world).environment.hostId).toBe("host_gpu");
    expect(world.store.getTask("t1")?.machine).toBe("host_gpu");
  });

  it("[A804] spawns on the project's default host and records no machine when none is set", async () => {
    const world = await setup();
    expect((await world.call("factoryman_dispatch", TASK)).isError).toBe(false);
    expect(spawned(world).environment.hostId).toBe("host_local");
    expect(world.store.getTask("t1")?.machine).toBeNull();
    expect(startPayload(world)).toMatchObject({ cloneMachine: "host_local" });
  });

  it("[A805] resolves a machine name to its host ID, whatever its case", async () => {
    const world = await setup();
    expect((await world.call("factoryman_dispatch", { ...TASK, machine: "GPU-BOX" })).isError).toBe(false);
    expect(world.store.getTask("t1")?.machine).toBe("host_gpu");
  });

  it("[A805] blocks an unknown machine name with no task and no worker", async () => {
    const world = await setup();
    const missing = await world.call("factoryman_dispatch", { ...TASK, machine: "nowhere" });
    expect(missing.isError).toBe(true);
    expect(missing.text).toContain("machine_unknown");
    expect(world.store.listTasks()).toEqual([]);
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
  });

  it("[A805] blocks a machine name that two machines share with no task and no worker", async () => {
    const world = await setup({ machines: [...MACHINES, hostFixture("host_gpu2", "gpu-box")], sources: [...SOURCES, { hostId: "host_gpu2", path: "/w2" }] });
    const ambiguous = await world.call("factoryman_dispatch", { ...TASK, machine: "gpu-box" });
    expect(ambiguous.text).toContain("machine_ambiguous");
    expect(world.store.listTasks()).toEqual([]);
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
  });

  it("[A806] blocks a machine that holds no source of the project", async () => {
    const world = await setup({ machines: [...MACHINES, hostFixture("host_edge", "edge-box")] });
    const result = await world.call("factoryman_dispatch", { ...TASK, machine: "edge-box" });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("machine_no_source");
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
    expect(world.store.listTasks()).toEqual([]);
  });

  it("[A807] returns ambiguous for matching rules that share a profile and name different machines", async () => {
    const world = await setup(
      {},
      rules(
        { id: "gpu", when: { kind: "ship" }, profile: "deep", machine: "gpu-box" },
        { id: "local", when: { kind: "ship" }, profile: "deep", machine: "local-box" },
      ),
    );
    const result = await world.call("factoryman_dispatch", TASK);
    expect(result.isError).toBe(true);
    expect(result.text).toContain("ambiguous");
    expect(result.text).toContain("gpu-box");
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
  });

  it.each([
    ["disconnected", hostFixture("host_gpu", "gpu-box", { status: "disconnected" })],
    ["not active", hostFixture("host_gpu", "gpu-box", { phase: "suspended" })],
  ])("[A808] blocks a pinned machine that is %s, tries no other machine, and creates no task", async (_label, gpu) => {
    const world = await setup({ machines: [hostFixture("host_local", "local-box"), gpu] });
    world.setProject({ defaultMachine: "local-box" });
    const result = await world.call("factoryman_dispatch", { ...TASK, machine: "gpu-box" });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("machine_offline");
    expect(result.text).toContain("gpu-box");
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
    expect(world.store.listTasks()).toEqual([]);
    expect(world.store.listEvents()).toEqual([]);
  });

  it("[A814] refuses a local-only dispatch to a machine other than the clone host, and spawns nothing", async () => {
    const world = await setup();
    world.setProject({ deliveryMode: "local-only" });
    const result = await world.call("factoryman_dispatch", { ...TASK, machine: "gpu-box" });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("machine_mismatch");
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
    expect(world.store.listTasks()).toEqual([]);
  });

  it("[A815] accepts a local-only dispatch to the host that holds the clone", async () => {
    const world = await setup();
    world.setProject({ deliveryMode: "local-only" });
    const result = await world.call("factoryman_dispatch", { ...TASK, machine: "local-box" });
    expect(result.isError).toBe(false);
    expect(world.store.getTask("t1")).toMatchObject({ mode: "local-only", state: "working", machine: "host_local" });
  });

  it("[A816] accepts a local-only dispatch with no machine, and runs it on the clone host", async () => {
    const world = await setup();
    world.setProject({ deliveryMode: "local-only" });
    expect((await world.call("factoryman_dispatch", TASK)).isError).toBe(false);
    expect(spawned(world).environment.hostId).toBe("host_local");
  });
});

describe("local-only without a clone host", () => {
  it("[A826] refuses a local-only dispatch to a machine when the project has no default source", async () => {
    const checkout = makeCheckout();
    const world = await loadWorld({
      machines: MACHINES,
      checkout,
      // The requested machine comes first, so a fallback that takes the first source as the clone would let it through.
      sources: [
        { hostId: "host_gpu", path: "/work/gpu", isDefault: false },
        { hostId: "host_local", path: checkout, isDefault: false },
      ],
    });
    world.setProject({ deliveryMode: "local-only" });
    const result = await world.call("factoryman_dispatch", { ...TASK, machine: "gpu-box" });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("machine_mismatch");
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
    expect(world.store.listTasks()).toEqual([]);
  });

  it("[A827] stops, and spawns nothing, when bb cannot list the machines", async () => {
    const world = await setup({ hostsError: new Error("bb is down") });
    const result = await world.call("factoryman_dispatch", { ...TASK, machine: "gpu-box" });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("could not read bb's machines");
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
    expect(world.store.listTasks()).toEqual([]);
  });
});
