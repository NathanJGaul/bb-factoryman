import { describe, expect, it } from "vitest";
import { withDispatchedTask, type TestRuntime } from "../../test/fixtures/runtime";
import type { TaskRow } from "../store/types";
import { observe, reconcileOnStart } from "./startup";
import { Notifier } from "./wake";

const row = (state: TaskRow["state"]): TaskRow => ({ taskId: "t1", projectId: "proj-1", kind: "ship", mode: "no-mistakes", state, workerThreadId: "thr-w1", branch: "fm/t1", machine: null, pullRequestUrl: null });
const thread = (status: string, deleted = false) => ({ id: "thr-w1", projectId: "proj-1", status, parentThreadId: "thr-sup", environmentId: "env-thr-w1", providerId: null, deleted });

async function restarted(options: Parameters<typeof withDispatchedTask>[0] = {}) {
  const t = await withDispatchedTask(options);
  const notifier = new Notifier(t.runtime);
  t.bb.calls.length = 0;
  return { t, notifier };
}
const reconcileRows = (t: TestRuntime, taskId = "t1") => t.runtime.deps.store.listEvents({ taskId }).filter((r) => r.event === "reconcile");

describe("observe", () => {
  it("[U153] observes a deleted or unknown worker thread as missing", () => {
    expect(observe(row("working"), null)).toBe("missing");
    expect(observe(row("merged"), null)).toBe("missing");
    expect(observe(row("working"), thread("idle", true))).toBe("missing");
  });

  it("[U154] observes a worker thread in error as failed unless the log already says failed", () => {
    expect(observe(row("working"), thread("error"))).toBe("failed");
    expect(observe(row("failed"), thread("error"))).toBe("failed");
  });

  it("[U155] observes any other worker thread as the logged state", () => {
    for (const status of ["active", "idle", "starting"]) expect(observe(row("validating"), thread(status))).toBe("validating");
  });
});

describe("reconcileOnStart", () => {
  it("[U156] does not observe a task that has no worker thread", async () => {
    const { t, notifier } = await restarted();
    t.runtime.log.create({ type: "create", actor: "supervisor", taskId: "t9", projectId: "proj-1", kind: "ship", mode: "no-mistakes" });
    t.bb.threads.get("thr-w1")!.deleted = true;
    const report = await reconcileOnStart(t.runtime, notifier);
    expect(report.appended.map((r) => r.taskId)).toEqual(["t1"]);
    expect(new Set(t.bb.callsTo("getThread").map(([id]) => id))).toEqual(new Set(["thr-w1"]));
  });

  it("[U157] writes one reconcile row and sends one message for each mismatch, and changes no task state", async () => {
    const { t, notifier } = await restarted();
    t.bb.threads.get("thr-w1")!.deleted = true;
    const report = await reconcileOnStart(t.runtime, notifier);
    expect(report.appended).toHaveLength(1);
    expect(reconcileRows(t)).toHaveLength(1);
    expect(reconcileRows(t)[0]?.evidence).toContain("missing");
    expect(t.runtime.deps.store.getTask("t1")?.state).toBe("working");
    expect(t.bb.sentTo("thr-sup")).toEqual([expect.stringContaining("reports: bb and the log disagree about its worker")]);
    expect(t.bb.sentTo("thr-sup")[0]).toContain("The log says the task is working, but bb reports missing.");
  });

  it("[U158] writes and sends nothing on a second start-up with the same mismatch", async () => {
    const { t, notifier } = await restarted();
    t.bb.threads.get("thr-w1")!.status = "error";
    await reconcileOnStart(t.runtime, notifier);
    t.bb.calls.length = 0;
    const again = await reconcileOnStart(t.runtime, notifier);
    expect(again.appended).toEqual([]);
    expect(again.deduplicated).toEqual(["t1"]);
    expect(reconcileRows(t)).toHaveLength(1);
    expect(t.bb.callsTo("sendMessage")).toEqual([]);
  });

  it("[U159] logs a corrupt task and does not observe it, and skips a torn_down task", async () => {
    const { t, notifier } = await restarted();
    t.runtime.log.create({ type: "create", actor: "supervisor", taskId: "t8", projectId: "proj-1", kind: "ship", mode: "no-mistakes" });
    t.runtime.deps.store.appendEvent({ taskId: "t8", at: "2026-11-06T12:00:00.000Z", fromState: "queued", toState: "merged", event: "merge", actor: "supervisor", evidence: null, payload: { yolo: true }, outcome: "applied", reasonCode: null, reasonMessage: null });
    t.runtime.deps.store.putTask({ ...row("merged"), taskId: "t8", workerThreadId: "thr-gone" });
    t.bb.threads.get("thr-w1")!.deleted = true;
    const report = await reconcileOnStart(t.runtime, notifier);
    expect(report.appended.map((r) => r.taskId)).toEqual(["t1"]);
    expect(t.lines.filter((l) => l.level === "error").map((l) => l.message)).toEqual([expect.stringContaining("Task t8 has a corrupt log")]);
    expect(t.bb.callsTo("getThread").map(([id]) => id)).not.toContain("thr-gone");
  });

  it("[U159] skips a torn_down task even when its worker thread is gone", async () => {
    const t = await withDispatchedTask();
    const { toMerged } = await import("../../test/fixtures/runtime");
    await toMerged(t);
    await t.runtime.apply("t1", { type: "teardown", actor: "supervisor", worktree: { uncommittedChanges: false, unpushedCommits: 0 } });
    t.bb.threads.get("thr-w1")!.deleted = true;
    t.bb.calls.length = 0;
    const report = await reconcileOnStart(t.runtime, new Notifier(t.runtime));
    expect(report.appended).toEqual([]);
    expect(t.bb.callsTo("getThread")).toEqual([]);
  });

  it("[U160] logs a thread read that fails for one task and still reconciles the others", async () => {
    const { t, notifier } = await restarted();
    await t.runtime.apply("t1", { type: "block", actor: "worker", evidence: "Waiting." });
    t.runtime.log.create({ type: "create", actor: "supervisor", taskId: "t2", projectId: "proj-1", kind: "ship", mode: "no-mistakes" });
    await t.runtime.apply("t2", { type: "start", actor: "supervisor", profile: { provider: "claude", model: "opus", reasoningLevel: "high", permissionMode: "auto" }, threadId: "thr-w2", branch: "fm/t2", evidence: "Second." });
    t.bb.addThread({ id: "thr-w2", parentThreadId: "thr-sup" });
    const read = t.bb.getThread.bind(t.bb);
    t.bb.getThread = async (id) => {
      if (id === "thr-w1") throw new Error("bb timed out");
      return read(id);
    };
    t.bb.threads.get("thr-w2")!.status = "error";
    const report = await reconcileOnStart(t.runtime, notifier);
    expect(report.appended.map((r) => r.taskId)).toEqual(["t2"]);
    expect(t.lines.filter((l) => l.level === "warn").map((l) => l.message)).toEqual([expect.stringContaining("bb timed out")]);
  });
});
