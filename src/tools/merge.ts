import { z } from "zod";
import type { MergeExecutor, MergeInput } from "../git/merge";
import { refuse } from "../machine/refusal";
import { errorText, type Runtime } from "../runtime";
import type { TaskRow } from "../store/types";
import { wouldAccept } from "./preview";
import { identify, sameProject } from "./access";
import type { Caller } from "./dispatch";
import { failure, refusalOutcome, success, type ToolOutcome } from "./results";

export const MERGE_RENDERER_ID = "factoryman-merge-approval";
/** The states in which `factoryman_merge` accepts a task. A task that waits for the owner stays in the second one. */
export const MERGEABLE_STATES: readonly string[] = ["review_ready", "awaiting_approval"];

export const mergeSchema = z.strictObject({ taskId: z.string().min(1) });

/** The only answers the approval form accepts. Anything else counts as no answer. */
export const approvalAnswerSchema = z.strictObject({
  decision: z.enum(["approved", "denied"]),
  comment: z.string().optional(),
});

/** The evidence the form shows the owner: the latest evidence that put the task in review. */
function reviewEvidence(rt: Runtime, task: TaskRow): string {
  const rows = rt.deps.store.listEvents({ taskId: task.taskId }).filter((row) => row.outcome === "applied" && row.evidence);
  return rows.findLast((row) => ["validated", "ready"].includes(row.event))?.evidence ?? "";
}

/**
 * Ask for the owner's approval and merge. Every step that the machine could
 * refuse runs before the merge command, and the `merge` event is recorded only
 * after the command succeeds, so a failure never leaves the log claiming a merge.
 */
export async function merge(rt: Runtime, executor: MergeExecutor, caller: Caller, raw: unknown): Promise<ToolOutcome> {
  const { store } = rt.deps;
  if (identify(store, caller.threadId).role === "worker") {
    return refusalOutcome(refuse("actor_forbidden", "A worker cannot merge."));
  }
  const parsed = mergeSchema.safeParse(raw);
  if (!parsed.success) {
    return refusalOutcome(refuse("invalid_event", `Invalid merge arguments: ${parsed.error.issues[0]?.message ?? "unreadable"}.`));
  }
  const { taskId } = parsed.data;
  const task = store.getTask(taskId);
  if (task === null || !sameProject(task, caller.projectId)) return failure(`No task ${taskId} exists in this project.`);
  if (task.kind !== "ship") return refusalOutcome(refuse("illegal_transition", "Only a ship task can be merged."));
  if (!MERGEABLE_STATES.includes(task.state)) {
    return refusalOutcome(refuse("illegal_transition", `Task ${taskId} is ${task.state}. A merge needs review_ready or awaiting_approval.`));
  }
  if (rt.openMergeForms.has(taskId)) return failure(`A merge approval for task ${taskId} is already waiting for the owner.`);
  rt.openMergeForms.add(taskId);
  try {
    return await mergeClaimed(rt, executor, caller, task);
  } finally {
    rt.openMergeForms.delete(taskId);
  }
}

async function mergeClaimed(rt: Runtime, executor: MergeExecutor, caller: Caller, task: TaskRow): Promise<ToolOutcome> {
  const { store, bb } = rt.deps;
  const taskId = task.taskId;
  const config = store.getProjectConfig(task.projectId);
  const input: MergeInput = {
    task,
    config,
    checkoutPath: task.mode === "local-only" ? await bb.getProjectCheckout(task.projectId) : null,
    remoteUrl: task.mode === "local-only" ? null : await bb.getProjectRemote(task.projectId),
    method: rt.deps.settings().mergeMethod,
  };
  const blocked = await executor.preflight(input);
  if (blocked !== null) return failure(`Merge refused: ${blocked}`);

  if (task.state === "review_ready") {
    const requested = await rt.apply(taskId, { type: "request_approval", actor: "supervisor" });
    if (!requested.ok) return refusalOutcome(requested.refusal);
  }

  if (!config.yolo) {
    const result = await bb.requestInput({
      threadId: caller.threadId,
      rendererId: MERGE_RENDERER_ID,
      title: `Approve merge of task ${taskId}`,
      payload: { taskId, branch: task.branch ?? "", prUrl: task.pullRequestUrl ?? "", evidence: reviewEvidence(rt, task) },
      timeoutMs: rt.deps.settings().approvalTimeoutMs,
      ...(caller.signal === undefined ? {} : { signal: caller.signal }),
    });
    if (result.outcome === "cancelled") {
      return failure(`The owner did not answer the merge form (${result.reason}). Task ${taskId} stays awaiting_approval. Call factoryman_merge again to ask again.`);
    }
    const answer = approvalAnswerSchema.safeParse(result.value);
    if (!answer.success) {
      return failure(`The merge form came back with an unreadable answer, so nothing was recorded. Task ${taskId} stays awaiting_approval.`);
    }
    const recorded = await rt.apply(taskId, {
      type: "record_approval",
      actor: "user",
      scope: "merge",
      decision: answer.data.decision,
      ...(answer.data.comment === undefined ? {} : { evidence: answer.data.comment }),
    });
    if (!recorded.ok) return refusalOutcome(recorded.refusal);
    if (answer.data.decision === "denied") {
      return failure(`The owner denied the merge${answer.data.comment ? `: ${answer.data.comment}` : "."} Task ${taskId} stays awaiting_approval.`);
    }
  }

  const mergeEvent = { type: "merge", actor: "supervisor", yolo: config.yolo };
  const preview = wouldAccept(store, taskId, mergeEvent);
  if (!preview.ok) return refusalOutcome(preview.refusal);

  let merged;
  try {
    merged = await executor.merge(input);
  } catch (error) {
    merged = { ok: false as const, message: errorText(error) };
  }
  if (!merged.ok) return failure(`Merge failed: ${merged.message}. No merge was recorded, and task ${taskId} stays awaiting_approval.`);

  const applied = await rt.apply(taskId, mergeEvent);
  if (!applied.ok) {
    rt.deps.log.error(`The merge of ${taskId} ran, but the log refused the merge event (${applied.refusal.code}).`);
    return failure(`The merge ran, but the log refused the merge event (${applied.refusal.code}: ${applied.refusal.message}). Check the forge before doing anything else.`);
  }
  return success(`Task ${taskId} is merged${config.yolo ? " (yolo: no approval form)" : ""}.`);
}
