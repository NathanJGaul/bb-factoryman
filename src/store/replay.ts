import { refuse, type Refusal } from "../machine/refusal";
import { createTask, transition } from "../machine/transition";
import type { TaskSnapshot } from "../machine/types";
import { rawCreateOf, rawEventOf } from "./rows";
import type { Store } from "./store";
import type { TaskEventRow } from "./types";

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
