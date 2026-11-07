import type { GuardName } from "./guards";
import type { EventType, TaskKind, TaskState } from "./types";

/** One legal move: where it goes and which gates it must pass, in order. */
export interface Transition {
  readonly target: TaskState;
  readonly guards: readonly GuardName[];
}

export type Lane = Partial<Record<TaskState, Partial<Record<EventType, Transition>>>>;

const go = (target: TaskState, ...guards: GuardName[]): Transition => ({ target, guards });

/** Any non-terminal state can fail, and failing needs evidence. */
const fail = go("failed", "evidenceProvided");

/** A failed task can still be torn down, through the same landed-work check. */
const failedLane = { teardown: go("torn_down", "notWorker", "worktreeLanded") };

/**
 * The ship lane. `validating` and `needs_decision` are reachable only in
 * `no-mistakes` projects, because only `handoff` enters them and `handoff`
 * checks the mode.
 */
const ship: Lane = {
  queued: { start: go("working", "profileResolved", "localOnlyStaysOnClone"), fail },
  working: {
    block: go("blocked"),
    handoff: go("validating", "modeIsNoMistakes", "evidenceProvided"),
    ready: go("review_ready", "modeIsNotNoMistakes", "evidenceProvided", "readyModeCheck"),
    fail,
  },
  blocked: { unblock: go("working"), fail },
  validating: {
    finding: go("needs_decision"),
    validated: go("review_ready", "modeIsNoMistakes", "evidenceProvided", "pipelineFinishedWithPr"),
    fail,
  },
  needs_decision: { resolve: go("validating"), fail },
  review_ready: {
    request_approval: go("awaiting_approval", "notWorker"),
    request_changes: go("working", "notWorker"),
    fail,
  },
  awaiting_approval: {
    record_approval: go("awaiting_approval", "ownerOnly", "approvalScopeIsMerge"),
    merge: go("merged", "notWorker", "mergeAuthorized"),
    request_changes: go("working", "notWorker"),
    fail,
  },
  merged: { teardown: go("torn_down", "notWorker", "worktreeLanded"), fail },
  failed: failedLane,
};

/** The scout lane. `promote` re-enters `queued` as a ship task. */
const scout: Lane = {
  queued: { start: go("working", "profileResolved", "localOnlyStaysOnClone"), fail },
  working: { block: go("blocked"), report: go("report_ready", "evidenceProvided"), fail },
  blocked: { unblock: go("working"), fail },
  report_ready: {
    record_approval: go("report_ready", "ownerOnly", "approvalScopeIsPromote"),
    promote: go("queued", "notWorker", "promotionAuthorized"),
    teardown: go("torn_down", "notWorker", "worktreeLanded"),
    fail,
  },
  failed: failedLane,
};

export const TABLES: Record<TaskKind, Lane> = { ship, scout };
