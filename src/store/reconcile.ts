import type { TaskState } from "../machine/types";
import { replayTask } from "./replay";
import type { Store } from "./store";
import type { TaskEventRow } from "./types";

/** What the caller saw in live bb for one task. `missing` means bb has no trace of it. */
export interface LiveObservation {
  taskId: string;
  state: TaskState | "missing";
}

export interface ReconcileReport {
  /** The `reconcile` rows this call wrote. */
  appended: TaskEventRow[];
  /** Tasks whose observation equals the replayed state. */
  matching: string[];
  /** Tasks whose mismatch is already the last log row, so nothing was written. */
  deduplicated: string[];
  /** Observations for tasks that the log does not know. */
  unknown: string[];
  /** Observations for tasks whose log is corrupt. */
  corrupt: string[];
}

/**
 * Compare replayed state with live observations. Each mismatch becomes one
 * `reconcile` row that names both states. Reconcile never changes task state,
 * the cache, or approvals: a person or a legal event settles the difference.
 */
export function reconcile(store: Store, observations: readonly LiveObservation[], options: { now?: () => string } = {}): ReconcileReport {
  const now = options.now ?? (() => new Date().toISOString());
  return store.transaction(() => {
    const report: ReconcileReport = { appended: [], matching: [], deduplicated: [], unknown: [], corrupt: [] };
    for (const { taskId, state: observed } of observations) {
      const replay = replayTask(store, taskId);
      if (!replay.ok) {
        (replay.reason === "not_found" ? report.unknown : report.corrupt).push(taskId);
        continue;
      }
      const logged = replay.snapshot.state;
      if (observed === logged) {
        report.matching.push(taskId);
        continue;
      }
      const last = store.listEvents({ taskId }).at(-1);
      if (last?.event === "reconcile" && last.payload.observed === observed) {
        report.deduplicated.push(taskId);
        continue;
      }
      report.appended.push(
        store.appendEvent({
          taskId,
          at: now(),
          fromState: logged,
          toState: logged,
          event: "reconcile",
          actor: "system",
          evidence: `The log says the task is ${logged}, but bb reports ${observed}.`,
          payload: { observed },
          outcome: "applied",
          reasonCode: null,
          reasonMessage: null,
        }),
      );
    }
    return report;
  });
}
