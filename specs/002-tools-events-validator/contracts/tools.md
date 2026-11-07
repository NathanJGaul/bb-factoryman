# Contract: the five tools, the approval form, and the supervisor command

Every tool returns plain text through bb's tool result.
A refusal returns the same text with `isError: true`.
No tool throws for an expected failure.

## Caller identity

`identify(store, threadId)` returns `{ role: "worker", task }` when a task's `workerThreadId` equals the thread ID, and `{ role: "other" }` otherwise.
The store is the only input.
A supervisor tool accepts `other` and refuses `worker`.
`factoryman_report` accepts `worker` and refuses `other`.
A supervisor tool also refuses a task whose `projectId` differs from the context's `projectId`.

## Visibility

`bb.agents.configure` returns tools from `context.pluginMetadata.role`.

| Role in metadata | Tools offered |
| --- | --- |
| `supervisor` | `factoryman_dispatch`, `factoryman_status`, `factoryman_merge`, `factoryman_teardown` |
| `worker` | `factoryman_report` |
| anything else | none |

Visibility is a hint.
Each tool re-checks the caller.

## `factoryman_dispatch`

Arguments:

| Field | Type | Rule |
| --- | --- | --- |
| `kind` | `"ship"` or `"scout"` | required |
| `description` | string | required, not blank |
| `profile.provider` | string | required, not blank |
| `profile.model` | string | required, not blank |
| `profile.reasoningLevel` | string | required, not blank |
| `profile.permissionMode` | `"accept-edits"`, `"auto"`, or `"full"` | required |

Steps:

1. Refuse a worker caller.
2. Validate the arguments (the schema rejects extra fields).
   On failure, return the refusal.
   Create nothing.
3. Read `getProjectConfig(projectId)`.
   The task mode is `deliveryMode`.
4. Make a task ID and the branch `<branchPrefix ?? "fm/"><taskId>`.
5. `TaskLog.create` with actor `supervisor`.
6. Spawn the worker through `BbPort.spawnWorker`: parent is the caller's thread, `parentNotifications` is `off`, plugin metadata is `{ role: "worker", taskId, kind }`, and the prompt comes from `buildWorkerPrompt`.
7. On a spawn error, apply `fail` (actor `system`, evidence `worker spawn failed: <message>`) and return an error result.
8. Apply `start` (actor `supervisor`, the profile, the thread ID, the branch, evidence = the description).
9. Read the thread once.
   If it is already in `error`, apply `fail`.

Result: `Dispatched <kind> task <taskId> in <mode> mode. Worker thread <threadId>, branch <branch>.`

## `factoryman_report`

Arguments:

| Field | Type | Rule |
| --- | --- | --- |
| `outcome` | `"done"`, `"blocked"`, or `"failed"` | required |
| `evidence` | string | required |
| `prUrl` | URL string | optional |
| `landedCommits` | non-negative integer | optional |

The task is the one the store records for the calling thread.

| Outcome | Task kind and mode | Event |
| --- | --- | --- |
| `done` | scout | `report` |
| `done` | ship, `no-mistakes` | `handoff` |
| `done` | ship, `direct-PR` | `ready` with `prUrl` |
| `done` | ship, `local-only` | `ready` with `landedCommits` |
| `blocked` | any | `block` |
| `failed` | any | `fail` |

The actor is `worker`.
The machine decides every refusal.

Result: `Task <taskId> is now <state>.` or the refusal.

## `factoryman_status`

Arguments: optional `taskId`, optional `states` (a list of states).
With a `taskId`, the result is one task block.
Without it, the result lists the tasks of the caller's project, filtered by `states`.
Each block shows task ID, kind, mode, state, worker thread, branch, pull request URL, and the first line of the description.
The tool reads the store and appends nothing.

## `factoryman_merge`

Arguments: `taskId`.

1. Refuse a worker caller, an unknown task, a task in another project, a scout, and a state other than `review_ready` or `awaiting_approval`.
2. Refuse when another merge call for the task is waiting for the owner.
3. Run the executor preflight (for example, a `local-only` project needs a base branch).
   Refuse on failure, before any form.
4. From `review_ready`, apply `request_approval` (actor `supervisor`).
5. If `yolo` is off, open the form and wait:

   | Form outcome | Recorded | Result |
   | --- | --- | --- |
   | `submitted` with `{ decision: "approved" }` | `record_approval` approved (actor `user`, scope `merge`) | continue |
   | `submitted` with `{ decision: "denied" }` | `record_approval` denied | stop, "denied" |
   | `submitted` with anything else | nothing | stop, "unreadable answer" |
   | `cancelled` (any reason) | nothing | stop, "not answered: <reason>" |

6. Preview the `merge` event with `yolo` set from the project config.
   If the machine would refuse, stop with that refusal.
7. Run the executor.
   On failure, record nothing and return the error.
8. Apply `merge` (actor `supervisor`, `yolo`).
   If the machine refuses after a successful merge, return an error that says the forge merged and the log refused.

Form payload: `{ taskId, branch, prUrl, evidence }`.
Form answer schema: `{ decision: "approved" | "denied", comment?: string }`, strict.
The comment becomes the approval event's evidence.

## `factoryman_teardown`

Arguments: `taskId`.

1. Refuse a worker caller, an unknown task, and a task in another project.
2. Resolve the worker thread, its environment, and the environment path through `BbPort`.
3. Read the worktree report from git.
   A failed read refuses.
4. Apply `teardown` (actor `supervisor`) with the report.
   The machine refuses unlanded work.
5. After the event is recorded, retire the worker through `BbPort.retireWorker`: archive the worker thread, then delete its environment (spike item 25).
   A failure here is reported in the result and does not undo the event.

Result: `Task <taskId> is torn down.` or the refusal.

## Supervisor command

`bb factoryman supervisor <thread-id>` refuses a thread that the store records as a worker.
Otherwise it stamps `{ role: "supervisor" }` on the thread's plugin metadata and prints a confirmation.

## Worker prompt

`buildWorkerPrompt` returns plain text that names the task ID, kind, delivery mode, and branch, gives the description, tells the worker to create the branch first, to commit its work, and to call `factoryman_report` with evidence, tells a `no-mistakes` worker never to push, and tells every worker not to contact the owner.
