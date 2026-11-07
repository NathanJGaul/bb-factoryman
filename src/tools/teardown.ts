import { z } from "zod";
import { worktreeReport } from "../git/report";
import { hostFor } from "../machines/route";
import { refuse } from "../machine/refusal";
import { errorText, type Runtime } from "../runtime";
import { identify, sameProject } from "./access";
import type { Caller } from "./dispatch";
import { failure, refusalOutcome, success, type ToolOutcome } from "./results";

export const teardownSchema = z.strictObject({ taskId: z.string().min(1) });

/**
 * Remove a finished worker's environment. The facts about uncommitted and
 * unpushed work come from git, never from an argument. The environment goes
 * only after the machine has accepted `teardown` (hard rule 2).
 */
export async function teardown(rt: Runtime, caller: Caller, raw: unknown): Promise<ToolOutcome> {
  const { store, bb } = rt.deps;
  if (identify(store, caller.threadId).role === "worker") {
    return refusalOutcome(refuse("actor_forbidden", "A worker cannot tear down a task."));
  }
  const parsed = teardownSchema.safeParse(raw);
  if (!parsed.success) {
    return refusalOutcome(refuse("invalid_event", `Invalid teardown arguments: ${parsed.error.issues[0]?.message ?? "unreadable"}.`));
  }
  const { taskId } = parsed.data;
  const task = store.getTask(taskId);
  if (task === null || !sameProject(task, caller.projectId)) return failure(`No task ${taskId} exists in this project.`);
  if (task.workerThreadId === null) return refusalOutcome(refuse("illegal_transition", `Task ${taskId} has no worker, so there is nothing to tear down.`));

  let environmentId: string | null;
  let path: string | null;
  try {
    environmentId = (await bb.getThread(task.workerThreadId))?.environmentId ?? null;
    path = environmentId === null ? null : await bb.getEnvironmentPath(environmentId);
  } catch (error) {
    return failure(`Teardown refused: could not read the worker's environment (${errorText(error)}). Nothing was recorded.`);
  }
  if (environmentId === null || path === null) {
    return failure(`Teardown refused: bb reports no worktree path for task ${taskId}, so the landed-work check cannot run. Nothing was recorded.`);
  }

  let host: string | null;
  try {
    host = await hostFor(bb, task);
  } catch (error) {
    return failure(`Teardown refused: could not tell which machine holds the worktree (${errorText(error)}). Nothing was recorded.`);
  }
  const report = await worktreeReport(rt.deps.exec, { path, mode: task.mode, baseBranch: store.getProjectConfig(task.projectId).baseBranch, host });
  if (!report.ok) return failure(`Teardown refused: could not read the worktree (${report.message}). Nothing was recorded.`);

  const applied = await rt.apply(taskId, { type: "teardown", actor: "supervisor", worktree: report.report });
  if (!applied.ok) return refusalOutcome(applied.refusal);

  try {
    await bb.retireWorker(task.workerThreadId, environmentId);
  } catch (error) {
    return success(`Task ${taskId} is torn down, but bb could not remove its environment yet (${errorText(error)}). bb removes it when the last thread is archived.`);
  }
  return success(`Task ${taskId} is torn down.`);
}
