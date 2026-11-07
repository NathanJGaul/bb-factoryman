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
    await report(one.runtime, WORKER, { outcome: "done", evidence: "Landed.", landedCommits: 1 } as never);
    expect(one.runtime.deps.store.getTask("t1")?.state).toBe("review_ready");
    const none = await withDispatchedTask({ mode: "local-only" });
    const outcome = await report(none.runtime, WORKER, { outcome: "done", evidence: "Nothing.", landedCommits: 0 } as never);
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
