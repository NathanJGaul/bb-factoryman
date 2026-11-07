import type { ThreadInfo } from "../bb/port";
import { errorText, type Runtime } from "../runtime";
import { reconcile, type LiveObservation, type ReconcileReport } from "../store/reconcile";
import { replayTask } from "../store/replay";
import type { TaskRow } from "../store/types";
import type { Notifier } from "./wake";

/**
 * What live bb says about a task, in the terms that `reconcile` takes. bb knows
 * only the worker thread, so a healthy thread observes as the logged state.
 */
export function observe(task: TaskRow, thread: ThreadInfo | null): LiveObservation["state"] {
  if (thread === null || thread.deleted) return "missing";
  if (thread.status === "error") return "failed";
  return task.state;
}

/**
 * After recovery, compare every live task with its worker thread. A mismatch
 * becomes one `reconcile` row and one message to the supervisor. Nothing here
 * changes a task's state (hard rule 8, constitution III).
 */
export async function reconcileOnStart(rt: Runtime, notifier: Notifier): Promise<ReconcileReport> {
  const { store, bb, log } = rt.deps;
  const observations: LiveObservation[] = [];
  for (const task of store.listTasks()) {
    if (task.state === "torn_down" || task.workerThreadId === null) continue;
    const replay = replayTask(store, task.taskId);
    if (!replay.ok) {
      if (replay.reason === "corrupt") log.error(`Task ${task.taskId} has a corrupt log (row ${replay.seq}): ${replay.refusal.message}`);
      continue;
    }
    try {
      observations.push({ taskId: task.taskId, state: observe(task, await bb.getThread(task.workerThreadId)) });
    } catch (error) {
      log.warn(`Could not read worker thread ${task.workerThreadId} of task ${task.taskId} at start-up: ${errorText(error)}`);
    }
  }
  const report = reconcile(store, observations, { now: rt.deps.now });
  for (const row of report.appended) {
    const task = store.getTask(row.taskId);
    if (task) await notifier.wake(task, "reports: bb and the log disagree about its worker", row.evidence);
  }
  return report;
}
