import type { DeliveryMode } from "../machine/types";
import type { ProjectConfig } from "../store/types";
import type { WorkflowConfig } from "./types";

export type EffectiveResult = { ok: true; config: ProjectConfig } | { ok: false; message: string };

/** The strictest mode ranks highest. A file can move a project up this ladder and never down it. */
const RIGOR: Record<DeliveryMode, number> = { "no-mistakes": 3, "direct-PR": 2, "local-only": 1 };

/**
 * The project config that a call uses: the stored config, tightened by the
 * file. The file fills a blank prefix or default machine, and it can raise the
 * delivery mode but never lower it. `yolo` and `baseBranch` come from the store
 * alone (D-078).
 */
export function effectiveProject(stored: ProjectConfig, workflow: WorkflowConfig): EffectiveResult {
  const { deliveryMode, branchPrefix, defaultMachine } = workflow.project;
  if (deliveryMode !== undefined && RIGOR[deliveryMode] < RIGOR[stored.deliveryMode]) {
    return {
      ok: false,
      message: `workflow.json sets deliveryMode \`${deliveryMode}\`, which is less strict than the project's \`${stored.deliveryMode}\`. Config can add checks and never loosen a gate`,
    };
  }
  return {
    ok: true,
    config: {
      ...stored,
      deliveryMode: deliveryMode ?? stored.deliveryMode,
      branchPrefix: stored.branchPrefix ?? branchPrefix ?? null,
      defaultMachine: stored.defaultMachine ?? defaultMachine ?? null,
    },
  };
}
