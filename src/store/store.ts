import type {
  ApprovalRow,
  EventQuery,
  NewApproval,
  NewTaskEvent,
  ProjectConfig,
  TaskEventRow,
  TaskFilter,
  TaskRow,
} from "./types";

/**
 * Everything the plugin persists. The event log and the approval list are
 * append-only: this interface offers no way to change or remove them. Rows
 * that come back are frozen copies.
 */
export interface Store {
  appendEvent(input: NewTaskEvent): TaskEventRow;
  /** Events in `seq` order, optionally limited to one task or to rows after a `seq`. */
  listEvents(query?: EventQuery): TaskEventRow[];
  getTask(taskId: string): TaskRow | null;
  /** Task rows ordered by task ID. */
  listTasks(filter?: TaskFilter): TaskRow[];
  /** Replace the whole row for the task ID. */
  putTask(row: TaskRow): void;
  /** Remove every task row. Events, approvals, and configs stay. */
  clearTasks(): void;
  addApproval(input: NewApproval): ApprovalRow;
  /** One task's approvals in insertion order. */
  listApprovals(taskId: string): ApprovalRow[];
  /** The stored config, or the default for an unregistered project. */
  getProjectConfig(projectId: string): ProjectConfig;
  putProjectConfig(config: ProjectConfig): void;
  /** Run `fn` atomically: commit when it returns, roll back every write when it throws. */
  transaction<T>(fn: () => T): T;
  close(): void;
}

/** What an unregistered project resolves to, as in firstmate: `no-mistakes` with `yolo` off. */
export function defaultProjectConfig(projectId: string): ProjectConfig {
  return {
    projectId,
    deliveryMode: "no-mistakes",
    yolo: false,
    branchPrefix: null,
    baseBranch: null,
    defaultMachine: null,
  };
}
