import type { Actor } from "../machine/types";
import { hostFor } from "../machines/route";
import { errorText, type Runtime } from "../runtime";
import type { TaskRow } from "../store/types";
import { decisionKey, viewSignature } from "./key";
import type { Answer, Finding, RunView, Validator } from "./types";

export type AnswerResult = { ok: true } | { ok: false; message: string };

const WATCHED: readonly string[] = ["validating", "needs_decision"];
const DEFAULT_POLL_MS = 5000;
const DEFAULT_MAX_ERRORS = 5;

/** One finding as one line, with the fields exactly as the validator wrote them. */
export const findingLine = (finding: Finding): string => `- ${finding.id} [${finding.severity}] ${finding.file}: ${finding.action}: ${finding.description}`;

function gateEvidence(view: RunView): string {
  const gate = view.gate!;
  const count = gate.findings.length;
  const head = `Gate ${gate.step} (${gate.status}) has ${count} finding${count === 1 ? "" : "s"}`;
  return count === 0 ? `${head}.` : `${head}:\n${gate.findings.map(findingLine).join("\n")}`;
}

/**
 * Follows no-mistakes runs for tasks in `validating` and `needs_decision`
 * (contracts/validator.md). One loop per task. The loop reattaches to the run
 * through `start`, which asks the pipeline again without starting a second run.
 * It never answers a finding, and it never cancels a run: the pipeline owns the
 * run and outlives this plugin.
 */
export class ValidationDriver {
  private readonly loops = new Map<string, Promise<void>>();
  private readonly errors = new Map<string, number>();
  /** The first view of the current wait, or null when the wait began without a view. */
  private readonly baselines = new Map<string, string | null>();
  private disposed = false;
  private readonly pollMs: number;
  private readonly maxErrors: number;
  private readonly wait: string | undefined;

  constructor(
    private readonly rt: Runtime,
    private readonly validator: Validator,
    options: { pollMs?: number; maxErrors?: number; wait?: string } = {},
  ) {
    this.pollMs = options.pollMs ?? DEFAULT_POLL_MS;
    this.maxErrors = options.maxErrors ?? DEFAULT_MAX_ERRORS;
    this.wait = options.wait;
  }

  isRunning(taskId: string): boolean {
    return this.loops.has(taskId);
  }

  /** Start the loop for a task in `validating` or `needs_decision`. A second call while the loop runs does nothing. */
  ensure(taskId: string): void {
    if (this.disposed || this.loops.has(taskId)) return;
    const task = this.rt.deps.store.getTask(taskId);
    if (!task || !WATCHED.includes(task.state)) return;
    this.loops.set(taskId, this.loop(taskId).finally(() => this.loops.delete(taskId)));
  }

  /** Start-up: follow every task that a restart interrupted. */
  resumeAll(): void {
    for (const task of this.rt.deps.store.listTasks({ states: ["validating", "needs_decision"] })) this.ensure(task.taskId);
  }

  /** Stop the loops. The runs keep going. */
  dispose(): void {
    this.disposed = true;
  }

  /**
   * Read the validator's live view for a task, without writing anything. This is the one answer to "where does the validator
   * run for this task" that a tool can ask, so a tool never rebuilds the worktree path and the host itself.
   */
  async current(taskId: string): Promise<{ ok: true; view: RunView } | { ok: false; message: string }> {
    const task = this.rt.deps.store.getTask(taskId);
    if (!task) return { ok: false, message: `No task ${taskId} exists.` };
    const context = await this.context(task);
    if (!context.ok) return { ok: false, message: context.message };
    const result = await this.validator.status({ cwd: context.cwd, host: context.host });
    return result.ok ? { ok: true, view: result.value } : { ok: false, message: result.error.message };
  }

  /**
   * Send an answer to the validator, and record `resolve` only after it accepts. The loop is already running, so it carries on.
   * `evidence` replaces the default text of the `resolve` event, so a caller can record who approved the answer.
   */
  async answer(taskId: string, response: Answer, actor: Actor, evidence?: string): Promise<AnswerResult> {
    const task = this.rt.deps.store.getTask(taskId);
    if (!task || task.state !== "needs_decision") return { ok: false, message: `Task ${taskId} is not waiting for a decision.` };
    const context = await this.context(task);
    if (!context.ok) return { ok: false, message: context.message };
    const sent = await this.validator.answer({ cwd: context.cwd, host: context.host, response });
    if (!sent.ok) return { ok: false, message: sent.error.message };
    return this.resolved(taskId, actor, evidence ?? `answered the gate: ${response.action}`);
  }

  /**
   * Move a parked task back to `validating` with no answer, so the loop asks the validator to start again.
   * This is the one decision the machine supports for a run that finished without a gate (D-141).
   */
  async rerun(taskId: string, actor: Actor, evidence: string): Promise<AnswerResult> {
    return this.resolved(taskId, actor, evidence);
  }

  private async resolved(taskId: string, actor: Actor, evidence: string): Promise<AnswerResult> {
    const applied = await this.rt.apply(taskId, { type: "resolve", actor, evidence });
    this.baselines.delete(taskId);
    return applied.ok ? { ok: true } : { ok: false, message: applied.refusal.message };
  }

  /** One pass of the loop. Returns `stop` when the task no longer needs following. */
  async step(taskId: string): Promise<"continue" | "stop"> {
    const task = this.rt.deps.store.getTask(taskId);
    if (!task || !WATCHED.includes(task.state)) {
      this.errors.delete(taskId);
      this.baselines.delete(taskId);
      return "stop";
    }
    const context = await this.context(task);
    if (!context.ok) return this.failed(task, context.message);
    return task.state === "validating" ? this.followRun(task, context) : this.followWait(task, context);
  }

  private async loop(taskId: string): Promise<void> {
    try {
      while (!this.disposed) {
        if ((await this.step(taskId)) === "stop") return;
        await this.rt.deps.sleep(this.pollMs);
      }
    } catch (error) {
      this.rt.deps.log.error(`The validation loop for task ${taskId} stopped: ${errorText(error)}`);
    }
  }

  private async context(task: TaskRow): Promise<{ ok: true; cwd: string; host: string | null; intent: string } | { ok: false; message: string }> {
    const { store, bb } = this.rt.deps;
    try {
      const environmentId = task.workerThreadId === null ? null : ((await bb.getThread(task.workerThreadId))?.environmentId ?? null);
      const cwd = environmentId === null ? null : await bb.getEnvironmentPath(environmentId);
      if (cwd === null) return { ok: false, message: "cannot read the worker's worktree path" };
      const start = store.listEvents({ taskId: task.taskId }).find((row) => row.event === "start" && row.outcome === "applied");
      return { ok: true, cwd, host: await hostFor(bb, task), intent: start?.evidence ?? `Complete task ${task.taskId}.` };
    } catch (error) {
      return { ok: false, message: `cannot read the worker's worktree path (${errorText(error)})` };
    }
  }

  private async followRun(task: TaskRow, context: { cwd: string; host: string | null; intent: string }): Promise<"continue" | "stop"> {
    const result = await this.validator.start({ cwd: context.cwd, host: context.host, intent: context.intent, wait: this.wait });
    if (!result.ok) return this.failed(task, result.error.message);
    this.errors.delete(task.taskId);
    const view = result.value;
    if (view.phase === "running") return "continue";
    if (view.phase === "gate") return this.park(task, view, gateEvidence(view));

    const id = view.runId ?? "unknown";
    switch (view.outcome) {
      case "checks-passed":
        if (view.prUrl !== null) {
          await this.apply(task, { type: "validated", actor: "system", evidence: `no-mistakes run ${id} finished: checks passed and the pull request is open.`, prUrl: view.prUrl, pipelineFinished: true });
          return this.next(task);
        }
        return this.park(task, view, `no-mistakes run ${id} finished with checks-passed but names no pull request.`);
      case "failed":
      case "cancelled":
        await this.apply(task, { type: "fail", actor: "system", evidence: `no-mistakes run ${id} ${view.outcome}: ${view.error ?? "no error text"}` });
        return this.next(task);
      default:
        return this.park(task, view, `no-mistakes run ${id} finished as ${view.outcome ?? "unknown"}, so a person has to decide before the task can go to review.`);
    }
  }

  private async followWait(task: TaskRow, context: { cwd: string; host: string | null }): Promise<"continue" | "stop"> {
    const result = await this.validator.status({ cwd: context.cwd, host: context.host });
    if (!result.ok) return "continue";
    const view = result.value;
    const baseline = this.baselines.get(task.taskId) ?? null;
    if (view.phase !== "running") {
      if (baseline === null) {
        this.baselines.set(task.taskId, viewSignature(view));
        return "continue";
      }
      if (viewSignature(view) === baseline) return "continue";
    }
    await this.apply(task, { type: "resolve", actor: "system", evidence: "The validator's view changed, so the pipeline is moving again." });
    this.baselines.delete(task.taskId);
    return this.next(task);
  }

  private async park(task: TaskRow, view: RunView, evidence: string): Promise<"continue" | "stop"> {
    // The key names this exact view, so a supervisor can ask for a decision on it and no other (D-138).
    await this.apply(task, { type: "finding", actor: "system", evidence: `${evidence}\nDecision key: ${decisionKey(view)}` });
    this.baselines.set(task.taskId, viewSignature(view));
    return this.next(task);
  }

  private async failed(task: TaskRow, message: string): Promise<"continue" | "stop"> {
    if (task.state !== "validating") return "continue";
    const count = (this.errors.get(task.taskId) ?? 0) + 1;
    this.errors.set(task.taskId, count);
    if (count < this.maxErrors) return "continue";
    this.errors.delete(task.taskId);
    await this.apply(task, { type: "finding", actor: "system", evidence: `The validator failed ${count} times in a row: ${message}` });
    this.baselines.set(task.taskId, null);
    return this.next(task);
  }

  private async apply(task: TaskRow, event: Record<string, unknown>): Promise<void> {
    const outcome = await this.rt.apply(task.taskId, event);
    if (!outcome.ok) this.rt.deps.log.error(`The validator driver could not record ${String(event["type"])} for task ${task.taskId}: ${outcome.refusal.message}`);
  }

  private next(task: TaskRow): "continue" | "stop" {
    const state = this.rt.deps.store.getTask(task.taskId)?.state;
    return state !== undefined && WATCHED.includes(state) ? "continue" : "stop";
  }
}
