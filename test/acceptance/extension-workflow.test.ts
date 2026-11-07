import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { makeCheckout, removeCheckouts } from "../fixtures/checkout";
import { hostFixture, loadWorld, type World } from "../fixtures/plugin-host";

afterEach(removeCheckouts);

const TASK = { kind: "ship", description: "Add a --json flag to the status command." } as const;
const LINT = { name: "lint", argv: ["pnpm", "run", "lint"] };
const TEST = { name: "test", argv: ["pnpm", "test"] };

async function setup(workflow?: unknown, options: Parameters<typeof loadWorld>[0] = {}): Promise<{ world: World; checkout: string }> {
  const checkout = makeCheckout({ workflow });
  const world = await loadWorld({ checkout, ...options });
  return { world, checkout };
}

function writeWorkflow(checkout: string, text: string): void {
  mkdirSync(join(checkout, ".bb", "factoryman"), { recursive: true });
  writeFileSync(join(checkout, ".bb", "factoryman", "workflow.json"), text);
}

const handoff = (world: World) => world.store.listEvents({ taskId: "t1" }).find((row) => row.event === "handoff");
const report = (world: World, evidence = "Committed the change.", thread = "thr-w1") => world.call("factoryman_report", { outcome: "done", evidence }, { threadId: thread });

describe("workflow.json through the plugin factory", () => {
  it("[A901] changes nothing when there is no workflow.json", async () => {
    const { world } = await setup();
    expect((await world.call("factoryman_dispatch", TASK)).isError).toBe(false);
    expect((await report(world)).isError).toBe(false);
    expect(handoff(world)?.payload).toEqual({});
    expect(world.store.getTask("t1")?.state).toBe("validating");
  });

  it.each([
    ["bad JSON", "{ not json"],
    ["a schema error", JSON.stringify({ version: 1, checks: { "no-mistakes": [{ name: "x", argv: [] }] } })],
  ])("[A902] blocks dispatch and a done report for %s, and uses no default in its place", async (_label, bad) => {
    const blocked = await setup(bad);
    const refused = await blocked.world.call("factoryman_dispatch", TASK);
    expect(refused.isError).toBe(true);
    expect(refused.text).toContain("workflow.json");
    expect(blocked.world.store.listTasks()).toEqual([]);
    expect(blocked.world.sdkCalls("threads.spawn")).toEqual([]);

    const running = await setup();
    expect((await running.world.call("factoryman_dispatch", TASK)).isError).toBe(false);
    writeWorkflow(running.checkout, bad);
    const result = await report(running.world);
    expect(result.isError).toBe(true);
    expect(result.text).toContain("workflow.json");
    expect(running.world.store.getTask("t1")?.state).toBe("working");
  });

  it("[A903] fills a blank prefix and default machine from the file, and lets a stored value win", async () => {
    const machines = [hostFixture("host_local", "local-box"), hostFixture("host_gpu", "gpu-box")];
    const checkout = makeCheckout({ workflow: { version: 1, project: { branchPrefix: "wip/", defaultMachine: "gpu-box" } } });
    const sources = [{ hostId: "host_local", path: checkout, isDefault: true }, { hostId: "host_gpu", path: "/work/gpu" }];
    const filled = await loadWorld({ checkout, machines, sources });
    expect((await filled.call("factoryman_dispatch", TASK)).isError).toBe(false);
    expect(filled.store.getTask("t1")).toMatchObject({ branch: "wip/t1", machine: "host_gpu" });

    const kept = await loadWorld({ checkout, machines, sources });
    kept.setProject({ branchPrefix: "fm/", defaultMachine: "local-box" });
    expect((await kept.call("factoryman_dispatch", TASK)).isError).toBe(false);
    expect(kept.store.getTask("t1")).toMatchObject({ branch: "fm/t1", machine: "host_local" });
  });

  it("[A904] applies a file mode that is as strict as the stored mode, and blocks a looser one", async () => {
    const stricter = await setup({ version: 1, project: { deliveryMode: "no-mistakes" } });
    stricter.world.setProject({ deliveryMode: "direct-PR" });
    expect((await stricter.world.call("factoryman_dispatch", TASK)).isError).toBe(false);
    expect(stricter.world.store.getTask("t1")?.mode).toBe("no-mistakes");

    const looser = await setup({ version: 1, project: { deliveryMode: "local-only" } });
    const blocked = await looser.world.call("factoryman_dispatch", TASK);
    expect(blocked.isError).toBe(true);
    expect(blocked.text).toContain("less strict");
    expect(looser.world.store.listTasks()).toEqual([]);
    expect(looser.world.sdkCalls("threads.spawn")).toEqual([]);
  });

  it.each([
    ["yolo", { yolo: true }],
    ["gates", { gates: { merge: false } }],
    ["skip", { skip: ["evidence"] }],
    ["approval", { approval: "none" }],
    ["a gate key under project", { project: { yolo: true } }],
    ["a gate key in a check", { checks: { "no-mistakes": [{ ...LINT, skip: true }] } }],
  ])("[A905] rejects a file that sets %s, and names hard rule 7", async (_label, extra) => {
    const { world } = await setup({ version: 1, ...extra });
    const result = await world.call("factoryman_dispatch", TASK);
    expect(result.isError).toBe(true);
    expect(result.text).toContain("never remove a gate");
    expect(world.store.listTasks()).toEqual([]);
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
  });

  it("[A906] rejects project.baseBranch", async () => {
    const { world } = await setup({ version: 1, project: { baseBranch: "main" } });
    const result = await world.call("factoryman_dispatch", TASK);
    expect(result.isError).toBe(true);
    expect(result.text).toContain("landed-work check");
  });

  it("[A907] rejects any other unknown key", async () => {
    const { world } = await setup({ version: 1, surprise: 1 });
    const result = await world.call("factoryman_dispatch", TASK);
    expect(result.isError).toBe(true);
    expect(result.text).toContain("workflow.json");
    expect(world.store.listTasks()).toEqual([]);
  });
});

describe("custom checks through factoryman_report", () => {
  const WORKFLOW = { version: 1, checks: { "no-mistakes": [LINT, TEST] } };

  it("[A908] runs the checks in the worktree and records their results in the handoff event", async () => {
    const { world } = await setup(WORKFLOW);
    expect((await world.call("factoryman_dispatch", TASK)).isError).toBe(false);
    world.paths.set("env-thr-w1", "/work/tree");
    expect((await report(world)).isError).toBe(false);
    expect(handoff(world)?.payload).toEqual({ checks: [{ name: "lint", passed: true }, { name: "test", passed: true }] });
    const ran = world.execCalls.filter((call) => call.command === "pnpm").map((call) => ({ line: [call.command, ...call.args].join(" "), cwd: call.cwd }));
    expect(ran).toEqual([{ line: "pnpm run lint", cwd: "/work/tree" }, { line: "pnpm test", cwd: "/work/tree" }]);
  });

  it("[A921] runs the checks of a remote task on its machine", async () => {
    const checkout = makeCheckout({ workflow: WORKFLOW });
    const world = await loadWorld({
      checkout,
      machines: [hostFixture("host_local", "local-box"), hostFixture("host_gpu", "gpu-box")],
      sources: [{ hostId: "host_local", path: checkout, isDefault: true }, { hostId: "host_gpu", path: "/work/gpu" }],
    });
    expect((await world.call("factoryman_dispatch", { ...TASK, machine: "gpu-box" })).isError).toBe(false);
    world.remote.runs.length = 0;
    world.paths.set("env-thr-w1", "/work/gpu/tree");
    expect((await report(world)).isError).toBe(false);
    // The validator also runs on the machine once the handoff is recorded, so look at the checks only.
    expect(world.remote.runs.filter((run) => run.command === "pnpm").map((run) => `${run.hostId}:${run.cwd}:${run.command} ${run.args.join(" ")}`)).toEqual([
      "host_gpu:/work/gpu/tree:pnpm run lint",
      "host_gpu:/work/gpu/tree:pnpm test",
    ]);
    expect(world.execCalls.filter((call) => call.command === "pnpm")).toEqual([]);
  });

  it("[A909] refuses the event with check_failed, logs it, keeps the task working, and shows the worker the output", async () => {
    const { world } = await setup(WORKFLOW);
    await world.call("factoryman_dispatch", TASK);
    world.paths.set("env-thr-w1", "/work/tree");
    world.execHandler = (command, args) => (command === "pnpm" && args[0] === "test" ? { code: 1, stdout: "", stderr: "3 tests failed" } : { code: 0, stdout: "", stderr: "" });
    const result = await report(world);
    expect(result.isError).toBe(true);
    expect(result.text).toContain("check_failed");
    expect(result.text).toContain("test");
    expect(result.text).toContain("3 tests failed");
    expect(world.store.getTask("t1")?.state).toBe("working");
    const refused = world.store.listEvents({ taskId: "t1" }).findLast((row) => row.outcome === "refused");
    expect(refused).toMatchObject({ event: "handoff", reasonCode: "check_failed" });
    world.execHandler = () => ({ code: 0, stdout: "", stderr: "" });
    expect((await report(world)).isError).toBe(false);
    expect(world.store.getTask("t1")?.state).toBe("validating");
  });

  it("[A910] does not let passing checks stand in for another gate", async () => {
    const { world } = await setup(WORKFLOW);
    await world.call("factoryman_dispatch", TASK);
    world.paths.set("env-thr-w1", "/work/tree");
    const result = await report(world, "  ");
    expect(result.isError).toBe(true);
    expect(result.text).toContain("evidence_required");
    expect(world.store.getTask("t1")?.state).toBe("working");
  });

  it("[A911] counts a check that cannot run as failed", async () => {
    const { world } = await setup(WORKFLOW);
    await world.call("factoryman_dispatch", TASK);
    world.paths.set("env-thr-w1", "/work/tree");
    world.execHandler = () => ({ code: null as unknown as number, stdout: "", stderr: "", error: "spawn pnpm ENOENT" });
    const result = await report(world);
    expect(result.isError).toBe(true);
    expect(result.text).toContain("check_failed");
    expect(result.text).toContain("ENOENT");
  });

  it("[A922] refuses a report that has checks to run and no worktree path", async () => {
    const { world } = await setup(WORKFLOW);
    await world.call("factoryman_dispatch", TASK);
    const result = await report(world);
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/worktree/);
    expect(world.store.getTask("t1")?.state).toBe("working");
  });

  it("[A912] runs no check for a scout task", async () => {
    const { world } = await setup(WORKFLOW);
    await world.call("factoryman_dispatch", { ...TASK, kind: "scout" });
    world.paths.set("env-thr-w1", "/work/tree");
    expect((await report(world, "Findings.")).isError).toBe(false);
    expect(world.store.getTask("t1")?.state).toBe("report_ready");
    expect(world.execCalls.filter((call) => call.command === "pnpm")).toEqual([]);
  });
});

describe("custom checks on the ready path", () => {
  const WORKFLOW = { version: 1, checks: { "direct-PR": [LINT], "local-only": [TEST], "no-mistakes": [{ name: "never", argv: ["never-run"] }] } };
  const PR = "https://github.com/acme/widgets/pull/7";
  const ready = (world: World, extra: Record<string, unknown>) => world.call("factoryman_report", { outcome: "done", evidence: "Pushed.", ...extra }, { threadId: "thr-w1" });
  const readyRow = (world: World) => world.store.listEvents({ taskId: "t1" }).find((row) => row.event === "ready");

  it("[A919] records the direct-PR checks in the ready event, and runs no other mode's check", async () => {
    const { world } = await setup(WORKFLOW);
    world.setProject({ deliveryMode: "direct-PR" });
    await world.call("factoryman_dispatch", TASK);
    world.paths.set("env-thr-w1", "/work/tree");
    expect((await ready(world, { prUrl: PR })).isError).toBe(false);
    expect(readyRow(world)?.payload).toMatchObject({ checks: [{ name: "lint", passed: true }] });
    expect(world.execCalls.filter((call) => ["pnpm", "never-run"].includes(call.command)).map((call) => [call.command, ...call.args].join(" "))).toEqual(["pnpm run lint"]);
  });

  it("[A919] refuses a direct-PR ready event with check_failed when a check fails", async () => {
    const { world } = await setup(WORKFLOW);
    world.setProject({ deliveryMode: "direct-PR" });
    await world.call("factoryman_dispatch", TASK);
    world.paths.set("env-thr-w1", "/work/tree");
    world.execHandler = () => ({ code: 1, stdout: "", stderr: "lint is red" });
    const result = await ready(world, { prUrl: PR });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("check_failed");
    expect(result.text).toContain("lint is red");
    expect(world.store.getTask("t1")?.state).toBe("working");
  });

  it("[A919] runs the local-only checks and records them in the ready event", async () => {
    const { world } = await setup(WORKFLOW);
    world.setProject({ deliveryMode: "local-only" });
    await world.call("factoryman_dispatch", TASK);
    world.paths.set("env-thr-w1", "/work/tree");
    expect((await ready(world, { landedCommits: 2 })).isError).toBe(false);
    expect(readyRow(world)?.payload).toMatchObject({ landedCommits: 2, checks: [{ name: "test", passed: true }] });
  });

  it("[A920] gives the dispatch resolver the effective mode and not the stored one", async () => {
    const checkout = makeCheckout({
      workflow: { version: 1, project: { deliveryMode: "no-mistakes" } },
      dispatch: {
        version: 1,
        profiles: { strict: { provider: "claude", model: "opus", reasoningLevel: "xhigh", permissionMode: "auto" } },
        rules: [{ id: "strict-mode", when: { mode: "no-mistakes" }, profile: "strict" }],
      },
    });
    const world = await loadWorld({ checkout });
    world.setProject({ deliveryMode: "direct-PR" });
    expect((await world.call("factoryman_dispatch", TASK)).isError).toBe(false);
    expect(world.store.getTask("t1")?.mode).toBe("no-mistakes");
    const [[spawn]] = world.sdkCalls("threads.spawn") as [[{ model: string }]];
    expect(spawn.model).toBe("opus");
  });
});
