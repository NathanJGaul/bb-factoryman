import type { DeliveryMode, TaskKind, TaskState } from "../machine/types";
import type { Runtime } from "../runtime";
import type { QueuedRequest } from "./request";

export const RUNNING_STATES: readonly TaskState[] = ["working", "blocked", "validating", "needs_decision"];

export interface Caps {
  project: number | null;
  global: number | null;
}

export function runningCount(_rt: Runtime, _projectId?: string): number {
  return 0;
}

export function capReached(_rt: Runtime, _projectId: string, _caps: Caps): string | null {
  return null;
}

export function enqueue(_rt: Runtime, _input: { projectId: string; kind: TaskKind; mode: DeliveryMode; request: QueuedRequest }): { ok: true; taskId: string } | { ok: false; message: string } {
  return { ok: false, message: "not implemented" };
}

export async function drain(_rt: Runtime): Promise<number> {
  return 0;
}

export function registerQueue(_rt: Runtime): void {
  // Not implemented.
}
