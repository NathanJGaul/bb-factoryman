import { refuse, type Refusal } from "../machine/refusal";
import { transition } from "../machine/transition";
import type { TaskState } from "../machine/types";
import { replayTask } from "../store/replay";
import type { Store } from "../store/store";

export type Preview = { ok: true; to: TaskState } | { ok: false; refusal: Refusal };

/**
 * Ask the pure machine whether it would accept an event for a task, without
 * writing anything. Tools use it to avoid side effects, such as a merge, that
 * the machine would refuse a moment later.
 */
export function wouldAccept(store: Store, taskId: string, raw: unknown): Preview {
  const replay = replayTask(store, taskId);
  if (!replay.ok) {
    return { ok: false, refusal: replay.reason === "not_found" ? refuse("unknown_task", `No task \`${taskId}\` exists.`) : replay.refusal };
  }
  const result = transition(replay.snapshot, raw);
  return result.ok ? { ok: true, to: result.to } : { ok: false, refusal: result.refusal };
}
