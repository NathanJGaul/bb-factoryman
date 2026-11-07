import type { Runtime } from "../runtime";

export interface Limits {
  maxWorkers?: number;
  perTaskBudget?: number;
  perDayBudget?: number;
  maxTasksPerDay?: number;
  budgetCurrency: string;
}

export type BudgetResult = { ok: true; notes: string[] } | { ok: false; text: string };

export async function checkBudget(_rt: Runtime, _projectId: string, _limits: Limits): Promise<BudgetResult> {
  return { ok: true, notes: [] };
}
