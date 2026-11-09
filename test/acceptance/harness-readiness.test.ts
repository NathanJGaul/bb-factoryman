import { afterEach, describe, expect, it } from "vitest";
import { makeCheckout, removeCheckouts } from "../fixtures/checkout";
import { DISPATCH, hostFixture, loadWorld, stateFixture, type World } from "../fixtures/plugin-host";

afterEach(removeCheckouts);

const MACHINES = [hostFixture("host_local", "local-box"), hostFixture("host_gpu", "gpu-box")];
const READY = [stateFixture("claude"), stateFixture("claude-code")];
const dispatch = (world: World, extra: Record<string, unknown> = {}) => world.call("factoryman_dispatch", { ...DISPATCH, ...extra });

/** A blocked dispatch leaves no task and no worker. */
function expectNothingCreated(world: World): void {
  expect(world.store.listTasks()).toEqual([]);
  expect(world.sdkCalls("threads.spawn")).toEqual([]);
}

async function remoteWorld(options: Parameters<typeof loadWorld>[0] = {}): Promise<World> {
  const checkout = makeCheckout();
  const sources = [
    { hostId: "host_local", path: checkout, isDefault: true },
    { hostId: "host_gpu", path: "/work/gpu", isDefault: false },
  ];
  return loadWorld({ machines: MACHINES, sources, checkout, ...options });
}

describe("the readiness gate through the plugin factory", () => {
  it("[A1301] blocks a provider that is not signed in, names the provider, the host, and bb's login command, and creates nothing", async () => {
    const world = await loadWorld({ providerStates: [stateFixture("claude", { status: "unauthenticated", localLoginCommand: "claude login" })] });
    const result = await dispatch(world);
    expect(result.isError).toBe(true);
    expect(result.text).toContain("Dispatch blocked (provider_unavailable)");
    expect(result.text).toContain("The provider `claude` is not signed in on the default host (bb status: unauthenticated). Run `claude login` on that machine.");
    expect(result.text).toContain("No task was created.");
    expectNothingCreated(world);
  });

  it.each([
    ["not_installed", "is not installed on the default host (bb status: not_installed)"],
    ["expired", "has an expired login on the default host (bb status: expired)"],
  ])("[A1302] blocks a provider whose bb status is %s, and carries that status", async (status, text) => {
    const world = await loadWorld({ providerStates: [stateFixture("claude", { status })] });
    const result = await dispatch(world);
    expect(result.isError).toBe(true);
    expect(result.text).toContain(text);
    expectNothingCreated(world);
  });

  it("[A1303] blocks a version that is too old and shows the installed and the minimum version", async () => {
    const world = await loadWorld({ providerStates: [stateFixture("claude", { status: "unsupported_version", installedVersion: "0.100.0", minimumSupportedVersion: "0.136.0" })] });
    const result = await dispatch(world);
    expect(result.isError).toBe(true);
    expect(result.text).toContain("installed 0.100.0, minimum 0.136.0");
    expectNothingCreated(world);
  });

  it.each([
    ["status unknown", { providerStates: [stateFixture("claude", { status: "unknown", statusMessage: "CLI timed out" })] }, "CLI timed out"],
    ["no state for the provider", { providerStates: [stateFixture("codex")] }, "bb reports no state for the provider `claude`"],
    ["a failed read of the states", { providerStatesError: new Error("HTTP 500") }, "could not read bb's provider states (HTTP 500)"],
    ["a status the plugin does not know", { providerStates: [stateFixture("claude", { status: "rate_limited" })] }, "bb status: unknown"],
  ])("[A1304] blocks on %s and creates nothing", async (_label, options, text) => {
    const world = await loadWorld(options);
    const result = await dispatch(world);
    expect(result.isError).toBe(true);
    expect(result.text).toContain(text);
    expect(result.text).toContain("No task was created.");
    expectNothingCreated(world);
  });

  it("[A1305] judges a task pinned to a remote machine by that machine's states, in both directions", async () => {
    const lockedGpu = await remoteWorld({ providerStatesByHost: { host_gpu: [stateFixture("claude", { status: "unauthenticated", localLoginCommand: "claude login" })] } });
    const blocked = await dispatch(lockedGpu, { machine: "gpu-box" });
    expect(blocked.isError).toBe(true);
    expect(blocked.text).toContain("is not signed in on gpu-box");
    expectNothingCreated(lockedGpu);
    // The default host's states would have passed it.
    expect((await dispatch(lockedGpu)).isError).toBe(false);

    const lockedServer = await remoteWorld({ providerStates: [stateFixture("claude", { status: "unauthenticated" })], providerStatesByHost: { host_gpu: READY } });
    const passed = await dispatch(lockedServer, { machine: "gpu-box" });
    expect(passed.isError).toBe(false);
    expect(lockedServer.sdkCalls("threads.spawn")).toHaveLength(1);
  });

  it("[A1306] gives the preflight of a remote machine the same remedy text as dispatch", async () => {
    const states = { host_gpu: [stateFixture("claude", { status: "unauthenticated", localLoginCommand: "claude login" })] };
    const world = await remoteWorld({ providerStatesByHost: states });
    const sentence = "The provider `claude` is not signed in on gpu-box (bb status: unauthenticated). Run `claude login` on that machine.";
    const report = await world.host.harness.behavior.runCli(["preflight", "gpu-box", "--project", "proj-1", "--provider", "claude"]);
    expect(report.exitCode).toBe(1);
    expect(`${report.stdout ?? ""}${report.stderr ?? ""}`).toContain(sentence);
    expect((await dispatch(world, { machine: "gpu-box" })).text).toContain(sentence);
  });

  it("[A1307] keeps a queued task queued while its provider is not ready, and starts it once the provider is ready", async () => {
    const world = await loadWorld({ checkout: makeCheckout({ workflow: { version: 1, limits: { maxWorkers: 1 } } }) });
    expect((await dispatch(world)).isError).toBe(false);
    expect((await dispatch(world)).text).toMatch(/Task t2 is queued/);
    world.setProviderStates([stateFixture("claude", { status: "unauthenticated" })]);
    await world.call("factoryman_report", { outcome: "failed", evidence: "Gave up." }, { threadId: "thr-w1" });
    expect(world.store.getTask("t2")?.state).toBe("queued");
    expect(world.sdkCalls("threads.spawn")).toHaveLength(1);
    world.setProviderStates();
    await world.runStartup();
    expect(world.store.getTask("t2")?.state).toBe("working");
    expect(world.sdkCalls("threads.spawn")).toHaveLength(2);
  });

  it("[A1308] dispatches as before when every state is ready", async () => {
    const world = await loadWorld({ providerStates: READY });
    const result = await dispatch(world);
    expect(result.isError).toBe(false);
    expect(result.text).toContain("Dispatched ship task t1");
    expect(world.sdkCalls("threads.spawn")).toHaveLength(1);
    expect(world.store.getTask("t1")?.state).toBe("working");
  });

  it("[A1309] uses no slot of the day cap for a blocked dispatch", async () => {
    const world = await loadWorld({ checkout: makeCheckout({ workflow: { version: 1, limits: { maxTasksPerDay: 1 } } }), providerStates: [stateFixture("claude", { status: "not_installed" })] });
    expect((await dispatch(world)).isError).toBe(true);
    expect(world.store.listTasks()).toEqual([]);
    world.setProviderStates();
    const second = await dispatch(world);
    expect(second.isError).toBe(false);
    expect(world.store.listTasks()).toHaveLength(1);
  });
});
