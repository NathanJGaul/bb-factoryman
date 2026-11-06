import { parseCreate } from "../machine/events";
import { refuse, type Refusal } from "../machine/refusal";
import { createTask, transition } from "../machine/transition";
import type { RowActor } from "./types";
import { replayTask } from "./replay";
import { taskRowOf } from "./rows";
import type { Store } from "./store";
import type { TaskEventRow, TaskRow } from "./types";
import type { TaskState } from "../machine/types";

export type LogOutcome =
  | { ok: true; task: TaskRow; event: TaskEventRow }
  | { ok: false; refusal: Refusal; event: TaskEventRow };

export interface TaskLogOptions {
  now?: () => string;
}

interface Refused {
  taskId: string;
  fromState: TaskState | null;
  event: string;
  actor: RowActor;
  evidence: string | null;
  payload: Record<string, unknown>;
  refusal: Refusal;
}

/**
 * Runs the machine and records what it decides. Every accepted event becomes
 * an applied row and a cache update. Every refused event becomes a refused row.
 */
export class TaskLog {
  private readonly store: Store;

  constructor(store: Store, options: TaskLogOptions = {}) {
    this.store = store;
    void options; // The injected clock arrives with U68.
  }

  create(raw: unknown): LogOutcome {
    const parsed = parseCreate(raw);
    const created = createTask(raw);
    const at = new Date().toISOString();
    const input = raw as Record<string, unknown>;
    if (!parsed.ok || !created.ok) {
      const refusal = !parsed.ok ? parsed.refusal : (created as { refusal: Refusal }).refusal;
      return this.refused(at, {
        taskId: typeof input.taskId === "string" ? input.taskId : "<unknown>",
        fromState: null,
        event: "create",
        actor: "unknown",
        evidence: null,
        payload: {},
        refusal,
      });
    }
    const { type: _type, actor, taskId, ...payload } = parsed.event;
    void _type;
    if (this.store.listEvents({ taskId }).some((row) => row.outcome === "applied" && row.event === "create")) {
      return this.refused(at, {
        taskId,
        fromState: null,
        event: "create",
        actor,
        evidence: null,
        payload,
        refusal: refuse("task_exists", `Task \`${taskId}\` already exists.`),
      });
    }
    const event = this.store.appendEvent({
      taskId,
      at,
      fromState: null,
      toState: "queued",
      event: "create",
      actor,
      evidence: null,
      payload,
      outcome: "applied",
      reasonCode: null,
      reasonMessage: null,
    });
    const task = taskRowOf(created.snapshot);
    this.store.putTask(task);
    return { ok: true, task, event };
  }

  apply(taskId: string, raw: unknown): LogOutcome {
    const at = new Date().toISOString();
    const { type, actor, evidence, ...payload } = raw as Record<string, unknown>;
    const described = {
      event: typeof type === "string" ? type : "<invalid>",
      actor: (typeof actor === "string" ? actor : "unknown") as RowActor,
      evidence: typeof evidence === "string" ? evidence : null,
      payload,
    };
    const replay = replayTask(this.store, taskId);
    if (!replay.ok) {
      const refusal = replay.reason === "not_found" ? refuse("unknown_task", `No task \`${taskId}\` exists.`) : replay.refusal;
      return this.refused(at, { taskId, fromState: null, ...described, refusal });
    }
    const result = transition(replay.snapshot, raw);
    if (!result.ok) {
      return this.refused(at, { taskId, fromState: replay.snapshot.state, ...described, refusal: result.refusal });
    }
    const event = this.store.appendEvent({
      taskId,
      at,
      fromState: result.from,
      toState: result.to,
      event: result.event.type,
      actor: result.event.actor,
      evidence: result.event.evidence ?? null,
      payload,
      outcome: "applied",
      reasonCode: null,
      reasonMessage: null,
    });
    const task = taskRowOf(result.snapshot);
    this.store.putTask(task);
    if (result.event.type === "record_approval") {
      this.store.addApproval({ taskId, scope: result.event.scope, decision: result.event.decision, at });
    }
    return { ok: true, task, event };
  }

  private refused(at: string, r: Refused): LogOutcome {
    const event = this.store.appendEvent({
      taskId: r.taskId,
      at,
      fromState: r.fromState,
      toState: r.fromState,
      event: r.event,
      actor: r.actor,
      evidence: r.evidence,
      payload: r.payload,
      outcome: "refused",
      reasonCode: r.refusal.code,
      reasonMessage: r.refusal.message,
    });
    return { ok: false, refusal: r.refusal, event };
  }
}
