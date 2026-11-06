# Contract: store, task log, replay, and reconcile

Modules: `src/store/`.
Only `src/store/sqlite.ts` imports `better-sqlite3`.

## Store interface

```ts
interface Store {
  appendEvent(input: NewTaskEvent): TaskEventRow;
  listEvents(query?: { taskId?: string; afterSeq?: number }): TaskEventRow[];
  getTask(taskId: string): TaskRow | null;
  listTasks(filter?: { projectId?: string; states?: TaskState[] }): TaskRow[];
  putTask(row: TaskRow): void;
  clearTasks(): void;
  addApproval(input: NewApproval): ApprovalRow;
  listApprovals(taskId: string): ApprovalRow[];
  getProjectConfig(projectId: string): ProjectConfig;
  putProjectConfig(config: ProjectConfig): void;
  transaction<T>(fn: () => T): T;
  close(): void;
}
```

## Store guarantees (checked by the shared contract suite)

1. `appendEvent` assigns a `seq` that is strictly greater than every earlier `seq`.
2. Rows read back equal rows written.
   Returned rows are frozen copies, so mutating one cannot change the store.
3. The interface has no way to update or delete an event or an approval.
   The SQLite schema also rejects raw `UPDATE` and `DELETE` on `task_event`.
4. `transaction` commits when `fn` returns and rolls back every write when `fn` throws.
   The error propagates.
5. `getProjectConfig` for an unknown project returns mode `no-mistakes`, `yolo` false, and null for the other fields.
6. `putTask` replaces the whole row for a task ID.
   `clearTasks` removes task rows and nothing else.
7. `listTasks` returns rows ordered by `task_id`.

## Task log

```ts
class TaskLog {
  constructor(store: Store, options?: { now?: () => string });
  create(raw: unknown): LogOutcome;
  apply(taskId: string, raw: unknown): LogOutcome;
}

type LogOutcome =
  | { ok: true; task: TaskRow; event: TaskEventRow }
  | { ok: false; refusal: Refusal; event: TaskEventRow };
```

1. `apply` replays the task's applied events to get the snapshot, calls `transition`, and then writes inside one transaction.
2. On success it appends an `applied` row, upserts the task row, and adds an approval row for `record_approval`.
3. On refusal it appends a `refused` row with the reason and changes nothing else.
4. If any write throws, the transaction rolls back and the error propagates.
   No partial state remains.
5. An unknown task ID is a refusal with code `unknown_task`.
   A repeated `create` is `task_exists`.

## Replay

```ts
function replayTask(store: Store, taskId: string): ReplayResult;
function rebuildCache(store: Store): RebuildReport;
function recover(store: Store): RecoveryReport;
```

1. `replayTask` folds applied rows (skipping `reconcile`) through `createTask` and `transition`.
   It returns `{ ok: true, snapshot, lastSeq }`, `{ ok: false, reason: "not_found" }` for a task with no applied rows, or `{ ok: false, reason: "corrupt", seq, refusal }` with the failing `seq`.
2. `rebuildCache` clears task rows and writes one row per replayable task, in one transaction.
   It lists corrupt tasks and writes no row for them.
3. `recover` replays every task whose last state row is not `torn_down`, repairs any cache row that is missing or differs from its replay, and returns `replayed` snapshots, `repaired` task IDs, `corrupt` tasks, and `skipped` terminal task IDs.
   It writes only the cache and never the log.

## Reconcile

```ts
interface LiveObservation { taskId: string; state: TaskState | 'missing' }
function reconcile(store: Store, observations: LiveObservation[], options?: { now?: () => string }): ReconcileReport;
```

1. For each observation whose state differs from the replayed state, append one `reconcile` row.
   The row keeps `from_state` and `to_state` equal to the replayed state and carries the observed state in the payload and a sentence in the evidence.
2. Task rows and approvals never change.
3. If the task's latest log row is already an identical `reconcile` row, append nothing.
4. Observations for unknown or corrupt tasks are reported and never logged against a made-up state.
