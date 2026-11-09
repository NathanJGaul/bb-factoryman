import { z } from "zod";
import { refuse } from "../machine/refusal";
import { hostFor } from "../machines/route";
import { errorText, type Runtime } from "../runtime";
import { describeObservation, observeValidatorAgent } from "../validator/agent";
import { failureText, runChecks, type CheckFact, type CheckRun } from "../workflow/checks";
import { loadWorkflowFor } from "../workflow/load";
import type { TaskRow } from "../store/types";
import { identify } from "./access";
import type { Caller } from "./dispatch";
import { failure, refusalOutcome, stateText, success, type ToolOutcome } from "./results";

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

  let run: CheckRun | null = null;
  if (outcome === "done" && task.kind === "ship") {
    const checked = await customChecks(rt, task);
    if (!checked.ok) return failure(checked.text);
    run = checked.run;
    if (run !== null) event = { ...event, checks: run.facts satisfies CheckFact[] };
    // Blank evidence stays blank, so the line cannot make it pass the evidence gate (hard rule 3). A failed check ends the
    // hand-off in the machine, so there is nothing to observe for it.
    const checksFailed = run !== null && run.failures.length > 0;
    if (task.mode === "no-mistakes" && evidence.trim() !== "" && !checksFailed) event = { ...event, evidence: `${evidence}\n\n${await validatorLine(rt, task)}` };
  }

  const applied = await rt.apply(task.taskId, event);
  if (applied.ok) return success(stateText(applied.task));
  const refused = refusalOutcome(applied.refusal);
  return run !== null && applied.refusal.code === "check_failed" ? { ...refused, text: `${refused.text}\n${failureText(run)}` } : refused;
}

/**
 * The line that names the validator's agent and its readiness, for the evidence of the hand-off (report task H12,
 * D-128). It reads on the task's machine and never throws: whatever it cannot read becomes text, and the hand-off goes on.
 */
async function validatorLine(rt: Runtime, task: TaskRow): Promise<string> {
  const { bb, exec } = rt.deps;
  let hostId: string | null = null;
  let hostName = "the default host";
  try {
    hostId = await hostFor(bb, task);
    if (hostId !== null) {
      hostName = hostId;
      hostName = (await bb.listMachines()).find((machine) => machine.id === hostId)?.name ?? hostId;
    }
  } catch (error) {
    return describeObservation({ status: "unobserved", reason: `could not place the task's host (${errorText(error)})` }, hostName);
  }
  return describeObservation(await observeValidatorAgent({ bb, exec }, { hostId, hostName }), hostName);
}

type Checked = { ok: true; run: CheckRun | null } | { ok: false; text: string };

/**
 * Run the custom checks of the task's delivery mode in its worktree, on its
 * machine. A bad workflow file, or a worktree that cannot be found, stops the
 * report: the gate fails closed (hard rules 7 and 8).
 */
async function customChecks(rt: Runtime, task: TaskRow): Promise<Checked> {
  const workflow = await loadWorkflowFor(rt, task.projectId);
  if (!workflow.ok) return { ok: false, text: `Cannot hand off: ${workflow.message}. Nothing was recorded.` };
  const checks = workflow.config.checks[task.mode] ?? [];
  if (checks.length === 0) return { ok: true, run: null };
  const { bb, exec } = rt.deps;
  try {
    const environmentId = task.workerThreadId === null ? null : ((await bb.getThread(task.workerThreadId))?.environmentId ?? null);
    const cwd = environmentId === null ? null : await bb.getEnvironmentPath(environmentId);
    if (cwd === null) return { ok: false, text: "Cannot run the custom checks: bb reports no worktree path for this task, so nothing was recorded." };
    return { ok: true, run: await runChecks(exec, checks, { cwd, host: await hostFor(bb, task) }) };
  } catch (error) {
    return { ok: false, text: `Cannot run the custom checks: could not read the worktree (${errorText(error)}). Nothing was recorded.` };
  }
}
