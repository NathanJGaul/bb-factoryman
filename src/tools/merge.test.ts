import { describe, expect, it } from "vitest";
import type { InputRequest, InputResult } from "../bb/port";
import type { MergeExecutor, MergeInput, MergeResult } from "../git/merge";
import { defaultProjectConfig } from "../store/store";
import { SUPERVISOR, WORKER, toReviewReady, withDispatchedTask, type TestRuntime } from "../../test/fixtures/runtime";
import { createMergeExecutor } from "../git/merge";
import type { Exec } from "../exec";
import { merge } from "./merge";

function fakeExecutor(options: { preflight?: string | null; result?: MergeResult; onMerge?: () => Promise<void> } = {}) {
  const merges: MergeInput[] = [];
  const executor: MergeExecutor = {
    preflight: async () => options.preflight ?? null,
    merge: async (input) => {
      merges.push(input);
      await options.onMerge?.();
      return options.result ?? { ok: true };
    },
  };
  return { executor, merges };
}

async function ready(options: { yolo?: boolean } = {}) {
  const t = await withDispatchedTask();
  if (options.yolo) t.runtime.deps.store.putProjectConfig({ ...defaultProjectConfig("proj-1"), yolo: true });
  await toReviewReady(t);
  return t;
}

const answer = (t: TestRuntime, value: unknown) => {
  t.bb.inputHandler = async () => ({ outcome: "submitted", value });
};
const events = (t: TestRuntime) => t.runtime.deps.store.listEvents({ taskId: "t1" }).map((row) => `${row.event}:${row.outcome}`);
const state = (t: TestRuntime) => t.runtime.deps.store.getTask("t1")?.state;

describe("factoryman_merge", () => {
  it("[U89] opens the form on the caller's thread with the renderer, task, branch, pull request, and evidence", async () => {
    const t = await ready();
    const { executor } = fakeExecutor();
    await merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
    const [[request]] = t.bb.callsTo("requestInput") as [[InputRequest]];
    expect(request).toMatchObject({
      threadId: "thr-sup",
      rendererId: "factoryman-merge-approval",
      payload: { taskId: "t1", branch: "fm/t1", prUrl: "https://github.com/acme/widgets/pull/7", evidence: "Pipeline finished." },
    });
    expect(request.title).toContain("t1");
  });

  it("[U213] shows the latest evidence that put the task in review after a rework loop", async () => {
    const t = await ready();
    await t.runtime.apply("t1", { type: "request_approval", actor: "supervisor" });
    await t.runtime.apply("t1", { type: "request_changes", actor: "user", evidence: "Rework." });
    await t.runtime.apply("t1", { type: "handoff", actor: "worker", evidence: "Second commit." });
    await t.runtime.apply("t1", { type: "validated", actor: "system", evidence: "Second pipeline run finished.", prUrl: "https://github.com/acme/widgets/pull/7", pipelineFinished: true });
    await merge(t.runtime, fakeExecutor().executor, SUPERVISOR, { taskId: "t1" });
    expect((t.bb.callsTo("requestInput")[0]?.[0] as InputRequest).payload).toMatchObject({ evidence: "Second pipeline run finished." });
  });

  it("[U90] takes the form timeout from the approval timeout setting", async () => {
    const t = await ready();
    t.settings.approvalTimeoutMs = 4321;
    await merge(t.runtime, fakeExecutor().executor, SUPERVISOR, { taskId: "t1" });
    expect((t.bb.callsTo("requestInput")[0]?.[0] as InputRequest).timeoutMs).toBe(4321);
  });

  it("[U91] records the owner's approval as actor user with scope merge, then merges once", async () => {
    const t = await ready();
    answer(t, { decision: "approved" });
    const { executor, merges } = fakeExecutor();
    const outcome = await merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
    expect(outcome.ok).toBe(true);
    expect(merges).toHaveLength(1);
    expect(state(t)).toBe("merged");
    expect(events(t).slice(-3)).toEqual(["request_approval:applied", "record_approval:applied", "merge:applied"]);
    const approval = t.runtime.deps.store.listEvents({ taskId: "t1" }).find((row) => row.event === "record_approval");
    expect(approval).toMatchObject({ actor: "user", payload: { scope: "merge", decision: "approved" } });
    expect(t.runtime.deps.store.listApprovals("t1")).toMatchObject([{ scope: "merge", decision: "approved" }]);
  });

  it("[U211] passes the mergeMethod setting to the executor", async () => {
    for (const method of ["squash", "merge", "rebase"] as const) {
      const t = await ready();
      t.settings.mergeMethod = method;
      answer(t, { decision: "approved" });
      const { executor, merges } = fakeExecutor();
      await merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
      expect(merges.map((m) => m.method), method).toEqual([method]);
    }
  });

  it("[U92] records the approval comment as the approval event's evidence", async () => {
    const t = await ready();
    answer(t, { decision: "approved", comment: "Looks good." });
    await merge(t.runtime, fakeExecutor().executor, SUPERVISOR, { taskId: "t1" });
    const approval = t.runtime.deps.store.listEvents({ taskId: "t1" }).find((row) => row.event === "record_approval");
    expect(approval?.evidence).toBe("Looks good.");
  });

  it("[U93] records a denial, runs no merge, and leaves the task awaiting approval", async () => {
    const t = await ready();
    answer(t, { decision: "denied", comment: "Not yet." });
    const { executor, merges } = fakeExecutor();
    const outcome = await merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
    expect(outcome.ok).toBe(false);
    expect(outcome.text).toMatch(/denied/i);
    expect(merges).toEqual([]);
    expect(state(t)).toBe("awaiting_approval");
    expect(t.runtime.deps.store.listApprovals("t1")).toMatchObject([{ decision: "denied" }]);
  });

  it("[U94] records nothing for a cancelled form, whatever the reason", async () => {
    for (const reason of ["timeout", "user", "thread-stopped"]) {
      const t = await ready();
      t.bb.inputHandler = async (): Promise<InputResult> => ({ outcome: "cancelled", reason });
      const { executor, merges } = fakeExecutor();
      const outcome = await merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
      expect(outcome.ok, reason).toBe(false);
      expect(outcome.text).toContain(reason);
      expect(merges, reason).toEqual([]);
      expect(state(t), reason).toBe("awaiting_approval");
      expect(t.runtime.deps.store.listApprovals("t1"), reason).toEqual([]);
    }
  });

  it("[U95] treats a submitted object with an extra field as unreadable and records nothing", async () => {
    const t = await ready();
    answer(t, { decision: "approved", sneaky: true });
    const { executor, merges } = fakeExecutor();
    const outcome = await merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
    expect(outcome.text).toMatch(/unreadable/i);
    expect(merges).toEqual([]);
    expect(t.runtime.deps.store.listApprovals("t1")).toEqual([]);
  });

  it("[U96] treats a decision other than approved or denied as unreadable and records nothing", async () => {
    for (const decision of ["yes", "APPROVED", "", true, 1]) {
      const t = await ready();
      answer(t, { decision });
      const { executor, merges } = fakeExecutor();
      const outcome = await merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
      expect(outcome.text, String(decision)).toMatch(/unreadable/i);
      expect(merges).toEqual([]);
      expect(t.runtime.deps.store.listApprovals("t1")).toEqual([]);
    }
  });

  it("[U97] treats a submitted value that is not an object as unreadable and records nothing", async () => {
    for (const value of ["approved", null, ["approved"], 7]) {
      const t = await ready();
      answer(t, value);
      const { executor, merges } = fakeExecutor();
      const outcome = await merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
      expect(outcome.text, JSON.stringify(value)).toMatch(/unreadable/i);
      expect(merges).toEqual([]);
    }
  });

  it("[U98] skips the form under yolo, passes through awaiting approval, and records yolo on the merge event", async () => {
    const t = await ready({ yolo: true });
    const { executor, merges } = fakeExecutor();
    const outcome = await merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
    expect(outcome.ok).toBe(true);
    expect(t.bb.callsTo("requestInput")).toEqual([]);
    expect(merges).toHaveLength(1);
    expect(events(t).slice(-2)).toEqual(["request_approval:applied", "merge:applied"]);
    expect(t.runtime.deps.store.listEvents({ taskId: "t1" }).at(-1)?.payload).toEqual({ yolo: true });
  });

  it("[U99] records no merge event and returns the error when the executor fails", async () => {
    const t = await ready();
    answer(t, { decision: "approved" });
    const { executor } = fakeExecutor({ result: { ok: false, message: "gh pr merge failed: not mergeable" } });
    const outcome = await merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("not mergeable");
    expect(state(t)).toBe("awaiting_approval");
    expect(events(t).some((e) => e.startsWith("merge:"))).toBe(false);
  });

  it("[U100] never reaches the executor when the machine would refuse the merge", async () => {
    const t = await ready();
    answer(t, { decision: "approved" });
    t.runtime.onApplied(async ({ event }) => {
      if (event.event === "record_approval") await t.runtime.apply("t1", { type: "request_changes", actor: "user", evidence: "Rework." });
    });
    const { executor, merges } = fakeExecutor();
    const outcome = await merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
    expect(outcome.ok).toBe(false);
    expect(merges).toEqual([]);
    expect(state(t)).toBe("working");
  });

  it("[U101] records request_approval from review_ready and does not record it again from awaiting_approval", async () => {
    const t = await ready();
    t.bb.inputHandler = async () => ({ outcome: "cancelled", reason: "timeout" });
    const { executor } = fakeExecutor();
    await merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
    await merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
    expect(events(t).filter((e) => e === "request_approval:applied")).toHaveLength(1);
    expect(events(t).filter((e) => e.startsWith("request_approval:refused"))).toHaveLength(0);
    expect(t.bb.callsTo("requestInput")).toHaveLength(2);
  });

  it("[U102] leaves the task in review_ready with no form when preflight fails", async () => {
    const t = await ready();
    const { executor, merges } = fakeExecutor({ preflight: "The project checkout has uncommitted changes." });
    const outcome = await merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("uncommitted changes");
    expect(state(t)).toBe("review_ready");
    expect(t.bb.callsTo("requestInput")).toEqual([]);
    expect(merges).toEqual([]);
  });

  it("[U103] refuses a second call while the form is open and opens a new form after it settles", async () => {
    const t = await ready();
    let release!: (result: InputResult) => void;
    t.bb.inputHandler = () => new Promise<InputResult>((resolve) => (release = resolve));
    const { executor } = fakeExecutor();
    const first = merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = await merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
    expect(second.ok).toBe(false);
    expect(second.text).toMatch(/already waiting/i);
    release({ outcome: "cancelled", reason: "user" });
    await first;
    t.bb.inputHandler = async () => ({ outcome: "cancelled", reason: "user" });
    await merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
    expect(t.bb.callsTo("requestInput")).toHaveLength(2);
  });

  it("[U223] opens one form when two calls for the same task start together", async () => {
    const t = await ready();
    let release!: (result: InputResult) => void;
    t.bb.inputHandler = () => new Promise<InputResult>((resolve) => (release = resolve));
    const { executor } = fakeExecutor();
    const first = merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
    const second = await merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
    expect(second.ok).toBe(false);
    expect(second.text).toMatch(/already waiting/i);
    await new Promise((resolve) => setTimeout(resolve, 0));
    release({ outcome: "cancelled", reason: "user" });
    await first;
    expect(t.bb.callsTo("requestInput")).toHaveLength(1);
    expect(events(t).filter((e) => e.startsWith("request_approval"))).toEqual(["request_approval:applied"]);
  });

  it("[U224] runs one merge when two yolo calls for the same task start together, and frees the task afterwards", async () => {
    const t = await ready({ yolo: true });
    let release!: () => void;
    const { executor, merges } = fakeExecutor({ onMerge: () => new Promise<void>((resolve) => (release = resolve)) });
    const first = merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
    const second = await merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
    expect(second.ok).toBe(false);
    expect(second.text).toMatch(/already waiting/i);
    await new Promise((resolve) => setTimeout(resolve, 0));
    release();
    expect((await first).ok).toBe(true);
    expect(merges).toHaveLength(1);
    expect(t.runtime.openMergeForms.has("t1")).toBe(false);
  });

  it("[U225] merges a pull request in the project's own repository, with the form or with yolo", async () => {
    for (const yolo of [false, true]) {
      const t = await ready({ yolo });
      answer(t, { decision: "approved" });
      const calls: string[][] = [];
      const exec: Exec = async (_command, args) => (calls.push([...args]), { code: 0, stdout: "", stderr: "" });
      const outcome = await merge(t.runtime, createMergeExecutor(exec), SUPERVISOR, { taskId: "t1" });
      expect(outcome.ok, String(yolo)).toBe(true);
      expect(calls, String(yolo)).toEqual([["pr", "merge", "https://github.com/acme/widgets/pull/7", "--squash"]]);
    }
  });

  it("[U226] refuses before the form and before any command when the pull request is outside the project's repository or the remote is unreadable", async () => {
    for (const yolo of [false, true]) {
      for (const remote of ["git@github.com:other/widgets.git", "git@gitlab.com:acme/widgets.git", "git@github.com:acme/other.git", null]) {
        const t = await ready({ yolo });
        t.bb.remotes.set("proj-1", remote);
        const calls: string[][] = [];
        const exec: Exec = async (_command, args) => (calls.push([...args]), { code: 0, stdout: "", stderr: "" });
        const outcome = await merge(t.runtime, createMergeExecutor(exec), SUPERVISOR, { taskId: "t1" });
        const label = `${String(yolo)} ${String(remote)}`;
        expect(outcome.ok, label).toBe(false);
        expect(outcome.text, label).toMatch(/refused/i);
        expect(calls, label).toEqual([]);
        expect(t.bb.callsTo("requestInput"), label).toEqual([]);
        expect(state(t), label).toBe("review_ready");
      }
    }
  });

  it("[U104] merges nothing when the approval arrives after the task left awaiting approval", async () => {
    const t = await ready();
    t.bb.inputHandler = async () => {
      await t.runtime.apply("t1", { type: "request_changes", actor: "user", evidence: "Rework first." });
      return { outcome: "submitted", value: { decision: "approved" } };
    };
    const { executor, merges } = fakeExecutor();
    const outcome = await merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
    expect(outcome.ok).toBe(false);
    expect(merges).toEqual([]);
    expect(state(t)).toBe("working");
    expect(t.runtime.deps.store.listApprovals("t1")).toEqual([]);
  });

  it("[U105] refuses a task in another project with no form", async () => {
    const t = await ready();
    const { executor } = fakeExecutor();
    const outcome = await merge(t.runtime, executor, { threadId: "thr-sup2", projectId: "proj-2" }, { taskId: "t1" });
    expect(outcome).toEqual({ ok: false, text: "No task t1 exists in this project." });
    expect(t.bb.callsTo("requestInput")).toEqual([]);
  });

  it("[U106] says the forge merged and the log refused when the merge event is refused after a successful merge", async () => {
    const t = await ready();
    answer(t, { decision: "approved" });
    const { executor } = fakeExecutor({
      onMerge: async () => {
        await t.runtime.apply("t1", { type: "request_changes", actor: "user", evidence: "Rework." });
      },
    });
    const outcome = await merge(t.runtime, executor, SUPERVISOR, { taskId: "t1" });
    expect(outcome.ok).toBe(false);
    expect(outcome.text).toMatch(/merged .* log refused|log refused/i);
    expect(state(t)).toBe("working");
  });

  it("refuses a worker caller, a scout, and a wrong state with no form", async () => {
    const t = await ready();
    const { executor } = fakeExecutor();
    expect((await merge(t.runtime, executor, WORKER, { taskId: "t1" })).text).toContain("actor_forbidden");
    const working = await withDispatchedTask();
    expect((await merge(working.runtime, executor, SUPERVISOR, { taskId: "t1" })).text).toContain("illegal_transition");
    const scout = await withDispatchedTask({ kind: "scout" });
    expect((await merge(scout.runtime, executor, SUPERVISOR, { taskId: "t1" })).text).toContain("illegal_transition");
    expect(t.bb.callsTo("requestInput")).toEqual([]);
    expect(working.bb.callsTo("requestInput")).toEqual([]);
  });
});
