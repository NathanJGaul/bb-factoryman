import { createTask, transition } from "../../src/machine/transition";
import type { TaskSnapshot } from "../../src/machine/types";
import type { Store } from "../../src/store/store";
import type { NewTaskEvent } from "../../src/store/types";
import { createEvent } from "./store";

const AT = "2026-11-05T12:00:00.000Z";

/** An event log row with sensible defaults, for tests that write history by hand. */
export function row(overrides: Partial<NewTaskEvent> = {}): NewTaskEvent {
  return {
    taskId: "task-1",
    at: AT,
    fromState: null,
    toState: null,
    event: "create",
    actor: "supervisor",
    evidence: null,
    payload: {},
    outcome: "applied",
    reasonCode: null,
    reasonMessage: null,
    ...overrides,
  };
}

/**
 * Write a task's history straight into the log by folding the machine, without
 * the task log. Returns the snapshot the fold ends on.
 */
export function writeHistory(
  store: Store,
  taskId: string,
  events: Array<Record<string, unknown>>,
  create: Record<string, unknown> = {},
): TaskSnapshot {
  const rawCreate = createEvent({ taskId, ...create });
  const created = createTask(rawCreate);
  if (!created.ok) throw new Error(`fixture create refused: ${created.refusal.message}`);
  const { type: _type, actor, taskId: _id, ...createPayload } = rawCreate;
  void _type;
  void _id;
  store.appendEvent(row({ taskId, toState: "queued", event: "create", actor: actor as never, payload: createPayload }));
  let snapshot = created.snapshot;
  for (const raw of events) {
    const result = transition(snapshot, raw);
    if (!result.ok) throw new Error(`fixture event ${String(raw.type)} refused: ${result.refusal.message}`);
    const { type, actor: eventActor, evidence, ...payload } = result.event;
    store.appendEvent(
      row({
        taskId,
        fromState: result.from,
        toState: result.to,
        event: type,
        actor: eventActor,
        evidence: evidence ?? null,
        payload,
      }),
    );
    snapshot = result.snapshot;
  }
  return snapshot;
}
