# Data model: Core scaffold, task state machine, and event storage

## Vocabulary

| Name | Values |
| --- | --- |
| Task kind | `ship`, `scout` |
| Delivery mode | `no-mistakes`, `direct-PR`, `local-only` |
| Task state | `queued`, `working`, `blocked`, `validating`, `needs_decision`, `review_ready`, `awaiting_approval`, `merged`, `report_ready`, `torn_down`, `failed` |
| Actor | `worker`, `supervisor`, `user`, `system` |
| Approval scope | `merge`, `promote` |
| Approval decision | `approved`, `denied` |
| Outcome | `applied`, `refused` |

`torn_down` is the only terminal state.
`failed` can still move to `torn_down`.

## Machine types (`src/machine/`)

### Profile

| Field | Rule |
| --- | --- |
| `provider` | Non-empty string |
| `model` | Non-empty string |
| `reasoningLevel` | Non-empty string |
| `permissionMode` | Non-empty string |

### Task context

| Field | Type | Set by |
| --- | --- | --- |
| `taskId` | string | `create` |
| `projectId` | string | `create` |
| `kind` | task kind | `create`, and `promote` sets `ship` |
| `mode` | delivery mode | `create` |
| `profile` | Profile or null | `start`; `promote` resets to null |
| `workerThreadId` | string or null | `start` |
| `branch` | string or null | `start` |
| `machine` | string or null | `start` |
| `prUrl` | string or null | `ready` and `validated`; `promote` resets to null |
| `approvals` | map of scope to latest decision | `record_approval`; `promote` and `request_changes` reset to empty |

### Task snapshot

`{ state: TaskState, context: TaskContext }`

### Events

Every event has `type` and `actor`.
`evidence` is an optional string on every event.
Schemas are strict: unknown keys are invalid.

| Event | Extra fields | Moves |
| --- | --- | --- |
| `create` | `taskId`, `projectId`, `kind`, `mode` | none to `queued` (through `createTask`) |
| `start` | `profile` (nullable), `threadId`, `branch`, `machine` (nullable) | `queued` to `working` |
| `block` | none | `working` to `blocked` |
| `unblock` | none | `blocked` to `working` |
| `handoff` | none | `working` to `validating` |
| `ready` | `prUrl` (optional URL), `landedCommits` (optional integer, 0 or more) | `working` to `review_ready` |
| `report` | none | `working` to `report_ready` (scout) |
| `finding` | none | `validating` to `needs_decision` |
| `resolve` | none | `needs_decision` to `validating` |
| `validated` | `prUrl` (URL), `pipelineFinished` (boolean) | `validating` to `review_ready` |
| `request_approval` | none | `review_ready` to `awaiting_approval` |
| `request_changes` | none | `review_ready` or `awaiting_approval` to `working` (ship only) |
| `record_approval` | `scope`, `decision` | self, in `awaiting_approval` (scope `merge`) and `report_ready` (scope `promote`) |
| `merge` | `yolo` (boolean) | `awaiting_approval` to `merged` |
| `promote` | none | `report_ready` to `queued`, kind becomes `ship` |
| `teardown` | `worktree`: `uncommittedChanges` (boolean), `unpushedCommits` (integer, 0 or more) | `merged`, `report_ready`, or `failed` to `torn_down` |
| `fail` | none | any state except `torn_down` and `failed`, to `failed` |

### Transition table

Guards run in the listed order.
The first failing guard names the refusal.

| Kind | From | Event | To | Guards |
| --- | --- | --- | --- | --- |
| both | `queued` | `start` | `working` | `profileResolved` |
| both | `working` | `block` | `blocked` | none |
| both | `blocked` | `unblock` | `working` | none |
| ship | `working` | `handoff` | `validating` | `modeIsNoMistakes`, `evidenceProvided` |
| ship | `working` | `ready` | `review_ready` | `modeIsNotNoMistakes`, `evidenceProvided`, `readyModeCheck` |
| ship | `validating` | `finding` | `needs_decision` | none |
| ship | `needs_decision` | `resolve` | `validating` | none |
| ship | `validating` | `validated` | `review_ready` | `modeIsNoMistakes`, `evidenceProvided`, `pipelineFinishedWithPr` |
| ship | `review_ready` | `request_approval` | `awaiting_approval` | `notWorker` |
| ship | `awaiting_approval` | `record_approval` | same | `ownerOnly`, `approvalScopeIsMerge` |
| ship | `awaiting_approval` | `merge` | `merged` | `notWorker`, `mergeAuthorized` |
| ship | `review_ready` | `request_changes` | `working` | `notWorker` |
| ship | `awaiting_approval` | `request_changes` | `working` | `notWorker` |
| ship | `merged` | `teardown` | `torn_down` | `notWorker`, `worktreeLanded` |
| scout | `working` | `report` | `report_ready` | `evidenceProvided` |
| scout | `report_ready` | `record_approval` | same | `ownerOnly`, `approvalScopeIsPromote` |
| scout | `report_ready` | `promote` | `queued` | `notWorker`, `promotionAuthorized` |
| scout | `report_ready` | `teardown` | `torn_down` | `notWorker`, `worktreeLanded` |
| both | any state except `torn_down` and `failed` | `fail` | `failed` | `evidenceProvided` |
| both | `failed` | `teardown` | `torn_down` | `notWorker`, `worktreeLanded` |

Every pair not in this table is refused as `illegal_transition`.

### Guards and reason codes

| Guard | Passes when | Reason code on failure |
| --- | --- | --- |
| `profileResolved` | `profile` is present | `profile_required` |
| `evidenceProvided` | `evidence` is non-empty after trimming | `evidence_required` |
| `modeIsNoMistakes` | task mode is `no-mistakes` | `mode_mismatch` |
| `modeIsNotNoMistakes` | task mode is `direct-PR` or `local-only` | `mode_mismatch` |
| `readyModeCheck` | `direct-PR` has `prUrl`; `local-only` has `landedCommits` of 1 or more | `mode_check_failed` |
| `pipelineFinishedWithPr` | `pipelineFinished` is true | `mode_check_failed` |
| `notWorker` | actor is not `worker` | `actor_forbidden` |
| `ownerOnly` | actor is `user` | `actor_forbidden` |
| `approvalScopeIsMerge` | scope is `merge` | `approval_scope_mismatch` |
| `approvalScopeIsPromote` | scope is `promote` | `approval_scope_mismatch` |
| `mergeAuthorized` | `yolo` is true, or `approvals.merge` is `approved` | `approval_required` |
| `promotionAuthorized` | `approvals.promote` is `approved` | `approval_required` |
| `worktreeLanded` | no uncommitted changes and zero unpushed commits | `unlanded_work` |

Other reason codes: `invalid_event` (schema failure), `unknown_event` (type not in the vocabulary), `illegal_transition` (no table row), `unknown_task`, `task_exists`, `internal_mismatch` (xstate and table disagree), and `corrupt_log` (replay only).

### Refusal

`{ code: ReasonCode, message: string }`

## Storage rows (`src/store/`)

### `project_config`

| Column | Type | Notes |
| --- | --- | --- |
| `project_id` | text, primary key | bb project ID |
| `delivery_mode` | text | One of the three modes |
| `yolo` | integer 0 or 1 | |
| `branch_prefix` | text, nullable | No invented default |
| `base_branch` | text, nullable | No invented default |
| `default_machine` | text, nullable | |

An unregistered project reads as mode `no-mistakes`, `yolo` off, and null for the rest.

### `task` (cache)

| Column | Type | Notes |
| --- | --- | --- |
| `task_id` | text, primary key | |
| `project_id` | text | Added to the design's columns |
| `kind` | text | |
| `mode` | text | Added; fixed at creation |
| `state` | text | |
| `worker_thread_id` | text, nullable | |
| `branch` | text, nullable | |
| `machine` | text, nullable | |
| `pull_request_url` | text, nullable | |

### `task_event` (append-only)

| Column | Type | Notes |
| --- | --- | --- |
| `seq` | integer, primary key, autoincrement | Strict order; added |
| `task_id` | text | |
| `at` | text | ISO 8601 UTC from the injected clock |
| `from_state` | text, nullable | Null for `create` and unknown-task refusals |
| `to_state` | text, nullable | Same as `from_state` for refusals and `reconcile` |
| `event` | text | Event type, or `reconcile` |
| `actor` | text | Actor, or `unknown` for unreadable input |
| `evidence` | text, nullable | |
| `payload` | text (JSON) | Event fields minus `type`, `actor`, `evidence`; added |
| `outcome` | text | `applied` or `refused`; added |
| `reason_code` | text, nullable | Set on refusals; added |
| `reason_message` | text, nullable | Set on refusals; added |

Triggers abort any `UPDATE` or `DELETE`.
Replay reads `applied` rows and skips `reconcile` rows.

### `approval` (append-only)

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer, primary key, autoincrement | |
| `task_id` | text | |
| `scope` | text | What the owner approved |
| `decision` | text | |
| `at` | text | |

## Derived views

- **Task row from snapshot**: the nine task columns map one to one from the context and the state.
- **Replay**: fold applied non-`reconcile` rows through `createTask` and `transition`.
- **Terminal task**: a task whose replayed state is `torn_down`.
- **Corrupt task**: a task whose applied row fails the machine on replay, or whose `to_state` differs from the machine's result.
