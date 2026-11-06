import { getNextSnapshot } from "xstate";
import { parseCreate, parseEvent, type TaskEvent } from "./events";
import { GUARDS } from "./guards";
import { MACHINES } from "./machines";
import { refuse, type Refusal } from "./refusal";
import { TABLES } from "./table";
import { TASK_KINDS, TASK_STATES, type TaskContext, type TaskKind, type TaskSnapshot, type TaskState } from "./types";

export type CreateResult = { ok: true; snapshot: TaskSnapshot } | { ok: false; refusal: Refusal };

export type TransitionResult =
  | { ok: true; snapshot: TaskSnapshot; from: TaskState; to: TaskState; event: TaskEvent }
  | { ok: false; refusal: Refusal };

function refusedWith(refusal: Refusal): { ok: false; refusal: Refusal } {
  return { ok: false, refusal };
}

/** Build the first snapshot of a task. Never throws. */
export function createTask(raw: unknown): CreateResult {
  const parsed = parseCreate(raw);
  if (!parsed.ok) return refusedWith(parsed.refusal);
  const { taskId, projectId, kind, mode } = parsed.event;
  return {
    ok: true,
    snapshot: {
      state: "queued",
      context: {
        taskId,
        projectId,
        kind,
        mode,
        profile: null,
        workerThreadId: null,
        branch: null,
        machine: null,
        prUrl: null,
        approvals: {},
      },
    },
  };
}

function isReadableSnapshot(value: unknown): value is TaskSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const { state, context } = value as { state?: unknown; context?: unknown };
  if (typeof state !== "string" || !(TASK_STATES as readonly string[]).includes(state)) return false;
  if (typeof context !== "object" || context === null) return false;
  const { kind } = context as { kind?: unknown };
  return typeof kind === "string" && (TASK_KINDS as readonly string[]).includes(kind);
}

type MachineSet = typeof MACHINES;

function run(machines: MachineSet, snapshot: TaskSnapshot, raw: unknown): TransitionResult {
  const parsed = parseEvent(raw);
  if (!parsed.ok) return refusedWith(parsed.refusal);
  const event = parsed.event;

  if (!isReadableSnapshot(snapshot)) {
    return refusedWith(refuse("illegal_transition", "The task snapshot is unreadable, so no event can apply."));
  }
  const { state, context } = snapshot;
  const kind: TaskKind = context.kind;

  const row = TABLES[kind][state]?.[event.type];
  if (row === undefined) {
    return refusedWith(refuse("illegal_transition", `\`${event.type}\` is not legal for a ${kind} task in \`${state}\`.`));
  }
  for (const name of row.guards) {
    const refusal = GUARDS[name](context, event);
    if (refusal !== null) return refusedWith(refusal);
  }

  const machine = machines[kind];
  const restored = machine.resolveState({ value: state, context: structuredClone(context) as TaskContext });
  const next = getNextSnapshot(machine, restored, event);
  if (next.value !== row.target) {
    return refusedWith(refuse("internal_mismatch", `The machine moved to \`${String(next.value)}\` but the table says \`${row.target}\`.`));
  }
  return {
    ok: true,
    snapshot: { state: row.target, context: next.context },
    from: state,
    to: row.target,
    event,
  };
}

/**
 * Apply one event with a given set of machines. Production code calls
 * `transition`. Tests call this to prove that a machine which disagrees with
 * the table, or throws, makes the facade refuse.
 */
export function transitionUsing(machines: MachineSet, snapshot: TaskSnapshot, raw: unknown): TransitionResult {
  try {
    return run(machines, snapshot, raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    return refusedWith(refuse("internal_mismatch", `The machine failed closed: ${reason}.`));
  }
}

/**
 * Apply one event to a task snapshot. Pure and total: it returns the next
 * snapshot or a refusal, and it never throws.
 */
export function transition(snapshot: TaskSnapshot, raw: unknown): TransitionResult {
  return transitionUsing(MACHINES, snapshot, raw);
}
