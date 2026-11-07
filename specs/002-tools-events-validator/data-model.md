# Data model: Tools and approval, event wiring, and the validator

The feature adds no table and no column.
The four tables from milestone 3 (`project_config`, `task`, `task_event`, `approval`) hold all durable state.
The types below are in-memory shapes that the new modules pass around.

## Durable state in use

| Stored fact | Where it lives |
| --- | --- |
| Task kind, mode, state, worker thread, branch, pull request URL | `task` row, rebuilt from `task_event` |
| Dispatch description | `evidence` of the `start` row (D-033) |
| Dispatch profile | `start` payload and the machine context |
| Merge decision | `record_approval` row and the `approval` table |
| Why a task failed or paused | `evidence` of the `fail`, `finding`, or `reconcile` row |
| Delivery mode, `yolo`, branch prefix, base branch | `project_config` |

## BbPort

The calls the plugin makes to bb, as plain data.

| Method | Input | Output |
| --- | --- | --- |
| `spawnWorker` | `projectId`, `parentThreadId`, `prompt`, `profile`, `metadata`, `baseBranch` | `{ threadId }` |
| `getThread` | `threadId` | `ThreadInfo` or `null` |
| `sendMessage` | `threadId`, `text` | nothing |
| `getEnvironmentPath` | `environmentId` | path or `null` |
| `retireWorker` | `threadId`, `environmentId` | nothing |
| `getProjectCheckout` | `projectId` | path or `null` |
| `requestInput` | `threadId`, `rendererId`, `title`, `payload`, `timeoutMs`, `signal` | `InputResult` |
| `setThreadMetadata` | `threadId`, `metadata` | nothing |

`ThreadInfo`: `id`, `projectId`, `status`, `parentThreadId`, `environmentId`, and `deleted`.
`deleted` is true when bb still serves a soft-deleted thread, so the parent stays known (D-047).
`InputResult`: `{ outcome: "submitted", value }` or `{ outcome: "cancelled", reason }`, as in `spike/RESULTS.md` item 20.

## Caller

`Caller`: `{ threadId, projectId }` from the tool context.
`Identity`: `{ role: "worker"; task: TaskRow }` or `{ role: "other" }`.

## Tool outcome

`ToolOutcome`: `{ ok: boolean; text: string }`.
`register.ts` turns it into bb's `{ content, isError }`.

## Approval form

`ApprovalAnswer`: `{ decision: "approved" | "denied"; comment?: string }`, strict.
`ApprovalPayload`: `{ taskId, branch, prUrl, evidence }`.

## Worktree report

`WorktreeReport`: `{ uncommittedChanges: boolean; unpushedCommits: number }`, the shape of the machine's `teardown` payload.

## MergeExecutor

`merge(input: { task: TaskRow; config: ProjectConfig; checkoutPath: string | null; method: "squash" | "merge" | "rebase" }): Promise<MergeResult>`.
`preflight(input): Promise<null | string>` returns a refusal message or `null`.
`MergeResult`: `{ ok: true } | { ok: false; message: string }`.

## Wake message

`WakeNote`: `{ taskId; kind; mode; headline; evidence; threadId; branch; findings? }`.
`headline` is the state name or a short reason.

## Observation

`LiveObservation` from `src/store/reconcile.ts`: `{ taskId; state: TaskState | "missing" }`.

## Validator types

`Validator`, `RunView`, `Gate`, `Finding`, `Outcome`, `Answer`, and `ValidatorResult` are in [contracts/validator.md](contracts/validator.md).

## Driver memory

The driver keeps, per live task, the abort handle of its loop and the first view of the current wait.
It keeps nothing durable.
The handlers keep the last turn-failure category per thread in a bounded map.
Both are rebuilt or dropped on restart without loss, because the log and the pipeline hold the truth.
