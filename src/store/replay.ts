import { refuse, type Refusal } from "../machine/refusal";
import { createTask, transition } from "../machine/transition";
import type { TaskSnapshot } from "../machine/types";
import { rawCreateOf, rawEventOf, taskRowOf } from "./rows";
import type { Store } from "./store";
import type { TaskEventRow, TaskRow } from "./types";

export type ReplayResult =
  | { ok: true; snapshot: TaskSnapshot; lastSeq: number }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "corrupt"; seq: number; refusal: Refusal };

function corrupt(row: TaskEventRow, why: string): ReplayResult {
  return { ok: false, reason: "corrupt", seq: row.seq, refusal: refuse("corrupt_log", `Log row ${row.seq} (\`${row.event}\`): ${why}`) };
}

/** Rows that change state: applied rows, minus the `reconcile` annotations. */
function stateRows(store: Store, taskId: string): TaskEventRow[] {
  return store.listEvents({ taskId }).filter((row) => row.outcome === "applied" && row.event !== "reconcile");
}

/**
 * Rebuild a task by folding its applied rows through the machine. A row that
 * the machine would now refuse, or that records a different state than the
 * machine reaches, makes the task `corrupt`. Replay never guesses a state.
 */
export function replayTask(store: Store, taskId: string): ReplayResult {
  const rows = stateRows(store, taskId);
  const [first, ...rest] = rows;
  if (first === undefined) return { ok: false, reason: "not_found" };
  if (first.event !== "create") return corrupt(first, "the first applied row must be `create`.");

  const created = createTask(rawCreateOf(first));
  if (!created.ok) return corrupt(first, `the \`create\` row is unreadable: ${created.refusal.message}`);
  if (first.fromState !== null || first.toState !== "queued") return corrupt(first, "a `create` row must go from nothing to `queued`.");

  let snapshot = created.snapshot;
  for (const row of rest) {
    const result = transition(snapshot, rawEventOf(row));
    if (!result.ok) return corrupt(row, `the machine now refuses it with ${result.refusal.code}: ${result.refusal.message}`);
    if (result.from !== row.fromState || result.to !== row.toState) {
      return corrupt(row, `it records ${String(row.fromState)} to ${String(row.toState)}, but the machine gives ${result.from} to ${result.to}.`);
    }
    snapshot = result.snapshot;
  }
  return { ok: true, snapshot, lastSeq: rows[rows.length - 1]?.seq ?? first.seq };
}

export interface CorruptTask {
  taskId: string;
  /** The log row where replay stopped. */
  seq: number;
  message: string;
}

export interface RebuildReport {
  /** Tasks whose rows were written, by task ID. */
  rebuilt: string[];
  corrupt: CorruptTask[];
}

export interface RecoveryReport {
  /** Every non-terminal task with the snapshot its log produces. */
  replayed: Array<{ taskId: string; snapshot: TaskSnapshot }>;
  /** Tasks whose cache row was missing or differed from the replay, and now matches. */
  repaired: string[];
  corrupt: CorruptTask[];
  /** Terminal tasks, which recovery does not replay. */
  skipped: string[];
}

/** Every task that has an applied `create` row, by task ID. */
function createdTaskIds(store: Store): string[] {
  const ids = new Set<string>();
  for (const row of store.listEvents()) {
    if (row.outcome === "applied" && row.event === "create") ids.add(row.taskId);
  }
  return [...ids].sort();
}

function sameRow(a: TaskRow | null, b: TaskRow): boolean {
  return a !== null && (Object.keys(b) as Array<keyof TaskRow>).every((key) => a[key] === b[key]);
}

function corruptTask(taskId: string, result: Extract<ReplayResult, { reason: "corrupt" }>): CorruptTask {
  return { taskId, seq: result.seq, message: result.refusal.message };
}

/**
 * Throw away the task cache and write it again from the log. A corrupt task
 * gets no row, so a bad log can never look healthy.
 */
export function rebuildCache(store: Store): RebuildReport {
  return store.transaction(() => {
    store.clearTasks();
    const report: RebuildReport = { rebuilt: [], corrupt: [] };
    for (const taskId of createdTaskIds(store)) {
      const result = replayTask(store, taskId);
      if (result.ok) {
        store.putTask(taskRowOf(result.snapshot));
        report.rebuilt.push(taskId);
      } else if (result.reason === "corrupt") {
        report.corrupt.push(corruptTask(taskId, result));
      }
    }
    return report;
  });
}

/** True when the last state-changing row of a task leaves it `torn_down`. */
function isTerminal(store: Store, taskId: string): boolean {
  return stateRows(store, taskId).at(-1)?.toState === "torn_down";
}

/**
 * Start-up recovery. Replay every task that is not torn down, repair any cache
 * row that is missing or differs, and report everything it did. It changes
 * only the cache, never the log.
 */
export function recover(store: Store): RecoveryReport {
  return store.transaction(() => {
    const report: RecoveryReport = { replayed: [], repaired: [], corrupt: [], skipped: [] };
    for (const taskId of createdTaskIds(store)) {
      if (isTerminal(store, taskId)) {
        report.skipped.push(taskId);
        continue;
      }
      const result = replayTask(store, taskId);
      if (!result.ok) {
        if (result.reason === "corrupt") report.corrupt.push(corruptTask(taskId, result));
        continue;
      }
      report.replayed.push({ taskId, snapshot: result.snapshot });
      const expected = taskRowOf(result.snapshot);
      if (!sameRow(store.getTask(taskId), expected)) {
        store.putTask(expected);
        report.repaired.push(taskId);
      }
    }
    return report;
  });
}
