import type {
  DeliveryMode,
  EventType,
  TaskContext,
  TaskKind,
  TaskSnapshot,
  TaskState,
} from "../../src/machine/types";

export const PROFILE = {
  provider: "claude",
  model: "opus",
  reasoningLevel: "high",
  permissionMode: "acceptEdits",
} as const;

export const PR_URL = "https://github.com/acme/widgets/pull/7";

export const WORKTREE_CLEAN = { uncommittedChanges: false, unpushedCommits: 0 } as const;

/** A task context with every field present. Override only what a test cares about. */
export function context(overrides: Partial<TaskContext> = {}): TaskContext {
  return {
    taskId: "task-1",
    projectId: "proj-1",
    kind: "ship",
    mode: "no-mistakes",
    profile: null,
    workerThreadId: null,
    branch: null,
    machine: null,
    prUrl: null,
    approvals: {},
    ...overrides,
  };
}

/** A context as it looks after a normal `start`. */
export function startedContext(overrides: Partial<TaskContext> = {}): TaskContext {
  return context({
    profile: PROFILE,
    workerThreadId: "thread-1",
    branch: "fm/task-1",
    ...overrides,
  });
}

/** A snapshot built by hand, so tests do not depend on the code under test to reach a state. */
export function snapshot(state: TaskState, overrides: Partial<TaskContext> = {}): TaskSnapshot {
  return { state, context: startedContext(overrides) };
}

/** One valid raw event for each event type. Mode-specific fields cover both modes. */
const VALID_EVENTS: Record<EventType, Record<string, unknown>> = {
  start: {
    type: "start",
    actor: "supervisor",
    profile: PROFILE,
    threadId: "thread-1",
    branch: "fm/task-1",
    machine: null,
  },
  block: { type: "block", actor: "system" },
  unblock: { type: "unblock", actor: "system" },
  handoff: { type: "handoff", actor: "worker", evidence: "all tests pass; handing off" },
  ready: {
    type: "ready",
    actor: "worker",
    evidence: "pull request open; branch holds the commits",
    prUrl: PR_URL,
    landedCommits: 2,
  },
  report: { type: "report", actor: "worker", evidence: "report written" },
  finding: { type: "finding", actor: "system", evidence: "pipeline stopped on a finding" },
  resolve: { type: "resolve", actor: "supervisor", evidence: "owner chose to keep the change" },
  validated: {
    type: "validated",
    actor: "system",
    evidence: "pipeline finished; CI green",
    prUrl: PR_URL,
    pipelineFinished: true,
  },
  request_approval: { type: "request_approval", actor: "supervisor" },
  record_approval: { type: "record_approval", actor: "user", scope: "merge", decision: "approved" },
  merge: { type: "merge", actor: "supervisor", yolo: false },
  promote: { type: "promote", actor: "supervisor" },
  teardown: { type: "teardown", actor: "supervisor", worktree: WORKTREE_CLEAN },
  fail: { type: "fail", actor: "supervisor", evidence: "worker crashed" },
};

export const EVENT_TYPES = Object.keys(VALID_EVENTS) as EventType[];

/** A fresh copy of the valid event for `type`, with `overrides` applied on top. */
export function validEvent(type: EventType, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return structuredClone({ ...VALID_EVENTS[type], ...overrides });
}

export const KINDS: readonly TaskKind[] = ["ship", "scout"];
export const MODES: readonly DeliveryMode[] = ["no-mistakes", "direct-PR", "local-only"];
