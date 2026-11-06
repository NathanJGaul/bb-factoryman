import { describe, expect, it } from "vitest";
import { validEvent } from "../../test/fixtures/machine";
import { row, writeHistory } from "../../test/fixtures/history";
import { drive, fakeClock, shipPath } from "../../test/fixtures/store";
import { createMemoryStore } from "./memory";
import { reconcile } from "./reconcile";
import { replayTask } from "./replay";
import { TaskLog } from "./task-log";

function setup() {
  const store = createMemoryStore();
  const log = new TaskLog(store, { now: fakeClock() });
  drive(log, "running", [validEvent("start"), validEvent("block")], { mode: "direct-PR" });
  drive(log, "review", shipPath().slice(0, 5));
  drive(log, "waiting", shipPath().slice(0, 6));
  return { store, log, now: fakeClock() };
}

describe("reconcile", () => {
  it("appends one reconcile row per mismatch, with the replayed state on both sides and the observed state in the payload", () => {
    const { store, now } = setup();
    const eventsBefore = store.listEvents().length;

    const report = reconcile(store, [{ taskId: "running", state: "failed" }, { taskId: "review", state: "merged" }], { now });

    expect(report.appended).toHaveLength(2);
    expect(store.listEvents()).toHaveLength(eventsBefore + 2);
    expect(report.appended[0]).toMatchObject({
      taskId: "running",
      fromState: "blocked",
      toState: "blocked",
      event: "reconcile",
      actor: "system",
      outcome: "applied",
      payload: { observed: "failed" },
      reasonCode: null,
    });
    expect(report.appended[0]?.evidence).toContain("blocked");
    expect(report.appended[0]?.evidence).toContain("failed");
    expect(report.appended[1]).toMatchObject({ taskId: "review", fromState: "review_ready", payload: { observed: "merged" } });
    expect(store.listEvents().at(-1)).toEqual(report.appended[1]);
    expect(report.appended[0]?.at).toBe("2026-11-05T12:00:00.000Z");
  });

  it("appends nothing for an observation that matches the replayed state", () => {
    const { store, now } = setup();
    const eventsBefore = store.listEvents().length;
    const report = reconcile(store, [{ taskId: "running", state: "blocked" }], { now });
    expect(report.appended).toEqual([]);
    expect(report.matching).toEqual(["running"]);
    expect(store.listEvents()).toHaveLength(eventsBefore);
  });

  it("appends nothing for an identical repeated mismatch, and appends again when the observation changes", () => {
    const { store, now } = setup();
    reconcile(store, [{ taskId: "running", state: "failed" }], { now });
    const eventsAfterFirst = store.listEvents().length;

    const repeat = reconcile(store, [{ taskId: "running", state: "failed" }], { now });
    expect(repeat.appended).toEqual([]);
    expect(repeat.deduplicated).toEqual(["running"]);
    expect(store.listEvents()).toHaveLength(eventsAfterFirst);

    const changed = reconcile(store, [{ taskId: "running", state: "working" }], { now });
    expect(changed.appended).toHaveLength(1);
    expect(changed.appended[0]?.payload).toEqual({ observed: "working" });
  });

  it("appends again for the same mismatch once another row has followed the reconcile row", () => {
    const { store, log, now } = setup();
    reconcile(store, [{ taskId: "running", state: "failed" }], { now });
    log.apply("running", validEvent("unblock"));
    log.apply("running", validEvent("block"));
    const again = reconcile(store, [{ taskId: "running", state: "failed" }], { now });
    expect(again.appended).toHaveLength(1);
  });

  it("does not treat a refused row that happens to carry an observed field as a reconcile row", () => {
    const { store, log, now } = setup();
    log.apply("running", { ...validEvent("start"), observed: "failed" });
    expect(store.listEvents().at(-1)).toMatchObject({ event: "start", outcome: "refused", payload: { observed: "failed" } });
    const report = reconcile(store, [{ taskId: "running", state: "failed" }], { now });
    expect(report.appended).toHaveLength(1);
    expect(report.deduplicated).toEqual([]);
  });

  it("counts an observation of missing as a mismatch", () => {
    const { store, now } = setup();
    const report = reconcile(store, [{ taskId: "waiting", state: "missing" }], { now });
    expect(report.appended).toHaveLength(1);
    expect(report.appended[0]).toMatchObject({ payload: { observed: "missing" }, fromState: "awaiting_approval", toState: "awaiting_approval" });
  });

  it("reports an observation for an unknown or corrupt task and logs nothing for it", () => {
    const { store, now } = setup();
    writeHistory(store, "forged", shipPath().slice(0, 5));
    store.appendEvent(row({ taskId: "forged", fromState: "review_ready", toState: "merged", event: "merge", actor: "supervisor", payload: { yolo: false } }));
    const eventsBefore = store.listEvents().length;

    const report = reconcile(store, [{ taskId: "ghost", state: "working" }, { taskId: "forged", state: "merged" }], { now });

    expect(report.unknown).toEqual(["ghost"]);
    expect(report.corrupt).toEqual(["forged"]);
    expect(report.appended).toEqual([]);
    expect(store.listEvents()).toHaveLength(eventsBefore);
  });

  it("never changes the replayed state, the task rows, or the approvals", () => {
    const { store, log, now } = setup();
    const tasksBefore = store.listTasks();
    const approvalsBefore = store.listApprovals("review");
    const stateBefore = replayTask(store, "running");

    reconcile(store, [{ taskId: "running", state: "failed" }, { taskId: "review", state: "missing" }, { taskId: "waiting", state: "queued" }], { now });

    expect(store.listTasks()).toEqual(tasksBefore);
    expect(store.listApprovals("review")).toEqual(approvalsBefore);
    expect(replayTask(store, "running")).toMatchObject({ ok: true, snapshot: (stateBefore as { snapshot: unknown }).snapshot });
    // The log carries on from the replayed state, not from the observation.
    expect(log.apply("running", validEvent("unblock")).ok).toBe(true);
    expect(store.getTask("running")?.state).toBe("working");
  });

  it("uses the wall clock when none is given", () => {
    const { store } = setup();
    const report = reconcile(store, [{ taskId: "running", state: "failed" }]);
    const at = report.appended[0]?.at ?? "";
    expect(new Date(at).toISOString()).toBe(at);
  });
});
