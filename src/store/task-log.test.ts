import { describe, expect, it } from "vitest";
import { PROFILE, validEvent } from "../../test/fixtures/machine";
import { createEvent, drive, fakeClock } from "../../test/fixtures/store";
import { createMemoryStore } from "./memory";
import { openSqliteStore } from "./sqlite";
import type { Store } from "./store";
import { TaskLog } from "./task-log";
import type { TaskRow } from "./types";

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

const STORES: ReadonlyArray<readonly [string, () => Store]> = [
  ["memory", () => createMemoryStore()],
  ["sqlite", () => openSqliteStore(":memory:")],
];

/** A store that behaves normally except that one write method throws. */
function failingOn(store: Store, method: "putTask" | "addApproval"): Store {
  return {
    ...store,
    [method]: () => {
      throw new Error("disk full");
    },
  };
}

describe.each(STORES)("TaskLog atomicity on the %s store", (_name, make) => {
  it("rolls back the log append when writing the task row fails", () => {
    const store = make();
    drive(new TaskLog(store), "task-1", [validEvent("start")]);
    const eventsBefore = store.listEvents();
    const taskBefore = store.getTask("task-1");

    const broken = new TaskLog(failingOn(store, "putTask"));
    expect(() => broken.apply("task-1", validEvent("block"))).toThrow("disk full");
    expect(() => broken.create(createEvent({ taskId: "task-2" }))).toThrow("disk full");

    expect(store.listEvents()).toEqual(eventsBefore);
    expect(store.getTask("task-1")).toEqual(taskBefore);
    expect(store.getTask("task-2")).toBeNull();
  });

  it("rolls back the log row and the task row when the approval write fails", () => {
    const store = make();
    drive(new TaskLog(store), "task-1", [validEvent("start"), validEvent("handoff"), validEvent("validated"), validEvent("request_approval")]);
    const eventsBefore = store.listEvents();
    const taskBefore = store.getTask("task-1");

    const broken = new TaskLog(failingOn(store, "addApproval"));
    expect(() => broken.apply("task-1", validEvent("record_approval"))).toThrow("disk full");

    expect(store.listEvents()).toEqual(eventsBefore);
    expect(store.getTask("task-1")).toEqual(taskBefore);
    expect(store.listApprovals("task-1")).toEqual([]);
  });
});

describe("TaskLog clock", () => {
  it("stamps each recorded row with one tick of the injected clock, in order", () => {
    const store = createMemoryStore();
    const log = new TaskLog(store, { now: fakeClock() });
    drive(log, "task-1", [validEvent("start")]);
    log.apply("task-1", validEvent("merge"));
    const rows = store.listEvents();
    expect(rows.map((r) => r.at)).toEqual(["2026-11-05T12:00:00.000Z", "2026-11-05T12:00:01.000Z", "2026-11-05T12:00:02.000Z"]);
    expect(rows.map((r) => r.seq)).toEqual([...rows.map((r) => r.seq)].sort((a, b) => a - b));
  });

  it("stamps an approval row with the same tick as its log row", () => {
    const store = createMemoryStore();
    const log = new TaskLog(store, { now: fakeClock() });
    drive(log, "task-1", [validEvent("start"), validEvent("handoff"), validEvent("validated"), validEvent("request_approval"), validEvent("record_approval")]);
    expect(store.listApprovals("task-1")[0]?.at).toBe(store.listEvents().at(-1)?.at);
  });

  it("falls back to the wall clock in ISO 8601 UTC form", () => {
    const store = createMemoryStore();
    new TaskLog(store).create(createEvent());
    const at = store.listEvents()[0]?.at ?? "";
    expect(new Date(at).toISOString()).toBe(at);
  });
});

describe("TaskLog uses the log, not the cache, to decide", () => {
  it("refuses an event that only a tampered cache row would allow", () => {
    const store = createMemoryStore();
    const log = new TaskLog(store);
    drive(log, "task-1", []);
    // The log says queued. Pretend the cache says awaiting_approval.
    store.putTask({ ...(store.getTask("task-1") as TaskRow), state: "awaiting_approval" });

    const result = log.apply("task-1", validEvent("merge", { yolo: true }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.code).toBe("illegal_transition");
    expect(store.listEvents().at(-1)).toMatchObject({ fromState: "queued", outcome: "refused" });
  });

  it("repairs a tampered cache row whenever it records an accepted event", () => {
    const store = createMemoryStore();
    const log = new TaskLog(store);
    drive(log, "task-1", [validEvent("start")]);
    store.putTask({ ...(store.getTask("task-1") as TaskRow), state: "merged", branch: "tampered" });

    const result = log.apply("task-1", validEvent("block"));

    expect(result.ok).toBe(true);
    expect(store.getTask("task-1")).toMatchObject({ state: "blocked", branch: "fm/task-1" });
  });
});

describe("TaskLog with unreadable input", () => {
  it.each([undefined, null, 5, "start", []])("logs %j as a refused row with a placeholder event and actor", (raw) => {
    const store = createMemoryStore();
    const log = new TaskLog(store);
    drive(log, "task-1", []);
    const result = log.apply("task-1", raw);
    expect(result.ok).toBe(false);
    expect(store.listEvents().at(-1)).toMatchObject({
      taskId: "task-1",
      fromState: "queued",
      toState: "queued",
      event: "<invalid>",
      actor: "unknown",
      evidence: null,
      payload: {},
      outcome: "refused",
      reasonCode: "invalid_event",
    });
  });

  it("keeps the readable parts of a broken event and never throws on values that cannot be stored", () => {
    const store = createMemoryStore();
    const log = new TaskLog(store);
    drive(log, "task-1", []);
    const circular: Record<string, unknown> = { type: "fail", actor: "supervisor", evidence: "x" };
    circular.self = circular;

    expect(log.apply("task-1", { type: "merge", actor: "root", yolo: true, evidence: "why" }).ok).toBe(false);
    expect(store.listEvents().at(-1)).toMatchObject({ event: "merge", actor: "unknown", evidence: "why", payload: { yolo: true }, reasonCode: "invalid_event" });

    expect(log.apply("task-1", circular).ok).toBe(false);
    expect(store.listEvents().at(-1)).toMatchObject({ event: "fail", actor: "supervisor", evidence: "x", payload: {} });

    expect(log.apply("task-1", { type: "fail", actor: "supervisor", evidence: "x", big: 10n }).ok).toBe(false);
    expect(store.listEvents().at(-1)).toMatchObject({ event: "fail", payload: {} });
  });
});
