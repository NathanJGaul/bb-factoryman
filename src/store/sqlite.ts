import Database from "better-sqlite3";
import { APPROVAL_DECISIONS, APPROVAL_SCOPES, DELIVERY_MODES, TASK_KINDS, TASK_STATES } from "../machine/types";
import { defaultProjectConfig, type Store } from "./store";
import type { ApprovalRow, ProjectConfig, TaskEventRow, TaskRow } from "./types";

/** Bump this when the schema changes, and add a migration step in `migrate`. */
export const SCHEMA_VERSION = 1;

const list = (values: readonly string[]) => values.map((v) => `'${v}'`).join(", ");

const SCHEMA = `
CREATE TABLE project_config (
  project_id TEXT PRIMARY KEY,
  delivery_mode TEXT NOT NULL CHECK (delivery_mode IN (${list(DELIVERY_MODES)})),
  yolo INTEGER NOT NULL CHECK (yolo IN (0, 1)),
  branch_prefix TEXT,
  base_branch TEXT,
  default_machine TEXT
);

CREATE TABLE task (
  task_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN (${list(TASK_KINDS)})),
  mode TEXT NOT NULL CHECK (mode IN (${list(DELIVERY_MODES)})),
  state TEXT NOT NULL CHECK (state IN (${list(TASK_STATES)})),
  worker_thread_id TEXT,
  branch TEXT,
  machine TEXT,
  pull_request_url TEXT
);

CREATE TABLE task_event (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  at TEXT NOT NULL,
  from_state TEXT CHECK (from_state IS NULL OR from_state IN (${list(TASK_STATES)})),
  to_state TEXT CHECK (to_state IS NULL OR to_state IN (${list(TASK_STATES)})),
  event TEXT NOT NULL,
  actor TEXT NOT NULL,
  evidence TEXT,
  payload TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('applied', 'refused')),
  reason_code TEXT,
  reason_message TEXT
);
CREATE INDEX task_event_by_task ON task_event (task_id, seq);
CREATE TRIGGER task_event_no_update BEFORE UPDATE ON task_event
BEGIN SELECT RAISE(ABORT, 'task_event is append-only'); END;
CREATE TRIGGER task_event_no_delete BEFORE DELETE ON task_event
BEGIN SELECT RAISE(ABORT, 'task_event is append-only'); END;

CREATE TABLE approval (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN (${list(APPROVAL_SCOPES)})),
  decision TEXT NOT NULL CHECK (decision IN (${list(APPROVAL_DECISIONS)})),
  at TEXT NOT NULL
);
CREATE INDEX approval_by_task ON approval (task_id, id);
CREATE TRIGGER approval_no_update BEFORE UPDATE ON approval
BEGIN SELECT RAISE(ABORT, 'approval is append-only'); END;
CREATE TRIGGER approval_no_delete BEFORE DELETE ON approval
BEGIN SELECT RAISE(ABORT, 'approval is append-only'); END;
`;

function migrate(db: Database.Database): void {
  const version = db.pragma("user_version", { simple: true }) as number;
  if (version > SCHEMA_VERSION) {
    throw new Error(`The database schema version ${version} is newer than this plugin supports (${SCHEMA_VERSION}). Update the plugin.`);
  }
  if (version === 0) {
    db.transaction(() => {
      db.exec(SCHEMA);
      db.pragma(`user_version = ${SCHEMA_VERSION}`);
    })();
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

type Raw = Record<string, unknown>;

function eventFromRow(r: Raw): TaskEventRow {
  return deepFreeze({
    seq: r.seq,
    taskId: r.task_id,
    at: r.at,
    fromState: r.from_state,
    toState: r.to_state,
    event: r.event,
    actor: r.actor,
    evidence: r.evidence,
    payload: JSON.parse(r.payload as string) as Record<string, unknown>,
    outcome: r.outcome,
    reasonCode: r.reason_code,
    reasonMessage: r.reason_message,
  } as TaskEventRow);
}

function taskFromRow(r: Raw): TaskRow {
  return deepFreeze({
    taskId: r.task_id,
    projectId: r.project_id,
    kind: r.kind,
    mode: r.mode,
    state: r.state,
    workerThreadId: r.worker_thread_id,
    branch: r.branch,
    machine: r.machine,
    pullRequestUrl: r.pull_request_url,
  } as TaskRow);
}

function approvalFromRow(r: Raw): ApprovalRow {
  return deepFreeze({ id: r.id, taskId: r.task_id, scope: r.scope, decision: r.decision, at: r.at } as ApprovalRow);
}

function configFromRow(r: Raw): ProjectConfig {
  return deepFreeze({
    projectId: r.project_id,
    deliveryMode: r.delivery_mode,
    yolo: r.yolo === 1,
    branchPrefix: r.branch_prefix,
    baseBranch: r.base_branch,
    defaultMachine: r.default_machine,
  } as ProjectConfig);
}

/**
 * Open the SQLite store. Pass a file path, `:memory:`, or an open
 * `better-sqlite3` database. The store closes only a database that it opened.
 */
export function openSqliteStore(target: string | Database.Database = ":memory:"): Store {
  const owned = typeof target === "string";
  const db = typeof target === "string" ? new Database(target) : target;
  migrate(db);

  const insertEvent = db.prepare(
    `INSERT INTO task_event (task_id, at, from_state, to_state, event, actor, evidence, payload, outcome, reason_code, reason_message)
     VALUES (@taskId, @at, @fromState, @toState, @event, @actor, @evidence, @payload, @outcome, @reasonCode, @reasonMessage)`,
  );
  const insertApproval = db.prepare("INSERT INTO approval (task_id, scope, decision, at) VALUES (@taskId, @scope, @decision, @at)");
  const upsertTask = db.prepare(
    `INSERT OR REPLACE INTO task (task_id, project_id, kind, mode, state, worker_thread_id, branch, machine, pull_request_url)
     VALUES (@taskId, @projectId, @kind, @mode, @state, @workerThreadId, @branch, @machine, @pullRequestUrl)`,
  );
  const upsertConfig = db.prepare(
    `INSERT OR REPLACE INTO project_config (project_id, delivery_mode, yolo, branch_prefix, base_branch, default_machine)
     VALUES (@projectId, @deliveryMode, @yolo, @branchPrefix, @baseBranch, @defaultMachine)`,
  );

  return {
    appendEvent(input) {
      const result = insertEvent.run({ ...input, payload: JSON.stringify(input.payload) });
      return deepFreeze({ ...structuredClone(input), seq: Number(result.lastInsertRowid) });
    },

    listEvents(query = {}) {
      const where: string[] = [];
      const params: Raw = {};
      if (query.taskId !== undefined) {
        where.push("task_id = @taskId");
        params.taskId = query.taskId;
      }
      if (query.afterSeq !== undefined) {
        where.push("seq > @afterSeq");
        params.afterSeq = query.afterSeq;
      }
      const sql = `SELECT * FROM task_event ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY seq`;
      return (db.prepare(sql).all(params) as Raw[]).map(eventFromRow);
    },

    getTask(taskId) {
      const row = db.prepare("SELECT * FROM task WHERE task_id = ?").get(taskId) as Raw | undefined;
      return row === undefined ? null : taskFromRow(row);
    },

    listTasks(filter = {}) {
      const where: string[] = [];
      const params: unknown[] = [];
      if (filter.projectId !== undefined) {
        where.push("project_id = ?");
        params.push(filter.projectId);
      }
      if (filter.states !== undefined) {
        where.push(`state IN (${filter.states.map(() => "?").join(", ") || "NULL"})`);
        params.push(...filter.states);
      }
      const sql = `SELECT * FROM task ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY task_id`;
      return (db.prepare(sql).all(...params) as Raw[]).map(taskFromRow);
    },

    putTask(row) {
      upsertTask.run(row);
    },

    clearTasks() {
      db.prepare("DELETE FROM task").run();
    },

    addApproval(input) {
      const result = insertApproval.run(input);
      return deepFreeze({ ...input, id: Number(result.lastInsertRowid) });
    },

    listApprovals(taskId) {
      return (db.prepare("SELECT * FROM approval WHERE task_id = ? ORDER BY id").all(taskId) as Raw[]).map(approvalFromRow);
    },

    getProjectConfig(projectId) {
      const row = db.prepare("SELECT * FROM project_config WHERE project_id = ?").get(projectId) as Raw | undefined;
      return row === undefined ? deepFreeze(defaultProjectConfig(projectId)) : configFromRow(row);
    },

    putProjectConfig(config) {
      upsertConfig.run({ ...config, yolo: config.yolo ? 1 : 0 });
    },

    transaction(fn) {
      return db.transaction(fn)();
    },

    close() {
      if (owned) db.close();
    },
  };
}
