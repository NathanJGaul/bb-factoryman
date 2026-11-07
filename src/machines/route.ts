import type { BbPort } from "../bb/port";
import type { TaskRow } from "../store/types";

/**
 * The host where a task's commands must run: its machine when that is not the
 * host that holds the clone, and null (the server) otherwise. A failed read
 * throws, so callers fail closed.
 */
export async function hostFor(bb: Pick<BbPort, "getProjectSources">, task: Pick<TaskRow, "machine" | "projectId">): Promise<string | null> {
  if (task.machine === null) return null;
  const sources = await bb.getProjectSources(task.projectId);
  const cloneHost = sources.find((source) => source.isDefault)?.hostId ?? null;
  return task.machine === cloneHost ? null : task.machine;
}
