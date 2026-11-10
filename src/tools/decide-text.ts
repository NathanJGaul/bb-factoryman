// Wording that factoryman_decide and the conformance lab's fake tool share, so the two cannot drift.
// This module has no imports: the lab is type-checked under Node's type stripping, which cannot take the tool's runtime imports.

/** The reason for a call on a task that is not in `needs_decision`. */
export const notWaitingText = (taskId: string, state: string): string => `Task ${taskId} is ${state}. A decision needs needs_decision.`;

/** The reason for a call on a task that is not a ship task: only a ship task has a pipeline to answer. */
export const NOT_SHIP_TEXT = "Only a ship task has a pipeline to answer.";
