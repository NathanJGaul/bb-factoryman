import type { ProjectConfig } from "../store/types";
import type { WorkflowConfig } from "./types";

export type EffectiveResult = { ok: true; config: ProjectConfig } | { ok: false; message: string };

export function effectiveProject(stored: ProjectConfig, _workflow: WorkflowConfig): EffectiveResult {
  return { ok: true, config: stored };
}
