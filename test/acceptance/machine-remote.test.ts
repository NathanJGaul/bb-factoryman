import { afterEach, describe, expect, it } from "vitest";
import { makeCheckout, removeCheckouts } from "../fixtures/checkout";
import { hostFixture, loadWorld, providerFixture, type RemoteRun, type World } from "../fixtures/plugin-host";

afterEach(removeCheckouts);

const MACHINES = [hostFixture("host_local", "local-box"), hostFixture("host_gpu", "gpu-box")];
const TASK = { kind: "ship", description: "Add a --json flag to the status command." } as const;
const line = (run: RemoteRun) => [run.command, ...run.args].join(" ");
const NM_INSTALLED = "sh -c command -v no-mistakes";
const NM_INIT = "git remote get-url no-mistakes";

async function setup(options: Parameters<typeof loadWorld>[0] = {}): Promise<World> {
  const checkout = makeCheckout();
  const sources = [
    { hostId: "host_local", path: checkout, isDefault: true },
    { hostId: "host_gpu", path: "/work/gpu", isDefault: false },
  ];
  return loadWorld({ machines: MACHINES, sources, checkout, ...options });
}

async function cli(world: World, argv: string[]): Promise<{ exitCode: number; text: string }> {
  const result = await world.host.harness.behavior.runCli(argv);
  return { exitCode: result.exitCode, text: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

describe("bb factoryman preflight through the plugin factory", () => {
  it("[A817] reports an agent CLI that is not available on the machine", async () => {
    const world = await setup({ providersByHost: { host_gpu: [providerFixture("claude", { available: false })] } });
    const report = await cli(world, ["preflight", "gpu-box", "--project", "proj-1"]);
    expect(report.exitCode).toBe(1);
    expect(report.text).toContain("agent_cli");
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
    expect(world.store.listEvents()).toEqual([]);
  });

  it.each([
    ["no-mistakes is not installed", NM_INSTALLED, "no_mistakes_installed"],
    ["the source is not initialized for no-mistakes", NM_INIT, "no_mistakes_initialized"],
  ])("[A818] reports a missing gate install when %s", async (_label, failing, check) => {
    const world = await setup();
    world.remote.handler = (run) => (line(run) === failing ? { code: 1, stdout: "", stderr: "" } : { code: 0, stdout: "", stderr: "" });
    const report = await cli(world, ["preflight", "gpu-box", "--project", "proj-1"]);
    expect(report.exitCode).toBe(1);
    expect(report.text).toContain(check);
    expect(world.remote.runs.every((run) => run.hostId === "host_gpu")).toBe(true);
  });

  it("[A819] reports missing gh credentials for the pull request modes and not for local-only", async () => {
    const world = await setup();
    world.remote.handler = (run) => (line(run) === "gh auth status" ? { code: 1, stdout: "", stderr: "not logged in" } : { code: 0, stdout: "", stderr: "" });
    for (const mode of ["no-mistakes", "direct-PR"] as const) {
      world.setProject({ deliveryMode: mode });
      expect((await cli(world, ["preflight", "gpu-box", "--project", "proj-1"])).text, mode).toContain("gh_credentials");
    }
    world.setProject({ deliveryMode: "local-only" });
    const local = await cli(world, ["preflight", "gpu-box", "--project", "proj-1"]);
    expect(local.exitCode).toBe(0);
    expect(local.text).not.toContain("gh_credentials");
  });
});

describe("dispatch to a remote machine", () => {
  it("[A820] blocks dispatch when the preflight fails, and spawns no worker", async () => {
    const world = await setup();
    world.remote.handler = (run) => (line(run) === NM_INSTALLED ? { code: 1, stdout: "", stderr: "" } : { code: 0, stdout: "", stderr: "" });
    const result = await world.call("factoryman_dispatch", { ...TASK, machine: "gpu-box" });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("preflight_failed");
    expect(result.text).toContain("no_mistakes_installed");
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
    expect(world.store.listTasks()).toEqual([]);
  });

  it("[A820] dispatches once the preflight passes, and does not repeat the checks for the next task", async () => {
    const world = await setup();
    expect((await world.call("factoryman_dispatch", { ...TASK, machine: "gpu-box" })).isError).toBe(false);
    const checks = world.remote.runs.length;
    expect(checks).toBeGreaterThan(0);
    expect((await world.call("factoryman_dispatch", { ...TASK, machine: "gpu-box" })).isError).toBe(false);
    expect(world.remote.runs.length).toBe(checks);
  });

  it("[A821] skips the preflight for the host that holds the clone", async () => {
    const world = await setup();
    const result = await world.call("factoryman_dispatch", { ...TASK, machine: "local-box" });
    expect(result.isError).toBe(false);
    expect(world.remote.runs).toEqual([]);
  });
});

describe("gate commands run where the worktree lives", () => {
  async function failedRemoteTask(world: World): Promise<void> {
    expect((await world.call("factoryman_dispatch", { ...TASK, machine: "gpu-box" })).isError).toBe(false);
    world.remote.runs.length = 0;
    world.paths.set("env-thr-w1", "/work/gpu/tree");
    const failed = await world.call("factoryman_report", { outcome: "failed", evidence: "Gave up." }, { threadId: "thr-w1" });
    expect(failed.isError).toBe(false);
  }

  it("[A822] runs the landed-work check of a remote task on its machine through a host terminal", async () => {
    const world = await setup();
    await failedRemoteTask(world);
    world.remote.handler = (run) => ({ code: 0, stdout: run.args[0] === "rev-list" ? "0\n" : "", stderr: "" });
    const result = await world.call("factoryman_teardown", { taskId: "t1" });
    expect(result.text).toBe("Task t1 is torn down.");
    expect(world.remote.runs.map((run) => `${run.hostId}:${run.cwd}:${line(run)}`)).toEqual([
      "host_gpu:/work/gpu/tree:git status --porcelain",
      "host_gpu:/work/gpu/tree:git rev-list --count HEAD --not --remotes",
    ]);
    expect(world.execCalls.filter((call) => call.command === "git")).toEqual([]);
  });

  it.each([
    ["a terminal that cannot start", (world: World) => void (world.remote.createError = new Error("host is gone"))],
    ["a terminal that never exits", (world: World) => void (world.remote.handler = () => "hang")],
    ["output that is truncated", (world: World) => void (world.remote.handler = () => "truncate")],
  ])("[A823] refuses teardown for %s, and records nothing", async (_label, break_) => {
    const world = await setup();
    await failedRemoteTask(world);
    break_(world);
    const result = await world.call("factoryman_teardown", { taskId: "t1" });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("Teardown refused");
    expect(world.store.getTask("t1")?.state).toBe("failed");
  });

  it("[A824] runs the landed-work check of a task with no machine on the server", async () => {
    const world = await setup();
    expect((await world.call("factoryman_dispatch", TASK)).isError).toBe(false);
    world.paths.set("env-thr-w1", "/work/tree");
    await world.call("factoryman_report", { outcome: "failed", evidence: "Gave up." }, { threadId: "thr-w1" });
    world.execHandler = (command, args) => ({ code: 0, stdout: command === "git" && args[0] === "rev-list" ? "0\n" : "", stderr: "" });
    expect((await world.call("factoryman_teardown", { taskId: "t1" })).text).toBe("Task t1 is torn down.");
    expect(world.remote.runs).toEqual([]);
    expect(world.execCalls.filter((call) => call.command === "git")).toHaveLength(2);
  });
});
