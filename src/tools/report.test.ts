import { describe, expect, it } from "vitest";
import { providerState } from "../../test/fixtures/bb-port";
import { DISPATCH_ARGS, SUPERVISOR, WORKER, testRuntime, withDispatchedTask, type TestRuntime } from "../../test/fixtures/runtime";
import { defaultProjectConfig } from "../store/store";
import { answerRead, isRead, type ReadAnswer } from "../../test/fixtures/validator-read";
import { dispatch } from "./dispatch";
import { report } from "./report";

const PR = "https://github.com/acme/widgets/pull/7";

describe("factoryman_report", () => {
  it("[U52] records report for a scout done and the task becomes report_ready", async () => {
    const t = await withDispatchedTask({ kind: "scout" });
    const outcome = await report(t.runtime, WORKER, { outcome: "done", evidence: "Found three call sites." });
    expect(outcome).toEqual({ ok: true, text: "Task t1 is now report_ready." });
    expect(t.runtime.deps.store.listEvents({ taskId: "t1" }).at(-1)).toMatchObject({ event: "report", actor: "worker", evidence: "Found three call sites." });
  });

  it("[U53] records handoff for a no-mistakes ship done and the task becomes validating", async () => {
    const t = await withDispatchedTask();
    await report(t.runtime, WORKER, { outcome: "done", evidence: "Committed abc123." });
    expect(t.runtime.deps.store.getTask("t1")?.state).toBe("validating");
    expect(t.runtime.deps.store.listEvents({ taskId: "t1" }).at(-1)?.event).toBe("handoff");
  });

  it("[U54] records ready for a direct-PR ship done with a pull request URL", async () => {
    const t = await withDispatchedTask({ mode: "direct-PR" });
    await report(t.runtime, WORKER, { outcome: "done", evidence: "PR open.", prUrl: PR });
    expect(t.runtime.deps.store.getTask("t1")).toMatchObject({ state: "review_ready", pullRequestUrl: PR });
  });

  it("[U55] refuses a direct-PR ship done without a pull request URL", async () => {
    const t = await withDispatchedTask({ mode: "direct-PR" });
    const outcome = await report(t.runtime, WORKER, { outcome: "done", evidence: "PR open." });
    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("mode_check_failed");
    expect(t.runtime.deps.store.getTask("t1")?.state).toBe("working");
  });

  it("[U56] records ready for a local-only ship done with one landed commit, and refuses zero", async () => {
    const one = await withDispatchedTask({ mode: "local-only" });
    await report(one.runtime, WORKER, { outcome: "done", evidence: "Landed.", landedCommits: 1 });
    expect(one.runtime.deps.store.getTask("t1")?.state).toBe("review_ready");
    const none = await withDispatchedTask({ mode: "local-only" });
    const outcome = await report(none.runtime, WORKER, { outcome: "done", evidence: "Nothing.", landedCommits: 0 });
    expect(outcome.ok).toBe(false);
    expect(none.runtime.deps.store.getTask("t1")?.state).toBe("working");
  });

  it("[U57] records block for blocked and fail for failed", async () => {
    const blocked = await withDispatchedTask();
    await report(blocked.runtime, WORKER, { outcome: "blocked", evidence: "Needs a credential." });
    expect(blocked.runtime.deps.store.getTask("t1")?.state).toBe("blocked");
    const failed = await withDispatchedTask();
    await report(failed.runtime, WORKER, { outcome: "failed", evidence: "Cannot build." });
    expect(failed.runtime.deps.store.getTask("t1")?.state).toBe("failed");
  });

  it("[U58] refuses blank or whitespace evidence and leaves a refused log row", async () => {
    for (const evidence of ["", "   \n"]) {
      const t = await withDispatchedTask();
      const outcome = await report(t.runtime, WORKER, { outcome: "done", evidence });
      expect(outcome.ok).toBe(false);
      expect(outcome.text).toContain("evidence_required");
      expect(t.runtime.deps.store.getTask("t1")?.state).toBe("working");
      expect(t.runtime.deps.store.listEvents({ taskId: "t1" }).at(-1)).toMatchObject({ event: "handoff", outcome: "refused", reasonCode: "evidence_required" });
    }
  });

  it("[U59] records the worker as the actor", async () => {
    const t = await withDispatchedTask();
    await report(t.runtime, WORKER, { outcome: "blocked", evidence: "Waiting." });
    expect(t.runtime.deps.store.listEvents({ taskId: "t1" }).at(-1)?.actor).toBe("worker");
  });

  it("[U60] refuses a caller that is not a recorded worker", async () => {
    const t = await withDispatchedTask();
    const outcome = await report(t.runtime, { threadId: "thr-other", projectId: "proj-1" }, { outcome: "done", evidence: "x" });
    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("actor_forbidden");
    expect(t.runtime.deps.store.getTask("t1")?.state).toBe("working");
  });

  it("[U61] names the new state in the result", async () => {
    const t = await withDispatchedTask();
    expect((await report(t.runtime, WORKER, { outcome: "blocked", evidence: "Waiting." })).text).toBe("Task t1 is now blocked.");
  });
});

describe("factoryman_report custom checks", () => {
  const WORKFLOW_PATH = "/work/repo/.bb/factoryman/workflow.json";
  const workflow = (checks: Record<string, unknown>) => JSON.stringify({ version: 1, checks });

  async function withChecks(text: string = workflow({ "no-mistakes": [{ name: "lint", argv: ["pnpm", "run", "lint"] }] })) {
    const t = await withDispatchedTask();
    t.bb.checkouts.set("proj-1", "/work/repo");
    t.files.files.set(WORKFLOW_PATH, text);
    t.bb.envPaths.set("env-thr-w1", "/work/tree");
    return t;
  }
  const ran = (t: Awaited<ReturnType<typeof withChecks>>) => t.execCalls.filter((call) => call.command === "pnpm");

  it("[U937] blocks a done report, runs nothing, and records nothing when bb cannot read the project", async () => {
    const t = await withChecks();
    t.bb.checkoutError = new Error("bb is down");
    const before = t.runtime.deps.store.listEvents({ taskId: "t1" }).length;
    const outcome = await report(t.runtime, WORKER, { outcome: "done", evidence: "Committed." });
    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("could not read the project");
    expect(ran(t)).toEqual([]);
    expect(t.runtime.deps.store.listEvents({ taskId: "t1" })).toHaveLength(before);
    expect(t.runtime.deps.store.getTask("t1")?.state).toBe("working");
  });

  it.each([
    ["the worker thread", (t: Awaited<ReturnType<typeof withChecks>>) => void (t.bb.getThreadError = new Error("bb is down"))],
    ["the worktree path", (t: Awaited<ReturnType<typeof withChecks>>) => void (t.bb.envPathError = new Error("bb is down"))],
  ])("[U938] blocks a done report, runs nothing, and records nothing when bb cannot read %s", async (_label, break_) => {
    const t = await withChecks();
    break_(t);
    const before = t.runtime.deps.store.listEvents({ taskId: "t1" }).length;
    const outcome = await report(t.runtime, WORKER, { outcome: "done", evidence: "Committed." });
    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("Cannot run the custom checks");
    expect(ran(t)).toEqual([]);
    expect(t.runtime.deps.store.listEvents({ taskId: "t1" })).toHaveLength(before);
  });

  it.each([
    ["failing checks", workflow({ "no-mistakes": [{ name: "lint", argv: ["pnpm", "run", "lint"] }] })],
    ["an invalid file", "{ not json"],
  ])("[U939] lets a worker report blocked and failed, and runs no check, with %s", async (_label, text) => {
    for (const outcome of ["blocked", "failed"] as const) {
      const t = await withChecks(text);
      t.execHandler = () => ({ code: 1, stdout: "", stderr: "lint failed" });
      const result = await report(t.runtime, WORKER, { outcome, evidence: "Cannot go on." });
      expect(result.ok, outcome).toBe(true);
      expect(t.runtime.deps.store.getTask("t1")?.state).toBe(outcome === "blocked" ? "blocked" : "failed");
      expect(ran(t), outcome).toEqual([]);
    }
  });

  it("[U943] gives a check with no timeout of its own the default timeout", async () => {
    const t = await withChecks();
    const seen: Array<number | undefined> = [];
    t.runtime.deps.exec = async (command, _args, options) => {
      if (command === "pnpm") seen.push(options?.timeoutMs);
      return { code: 0, stdout: "", stderr: "" };
    };
    await report(t.runtime, WORKER, { outcome: "done", evidence: "Committed." });
    expect(seen).toEqual([600_000]);
  });
});

describe("factoryman_report: the validator line of a hand-off", () => {
  const reads = (t: TestRuntime) => t.execCalls.filter((call) => isRead(call.command, call.args));
  const handoff = (t: TestRuntime) => t.runtime.deps.store.listEvents({ taskId: "t1" }).find((row) => row.event === "handoff" && row.outcome === "applied");
  const WORK = "Committed abc123.";

  /** Script the answer of the configuration read, and let every other command succeed. */
  const config = (t: TestRuntime, answer: ReadAnswer): void => void (t.execHandler = answerRead(answer));

  /** A `no-mistakes` project with one task on the remote machine gpu-box. */
  async function remoteTask(): Promise<TestRuntime> {
    const t = testRuntime();
    t.bb.addThread({ id: SUPERVISOR.threadId });
    t.runtime.deps.store.putProjectConfig({ ...defaultProjectConfig("proj-1"), deliveryMode: "no-mistakes" });
    t.bb.machines.push({ id: "host_gpu", name: "gpu-box", status: "connected", phase: "active", online: true });
    t.bb.sources.push({ hostId: "host_gpu", path: "/work/gpu", isDefault: false });
    const outcome = await dispatch(t.runtime, SUPERVISOR, { ...DISPATCH_ARGS, machine: "gpu-box" });
    if (!outcome.ok) throw new Error(`fixture dispatch failed: ${outcome.text}`);
    return t;
  }

  it("[U1699] puts the worker's evidence first, then a blank line, then the validator line, in the handoff event", async () => {
    const t = await withDispatchedTask();
    config(t, "agent: claude\n");
    await report(t.runtime, WORKER, { outcome: "done", evidence: WORK });
    expect(handoff(t)?.evidence).toBe(`${WORK}\n\nValidator agent: claude (bb provider claude-code) is ready on the default host.`);
    expect(reads(t)).toHaveLength(1);
  });

  it.each([
    ["an agent that is not ready", "agent: codex\n", "Validator agent: codex (bb provider codex) is not ready on the default host: "],
    ["an agent that cannot be observed", { code: 1, stderr: "Permission denied" }, "Validator agent: could not be observed on the default host ("],
    ["an agent with no known provider", "agent: copilot\n", "Validator agent: copilot has no known bb provider, so its readiness was not checked."],
  ] as const)("[U1700] still moves the task to validating for %s, and says so in the line", async (_label, answer, expected) => {
    const t = await withDispatchedTask();
    t.bb.states = [providerState("claude"), providerState("claude-code"), providerState("codex", { status: "unauthenticated", localLoginCommand: "codex login" })];
    config(t, answer);
    const outcome = await report(t.runtime, WORKER, { outcome: "done", evidence: WORK });
    expect(outcome.ok).toBe(true);
    expect(t.runtime.deps.store.getTask("t1")?.state).toBe("validating");
    expect(handoff(t)?.evidence).toContain(expected);
    expect(handoff(t)?.evidence?.startsWith(`${WORK}\n\n`)).toBe(true);
  });

  it("[U1701] never refuses the hand-off when the observation throws", async () => {
    const t = await withDispatchedTask();
    t.runtime.deps.exec = async () => {
      throw new Error("terminal exploded");
    };
    const outcome = await report(t.runtime, WORKER, { outcome: "done", evidence: WORK });
    expect(outcome.ok).toBe(true);
    expect(t.runtime.deps.store.getTask("t1")?.state).toBe("validating");
    expect(handoff(t)?.evidence).toContain("could not be observed");
    expect(handoff(t)?.evidence).toContain("terminal exploded");

    const remote = await remoteTask();
    const readsBefore = reads(remote).length; // the dispatch to the machine ran its own preflight read
    remote.bb.sourcesError = new Error("bb is down");
    const unplaced = await report(remote.runtime, WORKER, { outcome: "done", evidence: WORK });
    expect(unplaced.ok).toBe(true);
    expect(remote.runtime.deps.store.getTask("t1")?.state).toBe("validating");
    expect(handoff(remote)?.evidence).toContain("could not place the task's host (bb is down)");
    expect(reads(remote)).toHaveLength(readsBefore);
  });

  it("[U1702] adds no line and runs no read for direct-PR, local-only, scout, blocked, and failed reports", async () => {
    const cases: Array<[string, Parameters<typeof withDispatchedTask>[0], Record<string, unknown>]> = [
      ["direct-PR", { mode: "direct-PR" }, { outcome: "done", evidence: WORK, prUrl: PR }],
      ["local-only", { mode: "local-only" }, { outcome: "done", evidence: WORK, landedCommits: 1 }],
      ["scout", { kind: "scout" }, { outcome: "done", evidence: WORK }],
      ["blocked", {}, { outcome: "blocked", evidence: WORK }],
      ["failed", {}, { outcome: "failed", evidence: WORK }],
    ];
    for (const [label, options, args] of cases) {
      const t = await withDispatchedTask(options);
      config(t, "agent: claude\n");
      const outcome = await report(t.runtime, WORKER, args);
      expect(outcome.ok, label).toBe(true);
      const last = t.runtime.deps.store.listEvents({ taskId: "t1" }).at(-1);
      expect(last?.evidence, label).toBe(WORK);
      expect(reads(t), label).toEqual([]);
    }
  });

  it("[U1703] reads the configuration and the provider states of the task's machine, and names the machine", async () => {
    const t = await remoteTask();
    config(t, "agent: claude\n");
    t.bb.statesByHost.set("host_gpu", [providerState("claude"), providerState("claude-code")]);
    const readsBefore = reads(t).length; // the dispatch to the machine ran its own preflight read
    await report(t.runtime, WORKER, { outcome: "done", evidence: WORK });
    expect(reads(t)).toHaveLength(readsBefore + 1);
    expect(reads(t).at(-1)).toMatchObject({ host: "host_gpu", timeoutMs: 30_000 });
    expect(t.bb.callsTo("getProviderStates").at(-1)).toEqual(["host_gpu"]);
    expect(handoff(t)?.evidence).toBe(`${WORK}\n\nValidator agent: claude (bb provider claude-code) is ready on gpu-box.`);
  });

  describe("with custom checks", () => {
    async function withChecks(exitCode: number) {
      const t = await withDispatchedTask();
      t.bb.checkouts.set("proj-1", "/work/repo");
      t.files.files.set("/work/repo/.bb/factoryman/workflow.json", JSON.stringify({ version: 1, checks: { "no-mistakes": [{ name: "lint", argv: ["pnpm", "run", "lint"] }] } }));
      t.bb.envPaths.set("env-thr-w1", "/work/tree");
      const read = answerRead("agent: claude\n");
      t.execHandler = (command, args) => (command === "pnpm" ? { code: exitCode, stdout: "", stderr: "" } : read(command, args));
      return t;
    }

    it("[U1704] refuses the hand-off before any read when a custom check fails", async () => {
      const t = await withChecks(1);
      const outcome = await report(t.runtime, WORKER, { outcome: "done", evidence: WORK });
      expect(outcome.ok).toBe(false);
      expect(outcome.text).toContain("check_failed");
      expect(t.runtime.deps.store.getTask("t1")?.state).toBe("working");
      expect(reads(t)).toEqual([]);
    });

    it("[U1705] runs only the project's custom checks and the one read", async () => {
      const t = await withChecks(0);
      await report(t.runtime, WORKER, { outcome: "done", evidence: WORK });
      expect(t.execCalls.map((call) => call.command)).toEqual(["pnpm", "sh"]);
      const second = t.execCalls[1];
      expect(isRead(second?.command ?? "", second?.args ?? [])).toBe(true);
      expect(t.runtime.deps.store.getTask("t1")?.state).toBe("validating");
    });
  });

  it("[U1719] refuses blank evidence as before, and runs no read for it", async () => {
    for (const evidence of ["", "   \n"]) {
      const t = await withDispatchedTask();
      config(t, "agent: claude\n");
      const outcome = await report(t.runtime, WORKER, { outcome: "done", evidence });
      expect(outcome.ok).toBe(false);
      expect(outcome.text).toContain("evidence_required");
      expect(t.runtime.deps.store.getTask("t1")?.state).toBe("working");
      expect(reads(t)).toEqual([]);
    }
  });
});
