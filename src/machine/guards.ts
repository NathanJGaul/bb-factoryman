import type { TaskEvent } from "./events";
import { refuse, type Refusal } from "./refusal";
import type { TaskContext } from "./types";

export const GUARD_NAMES = [
  "profileResolved",
  "evidenceProvided",
  "modeIsNoMistakes",
  "modeIsNotNoMistakes",
  "readyModeCheck",
  "pipelineFinishedWithPr",
  "notWorker",
  "ownerOnly",
  "approvalScopeIsMerge",
  "approvalScopeIsPromote",
  "mergeAuthorized",
  "promotionAuthorized",
  "worktreeLanded",
] as const;

export type GuardName = (typeof GUARD_NAMES)[number];

/** A guard returns null when the gate passes and a refusal when it does not. */
export type Guard = (context: TaskContext, event: TaskEvent) => Refusal | null;

/** A gate that is not written yet fails closed. */
function pending(name: GuardName): Guard {
  return () => refuse("internal_mismatch", `Guard \`${name}\` is not implemented, so it refuses.`);
}

const profileResolved: Guard = (_context, event) =>
  event.type === "start" && event.profile
    ? null
    : refuse("profile_required", "A task needs a resolved dispatch profile before a worker starts.");

const evidenceProvided: Guard = (_context, event) =>
  event.evidence !== undefined && event.evidence.trim() !== ""
    ? null
    : refuse("evidence_required", `A \`${event.type}\` event needs non-empty evidence.`);

const notWorker: Guard = (_context, event) =>
  event.actor !== "worker"
    ? null
    : refuse("actor_forbidden", `A worker cannot send \`${event.type}\`.`);

const ownerOnly: Guard = (_context, event) =>
  event.actor === "user"
    ? null
    : refuse("actor_forbidden", `Only the owner can send \`${event.type}\`, but the actor was \`${event.actor}\`.`);

export const GUARDS: Record<GuardName, Guard> = {
  profileResolved,
  evidenceProvided,
  modeIsNoMistakes: pending("modeIsNoMistakes"),
  modeIsNotNoMistakes: pending("modeIsNotNoMistakes"),
  readyModeCheck: pending("readyModeCheck"),
  pipelineFinishedWithPr: pending("pipelineFinishedWithPr"),
  notWorker,
  ownerOnly,
  approvalScopeIsMerge: pending("approvalScopeIsMerge"),
  approvalScopeIsPromote: pending("approvalScopeIsPromote"),
  mergeAuthorized: pending("mergeAuthorized"),
  promotionAuthorized: pending("promotionAuthorized"),
  worktreeLanded: pending("worktreeLanded"),
};
