import type { TaskLog } from "../../src/store/task-log";
import { validEvent } from "./machine";

const START = Date.parse("2026-11-05T12:00:00.000Z");

/** A clock that moves forward one second per call, so rows have strictly ordered times. */
export function fakeClock(): () => string {
  let tick = 0;
  return () => new Date(START + tick++ * 1000).toISOString();
}

/** A raw `create` event. */
export function createEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "create",
    actor: "supervisor",
    taskId: "task-1",
    projectId: "proj-1",
    kind: "ship",
    mode: "no-mistakes",
    ...overrides,
  };
}

/** Every event of a `no-mistakes` ship task's life, from start to teardown, in order. */
export function shipPath(): Array<Record<string, unknown>> {
  return [
    validEvent("start"),
    validEvent("handoff"),
    validEvent("finding"),
    validEvent("resolve"),
    validEvent("validated"),
    validEvent("request_approval"),
    validEvent("record_approval"),
    validEvent("merge", { yolo: false }),
    validEvent("teardown"),
  ];
}

/** A scout task's life up to a promotion approval. */
export function scoutPath(): Array<Record<string, unknown>> {
  return [validEvent("start"), validEvent("report"), validEvent("record_approval", { scope: "promote" })];
}

/** Create `taskId` and apply `events`, failing loudly if the log refuses anything. */
export function drive(log: TaskLog, taskId: string, events: Array<Record<string, unknown>>, create: Record<string, unknown> = {}): void {
  const created = log.create(createEvent({ taskId, ...create }));
  if (!created.ok) throw new Error(`create ${taskId} refused: ${created.refusal.message}`);
  for (const event of events) {
    const result = log.apply(taskId, event);
    if (!result.ok) throw new Error(`${String(event.type)} on ${taskId} refused: ${result.refusal.code}: ${result.refusal.message}`);
  }
}
