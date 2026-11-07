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
  "localOnlyStaysOnClone",
] as const;

export type GuardName = (typeof GUARD_NAMES)[number];

/** A guard returns null when the gate passes and a refusal when it does not. */
export type Guard = (context: TaskContext, event: TaskEvent) => Refusal | null;

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

const modeIsNoMistakes: Guard = (context, event) =>
  context.mode === "no-mistakes"
    ? null
    : refuse("mode_mismatch", `\`${event.type}\` is only for \`no-mistakes\` projects, but this task uses \`${context.mode}\`.`);

const modeIsNotNoMistakes: Guard = (context, event) =>
  context.mode !== "no-mistakes"
    ? null
    : refuse("mode_mismatch", `\`${event.type}\` is for \`direct-PR\` and \`local-only\` projects. A \`no-mistakes\` task goes through \`handoff\` and \`validated\`.`);

/** Review ready for `direct-PR` needs an open pull request, and for `local-only` it needs landed commits. */
const readyModeCheck: Guard = (context, event) => {
  if (event.type !== "ready") {
    return refuse("mode_check_failed", "The review-ready check applies to `ready` events only.");
  }
  switch (context.mode) {
    case "direct-PR":
      return event.prUrl !== undefined
        ? null
        : refuse("mode_check_failed", "A `direct-PR` task is review ready only when a pull request is open.");
    case "local-only":
      return event.landedCommits !== undefined && event.landedCommits >= 1
        ? null
        : refuse("mode_check_failed", "A `local-only` task is review ready only when its branch holds landed commits.");
    default:
      return refuse("mode_mismatch", "A `no-mistakes` task reaches review ready through `validated`, not `ready`.");
  }
};

const pipelineFinishedWithPr: Guard = (_context, event) =>
  event.type === "validated" && event.pipelineFinished
    ? null
    : refuse("mode_check_failed", "A `no-mistakes` task is review ready only when the pipeline has finished and the pull request is open.");

const approvalScopeIs =
  (scope: "merge" | "promote"): Guard =>
  (_context, event) =>
    event.type === "record_approval" && event.scope === scope
      ? null
      : refuse("approval_scope_mismatch", `This state accepts only a \`${scope}\` approval.`);

/** Merge needs an approved decision, unless the project's `yolo` flag is on for this merge. */
const mergeAuthorized: Guard = (context, event) => {
  if (event.type !== "merge") {
    return refuse("approval_required", "The merge gate applies to `merge` events only.");
  }
  return event.yolo || context.approvals.merge === "approved"
    ? null
    : refuse("approval_required", "Merging needs a recorded approval from the owner, and this project's `yolo` flag is off.");
};

const promotionAuthorized: Guard = (context, event) =>
  event.type === "promote" && context.approvals.promote === "approved"
    ? null
    : refuse("approval_required", "Promoting a scout to a ship task needs a recorded approval from the owner.");

/** Teardown needs proof that no work is lost: nothing uncommitted and nothing unpushed. */
const worktreeLanded: Guard = (_context, event) => {
  if (event.type !== "teardown") {
    return refuse("unlanded_work", "The landed-work check applies to `teardown` events only.");
  }
  const { uncommittedChanges, unpushedCommits } = event.worktree;
  if (uncommittedChanges) {
    return refuse("unlanded_work", "Teardown refused: the worktree has uncommitted changes.");
  }
  return unpushedCommits === 0
    ? null
    : refuse("unlanded_work", `Teardown refused: the worktree has ${unpushedCommits} unpushed commit(s).`);
};

/** Hard rule 6: `local-only` commits stay in the clone, so the worker must run on the machine that holds it. */
const localOnlyStaysOnClone: Guard = (context, event) => {
  if (event.type !== "start" || context.mode !== "local-only") return null;
  if (event.machine === undefined || event.machine === null) return null;
  return event.cloneMachine !== undefined && event.cloneMachine !== null && event.machine === event.cloneMachine
    ? null
    : refuse(
        "machine_mismatch",
        `A \`local-only\` task stays on the machine that holds the clone (${event.cloneMachine ?? "unknown"}), but the task was pinned to ${event.machine}.`,
      );
};

export const GUARDS: Record<GuardName, Guard> = {
  profileResolved,
  evidenceProvided,
  modeIsNoMistakes,
  modeIsNotNoMistakes,
  readyModeCheck,
  pipelineFinishedWithPr,
  notWorker,
  ownerOnly,
  approvalScopeIsMerge: approvalScopeIs("merge"),
  approvalScopeIsPromote: approvalScopeIs("promote"),
  mergeAuthorized,
  promotionAuthorized,
  worktreeLanded,
  localOnlyStaysOnClone,
};
