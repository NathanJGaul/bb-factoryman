import type { Refusal } from "../machine/refusal";
import type { TaskRow } from "../store/types";

/** What a tool hands back to bb: plain text, and whether the call worked. */
export interface ToolOutcome {
  ok: boolean;
  text: string;
}

export const success = (text: string): ToolOutcome => ({ ok: true, text });
export const failure = (text: string): ToolOutcome => ({ ok: false, text });

export const refusalOutcome = (refusal: Refusal): ToolOutcome =>
  failure(`Refused (${refusal.code}): ${refusal.message}`);

export const stateText = (task: Pick<TaskRow, "taskId" | "state">): string => `Task ${task.taskId} is now ${task.state}.`;

/** Cut `text` to `limit` characters, ending with an ellipsis when it was longer. */
export function clip(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}
