# Contract: event wiring and wake messages

## Handled events

A handler first loads the task whose `workerThreadId` equals the event's thread ID.
It returns without a change or a message when there is none, when the task is `torn_down`, or when the rule below does not apply.

| bb event | Applies when the task is | Action | Wake |
| --- | --- | --- | --- |
| `thread.failed` | `working` or `blocked` | Apply `fail` (actor `system`) with evidence from `error`; when `error` is empty, wait 500 ms for the `turn.failed` that follows (spike item 21) and use its category and status code; else the fixed text `worker thread entered the error state` | by state (`failed`) |
| `thread.deleted` | any state before `torn_down` | Apply `fail` (actor `system`) with evidence `worker thread was deleted` | by state (`failed`) |
| `thread.idle` | `working` | none | "worker finished a turn without reporting" |
| `thread.archived` | any state before `torn_down` | none | "worker thread was archived and its worktree may be removed" |
| `interaction.pending` | any non-terminal state, interaction origin is not this plugin | none | "worker raised a question: <title>" |
| `turn.failed` | any | remember the category and status code for the thread in memory | none |
| every other event | n/a | ignored | none |

An event that the machine refuses, such as a second `thread.failed`, is logged as a refused row and sends nothing.

## Wake by state

After every applied event, from a tool, a handler, or the driver, the notifier checks the new state.

| New state | Wake |
| --- | --- |
| `needs_decision`, `review_ready`, `report_ready`, `blocked`, `failed` | one message |
| every other state | none |

## Wake target and delivery

The target is `parentThreadId` of the worker thread, read from the event's thread DTO or from `BbPort.getThread`.
The message goes through `threads.send` with `mode: "auto"`.
No parent logs a warning and sends nothing.
A send error logs a warning and changes nothing else.

## Message text

```text
[factoryman] Task <taskId> (<kind>, <mode>) is now <state>.
Evidence: <evidence cut to 600 characters>
Worker thread: <threadId>. Branch: <branch>.
```

A `needs_decision` message from the validator adds one line per finding: `- <id> [<severity>] <file>: <action>: <description>`, exactly as the validator wrote the fields.
The non-transition wakes use the same first line with a short reason in place of the state.

## Start-up

1. `recover(store)` rebuilds stale cache rows and reports corrupt tasks.
2. For each non-terminal task that has a worker thread, `BbPort.getThread` gives an observation: `missing` when the thread is absent or deleted, `failed` when its status is `error`, and the logged state otherwise.
3. `reconcile(store, observations)` writes one `reconcile` row per mismatch and none for a mismatch that is already the last row.
4. Each written row produces one message to the supervisor.
5. The validator driver resumes every task that is `validating` or `needs_decision`.

The step runs in a background service after the factory returns, because `bb.sdk` is available there.
