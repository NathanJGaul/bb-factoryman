import type { Profile, DeliveryMode, TaskKind } from "../machine/types";
import { createTask, transition } from "../machine/transition";
import type { Refusal } from "../machine/refusal";
import { errorText, type Runtime } from "../runtime";
import { buildWorkerPrompt } from "./prompt";

/** The branch prefix when a project config sets none (D-034). */
export const DEFAULT_BRANCH_PREFIX = "fm/";

export const branchFor = (prefix: string | null, taskId: string): string => `${prefix ?? DEFAULT_BRANCH_PREFIX}${taskId}`;

export interface StartFacts {
  profile: Profile;
  machine: string | null;
  cloneMachine: string | null;
}

/**
 * Ask the pure machine about the start of a new task before anything exists,
 * so a refused start (such as a local-only task on another machine) spawns no
 * worker and creates no task.
 */
export function previewStart(input: { projectId: string; kind: TaskKind; mode: DeliveryMode; branchPrefix: string | null; facts: StartFacts }): Refusal | null {
  const draft = createTask({ type: "create", actor: "supervisor", taskId: "preview", projectId: input.projectId, kind: input.kind, mode: input.mode });
  if (!draft.ok) return draft.refusal;
  const preview = transition(draft.snapshot, { type: "start", actor: "supervisor", threadId: "preview", branch: branchFor(input.branchPrefix, "preview"), ...input.facts });
  return preview.ok ? null : preview.refusal;
}

export interface LaunchInput {
  taskId: string;
  projectId: string;
  kind: TaskKind;
  mode: DeliveryMode;
  description: string;
  facts: StartFacts;
  parentThreadId: string;
  branchPrefix: string | null;
  baseBranch: string | null;
}

export type LaunchResult = { ok: true; threadId: string; branch: string } | { ok: false; text: string; refusal?: Refusal };

/**
 * Spawn the worker of a task that exists in `queued` and record `start`. The
 * task counts as running from the first line, so a second dispatch cannot slip
 * past a cap while the spawn is in flight.
 */
export async function launchWorker(rt: Runtime, input: LaunchInput): Promise<LaunchResult> {
  rt.launching.add(input.taskId);
  try {
    const { bb } = rt.deps;
    const { taskId, kind, mode, description, facts } = input;
    const branch = branchFor(input.branchPrefix, taskId);

    let threadId: string;
    try {
      ({ threadId } = await bb.spawnWorker({
        projectId: input.projectId,
        parentThreadId: input.parentThreadId,
        prompt: buildWorkerPrompt({ taskId, kind, mode, branch, description }),
        profile: facts.profile,
        metadata: { role: "worker", taskId, kind },
        baseBranch: input.baseBranch,
        hostId: facts.machine,
      }));
    } catch (error) {
      await rt.apply(taskId, { type: "fail", actor: "system", evidence: `worker spawn failed: ${errorText(error)}` });
      return { ok: false, text: `Dispatch failed: the worker could not start (${errorText(error)}). Task ${taskId} is failed.` };
    }

    const started = await rt.apply(taskId, { type: "start", actor: "supervisor", threadId, branch, evidence: description, ...facts });
    if (!started.ok) return { ok: false, text: `Refused (${started.refusal.code}): ${started.refusal.message}`, refusal: started.refusal };

    // The worker can fail before this record exists, and no event would reach us then.
    try {
      if ((await bb.getThread(threadId))?.status === "error") {
        await rt.apply(taskId, { type: "fail", actor: "system", evidence: "worker thread entered the error state right after it started" });
        return { ok: false, text: `Task ${taskId} started, but its worker thread ${threadId} failed at once. Task ${taskId} is failed.` };
      }
    } catch (error) {
      rt.deps.log.warn(`Could not read worker thread ${threadId} after start: ${errorText(error)}`);
    }
    return { ok: true, threadId, branch };
  } finally {
    rt.launching.delete(input.taskId);
  }
}
