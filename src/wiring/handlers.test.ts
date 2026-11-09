import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { describe, expect, it } from "vitest";
import { toMerged, toReviewReady, withDispatchedTask, type TestRuntime } from "../../test/fixtures/runtime";
import { EventHandlers, registerHandlers } from "./handlers";
import { Notifier } from "./wake";

type State = "working" | "blocked" | "validating" | "needs_decision" | "review_ready" | "awaiting_approval" | "merged" | "torn_down" | "failed";

async function inState(state: State, options: Parameters<typeof withDispatchedTask>[0] = {}) {
  const t = await withDispatchedTask(options);
  const apply = (event: Record<string, unknown>) => t.runtime.apply("t1", event);
  if (state === "blocked") await apply({ type: "block", actor: "worker", evidence: "Waiting." });
  if (state === "validating" || state === "needs_decision") await apply({ type: "handoff", actor: "worker", evidence: "Done." });
  if (state === "needs_decision") await apply({ type: "finding", actor: "system", evidence: "Gate." });
  if (state === "review_ready") await toReviewReady(t);
  if (state === "awaiting_approval") {
    await toReviewReady(t);
    await apply({ type: "request_approval", actor: "supervisor" });
  }
  if (state === "merged" || state === "torn_down") await toMerged(t);
  if (state === "torn_down") await apply({ type: "teardown", actor: "supervisor", worktree: { uncommittedChanges: false, unpushedCommits: 0 } });
  if (state === "failed") await apply({ type: "fail", actor: "system", evidence: "Died." });
  expect(t.runtime.deps.store.getTask("t1")?.state).toBe(state);
  const notifier = new Notifier(t.runtime);
  t.runtime.onApplied((applied) => notifier.onApplied(applied));
  const handlers = new EventHandlers(t.runtime, notifier, "factoryman");
  t.bb.calls.length = 0;
  return { t, handlers };
}

const rows = (t: TestRuntime) => t.runtime.deps.store.listEvents({ taskId: "t1" }).map((row) => `${row.event}:${row.outcome}`);
const state = (t: TestRuntime) => t.runtime.deps.store.getTask("t1")?.state;
const failedRow = (t: TestRuntime) => t.runtime.deps.store.listEvents({ taskId: "t1" }).findLast((row) => row.event === "fail");
const thread = { thread: { id: "thr-w1" } };

describe("thread.failed", () => {
  it("[U135] fails a working task with the thread's error text and wakes the supervisor", async () => {
    const { t, handlers } = await inState("working");
    await handlers.threadFailed({ ...thread, error: "Provider crashed" });
    expect(state(t)).toBe("failed");
    expect(failedRow(t)).toMatchObject({ actor: "system", evidence: "worker thread failed: Provider crashed" });
    expect(t.bb.sentTo("thr-sup")).toHaveLength(1);
  });

  it("[U136] uses the remembered turn failure's category and status code when the error text is empty", async () => {
    const { t, handlers } = await inState("working");
    await handlers.turnFailed({ threadId: "thr-w1", errorInfo: { category: "bad-request", httpStatusCode: 404 } });
    await handlers.threadFailed({ ...thread, error: null });
    expect(failedRow(t)?.evidence).toBe("worker thread failed: provider error (category bad-request, HTTP 404)");
    expect(t.sleeps).toEqual([500]);
  });

  it("[U137] uses the fixed fallback text when there is neither an error text nor a turn failure", async () => {
    const { t, handlers } = await inState("working");
    await handlers.threadFailed({ ...thread, error: null });
    expect(failedRow(t)?.evidence).toBe("worker thread entered the error state");
  });

  describe("the provider's reported cause (feature 009, H3)", () => {
    const LOGIN = "Not logged in · Please run /login";
    const SIGN_IN_REMEDY = "Sign in to the provider on the machine that runs the worker, then dispatch the task again.";
    const MODEL_REMEDY = "Pick a model that `bb provider models <provider>` lists for this provider, then dispatch the task again.";

    it("[U1461] follows the thread's error text with the cause", async () => {
      const { t, handlers } = await inState("working");
      t.bb.failureCauses.set("thr-w1", "Overloaded, try later");
      await handlers.threadFailed({ ...thread, error: "Provider crashed" });
      expect(failedRow(t)?.evidence).toBe('worker thread failed: Provider crashed. Provider-reported cause: "Overloaded, try later"');
    });

    it("[U1462] follows a remembered turn failure with the cause", async () => {
      const { t, handlers } = await inState("working");
      t.bb.failureCauses.set("thr-w1", "unexpected status 500 from upstream");
      await handlers.turnFailed({ threadId: "thr-w1", errorInfo: { category: "bad-request", httpStatusCode: 404 } });
      await handlers.threadFailed({ ...thread, error: null });
      expect(failedRow(t)?.evidence).toBe('worker thread failed: provider error (category bad-request, HTTP 404). Provider-reported cause: "unexpected status 500 from upstream"');
    });

    it("[U1463] follows the fallback text with the cause", async () => {
      const { t, handlers } = await inState("working");
      t.bb.failureCauses.set("thr-w1", LOGIN);
      await handlers.threadFailed({ ...thread, error: null });
      expect(failedRow(t)?.evidence).toBe(`worker thread entered the error state. Provider-reported cause: "${LOGIN}"\nRemedy: ${SIGN_IN_REMEDY}`);
    });

    it("[U1464] adds the remedy as a second line, and leaves the cause line unchanged", async () => {
      const { t, handlers } = await inState("working");
      t.bb.failureCauses.set("thr-w1", "Failed to resolve Pi model openai/gpt-6-luna");
      await handlers.threadFailed({ ...thread, error: "Command thread.start failed" });
      const [first, second, ...rest] = (failedRow(t)?.evidence ?? "").split("\n");
      expect(first).toBe('worker thread failed: Command thread.start failed. Provider-reported cause: "Failed to resolve Pi model openai/gpt-6-luna"');
      expect(second).toBe(`Remedy: ${MODEL_REMEDY}`);
      expect(rest).toEqual([]);
    });

    it("[U1464] uses the remembered HTTP status for the remedy when the cause text does not say it", async () => {
      const { t, handlers } = await inState("working");
      t.bb.failureCauses.set("thr-w1", "connection reset by peer");
      await handlers.turnFailed({ threadId: "thr-w1", errorInfo: { category: "connection-failed", httpStatusCode: 401 } });
      await handlers.threadFailed({ ...thread, error: null });
      expect(failedRow(t)?.evidence).toContain(`Remedy: ${SIGN_IN_REMEDY}`);
    });

    it("[U1466] keeps today's evidence, still records the failure, and logs a warning when the cause read throws", async () => {
      const { t, handlers } = await inState("working");
      t.bb.failureCauseError = new Error("HTTP 500");
      await handlers.threadFailed({ ...thread, error: "Provider crashed" });
      expect(state(t)).toBe("failed");
      expect(failedRow(t)?.evidence).toBe("worker thread failed: Provider crashed");
      expect(t.lines.some((line) => line.level === "warn" && line.message.includes("thr-w1") && line.message.includes("HTTP 500"))).toBe(true);
    });

    it("[U1467] flattens and bounds the cause in the evidence", async () => {
      const { t, handlers } = await inState("working");
      t.bb.failureCauses.set("thr-w1", `first line\n\tsecond line ${"x".repeat(400)}`);
      await handlers.threadFailed({ ...thread, error: "Provider crashed" });
      const evidence = failedRow(t)?.evidence ?? "";
      expect(evidence).not.toMatch(/[\t\r]/);
      expect(evidence.split("\n")).toHaveLength(1);
      expect(evidence).toContain('Provider-reported cause: "first line second line xxx');
      expect(evidence.endsWith('..."')).toBe(true);
      // The prefix, the quote that opens the cause, the cause cut to its limit, and the quote that closes it.
      const CAUSE_LIMIT = 300;
      expect(evidence).toHaveLength('worker thread failed: Provider crashed. Provider-reported cause: "'.length + CAUSE_LIMIT + '"'.length);
    });

    it("[U1468] reads the cause once, after the wait for an empty error text", async () => {
      const { t, handlers } = await inState("working");
      const sleepsWhenRead: number[] = [];
      t.bb.getFailureCause = async () => {
        sleepsWhenRead.push(t.sleeps.length);
        return LOGIN;
      };
      await handlers.threadFailed({ ...thread, error: null });
      expect(sleepsWhenRead).toEqual([1]);
      expect(t.sleeps).toEqual([500]);
    });

    it("[U1469] does not read the cause for a failure in a state that the handler ignores", async () => {
      for (const ignored of ["validating", "needs_decision", "review_ready", "awaiting_approval", "merged"] as const) {
        const { t, handlers } = await inState(ignored);
        await handlers.threadFailed({ ...thread, error: "late" });
        expect(t.bb.callsTo("getFailureCause"), ignored).toEqual([]);
      }
      const { t, handlers } = await inState("working");
      await handlers.threadFailed({ thread: { id: "thr-unknown" }, error: "x" });
      expect(t.bb.callsTo("getFailureCause")).toEqual([]);
    });
  });

  it("[U138] fails a blocked task", async () => {
    const { t, handlers } = await inState("blocked");
    await handlers.threadFailed({ ...thread, error: "boom" });
    expect(state(t)).toBe("failed");
  });

  it("[U139] ignores a failure in validating, needs_decision, review_ready, awaiting_approval, merged, and report_ready", async () => {
    for (const s of ["validating", "needs_decision", "review_ready", "awaiting_approval", "merged"] as const) {
      const { t, handlers } = await inState(s);
      await handlers.threadFailed({ ...thread, error: "boom" });
      expect(state(t), s).toBe(s);
      expect(t.bb.callsTo("sendMessage"), s).toEqual([]);
    }
    const { t, handlers } = await inState("working", { kind: "scout" });
    await t.runtime.apply("t1", { type: "report", actor: "worker", evidence: "Report." });
    t.bb.calls.length = 0;
    await handlers.threadFailed({ ...thread, error: "boom" });
    expect(state(t)).toBe("report_ready");
    expect(t.bb.callsTo("sendMessage")).toEqual([]);
  });

  it("[U140] sends no second message and records no second fail for a duplicate failure", async () => {
    const { t, handlers } = await inState("working");
    await handlers.threadFailed({ ...thread, error: "boom" });
    await handlers.threadFailed({ ...thread, error: "boom" });
    expect(rows(t).filter((row) => row.startsWith("fail:"))).toEqual(["fail:applied"]);
    expect(t.bb.sentTo("thr-sup")).toHaveLength(1);
  });
});

describe("thread.deleted, thread.idle, and thread.archived", () => {
  it("[U141] fails a task in any state before merged when its thread is deleted", async () => {
    for (const s of ["working", "validating", "review_ready"] as const) {
      const { t, handlers } = await inState(s);
      await handlers.threadDeleted(thread);
      expect(state(t), s).toBe("failed");
      expect(failedRow(t)?.evidence).toBe("worker thread was deleted");
    }
  });

  it("[U142] ignores a deletion for a merged, torn_down, or already failed task", async () => {
    for (const s of ["merged", "torn_down", "failed"] as const) {
      const { t, handlers } = await inState(s);
      const before = rows(t).length;
      await handlers.threadDeleted(thread);
      expect(rows(t), s).toHaveLength(before);
      expect(t.bb.callsTo("sendMessage"), s).toEqual([]);
    }
  });

  it("[U143] wakes the supervisor for an idle worker on a working task and changes nothing", async () => {
    const { t, handlers } = await inState("working");
    const before = rows(t).length;
    await handlers.threadIdle(thread);
    expect(rows(t)).toHaveLength(before);
    expect(state(t)).toBe("working");
    expect(t.bb.sentTo("thr-sup")).toEqual(["[factoryman] Task t1 (ship, no-mistakes) reports: the worker finished a turn without reporting.\nWorker thread: thr-w1. Branch: fm/t1."]);
  });

  it("[U144] ignores an idle worker in every other state", async () => {
    for (const s of ["blocked", "validating", "needs_decision", "review_ready", "awaiting_approval", "merged", "failed", "torn_down"] as const) {
      const { t, handlers } = await inState(s);
      await handlers.threadIdle(thread);
      expect(t.bb.callsTo("sendMessage"), s).toEqual([]);
    }
  });

  it("[U145] warns the supervisor about an archived worker without changing state, and ignores a torn_down task", async () => {
    const { t, handlers } = await inState("merged");
    await handlers.threadArchived(thread);
    expect(state(t)).toBe("merged");
    expect(t.bb.sentTo("thr-sup")).toEqual([expect.stringContaining("worker thread was archived, so bb may remove its worktree")]);
    const done = await inState("torn_down");
    await done.handlers.threadArchived(thread);
    expect(done.t.bb.callsTo("sendMessage")).toEqual([]);
  });
});

describe("interaction.pending", () => {
  it("[U146] wakes the supervisor with the title of an interaction that another source raised", async () => {
    const { t, handlers } = await inState("working");
    await handlers.interactionPending({ ...thread, interaction: { origin: { pluginId: null }, payload: { title: "Which database should I use?" } } });
    expect(t.bb.sentTo("thr-sup")).toEqual([expect.stringContaining("reports: the worker raised a question: Which database should I use?")]);
    expect(state(t)).toBe("working");
  });

  it("[U147] sends nothing for a form that this plugin raised", async () => {
    const { t, handlers } = await inState("working");
    await handlers.interactionPending({ ...thread, interaction: { origin: { pluginId: "factoryman" }, payload: { title: "Approve merge" } } });
    expect(t.bb.callsTo("sendMessage")).toEqual([]);
  });
});

describe("matching and robustness", () => {
  it("[U148] writes no log row and sends nothing for a thread that no task records", async () => {
    const { t, handlers } = await inState("working");
    const before = t.runtime.deps.store.listEvents().length;
    const other = { thread: { id: "thr-unrelated" } };
    await handlers.threadFailed({ ...other, error: "boom" });
    await handlers.threadDeleted(other);
    await handlers.threadIdle(other);
    await handlers.threadArchived(other);
    await handlers.interactionPending({ ...other, interaction: {} });
    expect(t.runtime.deps.store.listEvents()).toHaveLength(before);
    expect(t.bb.callsTo("sendMessage")).toEqual([]);
  });

  it("[U149] never matches a queued task, which has no worker thread", async () => {
    const t = await withDispatchedTask();
    t.runtime.log.create({ type: "create", actor: "supervisor", taskId: "t9", projectId: "proj-1", kind: "ship", mode: "no-mistakes" });
    const handlers = new EventHandlers(t.runtime, new Notifier(t.runtime), "factoryman");
    await handlers.threadDeleted({ thread: { id: "null" } });
    await handlers.threadDeleted({ thread: { id: "" } });
    expect(t.runtime.deps.store.getTask("t9")?.state).toBe("queued");
    // Control: the same event for the started task's worker does match.
    await handlers.threadDeleted({ thread: { id: "thr-w1" } });
    expect(t.runtime.deps.store.getTask("t1")?.state).toBe("failed");
  });

  it("[U150] remembers a turn failure per thread and keeps the memory bounded", async () => {
    const { handlers } = await inState("working");
    for (let i = 0; i < 150; i += 1) await handlers.turnFailed({ threadId: `thr-x${i}`, errorInfo: { category: "rate-limit", httpStatusCode: 429 } });
    expect(handlers.turnFailures.size).toBeLessThanOrEqual(100);
    expect(handlers.turnFailures.has("thr-x149")).toBe(true);
    expect(handlers.turnFailures.has("thr-x0")).toBe(false);
  });

  it("[U151] registers only the five thread events and turn.failed, and ignores the rest", async () => {
    const host = createFakePluginHost({ pluginId: "factoryman" });
    const { handlers } = await inState("working");
    registerHandlers(host.bb, handlers);
    const counts = host.harness.inspection.registrations.threadEventHandlers;
    const registered = Object.entries(counts).filter(([, n]) => n > 0).map(([name]) => name).sort();
    expect(registered).toEqual(["interaction.pending", "thread.archived", "thread.deleted", "thread.failed", "thread.idle", "turn.failed"]);
  });

  it("[U152] logs a handler whose store call throws and does not throw", async () => {
    const { t, handlers } = await inState("working");
    t.runtime.deps.store.listTasks = () => {
      throw new Error("database is locked");
    };
    await expect(handlers.threadFailed({ ...thread, error: "boom" })).resolves.toBeUndefined();
    expect(t.lines.filter((l) => l.level === "error").map((l) => l.message)).toEqual([expect.stringContaining("database is locked")]);
  });
});
