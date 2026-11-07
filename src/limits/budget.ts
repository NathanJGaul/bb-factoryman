import { errorText, type Runtime } from "../runtime";
import type { TaskRow } from "../store/types";
import type { Limits } from "../workflow/types";
import { RUNNING_STATES } from "./queue";

export type { Limits } from "../workflow/types";

export type BudgetResult = { ok: true; notes: string[] } | { ok: false; text: string };

const ok = (notes: string[] = []): BudgetResult => ({ ok: true, notes });

/** Tasks of the project whose `create` row is dated today (the UTC date of the injected clock). */
function createdToday(rt: Runtime, projectId: string, today: string): TaskRow[] {
  const { store } = rt.deps;
  const created = new Set(
    store
      .listEvents()
      .filter((row) => row.event === "create" && row.outcome === "applied" && row.at.slice(0, 10) === today)
      .map((row) => row.taskId),
  );
  return store.listTasks({ projectId }).filter((task) => created.has(task.taskId));
}

/**
 * Decide whether the project may start another task today. The day cap needs no
 * cost data. The budgets read the cost of each worker thread that bb reports,
 * and a cost that is missing, in another currency, or unreadable counts as
 * unknown: the budget is not enforced on it and the result says so (D-086).
 */
export async function checkBudget(rt: Runtime, projectId: string, limits: Limits): Promise<BudgetResult> {
  const { maxTasksPerDay, perDayBudget, perTaskBudget, budgetCurrency } = limits;
  if (maxTasksPerDay === undefined && perDayBudget === undefined && perTaskBudget === undefined) return ok();

  const today = rt.deps.now().slice(0, 10);
  const todays = createdToday(rt, projectId, today);
  if (maxTasksPerDay !== undefined && todays.length >= maxTasksPerDay) {
    return { ok: false, text: `Dispatch refused: this project already created ${todays.length} tasks today (limit ${maxTasksPerDay}, UTC day ${today}).` };
  }
  if (perDayBudget === undefined && perTaskBudget === undefined) return ok();

  const running = rt.deps.store.listTasks({ projectId }).filter((task) => RUNNING_STATES.includes(task.state));
  const costs = new Map<string, number | null>();
  for (const task of [...todays, ...running]) {
    if (task.workerThreadId === null || costs.has(task.taskId)) continue;
    try {
      const cost = await rt.deps.bb.getThreadCost(task.workerThreadId);
      costs.set(task.taskId, cost !== null && cost.currency === budgetCurrency ? cost.amount : null);
    } catch (error) {
      rt.deps.log.warn(`Could not read the cost of thread ${task.workerThreadId} for task ${task.taskId}: ${errorText(error)}`);
      costs.set(task.taskId, null);
    }
  }

  const notes: string[] = [];
  const known = [...costs.values()].filter((amount): amount is number => amount !== null);
  const budgets = [perDayBudget === undefined ? null : "perDayBudget", perTaskBudget === undefined ? null : "perTaskBudget"].filter((name) => name !== null).join(" and ");

  if (perDayBudget !== undefined) {
    const spent = todays.reduce((sum, task) => sum + (costs.get(task.taskId) ?? 0), 0);
    if (spent >= perDayBudget) {
      return { ok: false, text: `Dispatch refused: this project spent ${spent} ${budgetCurrency} today, which reaches the perDayBudget of ${perDayBudget} ${budgetCurrency}.` };
    }
  }
  if (perTaskBudget !== undefined) {
    for (const task of running) {
      const amount = costs.get(task.taskId);
      if (amount !== null && amount !== undefined && amount > perTaskBudget) {
        return { ok: false, text: `Dispatch refused: task ${task.taskId} has cost ${amount} ${budgetCurrency}, over the perTaskBudget of ${perTaskBudget} ${budgetCurrency}. Stop it first.` };
      }
    }
  }

  const unknown = [...costs.entries()].filter(([, amount]) => amount === null).length;
  if (costs.size > 0 && known.length === 0) {
    notes.push(
      `Cost data from bb is unavailable for ${costs.size} ${costs.size === 1 ? "task" : "tasks"}, so ${budgets} could not be checked.` +
        (maxTasksPerDay === undefined ? " No spend limit is in force." : " maxTasksPerDay is the only spend limit in force."),
    );
  } else if (unknown > 0) {
    notes.push(`The cost of ${unknown} ${unknown === 1 ? "task" : "tasks"} is unknown (no data or another currency), so ${budgets} could not be checked fully.`);
  }
  return ok(notes);
}
