import type { DeliveryMode } from "../machine/types";

/** One command that must pass before a task reaches review ready. It runs with no shell. */
export interface Check {
  readonly name: string;
  readonly argv: readonly string[];
  readonly timeoutSeconds?: number;
}

/** The parsed `.bb/factoryman/workflow.json`. Every field can only tighten the workflow (hard rule 7). */
export interface WorkflowConfig {
  readonly version: 1;
  readonly project: {
    readonly deliveryMode?: DeliveryMode;
    readonly branchPrefix?: string;
    readonly defaultMachine?: string;
  };
  readonly checks: Readonly<Partial<Record<DeliveryMode, readonly Check[]>>>;
}
