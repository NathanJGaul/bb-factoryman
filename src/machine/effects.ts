import type { TaskEvent } from "./events";
import type { TaskContext } from "./types";

/**
 * The context a task has after `event` is accepted. Pure: it returns a new
 * object and never mutates `context`. Guards have already passed by the time
 * this runs, so it only records facts.
 */
export function applyEffects(context: TaskContext, event: TaskEvent): TaskContext {
  switch (event.type) {
    case "start":
      return {
        ...context,
        profile: event.profile ?? null,
        workerThreadId: event.threadId,
        branch: event.branch,
        machine: event.machine ?? null,
      };
    case "ready":
      // A `local-only` task has no pull request, so keep whatever the context holds.
      return event.prUrl === undefined ? context : { ...context, prUrl: event.prUrl };
    case "validated":
      return { ...context, prUrl: event.prUrl };
    case "record_approval":
      // The latest decision per scope wins, so a later "approved" replaces an earlier "denied".
      return { ...context, approvals: { ...context.approvals, [event.scope]: event.decision } };
    case "request_changes":
      // A denial or an approval of the old work says nothing about the reworked work.
      // The record_approval rows stay in the log. Only the task's current decision is cleared.
      return { ...context, approvals: {} };
    case "promote":
      // The scout's report authorizes nothing. The new ship task needs its own profile and approvals.
      return { ...context, kind: "ship", profile: null, prUrl: null, approvals: {} };
    default:
      return context;
  }
}
