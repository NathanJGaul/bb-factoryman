import { describe, expect, it } from "vitest";
import { WORKER, withDispatchedTask, type TestRuntime } from "../../test/fixtures/runtime";
import { Notifier } from "./wake";

async function wired(options: Parameters<typeof withDispatchedTask>[0] = {}) {
  const t = await withDispatchedTask(options);
  const notifier = new Notifier(t.runtime);
  t.runtime.onApplied((applied) => notifier.onApplied(applied));
  return { t, notifier };
}

const sent = (t: TestRuntime) => t.bb.sentTo("thr-sup");
const READY = { type: "validated", actor: "system", evidence: "Green.", prUrl: "https://github.com/a/b/pull/1", pipelineFinished: true };

describe("Notifier", () => {
  it("[U125] sends one message for each of the five attention states", async () => {
    const runs: Array<[string, (t: TestRuntime) => Promise<unknown>]> = [
      ["blocked", (t) => t.runtime.apply("t1", { type: "block", actor: "worker", evidence: "Waiting." })],
      ["failed", (t) => t.runtime.apply("t1", { type: "fail", actor: "system", evidence: "Died." })],
      [
        "needs_decision",
        async (t) => {
          await t.runtime.apply("t1", { type: "handoff", actor: "worker", evidence: "Done." });
          await t.runtime.apply("t1", { type: "finding", actor: "system", evidence: "Gate." });
        },
      ],
      [
        "review_ready",
        async (t) => {
          await t.runtime.apply("t1", { type: "handoff", actor: "worker", evidence: "Done." });
          await t.runtime.apply("t1", READY);
        },
      ],
    ];
    for (const [state, run] of runs) {
      const { t } = await wired();
      await run(t);
      expect(sent(t).filter((text) => text.includes(`is now ${state}`)), state).toHaveLength(1);
    }
    const { t: scout } = await wired({ kind: "scout" });
    await scout.runtime.apply("t1", { type: "report", actor: "worker", evidence: "Report." });
    expect(sent(scout)).toHaveLength(1);
    expect(sent(scout)[0]).toContain("is now report_ready");
  });

  it("[U126] sends nothing for validating, awaiting_approval, merged, and torn_down", async () => {
    const { t } = await wired();
    await t.runtime.apply("t1", { type: "handoff", actor: "worker", evidence: "Done." });
    expect(sent(t)).toEqual([]);
    await t.runtime.apply("t1", READY);
    expect(sent(t)).toHaveLength(1);
    await t.runtime.apply("t1", { type: "request_approval", actor: "supervisor" });
    await t.runtime.apply("t1", { type: "merge", actor: "supervisor", yolo: true });
    await t.runtime.apply("t1", { type: "teardown", actor: "supervisor", worktree: { uncommittedChanges: false, unpushedCommits: 0 } });
    expect(sent(t)).toHaveLength(1);
  });

  it("[U127] names the task, kind, mode, state, evidence, thread, and branch in the message", async () => {
    const { t } = await wired();
    await t.runtime.apply("t1", { type: "block", actor: "worker", evidence: "Needs a token." });
    expect(sent(t)).toEqual(["[factoryman] Task t1 (ship, no-mistakes) is now blocked.\nEvidence: Needs a token.\nWorker thread: thr-w1. Branch: fm/t1."]);
  });

  it("[U128] cuts evidence to 600 characters and leaves evidence of exactly 600 unchanged", async () => {
    const exact = await wired();
    await exact.t.runtime.apply("t1", { type: "block", actor: "worker", evidence: "x".repeat(600) });
    expect(sent(exact.t)[0]).toContain(`Evidence: ${"x".repeat(600)}\n`);
    const over = await wired();
    await over.t.runtime.apply("t1", { type: "block", actor: "worker", evidence: "x".repeat(601) });
    expect(sent(over.t)[0]).toContain(`Evidence: ${"x".repeat(599)}…\n`);
  });

  it("[U129] sends to the parent of the worker thread as the port reports it", async () => {
    const { t } = await wired();
    t.bb.threads.get("thr-w1")!.parentThreadId = "thr-other-parent";
    await t.runtime.apply("t1", { type: "block", actor: "worker", evidence: "Waiting." });
    expect(t.bb.sentTo("thr-other-parent")).toHaveLength(1);
    expect(sent(t)).toEqual([]);
  });

  it("[U130] sends nothing and logs a warning for a worker with no parent", async () => {
    const { t } = await wired();
    t.bb.threads.get("thr-w1")!.parentThreadId = null;
    await t.runtime.apply("t1", { type: "block", actor: "worker", evidence: "Waiting." });
    expect(t.bb.callsTo("sendMessage")).toEqual([]);
    expect(t.lines.filter((l) => l.level === "warn").map((l) => l.message)).toEqual([expect.stringContaining("No parent thread")]);
  });

  it("[U131] logs a failed send and does not throw", async () => {
    const { t } = await wired();
    t.bb.sendError = new Error("bb is down");
    const outcome = await t.runtime.apply("t1", { type: "block", actor: "worker", evidence: "Waiting." });
    expect(outcome.ok).toBe(true);
    expect(t.runtime.deps.store.getTask("t1")?.state).toBe("blocked");
    expect(t.lines.some((l) => l.level === "warn" && l.message.includes("bb is down"))).toBe(true);
  });

  it("[U132] keeps multi-line finding evidence whole for a needs_decision message", async () => {
    const { t } = await wired();
    await t.runtime.apply("t1", { type: "handoff", actor: "worker", evidence: "Done." });
    const findings = [`review-1 [error] sum.js: auto-fix: ${"a".repeat(400)}`, `review-2 [error] sum.js: ask-user: ${"b".repeat(400)}`].map((line) => `- ${line}`).join("\n");
    await t.runtime.apply("t1", { type: "finding", actor: "system", evidence: `Gate review has 2 findings:\n${findings}` });
    expect(sent(t)[0]).toContain(findings);
  });

  it("[U133] uses the same first line with a reason in place of the state for a wake that is not a transition", async () => {
    const { t, notifier } = await wired();
    await notifier.wake(t.runtime.deps.store.getTask("t1")!, "reports: the worker finished a turn without reporting", null);
    expect(sent(t)).toEqual(["[factoryman] Task t1 (ship, no-mistakes) reports: the worker finished a turn without reporting.\nWorker thread: thr-w1. Branch: fm/t1."]);
  });

  it("[U134] fires after a transition that a tool applied", async () => {
    const { t } = await wired();
    const { report } = await import("../tools/report");
    await report(t.runtime, WORKER, { outcome: "blocked", evidence: "Waiting." });
    expect(sent(t)).toHaveLength(1);
  });
});
