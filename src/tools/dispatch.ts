import { z } from "zod";
import { refuse } from "../machine/refusal";
import { errorText, type Runtime } from "../runtime";
import { identify } from "./access";
import { buildWorkerPrompt } from "./prompt";
import { failure, refusalOutcome, success, type ToolOutcome } from "./results";

/** What bb tells a tool about its caller. */
export interface Caller {
  threadId: string;
  projectId: string;
}

const nonBlank = z.string().refine((value) => value.trim() !== "", "must not be blank");

export const dispatchSchema = z.strictObject({
  kind: z.enum(["ship", "scout"]),
  description: nonBlank,
  profile: z.strictObject({
    provider: nonBlank,
    model: nonBlank,
    reasoningLevel: nonBlank,
    permissionMode: z.enum(["accept-edits", "auto", "full"]),
  }),
});

/** The branch prefix when a project config sets none (D-034). */
export const DEFAULT_BRANCH_PREFIX = "fm/";

/**
 * Create a task and its worker. The caller supplies the whole profile until the
 * dispatch resolver exists (milestone 7), and the worker runs on the default
 * host until machine placement exists (milestone 8).
 */
export async function dispatch(rt: Runtime, caller: Caller, raw: unknown): Promise<ToolOutcome> {
  const { store, bb } = rt.deps;
  if (identify(store, caller.threadId).role === "worker") {
    return refusalOutcome(refuse("actor_forbidden", "A worker cannot dispatch tasks."));
  }
  const parsed = dispatchSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue && issue.path.length > 0 ? ` at \`${issue.path.join(".")}\`` : "";
    return refusalOutcome(refuse("invalid_event", `Invalid dispatch arguments${where}: ${issue?.message ?? "unreadable"}.`));
  }
  const { kind, description, profile } = parsed.data;

  const config = store.getProjectConfig(caller.projectId);
  const taskId = rt.deps.newId();
  const branch = `${config.branchPrefix ?? DEFAULT_BRANCH_PREFIX}${taskId}`;
  const created = rt.log.create({ type: "create", actor: "supervisor", taskId, projectId: caller.projectId, kind, mode: config.deliveryMode });
  if (!created.ok) return refusalOutcome(created.refusal);

  let threadId: string;
  try {
    ({ threadId } = await bb.spawnWorker({
      projectId: caller.projectId,
      parentThreadId: caller.threadId,
      prompt: buildWorkerPrompt({ taskId, kind, mode: config.deliveryMode, branch, description }),
      profile,
      metadata: { role: "worker", taskId, kind },
      baseBranch: config.baseBranch,
    }));
  } catch (error) {
    await rt.apply(taskId, { type: "fail", actor: "system", evidence: `worker spawn failed: ${errorText(error)}` });
    return failure(`Dispatch failed: the worker could not start (${errorText(error)}). Task ${taskId} is failed.`);
  }

  const started = await rt.apply(taskId, { type: "start", actor: "supervisor", profile, threadId, branch, evidence: description });
  if (!started.ok) return refusalOutcome(started.refusal);

  // The worker can fail before this record exists, and no event would reach us then.
  try {
    if ((await bb.getThread(threadId))?.status === "error") {
      await rt.apply(taskId, { type: "fail", actor: "system", evidence: "worker thread entered the error state right after it started" });
      return failure(`Task ${taskId} started, but its worker thread ${threadId} failed at once. Task ${taskId} is failed.`);
    }
  } catch (error) {
    rt.deps.log.warn(`Could not read worker thread ${threadId} after start: ${errorText(error)}`);
  }

  return success(`Dispatched ${kind} task ${taskId} in ${config.deliveryMode} mode. Worker thread ${threadId}, branch ${branch}.`);
}
