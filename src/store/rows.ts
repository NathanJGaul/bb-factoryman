import type { TaskSnapshot } from "../machine/types";
import type { TaskEventRow, TaskRow } from "./types";

/** The cache row for a snapshot. */
export function taskRowOf(snapshot: TaskSnapshot): TaskRow {
  const { context, state } = snapshot;
  return {
    taskId: context.taskId,
    projectId: context.projectId,
    kind: context.kind,
    mode: context.mode,
    state,
    workerThreadId: context.workerThreadId,
    branch: context.branch,
    machine: context.machine,
    pullRequestUrl: context.prUrl,
  };
}

/** The raw event that produced a log row, as the machine expects to read it. */
export function rawEventOf(row: TaskEventRow): Record<string, unknown> {
  return {
    type: row.event,
    actor: row.actor,
    ...(row.evidence !== null ? { evidence: row.evidence } : {}),
    ...row.payload,
  };
}

/** The raw `create` event that produced a log row. */
export function rawCreateOf(row: TaskEventRow): Record<string, unknown> {
  return { type: "create", actor: row.actor, taskId: row.taskId, ...row.payload };
}
