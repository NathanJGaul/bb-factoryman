import type { WorkflowConfig } from "./types";

export type ParseWorkflowResult = { ok: true; config: WorkflowConfig } | { ok: false; message: string };

export const GATE_KEYS: readonly string[] = [];

export function emptyWorkflowConfig(): WorkflowConfig {
  throw new Error("not implemented");
}

export function parseWorkflowConfig(_raw: unknown): ParseWorkflowResult {
  return { ok: false, message: "not implemented" };
}
