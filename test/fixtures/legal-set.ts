import type { GuardName } from "../../src/machine/guards";
import type { DeliveryMode, EventType, TaskKind, TaskSnapshot, TaskState } from "../../src/machine/types";
import { snapshot, validEvent } from "./machine";

export const STATES: readonly TaskState[] = [
  "queued",
  "working",
  "blocked",
  "validating",
  "needs_decision",
  "review_ready",
  "awaiting_approval",
  "merged",
  "report_ready",
  "torn_down",
  "failed",
];

type Lane<T> = Partial<Record<TaskState, Partial<Record<EventType, T>>>>;

/**
 * The legal set, written by hand from docs/DESIGN.md and CLAUDE.md. It does not
 * read the table in src/machine, so a wrong table row cannot hide here.
 */
export const LEGAL: Record<TaskKind, Lane<TaskState>> = {
  ship: {
    queued: { start: "working", fail: "failed" },
    working: { block: "blocked", handoff: "validating", ready: "review_ready", fail: "failed" },
    blocked: { unblock: "working", fail: "failed" },
    validating: { finding: "needs_decision", validated: "review_ready", fail: "failed" },
    needs_decision: { resolve: "validating", fail: "failed" },
    review_ready: { request_approval: "awaiting_approval", request_changes: "working", fail: "failed" },
    awaiting_approval: { record_approval: "awaiting_approval", merge: "merged", request_changes: "working", fail: "failed" },
    merged: { teardown: "torn_down", fail: "failed" },
    failed: { teardown: "torn_down" },
  },
  scout: {
    queued: { start: "working", fail: "failed" },
    working: { block: "blocked", report: "report_ready", fail: "failed" },
    blocked: { unblock: "working", fail: "failed" },
    report_ready: { record_approval: "report_ready", promote: "queued", teardown: "torn_down", fail: "failed" },
    failed: { teardown: "torn_down" },
  },
};

/** The guards each legal row lists, in the order data-model.md documents. */
export const GUARDS_OF: Record<TaskKind, Lane<readonly GuardName[]>> = {
  ship: {
    queued: { start: ["profileResolved", "localOnlyStaysOnClone"], fail: ["evidenceProvided"] },
    working: {
      block: [],
      handoff: ["modeIsNoMistakes", "evidenceProvided", "customChecksPassed"],
      ready: ["modeIsNotNoMistakes", "evidenceProvided", "readyModeCheck", "customChecksPassed"],
      fail: ["evidenceProvided"],
    },
    blocked: { unblock: [], fail: ["evidenceProvided"] },
    validating: {
      finding: [],
      validated: ["modeIsNoMistakes", "evidenceProvided", "pipelineFinishedWithPr"],
      fail: ["evidenceProvided"],
    },
    needs_decision: { resolve: [], fail: ["evidenceProvided"] },
    review_ready: { request_approval: ["notWorker"], request_changes: ["notWorker"], fail: ["evidenceProvided"] },
    awaiting_approval: {
      record_approval: ["ownerOnly", "approvalScopeIsMerge"],
      merge: ["notWorker", "mergeAuthorized"],
      request_changes: ["notWorker"],
      fail: ["evidenceProvided"],
    },
    merged: { teardown: ["notWorker", "worktreeLanded"], fail: ["evidenceProvided"] },
    failed: { teardown: ["notWorker", "worktreeLanded"] },
  },
  scout: {
    queued: { start: ["profileResolved", "localOnlyStaysOnClone"], fail: ["evidenceProvided"] },
    working: { block: [], report: ["evidenceProvided"], fail: ["evidenceProvided"] },
    blocked: { unblock: [], fail: ["evidenceProvided"] },
    report_ready: {
      record_approval: ["ownerOnly", "approvalScopeIsPromote"],
      promote: ["notWorker", "promotionAuthorized"],
      teardown: ["notWorker", "worktreeLanded"],
      fail: ["evidenceProvided"],
    },
    failed: { teardown: ["notWorker", "worktreeLanded"] },
  },
};

/** The mode that lets a legal event pass its mode guard. */
export function modeFor(type: EventType): DeliveryMode {
  return type === "ready" ? "direct-PR" : "no-mistakes";
}

/** A snapshot and a raw event that satisfy every gate of `type` in `state`. */
export function satisfied(
  kind: TaskKind,
  state: TaskState,
  type: EventType,
): { snapshot: TaskSnapshot; event: Record<string, unknown> } {
  const approvals = type === "merge" ? { merge: "approved" as const } : type === "promote" ? { promote: "approved" as const } : {};
  const overrides = type === "record_approval" ? { scope: state === "report_ready" ? "promote" : "merge" } : {};
  return {
    snapshot: snapshot(state, { kind, mode: modeFor(type), approvals }),
    event: validEvent(type, overrides),
  };
}
