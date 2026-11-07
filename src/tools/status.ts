import { z } from "zod";
import { TASK_STATES } from "../machine/types";
import type { Runtime } from "../runtime";
import { refuse } from "../machine/refusal";
import type { TaskRow } from "../store/types";
import { identify, sameProject } from "./access";
import type { Caller } from "./dispatch";
import { clip, failure, refusalOutcome, success, type ToolOutcome } from "./results";

export const statusSchema = z.strictObject({
  taskId: z.string().optional(),
  states: z.array(z.enum(TASK_STATES)).optional(),
});

function describeTask(rt: Runtime, task: TaskRow): string {
  const lines = [`Task ${task.taskId}: ${task.kind}, ${task.mode}, state ${task.state}`];
  if (task.workerThreadId !== null) lines.push(`  worker thread: ${task.workerThreadId}`);
  if (task.branch !== null) lines.push(`  branch: ${task.branch}`);
  if (task.pullRequestUrl !== null) lines.push(`  pull request: ${task.pullRequestUrl}`);
  const start = rt.deps.store.listEvents({ taskId: task.taskId }).find((row) => row.event === "start" && row.outcome === "applied");
  const firstLine = start?.evidence?.split("\n")[0]?.trim();
  if (firstLine) lines.push(`  description: ${clip(firstLine, 120)}`);
  return lines.join("\n");
}

/** Read task state. This tool never writes to the log. */
export async function status(rt: Runtime, caller: Caller, raw: unknown): Promise<ToolOutcome> {
  const { store } = rt.deps;
  if (identify(store, caller.threadId).role === "worker") {
    return refusalOutcome(refuse("actor_forbidden", "A worker cannot read the fleet. Use factoryman_report."));
  }
  const parsed = statusSchema.safeParse(raw);
  if (!parsed.success) {
    return refusalOutcome(refuse("invalid_event", `Invalid status arguments: ${parsed.error.issues[0]?.message ?? "unreadable"}.`));
  }
  const { taskId, states } = parsed.data;
  if (taskId !== undefined) {
    const task = store.getTask(taskId);
    return task !== null && sameProject(task, caller.projectId)
      ? success(describeTask(rt, task))
      : failure(`No task ${taskId} exists in this project.`);
  }
  const tasks = store.listTasks({ projectId: caller.projectId, ...(states === undefined ? {} : { states }) });
  return tasks.length === 0 ? success("No tasks match.") : success(tasks.map((task) => describeTask(rt, task)).join("\n"));
}
