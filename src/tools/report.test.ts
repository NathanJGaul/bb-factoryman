import { describe, expect, it } from "vitest";
import { WORKER, withDispatchedTask } from "../../test/fixtures/runtime";
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
