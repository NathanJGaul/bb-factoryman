import { z } from "zod";
import { refuse } from "../machine/refusal";
import type { Runtime } from "../runtime";
import { identify } from "./access";
import type { Caller } from "./dispatch";
import { refusalOutcome, stateText, success, type ToolOutcome } from "./results";

export const reportSchema = z.strictObject({
  outcome: z.enum(["done", "blocked", "failed"]),
  evidence: z.string(),
  prUrl: z.url().optional(),
  landedCommits: z.number().int().min(0).optional(),
});

/**
 * A worker hands back its outcome. The task is the one the store records for
 * the calling thread, so a worker cannot report for another task. The machine
 * decides every refusal, including missing evidence.
 */
export async function report(rt: Runtime, caller: Caller, raw: unknown): Promise<ToolOutcome> {
  const identity = identify(rt.deps.store, caller.threadId);
  if (identity.role !== "worker") {
    return refusalOutcome(refuse("actor_forbidden", "Only the worker of a task can report on it."));
  }
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue && issue.path.length > 0 ? ` at \`${issue.path.join(".")}\`` : "";
    return refusalOutcome(refuse("invalid_event", `Invalid report arguments${where}: ${issue?.message ?? "unreadable"}.`));
  }
  const { outcome, evidence, prUrl, landedCommits } = parsed.data;
  const { task } = identity;

  const base = { actor: "worker", evidence } as const;
  let event: Record<string, unknown>;
  if (outcome === "blocked") event = { type: "block", ...base };
  else if (outcome === "failed") event = { type: "fail", ...base };
  else if (task.kind === "scout") event = { type: "report", ...base };
  else if (task.mode === "no-mistakes") event = { type: "handoff", ...base };
  else event = { type: "ready", ...base, ...(prUrl === undefined ? {} : { prUrl }), ...(landedCommits === undefined ? {} : { landedCommits }) };

  const applied = await rt.apply(task.taskId, event);
  return applied.ok ? success(stateText(applied.task)) : refusalOutcome(applied.refusal);
}
