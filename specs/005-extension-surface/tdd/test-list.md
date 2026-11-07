---
feature: 005-extension-surface
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 17
planned_at: 6ce8bfc
updated_at: 6ce8bfc
suite_baseline: green
---

# Test list: Extension surface

The acceptance layer is an in-process integration test through the bb fake plugin host and the public factory.
A sibling plugin is simulated with the host's `callRpc`, which has host semantics (schema checks and a caller).
Spike items 9 and 10 pin the real cross-plugin facts from two probe plugins on a throwaway bb.
The suite baseline was 72 files and 873 tests, all passing.

## Outer loop: acceptance behaviors

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| A901 | With no `workflow.json`, dispatch and report behave as before | AC-1.1, FR-901 | example | DONE | `test/acceptance/extension-workflow.test.ts::[A901]` |
| A902 | A `workflow.json` with bad JSON or a schema error blocks dispatch and a worker's done report, and nothing replaces it | AC-1.2, FR-902 | example | DONE | `test/acceptance/extension-workflow.test.ts::[A902]` |
| A903 | `branchPrefix` and `defaultMachine` in the file fill blank stored values, and a stored value wins | AC-1.3, FR-904 | example | DONE | `test/acceptance/extension-workflow.test.ts::[A903]` |
| A904 | A stricter or equal `deliveryMode` in the file applies, and a looser one blocks | AC-1.4, FR-904 | example | DONE | `test/acceptance/extension-workflow.test.ts::[A904]` |
| A905 | A file that sets a gate-like key is rejected with a message that names hard rule 7 | AC-2.1, FR-903, SC-902 | example | DONE | `test/acceptance/extension-workflow.test.ts::[A905]` |
| A906 | A file that sets `project.baseBranch` is rejected | AC-2.2, FR-903 | example | DONE | `test/acceptance/extension-workflow.test.ts::[A906]` |
| A907 | A file with any other unknown key is rejected | AC-2.3, FR-903 | example | DONE | `test/acceptance/extension-workflow.test.ts::[A907]` |
| A908 | The configured checks run in the worker's worktree on the task's machine and their results travel in the `handoff` or `ready` event | AC-3.1, FR-905, FR-906 | example | DONE | `test/acceptance/extension-workflow.test.ts::[A908]` |
| A909 | A failing check refuses the event with `check_failed`, logs the refusal, leaves the task `working`, and shows the worker the failing output | AC-3.2, FR-905 | example | DONE | `test/acceptance/extension-workflow.test.ts::[A909]` |
| A910 | Passing checks do not loosen another gate: empty evidence is still refused | AC-3.3, FR-905 | example | DONE | `test/acceptance/extension-workflow.test.ts::[A910]` |
| A911 | A check that cannot run counts as failed | AC-3.4, FR-907 | error | DONE | `test/acceptance/extension-workflow.test.ts::[A911]` |
| A912 | A scout task runs no check | AC-3.5, FR-906 | example | DONE | `test/acceptance/extension-workflow.test.ts::[A912]` |
| A913 | After each applied event the worker thread holds `taskId`, `kind`, `mode`, `state`, and `machine`, and keeps `role` | AC-4.1, FR-908 | example | DONE | `test/acceptance/extension-surface.test.ts::[A913]` |
| A914 | A failed metadata write leaves the transition in place and logs a warning | AC-4.2, FR-908 | error | DONE | `test/acceptance/extension-surface.test.ts::[A914]` |
| A915 | A sibling plugin reads tasks and events through `callRpc`, with `since`, and every answer carries `apiVersion` 1 | AC-5.1, FR-909, SC-901 | example | DONE | `test/acceptance/extension-surface.test.ts::[A915]` |
| A916 | No RPC call changes the log, and a write-shaped method does not exist | AC-5.2, FR-909, SC-901 | example | DONE | `test/acceptance/extension-surface.test.ts::[A916]` |
| A917 | The registered methods are exactly the four read methods, each discoverable with a description | AC-5.3, FR-909 | example | DONE | `test/acceptance/extension-surface.test.ts::[A917]` |
| A918 | `src/machine/` imports nothing from the layers above it, so the event field, the guard, and the reason code are the only additions | FR-910 | example | DONE | `test/acceptance/layout.test.ts::[A918]` |

## Added by the audit (cycle R1)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| A919 | The `direct-PR` and `local-only` checks run on `ready`, a failing check refuses with `check_failed`, and another mode's check does not run | AC-3.1, AC-3.2 | example | DONE | `test/acceptance/extension-workflow.test.ts::[A919]` |
| A920 | The dispatch resolver gets the effective mode | AC-1.4 | example | DONE | `test/acceptance/extension-workflow.test.ts::[A920]` |
| A921 | The checks of a remote task run on its machine | AC-3.1 | example | DONE | `test/acceptance/extension-workflow.test.ts::[A921]` |
| A922 | A report with checks to run and no worktree path is refused | AC-3.4 | error | DONE | `test/acceptance/extension-workflow.test.ts::[A922]` |
| U936 | The list of gate-like keys is pinned by hand | FR-903 | example | DONE | `src/workflow/config.test.ts::[U936]` |
| U937 | A project read that fails blocks a done report | FR-902 | error | DONE | `src/tools/report.test.ts::[U937]` |
| U938 | A worker thread or worktree path read that fails blocks a done report | FR-906 | error | DONE | `src/tools/report.test.ts::[U938]` |
| U939 | A `blocked` or `failed` report passes with failing checks or an invalid file, and runs no check | FR-906 | example | DONE | `src/tools/report.test.ts::[U939]` |
| U940 | `listEvents` returns 200 rows by default and takes a limit of 1000 | FR-909 | boundary | DONE | `src/rpc/read.test.ts::[U940]` |
| U941 | The stamper writes nothing after a refused event | FR-908 | example | DONE | `src/wiring/stamp.test.ts::[U941]` |
| U942 | A version other than 1 and input that is not an object are rejected | FR-901 | example | DONE | `src/workflow/config.test.ts::[U942]` |
| U943 | A check with no timeout of its own gets the 600 second default | FR-907 | boundary | DONE | `src/tools/report.test.ts::[U943]` |

`[U905]` and `[U915]` are split into one behavior per test.

## Inner loop: unit behaviors

### `src/workflow/config.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U901 | A minimal file parses and fills an empty `checks` and `project` | FR-901 | example | DONE | `src/workflow/config.test.ts::[U901]` |
| U902 | Each gate-like key is rejected with a message that names hard rule 7, at the top level and under `project` | FR-903 | example | DONE | `src/workflow/config.test.ts::[U902]` |
| U903 | `project.baseBranch` is rejected with a message about the landed-work check | FR-903 | example | DONE | `src/workflow/config.test.ts::[U903]` |
| U904 | An unknown key is rejected at the top level, in `project`, and in a check | FR-903 | example | DONE | `src/workflow/config.test.ts::[U904]` |
| U905 | A check needs a name and a non-empty argv, names are unique per mode, at most 20 per mode, and a timeout is 1 to 3600 seconds | FR-906 | boundary | DONE | `src/workflow/config.test.ts::[U905]` |
| U906 | `deliveryMode` accepts the three modes and nothing else, and `checks` keys must be modes | FR-904 | example | DONE | `src/workflow/config.test.ts::[U906]` |

### `src/workflow/load.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U907 | An absent file or an unknown checkout gives the empty config | FR-901 | example | DONE | `src/workflow/load.test.ts::[U907]` |
| U908 | Invalid JSON, a schema failure, and a read error each block with a message that names workflow.json | FR-902 | error | DONE | `src/workflow/load.test.ts::[U908]` |
| U909 | The loader reads `<checkout>/.bb/factoryman/workflow.json` | FR-901 | example | DONE | `src/workflow/load.test.ts::[U909]` |

### `src/workflow/effective.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U910 | `branchPrefix` and `defaultMachine` fill a null stored value, and a stored value wins | FR-904 | example | DONE | `src/workflow/effective.test.ts::[U910]` |
| U911 | An equal or stricter `deliveryMode` replaces the stored mode | FR-904 | boundary | DONE | `src/workflow/effective.test.ts::[U911]` |
| U912 | A looser `deliveryMode` is blocked with a message naming both modes | FR-904 | boundary | DONE | `src/workflow/effective.test.ts::[U912]` |
| U913 | `yolo` and `baseBranch` always come from the store | FR-903 | example | DONE | `src/workflow/effective.test.ts::[U913]` |

### `src/machine/` (events, guards, table, refusal)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U914 | `handoff` and `ready` accept `checks` of name and passed, and no other event does | FR-905 | example | DONE | `src/machine/events.test.ts::[U914]` |
| U915 | `customChecksPassed` refuses any check with `passed: false` and names the failures | FR-905 | example | DONE | `src/machine/guards.test.ts::[U915]` |
| U916 | `customChecksPassed` passes with no checks, an empty list, or all passed | FR-905 | boundary | DONE | `src/machine/guards.test.ts::[U916]` |
| U917 | The ship table lists the guard on `handoff` and `ready` after the existing gates | FR-905 | example | DONE | `src/machine/table.test.ts::[U917]` |
| U918 | A failing check refuses `handoff` and `ready` through `transition` with `check_failed`, and the other guards still run first | FR-905 | example | DONE | `src/machine/transition.test.ts::[U918]` |

### `src/workflow/checks.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U919 | Each check runs with `argv[0]`, the rest as arguments, the worktree as `cwd`, the task's host, and its timeout | FR-906 | example | DONE | `src/workflow/checks.test.ts::[U919]` |
| U920 | A check passes only on exit code 0 | FR-907 | boundary | DONE | `src/workflow/checks.test.ts::[U920]` |
| U921 | A check that cannot run (code null) fails with its error in the detail | FR-907 | error | DONE | `src/workflow/checks.test.ts::[U921]` |
| U922 | Every check runs even after one fails, in order | FR-906 | example | DONE | `src/workflow/checks.test.ts::[U922]` |
| U923 | The failure text names each failing check with the tail of its output, cut to a limit | FR-906 | example | DONE | `src/workflow/checks.test.ts::[U923]` |
| U924 | No configured check gives no facts and runs nothing | FR-906 | example | DONE | `src/workflow/checks.test.ts::[U924]` |

### `src/wiring/stamp.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U925 | After an applied event the stamper writes taskId, kind, mode, state, and machine to the worker thread | FR-908 | example | DONE | `src/wiring/stamp.test.ts::[U925]` |
| U926 | A task with no worker thread is skipped | FR-908 | boundary | DONE | `src/wiring/stamp.test.ts::[U926]` |
| U927 | A failed write is logged as a warning and the event stands | FR-908 | error | DONE | `src/wiring/stamp.test.ts::[U927]` |
| U928 | The stamper does not write the role | FR-908 | example | DONE | `src/wiring/stamp.test.ts::[U928]` |

### `src/rpc/read.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U929 | `listTasks` returns task rows, filtered by project and states | FR-909 | example | DONE | `src/rpc/read.test.ts::[U929]` |
| U930 | `getTask` returns the row, and null for an unknown task | FR-909 | example | DONE | `src/rpc/read.test.ts::[U930]` |
| U931 | `listEvents` returns rows after `since`, for one task or all, up to a limit | FR-909 | boundary | DONE | `src/rpc/read.test.ts::[U931]` |
| U932 | `apiVersion` returns 1, and every answer carries `apiVersion` 1 | FR-909 | example | DONE | `src/rpc/read.test.ts::[U932]` |
| U933 | The registration has exactly four methods, all discoverable and described | FR-909 | example | DONE | `src/rpc/read.test.ts::[U933]` |
| U934 | The handlers never call a write method of the store | FR-909 | example | DONE | `src/rpc/read.test.ts::[U934]` |
| U935 | Input outside the contract (extra keys, a negative limit) is rejected by the schema | FR-909 | boundary | DONE | `src/rpc/read.test.ts::[U935]` |
