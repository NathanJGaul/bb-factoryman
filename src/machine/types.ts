/** Vocabulary and shapes shared by the task state machine. No bb imports. */

export const TASK_KINDS = ["ship", "scout"] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const DELIVERY_MODES = ["no-mistakes", "direct-PR", "local-only"] as const;
export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const TASK_STATES = [
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
] as const;
export type TaskState = (typeof TASK_STATES)[number];

export const ACTORS = ["worker", "supervisor", "user", "system"] as const;
export type Actor = (typeof ACTORS)[number];

export const APPROVAL_SCOPES = ["merge", "promote"] as const;
export type ApprovalScope = (typeof APPROVAL_SCOPES)[number];

export const APPROVAL_DECISIONS = ["approved", "denied"] as const;
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number];

export const EVENT_TYPES = [
  "start",
  "block",
  "unblock",
  "handoff",
  "ready",
  "report",
  "finding",
  "resolve",
  "validated",
  "request_approval",
  "record_approval",
  "merge",
  "promote",
  "teardown",
  "fail",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** A dispatch profile: the four fields the design copies from bb's task presets. */
export interface Profile {
  readonly provider: string;
  readonly model: string;
  readonly reasoningLevel: string;
  readonly permissionMode: string;
}

/** Everything the machine knows about a task besides its state name. */
export interface TaskContext {
  readonly taskId: string;
  readonly projectId: string;
  readonly kind: TaskKind;
  readonly mode: DeliveryMode;
  readonly profile: Profile | null;
  readonly workerThreadId: string | null;
  readonly branch: string | null;
  readonly machine: string | null;
  readonly prUrl: string | null;
  /** The latest decision per scope. */
  readonly approvals: Readonly<Partial<Record<ApprovalScope, ApprovalDecision>>>;
}

export interface TaskSnapshot {
  readonly state: TaskState;
  readonly context: TaskContext;
}
