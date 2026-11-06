import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterAll, describe, expect, it } from "vitest";
import { createMemoryStore } from "../../src/store/memory";
import { reconcile } from "../../src/store/reconcile";
import { rebuildCache, recover, replayTask } from "../../src/store/replay";
import { openSqliteStore } from "../../src/store/sqlite";
import type { Store } from "../../src/store/store";
import { TaskLog } from "../../src/store/task-log";
import { validEvent } from "../fixtures/machine";
import { drive, fakeClock, scoutPath, shipPath } from "../fixtures/store";

const dir = mkdtempSync(join(tmpdir(), "factoryman-restart-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const STORES: ReadonlyArray<readonly [string, () => Store]> = [
  ["memory", () => createMemoryStore()],
  ["sqlite", () => openSqliteStore(":memory:")],
];

describe.each(STORES)("%s store: recording events", (_name, make) => {
  it("writes one log row, the task row, and any approval row together", () => {
    const store = make();
    const log = new TaskLog(store, { now: fakeClock() });
    drive(log, "task-1", shipPath().slice(0, 7));

    const rows = store.listEvents({ taskId: "task-1" });
    expect(rows.map((r) => r.event)).toEqual(["create", "start", "handoff", "finding", "resolve", "validated", "request_approval", "record_approval"]);
    expect(rows.every((r) => r.outcome === "applied")).toBe(true);
    expect(rows[0]).toMatchObject({ fromState: null, toState: "queued", actor: "supervisor" });
    expect(rows[1]).toMatchObject({ fromState: "queued", toState: "working", event: "start" });
    expect(rows.map((r) => r.at)).toEqual([...rows.map((r) => r.at)].sort());
    expect(store.getTask("task-1")).toMatchObject({
      taskId: "task-1",
      projectId: "proj-1",
      kind: "ship",
      mode: "no-mistakes",
      state: "awaiting_approval",
      workerThreadId: "thread-1",
      branch: "fm/task-1",
      pullRequestUrl: "https://github.com/acme/widgets/pull/7",
    });
    expect(store.listApprovals("task-1")).toMatchObject([{ taskId: "task-1", scope: "merge", decision: "approved" }]);
  });

  it("logs a refused event with its reason and leaves the task row unchanged", () => {
    const store = make();
    const log = new TaskLog(store, { now: fakeClock() });
    drive(log, "task-1", []);
    const before = store.getTask("task-1");
    const eventsBefore = store.listEvents().length;

    const result = log.apply("task-1", validEvent("merge"));

    expect(result.ok).toBe(false);
    expect(store.getTask("task-1")).toEqual(before);
    expect(store.listEvents()).toHaveLength(eventsBefore + 1);
    expect(store.listEvents().at(-1)).toMatchObject({
      taskId: "task-1",
      fromState: "queued",
      toState: "queued",
      event: "merge",
      outcome: "refused",
      reasonCode: "illegal_transition",
    });
    expect(store.listEvents().at(-1)?.reasonMessage?.length).toBeGreaterThan(0);
  });
});

describe("log immutability", () => {
  it("rejects a raw UPDATE or DELETE on a stored log row", () => {
    const path = join(dir, "immutable.db");
    const store = openSqliteStore(path);
    const log = new TaskLog(store, { now: fakeClock() });
    drive(log, "task-1", [validEvent("start")]);
    const raw = new Database(path);
    expect(() => raw.prepare("UPDATE task_event SET event = 'hacked'").run()).toThrow(/append-only/);
    expect(() => raw.prepare("DELETE FROM task_event").run()).toThrow(/append-only/);
    raw.close();
    expect(store.listEvents()).toHaveLength(2);
    store.close();
  });

  it("gives the in-memory store no way to change a row it returned", () => {
    const store = createMemoryStore();
    const log = new TaskLog(store, { now: fakeClock() });
    drive(log, "task-1", [validEvent("start")]);
    const [row] = store.listEvents();
    expect(() => {
      (row as { event: string }).event = "hacked";
    }).toThrow();
    expect(store.listEvents()[0]?.event).toBe("create");
  });
});

/** A spread of tasks: finished, failed, mid-flight, blocked, and promoted. */
function populate(log: TaskLog): void {
  drive(log, "ship-done", shipPath());
  drive(log, "ship-failed", [validEvent("start"), validEvent("fail", { evidence: "worker crashed" })]);
  drive(log, "ship-queued", []);
  drive(log, "ship-blocked", [validEvent("start"), validEvent("block")], { mode: "direct-PR", projectId: "proj-2" });
  drive(log, "scout-promoted", [...scoutPath(), validEvent("promote"), validEvent("start")], { kind: "scout" });
  drive(log, "scout-reported", [validEvent("start"), validEvent("report")], { kind: "scout", projectId: "proj-2" });
}

describe.each(STORES)("%s store: rebuilding the cache", (_name, make) => {
  it("rebuilds task rows equal to the originals, field for field, after the cache is destroyed", () => {
    const store = make();
    populate(new TaskLog(store, { now: fakeClock() }));
    const before = store.listTasks();
    expect(before).toHaveLength(6);
    expect(new Set(before.map((t) => t.state)).size).toBeGreaterThan(3);

    store.clearTasks();
    expect(store.listTasks()).toEqual([]);
    const report = rebuildCache(store);

    expect(report.corrupt).toEqual([]);
    expect(store.listTasks()).toEqual(before);
  });

  it("reports a task as corrupt when an applied row no longer passes the machine", () => {
    const store = make();
    const log = new TaskLog(store, { now: fakeClock() });
    populate(log);
    drive(log, "forged", shipPath().slice(0, 6));
    // Forge a history: a merge with no recorded approval, written straight to the log.
    const forged = store.appendEvent({
      taskId: "forged",
      at: "2026-11-05T13:00:00.000Z",
      fromState: "awaiting_approval",
      toState: "merged",
      event: "merge",
      actor: "supervisor",
      evidence: null,
      payload: { yolo: false },
      outcome: "applied",
      reasonCode: null,
      reasonMessage: null,
    });
    const healthyBefore = store.listTasks().filter((t) => t.taskId !== "forged");

    const replay = replayTask(store, "forged");
    expect(replay).toMatchObject({ ok: false, reason: "corrupt", seq: forged.seq });

    const report = rebuildCache(store);
    expect(report.corrupt).toMatchObject([{ taskId: "forged", seq: forged.seq }]);
    expect(store.getTask("forged")).toBeNull();
    expect(store.listTasks()).toEqual(healthyBefore);
    expect(log.apply("forged", validEvent("teardown")).ok).toBe(false);
  });
});

describe.each(STORES)("%s store: reconcile", (_name, make) => {
  it("appends one reconcile row per mismatch, changes no state, and skips an identical repeat", () => {
    const store = make();
    const log = new TaskLog(store, { now: fakeClock() });
    populate(log);
    const tasksBefore = store.listTasks();
    const approvalsBefore = store.listApprovals("ship-done");
    const eventsBefore = store.listEvents().length;
    const now = fakeClock();

    const first = reconcile(store, [{ taskId: "ship-blocked", state: "failed" }, { taskId: "ship-queued", state: "queued" }], { now });
    expect(first.appended).toHaveLength(1);
    expect(first.matching).toEqual(["ship-queued"]);
    expect(first.appended[0]).toMatchObject({
      taskId: "ship-blocked",
      event: "reconcile",
      fromState: "blocked",
      toState: "blocked",
      outcome: "applied",
      payload: { observed: "failed" },
    });
    expect(first.appended[0]?.evidence).toContain("failed");
    expect(store.listEvents()).toHaveLength(eventsBefore + 1);

    const repeat = reconcile(store, [{ taskId: "ship-blocked", state: "failed" }], { now });
    expect(repeat.appended).toEqual([]);
    expect(repeat.deduplicated).toEqual(["ship-blocked"]);

    const changed = reconcile(store, [{ taskId: "ship-blocked", state: "missing" }], { now });
    expect(changed.appended).toHaveLength(1);

    expect(store.listTasks()).toEqual(tasksBefore);
    expect(store.listApprovals("ship-done")).toEqual(approvalsBefore);
    expect(replayTask(store, "ship-blocked")).toMatchObject({ ok: true, snapshot: { state: "blocked" } });
  });
});

describe("start-up recovery", () => {
  it("replays every non-terminal task on a reopened SQLite file and repairs the cache", () => {
    const path = join(dir, "recover.db");
    const first = openSqliteStore(path);
    populate(new TaskLog(first, { now: fakeClock() }));
    const expected = first.listTasks();
    first.close();

    const reopened = openSqliteStore(path);
    // Simulate a cache lost in a crash: one row diverged and the rest missing.
    reopened.clearTasks();
    const stale = expected.find((t) => t.taskId === "ship-blocked");
    if (!stale) throw new Error("fixture task missing");
    reopened.putTask({ ...stale, state: "working" });

    const report = recover(reopened);

    const nonTerminal = expected.filter((t) => t.state !== "torn_down").map((t) => t.taskId).sort();
    expect(report.replayed.map((r) => r.taskId).sort()).toEqual(nonTerminal);
    expect(report.skipped).toEqual(["ship-done"]);
    expect(report.corrupt).toEqual([]);
    expect([...report.repaired].sort()).toEqual(nonTerminal);
    for (const row of expected.filter((t) => t.state !== "torn_down")) {
      expect(reopened.getTask(row.taskId)).toEqual(row);
    }
    reopened.close();
  });
});
