import type { TaskEvent } from "./events";
import type { TaskContext } from "./types";

/**
 * The context a task has after `event` is accepted. Pure: it returns a new
 * object and never mutates `context`. Guards have already passed by the time
 * this runs, so it only records facts.
 */
export function applyEffects(context: TaskContext, event: TaskEvent): TaskContext {
  void event;
  return context;
}
