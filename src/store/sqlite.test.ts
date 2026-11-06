import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterAll, describe, expect, it } from "vitest";
import { AT, describeStoreContract, newEvent, taskRow } from "../../test/store-contract";
import { openSqliteStore } from "./sqlite";

describeStoreContract("sqlite", () => openSqliteStore(":memory:"));

const dir = mkdtempSync(join(tmpdir(), "factoryman-sqlite-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let counter = 0;
const freshPath = () => join(dir, `store-${counter++}.db`);

describe("sqlite schema", () => {
  it("aborts a raw UPDATE or DELETE on task_event", () => {
    const path = freshPath();
    const store = openSqliteStore(path);
    store.appendEvent(newEvent());
    const raw = new Database(path);
    expect(() => raw.prepare("UPDATE task_event SET event = 'hacked'").run()).toThrow(/append-only/);
    expect(() => raw.prepare("DELETE FROM task_event").run()).toThrow(/append-only/);
    raw.close();
    expect(store.listEvents()).toHaveLength(1);
    expect(store.listEvents()[0]?.event).toBe("create");
    store.close();
  });

  it("aborts a raw UPDATE or DELETE on approval", () => {
    const path = freshPath();
    const store = openSqliteStore(path);
    store.addApproval({ taskId: "task-1", scope: "merge", decision: "approved", at: AT });
    const raw = new Database(path);
    expect(() => raw.prepare("UPDATE approval SET decision = 'denied'").run()).toThrow(/append-only/);
    expect(() => raw.prepare("DELETE FROM approval").run()).toThrow(/append-only/);
    raw.close();
    expect(store.listApprovals("task-1")[0]?.decision).toBe("approved");
    store.close();
  });

  it("records the schema version and refuses a newer one", () => {
    const path = freshPath();
    openSqliteStore(path).close();
    const raw = new Database(path);
    expect(raw.pragma("user_version", { simple: true })).toBe(1);
    raw.pragma("user_version = 99");
    raw.close();
    expect(() => openSqliteStore(path)).toThrow(/newer/);
  });

  it("keeps its data when the same file is closed and reopened", () => {
    const path = freshPath();
    const first = openSqliteStore(path);
    const event = first.appendEvent(newEvent({ payload: { n: { deep: [1, null] } } }));
    first.putTask(taskRow({ state: "working", branch: "fm/x" }));
    const approval = first.addApproval({ taskId: "task-1", scope: "merge", decision: "approved", at: AT });
    first.putProjectConfig({ projectId: "p", deliveryMode: "local-only", yolo: true, branchPrefix: "fm/", baseBranch: "main", defaultMachine: "m1" });
    first.close();

    const second = openSqliteStore(path);
    expect(second.listEvents()).toEqual([event]);
    expect(second.getTask("task-1")).toEqual(taskRow({ state: "working", branch: "fm/x" }));
    expect(second.listApprovals("task-1")).toEqual([approval]);
    expect(second.getProjectConfig("p")).toMatchObject({ deliveryMode: "local-only", yolo: true, defaultMachine: "m1" });
    expect(second.appendEvent(newEvent()).seq).toBeGreaterThan(event.seq);
    second.close();
  });

  it("rejects raw rows whose enum values are not in the vocabulary", () => {
    const path = freshPath();
    openSqliteStore(path).close();
    const raw = new Database(path);
    const badEvent = raw.prepare(
      "INSERT INTO task_event (task_id, at, event, actor, payload, outcome) VALUES ('t', 'now', 'e', 'system', '{}', 'maybe')",
    );
    expect(() => badEvent.run()).toThrow(/CHECK/);
    const badTask = raw.prepare("INSERT INTO task (task_id, project_id, kind, mode, state) VALUES ('t', 'p', 'ship', 'no-mistakes', 'exploded')");
    expect(() => badTask.run()).toThrow(/CHECK/);
    const badConfig = raw.prepare("INSERT INTO project_config (project_id, delivery_mode, yolo) VALUES ('p', 'yolo-mode', 0)");
    expect(() => badConfig.run()).toThrow(/CHECK/);
    const badApproval = raw.prepare("INSERT INTO approval (task_id, scope, decision, at) VALUES ('t', 'teardown', 'approved', 'now')");
    expect(() => badApproval.run()).toThrow(/CHECK/);
    raw.close();
  });
});
