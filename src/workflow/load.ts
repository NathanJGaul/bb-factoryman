import type { Files } from "../files";
import type { WorkflowConfig } from "./types";

export type LoadWorkflowResult = { ok: true; config: WorkflowConfig } | { ok: false; message: string };

export async function loadWorkflowConfig(_files: Files, _checkout: string | null): Promise<LoadWorkflowResult> {
  return { ok: false, message: "not implemented" };
}
