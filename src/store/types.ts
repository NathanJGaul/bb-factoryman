import type {
  Actor,
  ApprovalDecision,
  ApprovalScope,
  DeliveryMode,
  TaskKind,
  TaskState,
} from "../machine/types";

/** The task cache row. It mirrors `task` in docs/DESIGN.md, plus `projectId` and `mode`. */
export interface TaskRow {
  readonly taskId: string;
  readonly projectId: string;
  readonly kind: TaskKind;
  readonly mode: DeliveryMode;
  readonly state: TaskState;
  readonly workerThreadId: string | null;
  readonly branch: string | null;
  readonly machine: string | null;
  readonly pullRequestUrl: string | null;
}

export type Outcome = "applied" | "refused";

/** The actor of a row. `unknown` marks input too broken to name an actor. */
export type RowActor = Actor | "unknown";

/** An event log row before the store assigns its `seq`. */
export interface NewTaskEvent {
  readonly taskId: string;
  /** ISO 8601 UTC time from the caller's clock. */
  readonly at: string;
  readonly fromState: TaskState | null;
  readonly toState: TaskState | null;
  readonly event: string;
  readonly actor: RowActor;
  readonly evidence: string | null;
  /** Event fields other than `type`, `actor`, and `evidence`. Replay needs them. */
  readonly payload: Readonly<Record<string, unknown>>;
  readonly outcome: Outcome;
  readonly reasonCode: string | null;
  readonly reasonMessage: string | null;
}

export interface TaskEventRow extends NewTaskEvent {
  readonly seq: number;
}

export interface NewApproval {
  readonly taskId: string;
  readonly scope: ApprovalScope;
  readonly decision: ApprovalDecision;
  readonly at: string;
}

export interface ApprovalRow extends NewApproval {
  readonly id: number;
}

export interface ProjectConfig {
  readonly projectId: string;
  readonly deliveryMode: DeliveryMode;
  readonly yolo: boolean;
  readonly branchPrefix: string | null;
  readonly baseBranch: string | null;
  readonly defaultMachine: string | null;
}

export interface EventQuery {
  readonly taskId?: string;
  readonly afterSeq?: number;
}

export interface TaskFilter {
  readonly projectId?: string;
  readonly states?: readonly TaskState[];
}
