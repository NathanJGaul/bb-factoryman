import type { BbPort } from "../bb/port";
import type { TaskRow } from "../store/types";

export async function hostFor(_bb: Pick<BbPort, "getProjectSources">, _task: Pick<TaskRow, "machine" | "projectId">): Promise<string | null> {
  return null;
}
