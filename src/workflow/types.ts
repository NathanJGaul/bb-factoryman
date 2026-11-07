import type { DeliveryMode } from "../machine/types";

/** One command that must pass before a task reaches review ready. It runs with no shell. */
export interface Check {
  readonly name: string;
  readonly argv: readonly string[];
  readonly timeoutSeconds?: number;
}

/** Limits that only restrict work. Every field but the currency is optional. */
export interface Limits {
  readonly maxWorkers?: number;
  readonly perTaskBudget?: number;
  readonly perDayBudget?: number;
  readonly maxTasksPerDay?: number;
  readonly budgetCurrency: string;
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
  readonly limits: Limits;
}
