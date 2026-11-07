import type { WebhookNotifier } from "../limits/webhook";
import { errorText, type AppliedEvent, type Runtime } from "../runtime";
import type { TaskRow } from "../store/types";
import { clip } from "../tools/results";

/** The states in which a task needs the supervisor (FR-208). */
export const WAKE_STATES: readonly string[] = ["needs_decision", "review_ready", "report_ready", "blocked", "failed"];

const EVIDENCE_LIMIT = 600;
/** Findings travel in the evidence of a `needs_decision` task, and the supervisor needs all of them. */
const FINDINGS_LIMIT = 8000;

/**
 * Tells the supervisor about a task. The plugin sends the only wake messages,
 * because workers spawn with bb's parent notifications off (D-043). A failed
 * send is logged and never undoes a transition.
 */
export class Notifier {
  constructor(
    private readonly rt: Runtime,
    private readonly webhook?: WebhookNotifier,
  ) {}

  /** Runtime listener: wake the supervisor when an applied event leaves the task in an attention state. */
  async onApplied({ task, event }: AppliedEvent): Promise<void> {
    if (!WAKE_STATES.includes(task.state)) return;
    // The supervisor wake comes first, so a slow webhook (up to its timeout) never delays it.
    await this.wake(task, `is now ${task.state}`, event.evidence);
    await this.webhook?.post(task, event);
  }

  /** `phrase` completes the sentence "Task <id> (<kind>, <mode>) ...". */
  async wake(task: TaskRow, phrase: string, evidence: string | null): Promise<void> {
    const { bb, log } = this.rt.deps;
    if (task.workerThreadId === null) return;
    try {
      const thread = await bb.getThread(task.workerThreadId);
      const parent = thread?.parentThreadId ?? null;
      if (parent === null) {
        log.warn(`No parent thread for worker ${task.workerThreadId}, so the supervisor was not told about task ${task.taskId}.`);
        return;
      }
      await bb.sendMessage(parent, this.text(task, phrase, evidence));
    } catch (error) {
      log.warn(`Could not wake the supervisor about task ${task.taskId}: ${errorText(error)}`);
    }
  }

  private text(task: TaskRow, phrase: string, evidence: string | null): string {
    const lines = [`[factoryman] Task ${task.taskId} (${task.kind}, ${task.mode}) ${phrase}.`];
    if (evidence !== null && evidence.trim() !== "") {
      lines.push(`Evidence: ${clip(evidence, task.state === "needs_decision" ? FINDINGS_LIMIT : EVIDENCE_LIMIT)}`);
    }
    lines.push(`Worker thread: ${task.workerThreadId ?? "none"}. Branch: ${task.branch ?? "none"}.`);
    return lines.join("\n");
  }
}
