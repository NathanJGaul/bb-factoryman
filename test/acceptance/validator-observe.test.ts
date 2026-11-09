import { afterEach, describe, expect, it } from "vitest";
import { FakeValidator } from "../../src/validator/fake";
import { READ_SCRIPT } from "../../src/validator/agent";
import { makeCheckout, removeCheckouts } from "../fixtures/checkout";
import { hostFixture, loadWorld, providerFixture, stateFixture, DISPATCH, type RemoteRun, type World } from "../fixtures/plugin-host";

afterEach(removeCheckouts);

const worker = { threadId: "thr-w1" };
const WORK = "Committed abc123.";
const PR = "https://github.com/acme/widgets/pull/7";
const isRead = (call: { command: string; args: readonly string[] }) => call.command === "sh" && call.args[1] === READ_SCRIPT;
const answer = (text: string | { code: number; stderr: string }) =>
  typeof text === "string" ? { code: 0, stdout: text, stderr: "" } : { code: text.code, stdout: "", stderr: text.stderr };
const READY = [stateFixture("claude"), stateFixture("claude-code")];

/** A world with the given states on the server, the configuration answer for the server's read, and a `no-mistakes` project. */
async function local(config: string | { code: number; stderr: string }, states: unknown[] = READY, mode: "no-mistakes" | "direct-PR" | "local-only" = "no-mistakes") {
  const world = await loadWorld({ validator: new FakeValidator(), providerStates: states, providers: [providerFixture("claude"), providerFixture("claude-code"), providerFixture("codex")] });
  world.setProject({ deliveryMode: mode });
  world.execHandler = (command, args) => (command === "sh" && args[1] === READ_SCRIPT ? answer(config) : { code: 0, stdout: "", stderr: "" });
  return world;
}

async function handoff(world: World, args: Record<string, unknown> = { outcome: "done", evidence: WORK }, task: Record<string, unknown> = DISPATCH) {
  await world.call("factoryman_dispatch", task);
  return world.call("factoryman_report", args, worker);
}
const evidence = (world: World) => world.store.listEvents({ taskId: "t1" }).find((row) => row.event === "handoff" && row.outcome === "applied")?.evidence;
/** A pattern that matches this whole line and nothing else. */
const exactly = (text: string): RegExp => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
const CODEX_DOWN = [...READY, stateFixture("codex", { status: "unauthenticated", localLoginCommand: "codex login" })];

describe("the validator line of a hand-off, through the plugin factory", () => {
  it("[A1608] puts the worker's evidence first and the line for a ready agent after a blank line, and the task becomes validating", async () => {
    const world = await local("agent: claude\n");
    expect((await handoff(world)).isError).toBe(false);
    expect(world.store.getTask("t1")?.state).toBe("validating");
    expect(evidence(world)).toBe(`${WORK}\n\nValidator agent: claude (bb provider claude-code) is ready on the default host.`);
  });

  it("[A1609] names an agent that bb reports as unauthenticated, with bb's remedy, and the task still becomes validating", async () => {
    const world = await local("agent: codex\n", CODEX_DOWN);
    expect((await handoff(world)).isError).toBe(false);
    expect(world.store.getTask("t1")?.state).toBe("validating");
    expect(evidence(world)).toContain("Validator agent: codex (bb provider codex) is not ready on the default host: ");
    expect(evidence(world)).toContain("Run `codex login` on that machine");
  });

  it("[A1610] writes the right line for a list, for auto and for no file, for an unmapped agent, and for an unreadable configuration", async () => {
    const cases: Array<[string, string | { code: number; stderr: string }, RegExp]> = [
      ["a list", "agent: [codex, claude]\n", /^Validator agents, in order: codex \(bb provider codex\) is not ready on the default host: .*; claude \(bb provider claude-code\) is ready on the default host\.$/s],
      ["auto", "agent: auto\n", /Validator agent: auto\. no-mistakes picks the first runnable agent when the run starts\. bb reports ready on the default host: claude-code\.$/],
      ["no file", { code: 3, stderr: "" }, /Validator agent: auto \(the host has no no-mistakes configuration file, so the default applies\)\. no-mistakes picks/],
      ["an unmapped agent", "agent: copilot\n", exactly("Validator agent: copilot has no known bb provider, so its readiness was not checked.")],
      ["an unreadable configuration", "agent: [codex\n", exactly("Validator agent: could not be observed on the default host (the `agent` list is not closed (a flow list ends with `]`)), so its readiness is not known.")],
      ["a read that fails", { code: 1, stderr: "Permission denied" }, exactly("Validator agent: could not be observed on the default host (the read exited 1: Permission denied), so its readiness is not known.")],
    ];
    for (const [label, config, pattern] of cases) {
      const world = await local(config, CODEX_DOWN);
      expect((await handoff(world)).isError, label).toBe(false);
      expect(world.store.getTask("t1")?.state, label).toBe("validating");
      const line = evidence(world)?.split("\n\n")[1] ?? "";
      expect(line, label).toMatch(pattern);
    }
  });
});

const MACHINES = [hostFixture("host_local", "local-box"), hostFixture("host_gpu", "gpu-box")];
const GPU_STATES = { host_gpu: [stateFixture("claude"), stateFixture("claude-code"), stateFixture("codex", { status: "unauthenticated", localLoginCommand: "codex login" })] };

async function remote(config: string | { code: number; stderr: string }, mode: "no-mistakes" | "direct-PR" | "local-only" = "no-mistakes", extra: Parameters<typeof loadWorld>[0] = {}) {
  const checkout = makeCheckout();
  const sources = [
    { hostId: "host_local", path: checkout, isDefault: true },
    { hostId: "host_gpu", path: "/work/gpu", isDefault: false },
  ];
  const world = await loadWorld({ machines: MACHINES, sources, checkout, validator: new FakeValidator(), providerStatesByHost: GPU_STATES, ...extra });
  world.setProject({ deliveryMode: mode });
  world.remote.handler = (run: RemoteRun) => (run.command === "sh" && run.args[1] === READ_SCRIPT ? answer(config) : { code: 0, stdout: "", stderr: "" });
  return world;
}
const remoteReads = (world: World) => world.remote.runs.filter((run) => run.command === "sh" && run.args[1] === READ_SCRIPT);

describe("the validator observation on a remote machine and in the preflight", () => {
  it("[A1611] reads the configuration and the provider states of the task's machine and not the server's, and adds no line for direct-PR, local-only, or a scout", async () => {
    // The server's own answers say codex and not ready. Only a read on gpu-box can produce the line below.
    const world = await remote("agent: claude\n");
    world.execHandler = (command, args) => (command === "sh" && args[1] === READ_SCRIPT ? answer("agent: codex\n") : { code: 0, stdout: "", stderr: "" });
    await handoff(world, undefined, { ...DISPATCH, machine: "gpu-box" });
    expect(world.store.getTask("t1")?.state).toBe("validating");
    expect(remoteReads(world).length).toBeGreaterThanOrEqual(1);
    expect(remoteReads(world).every((run) => run.hostId === "host_gpu")).toBe(true);
    expect(world.execCalls.filter(isRead)).toEqual([]);
    expect(evidence(world)).toBe(`${WORK}\n\nValidator agent: claude (bb provider claude-code) is ready on gpu-box.`);
    expect(world.sdkCalls("system.providerStates").some(([args]) => (args as { hostId?: string } | undefined)?.hostId === "host_gpu")).toBe(true);

    for (const [label, mode, kind, args] of [
      ["direct-PR", "direct-PR", "ship", { outcome: "done", evidence: WORK, prUrl: PR }],
      ["local-only", "local-only", "ship", { outcome: "done", evidence: WORK, landedCommits: 1 }],
      ["a scout", "no-mistakes", "scout", { outcome: "done", evidence: WORK }],
    ] as const) {
      const other = await remote("agent: claude\n", mode);
      await handoff(other, args, { ...DISPATCH, kind });
      expect(other.store.listEvents({ taskId: "t1" }).at(-1)?.evidence, label).toBe(WORK);
      expect(other.execCalls.filter(isRead), label).toEqual([]);
      expect(remoteReads(other), label).toEqual([]);
    }
  });

  it("[A1612] exits 1 with a validator_agent problem, or 0 and names the agent, and refuses a dispatch to the machine with an unready agent", async () => {
    const down = await remote("agent: codex\n");
    const failed = await down.host.harness.behavior.runCli(["preflight", "gpu-box", "--project", "proj-1"]);
    expect(failed.exitCode).toBe(1);
    expect(failed.stdout).toContain("validator_agent: codex (bb provider codex) is not ready on gpu-box");

    const dispatched = await down.call("factoryman_dispatch", { ...DISPATCH, machine: "gpu-box" });
    expect(dispatched.isError).toBe(true);
    expect(dispatched.text).toContain("Dispatch blocked (preflight_failed)");
    expect(dispatched.text).toContain("validator_agent");
    expect(down.store.listTasks()).toEqual([]);
    expect(down.sdkCalls("threads.spawn")).toEqual([]);

    const up = await remote("agent: claude\n");
    const ready = await up.host.harness.behavior.runCli(["preflight", "gpu-box", "--project", "proj-1"]);
    expect(ready.exitCode).toBe(0);
    expect(ready.stdout).toContain("Validator agent: claude (bb provider claude-code) is ready on gpu-box.");

    const unreadable = await remote({ code: 1, stderr: "Permission denied" });
    const unobserved = await unreadable.host.harness.behavior.runCli(["preflight", "gpu-box", "--project", "proj-1"]);
    expect(unobserved.exitCode).toBe(1);
    expect(unobserved.stdout).toContain("validator_agent: could not be observed on gpu-box");

    const direct = await remote("agent: codex\n", "direct-PR");
    expect((await direct.host.harness.behavior.runCli(["preflight", "gpu-box", "--project", "proj-1"])).exitCode).toBe(0);
    expect(remoteReads(direct)).toEqual([]);

    const clone = await remote("agent: codex\n");
    const skipped = await clone.host.harness.behavior.runCli(["preflight", "local-box", "--project", "proj-1"]);
    expect(skipped.exitCode).toBe(0);
    expect(skipped.stdout).toContain("holds the project's clone");
    expect(remoteReads(clone)).toEqual([]);
  });

  it("[A1613] runs nothing but the one read command and the project's own checks, and the read writes nothing", async () => {
    const worlds: World[] = [];
    const a = await local("agent: claude\n");
    await handoff(a);
    worlds.push(a);
    const b = await remote("agent: claude\n");
    await handoff(b, undefined, { ...DISPATCH, machine: "gpu-box" });
    await b.host.harness.behavior.runCli(["preflight", "gpu-box", "--project", "proj-1"]);
    worlds.push(b);

    const lines = worlds.flatMap((world) => [...world.execCalls.map((call) => [call.command, ...call.args]), ...world.remote.runs.map((run) => [run.command, ...run.args])]);
    // The observations are the calls that mention the configuration file, and every one is the single contract script.
    const observations = lines.filter((line) => line.some((part) => part.includes("config.yaml")));
    expect(observations.length).toBeGreaterThanOrEqual(3);
    for (const line of observations) expect(line).toEqual(["sh", "-c", READ_SCRIPT]);
    expect(READ_SCRIPT).not.toMatch(/[>]|\b(tee|rm|mv|cp|touch|mkdir|sed|chmod|dd|ln)\b/);
    // Nothing else of the observation reaches no-mistakes: the plugin ran no no-mistakes command here.
    expect(lines.filter((line) => line[0] === "no-mistakes")).toEqual([]);
  });
});
