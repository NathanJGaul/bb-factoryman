import { describe, expect, it } from "vitest";
import { PROFILE, validEvent } from "../../test/fixtures/machine";
import { createEvent, drive } from "../../test/fixtures/store";
import { createMemoryStore } from "./memory";
import { TaskLog } from "./task-log";

function setup() {
  const store = createMemoryStore();
  return { store, log: new TaskLog(store) };
}

describe("TaskLog.create", () => {
  it("appends an applied row from nothing to queued and writes the task row", () => {
    const { store, log } = setup();
    const result = log.create(createEvent({ taskId: "task-1", kind: "scout", mode: "direct-PR", projectId: "proj-9" }));
    expect(result.ok).toBe(true);
    const rows = store.listEvents();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      taskId: "task-1",
      fromState: null,
      toState: "queued",
      event: "create",
      actor: "supervisor",
      evidence: null,
      payload: { projectId: "proj-9", kind: "scout", mode: "direct-PR" },
      outcome: "applied",
      reasonCode: null,
      reasonMessage: null,
    });
    expect(store.getTask("task-1")).toEqual({
      taskId: "task-1",
      projectId: "proj-9",
      kind: "scout",
      mode: "direct-PR",
      state: "queued",
      workerThreadId: null,
      branch: null,
      machine: null,
      pullRequestUrl: null,
    });
    if (result.ok) {
      expect(result.task).toEqual(store.getTask("task-1"));
      expect(result.event).toEqual(rows[0]);
    }
  });

  it("refuses a repeated create with task_exists, logs it, and leaves the task alone", () => {
    const { store, log } = setup();
    log.create(createEvent());
    log.apply("task-1", validEvent("start"));
    const before = store.getTask("task-1");

    const again = log.create(createEvent({ projectId: "other" }));

    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.refusal.code).toBe("task_exists");
    expect(store.getTask("task-1")).toEqual(before);
    expect(store.listEvents().at(-1)).toMatchObject({ taskId: "task-1", event: "create", outcome: "refused", reasonCode: "task_exists" });
  });

  it("logs a create that fails validation as a refused row", () => {
    const { store, log } = setup();
    const result = log.create(createEvent({ projectId: "" }));
    expect(result.ok).toBe(false);
    expect(store.listTasks()).toEqual([]);
    expect(store.listEvents()).toMatchObject([{ taskId: "task-1", event: "create", outcome: "refused", reasonCode: "invalid_event" }]);
  });
});

describe("TaskLog.apply", () => {
  it("on success appends an applied row with from, to, event, actor, evidence, and payload, and updates the task row", () => {
    const { store, log } = setup();
    drive(log, "task-1", [validEvent("start")]);
    const result = log.apply("task-1", validEvent("block", { evidence: "machine went offline" }));

    expect(result.ok).toBe(true);
    const last = store.listEvents().at(-1);
    expect(last).toMatchObject({
      taskId: "task-1",
      fromState: "working",
      toState: "blocked",
      event: "block",
      actor: "system",
      evidence: "machine went offline",
      payload: {},
      outcome: "applied",
    });
    const start = store.listEvents()[1];
    expect(start).toMatchObject({
      fromState: "queued",
      toState: "working",
      event: "start",
      evidence: null,
      payload: { profile: PROFILE, threadId: "thread-1", branch: "fm/task-1", machine: null },
    });
    expect(store.getTask("task-1")).toMatchObject({ state: "blocked", workerThreadId: "thread-1", branch: "fm/task-1" });
    if (result.ok) {
      expect(result.task).toEqual(store.getTask("task-1"));
      expect(result.event).toEqual(last);
    }
  });

  it("on refusal appends a refused row with its code and message and leaves the task row unchanged", () => {
    const { store, log } = setup();
    drive(log, "task-1", [validEvent("start")]);
    const before = store.getTask("task-1");

    const result = log.apply("task-1", validEvent("merge", { yolo: true }));

    expect(result.ok).toBe(false);
    expect(store.getTask("task-1")).toEqual(before);
    const last = store.listEvents().at(-1);
    expect(last).toMatchObject({
      taskId: "task-1",
      fromState: "working",
      toState: "working",
      event: "merge",
      actor: "supervisor",
      payload: { yolo: true },
      outcome: "refused",
      reasonCode: "illegal_transition",
    });
    expect(last?.reasonMessage?.length).toBeGreaterThan(0);
    if (!result.ok) {
      expect(result.refusal.code).toBe("illegal_transition");
      expect(result.event).toEqual(last);
    }
  });

  it("refuses an event for an unknown task with unknown_task and logs it", () => {
    const { store, log } = setup();
    const result = log.apply("ghost", validEvent("start"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.code).toBe("unknown_task");
    expect(store.listTasks()).toEqual([]);
    expect(store.listEvents()).toMatchObject([
      { taskId: "ghost", fromState: null, toState: null, event: "start", outcome: "refused", reasonCode: "unknown_task" },
    ]);
  });

  it("writes an approval row for record_approval and for no other event", () => {
    const { store, log } = setup();
    drive(log, "task-1", [validEvent("start"), validEvent("handoff"), validEvent("validated"), validEvent("request_approval")]);
    expect(store.listApprovals("task-1")).toEqual([]);

    log.apply("task-1", validEvent("record_approval", { decision: "denied" }));
    log.apply("task-1", validEvent("record_approval", { decision: "approved" }));
    log.apply("task-1", validEvent("record_approval", { actor: "worker", decision: "approved" }));

    expect(store.listApprovals("task-1")).toMatchObject([
      { taskId: "task-1", scope: "merge", decision: "denied" },
      { taskId: "task-1", scope: "merge", decision: "approved" },
    ]);
  });
});
