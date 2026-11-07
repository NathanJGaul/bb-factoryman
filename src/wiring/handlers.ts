import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { errorText, type Runtime } from "../runtime";
import type { TaskRow } from "../store/types";
import { identify } from "../tools/access";
import type { Notifier } from "./wake";

export interface ThreadRef {
  thread: { id: string };
}

interface TurnFailure {
  category: string | null;
  status: number | null;
}

/** How long `thread.failed` waits for the turn failure that follows it when the error text is empty (spike item 21). */
const TURN_FAILED_GRACE_MS = 500;
const TURN_FAILURE_LIMIT = 100;

/**
 * Maps bb thread events to transitions and wake messages (contracts/events.md).
 * Every handler loads the recorded worker first and does nothing for any other
 * thread. A handler never throws.
 */
export class EventHandlers {
  readonly turnFailures = new Map<string, TurnFailure>();

  constructor(
    private readonly rt: Runtime,
    private readonly notifier: Notifier,
    private readonly pluginId: string,
  ) {}

  async threadFailed(payload: ThreadRef & { error: string | null }): Promise<void> {
    await this.guarded("thread.failed", async () => {
      const task = this.workerTask(payload.thread.id);
      if (!task || (task.state !== "working" && task.state !== "blocked")) return;
      const text = payload.error?.trim();
      if (!text) await this.rt.deps.sleep(TURN_FAILED_GRACE_MS);
      const failure = this.turnFailures.get(payload.thread.id);
      const evidence = text
        ? `worker thread failed: ${text}`
        : failure
          ? `worker thread failed: provider error (category ${failure.category ?? "unknown"}, HTTP ${failure.status ?? "unknown"})`
          : "worker thread entered the error state";
      await this.rt.apply(task.taskId, { type: "fail", actor: "system", evidence });
    });
  }

  async turnFailed(payload: { threadId: string; errorInfo: { category?: string | null; httpStatusCode?: number | null } | null }): Promise<void> {
    await this.guarded("turn.failed", async () => {
      this.turnFailures.delete(payload.threadId);
      this.turnFailures.set(payload.threadId, { category: payload.errorInfo?.category ?? null, status: payload.errorInfo?.httpStatusCode ?? null });
      while (this.turnFailures.size > TURN_FAILURE_LIMIT) {
        const oldest = this.turnFailures.keys().next().value;
        if (oldest === undefined) break;
        this.turnFailures.delete(oldest);
      }
    });
  }

  async threadDeleted(payload: ThreadRef): Promise<void> {
    await this.guarded("thread.deleted", async () => {
      const task = this.workerTask(payload.thread.id);
      if (!task || task.state === "failed") return;
      await this.rt.apply(task.taskId, { type: "fail", actor: "system", evidence: "worker thread was deleted" });
    });
  }

  async threadIdle(payload: ThreadRef): Promise<void> {
    await this.guarded("thread.idle", async () => {
      const task = this.workerTask(payload.thread.id);
      if (!task || task.state !== "working") return;
      await this.notifier.wake(task, "reports: the worker finished a turn without reporting", null);
    });
  }

  async threadArchived(payload: ThreadRef): Promise<void> {
    await this.guarded("thread.archived", async () => {
      const task = this.workerTask(payload.thread.id);
      if (!task) return;
      await this.notifier.wake(task, "reports: the worker thread was archived, so bb may remove its worktree", null);
    });
  }

  async interactionPending(payload: ThreadRef & { interaction: { origin?: { kind?: string; pluginId?: string | null }; payload?: { kind?: string; title?: string } } }): Promise<void> {
    await this.guarded("interaction.pending", async () => {
      const task = this.workerTask(payload.thread.id);
      if (!task || payload.interaction.origin?.pluginId === this.pluginId) return;
      const title = payload.interaction.payload?.title ?? "an unnamed interaction";
      await this.notifier.wake(task, `reports: the worker raised a question: ${title}`, null);
    });
  }

  /** The non-terminal task whose recorded worker is this thread, or undefined. */
  private workerTask(threadId: string): TaskRow | undefined {
    const identity = identify(this.rt.deps.store, threadId);
    if (identity.role !== "worker") return undefined;
    const task = this.rt.deps.store.getTask(identity.task.taskId);
    return task && task.state !== "torn_down" ? task : undefined;
  }

  private async guarded(event: string, run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (error) {
      this.rt.deps.log.error(`The ${event} handler failed: ${errorText(error)}`);
    }
  }
}

/** Subscribe to the five thread events and to `turn.failed`. Every other event is ignored. */
export function registerHandlers(bb: BbPluginApi, handlers: EventHandlers): void {
  bb.events.on("thread.failed", (payload) => handlers.threadFailed(payload));
  bb.events.on("turn.failed", (payload) => handlers.turnFailed(payload));
  bb.events.on("thread.deleted", (payload) => handlers.threadDeleted(payload));
  bb.events.on("thread.idle", (payload) => handlers.threadIdle(payload));
  bb.events.on("thread.archived", (payload) => handlers.threadArchived(payload));
  bb.events.on("interaction.pending", (payload) => handlers.interactionPending(payload));
}
