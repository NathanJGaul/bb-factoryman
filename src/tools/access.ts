import type { Store } from "../store/store";
import type { TaskRow } from "../store/types";

export type Identity = { role: "worker"; task: TaskRow } | { role: "other" };

/**
 * Decide who is calling from the store alone. A thread is a worker only when a
 * task records it as its worker thread. Plugin metadata never decides this,
 * because the thread's own agent can write it.
 */
export function identify(store: Store, threadId: string): Identity {
  const task = store.listTasks().find((candidate) => candidate.workerThreadId === threadId);
  return task === undefined ? { role: "other" } : { role: "worker", task };
}

/** A supervisor reaches only the tasks of its own project. */
export function sameProject(task: TaskRow, projectId: string): boolean {
  return task.projectId === projectId;
}
