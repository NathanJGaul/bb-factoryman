import { errorText, type Runtime } from "../runtime";

/**
 * After each applied event, stamp the worker thread's plugin metadata with the
 * task's ID, kind, mode, state, and machine, so other plugins can group or
 * label threads by task (D-081). It never writes `role`: tool visibility stays
 * as it was, and authority still comes from the store. A failed write is
 * logged and never undoes the event.
 */
export function registerStamper(rt: Runtime): void {
  rt.onApplied(async ({ task }) => {
    if (task.workerThreadId === null) return;
    try {
      await rt.deps.bb.setThreadMetadata(task.workerThreadId, { taskId: task.taskId, kind: task.kind, mode: task.mode, state: task.state, machine: task.machine });
    } catch (error) {
      rt.deps.log.warn(`Could not stamp thread ${task.workerThreadId} for task ${task.taskId}: ${errorText(error)}`);
    }
  });
}
