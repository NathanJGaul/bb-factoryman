import { parseCreate } from "../machine/events";
import { refuse, type Refusal } from "../machine/refusal";
import { createTask, transition } from "../machine/transition";
import { ACTORS, type TaskState } from "../machine/types";
import { replayTask } from "./replay";
import { taskRowOf } from "./rows";
import type { Store } from "./store";
import type { RowActor, TaskEventRow, TaskRow } from "./types";

export type LogOutcome =
  | { ok: true; task: TaskRow; event: TaskEventRow }
  | { ok: false; refusal: Refusal; event: TaskEventRow };

export interface TaskLogOptions {
  /** The clock for row times. It returns ISO 8601 UTC strings. Defaults to the wall clock. */
  now?: () => string;
}

/** What a refused row records about the input, read as far as the input allows. */
interface Described {
  event: string;
  actor: RowActor;
  evidence: string | null;
  payload: Record<string, unknown>;
}

/** Copy `value` through JSON so it can be stored, or return `{}` when it cannot be (circular, BigInt). */
function jsonSafe(value: unknown): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function describeRaw(raw: unknown): Described {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { event: "<invalid>", actor: "unknown", evidence: null, payload: {} };
  }
  const { type, actor, evidence, ...rest } = raw as Record<string, unknown>;
  return {
    event: typeof type === "string" ? type : "<invalid>",
    actor: typeof actor === "string" && (ACTORS as readonly string[]).includes(actor) ? (actor as RowActor) : "unknown",
    evidence: typeof evidence === "string" ? evidence : null,
    payload: jsonSafe(rest),
  };
}

/**
 * Runs the machine and records what it decides. Every accepted event becomes
 * an applied row and a cache update. Every refused event becomes a refused row.
 * Each call is one transaction: all of its writes happen, or none do.
 */
export class TaskLog {
  private readonly store: Store;
  private readonly now: () => string;

  constructor(store: Store, options: TaskLogOptions = {}) {
    this.store = store;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  /** Record the creation of a task. */
  create(raw: unknown): LogOutcome {
    return this.store.transaction(() => {
      const at = this.now();
      const parsed = parseCreate(raw);
      if (!parsed.ok) {
        const taskId = describeRaw(raw).payload.taskId;
        return this.refused(at, typeof taskId === "string" ? taskId : "<unknown>", null, { ...describeRaw(raw), event: "create" }, parsed.refusal);
      }
      const { type: _type, actor, taskId, ...payload } = parsed.event;
      void _type;
      const described: Described = { event: "create", actor, evidence: null, payload };
      const exists = this.store.listEvents({ taskId }).some((row) => row.outcome === "applied" && row.event === "create");
      if (exists) {
        return this.refused(at, taskId, null, described, refuse("task_exists", `Task \`${taskId}\` already exists.`));
      }
      const created = createTask(raw);
      if (!created.ok) return this.refused(at, taskId, null, described, created.refusal);
      const event = this.store.appendEvent({ taskId, at, fromState: null, toState: "queued", ...described, outcome: "applied", reasonCode: null, reasonMessage: null });
      const task = taskRowOf(created.snapshot);
      this.store.putTask(task);
      return { ok: true, task, event };
    });
  }

  /** Record one event for an existing task. */
  apply(taskId: string, raw: unknown): LogOutcome {
    return this.store.transaction(() => {
      const at = this.now();
      const described = describeRaw(raw);
      const replay = replayTask(this.store, taskId);
      if (!replay.ok) {
        const refusal = replay.reason === "not_found" ? refuse("unknown_task", `No task \`${taskId}\` exists.`) : replay.refusal;
        return this.refused(at, taskId, null, described, refusal);
      }
      const result = transition(replay.snapshot, raw);
      if (!result.ok) return this.refused(at, taskId, replay.snapshot.state, described, result.refusal);

      const { type, actor, evidence, ...rest } = result.event;
      const event = this.store.appendEvent({
        taskId,
        at,
        fromState: result.from,
        toState: result.to,
        event: type,
        actor,
        evidence: evidence ?? null,
        payload: jsonSafe(rest),
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
    });
  }

  private refused(at: string, taskId: string, state: TaskState | null, described: Described, refusal: Refusal): LogOutcome {
    const event = this.store.appendEvent({
      taskId,
      at,
      fromState: state,
      toState: state,
      ...described,
      outcome: "refused",
      reasonCode: refusal.code,
      reasonMessage: refusal.message,
    });
    return { ok: false, refusal, event };
  }
}
