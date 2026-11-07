---
feature: 002-tools-events-validator
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 38
planned_at: 2f108b0
updated_at: 2f108b0
suite_baseline: green
---

# Test List: Tools and approval, event wiring, and the validator

The acceptance layer is an in-process integration test through the bb fake plugin host (`createFakePluginHost`) and the public factory.
No process-level runner drives a real bb, so every `A` behavior is weaker than an end-to-end test.
The real bb and no-mistakes behavior is pinned by `spike/RESULTS.md` and by the recorded fixtures under `test/fixtures/recorded/`.
The suite baseline was 20 files and 354 tests, all passing.

## Outer loop: acceptance behaviors

One per acceptance criterion in `spec.md`.
Each stays red until the feature works through the plugin factory.
The `test` column is filled in when the test is written.

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| A1 | Thread roles decide which tools bb offers: supervisor gets four, worker gets `factoryman_report`, any other thread gets none | AC-1.1, FR-101, FR-102 | example | PENDING | `test/acceptance/tools-visibility.test.ts` |
| A2 | A recorded worker thread is refused on every supervisor tool, and a thread that is not a recorded worker is refused on `factoryman_report` | AC-1.2, FR-103, FR-104 | example | PENDING | `test/acceptance/tools-authority.test.ts` |
| A3 | `factoryman_dispatch` creates a task in the project's mode, spawns one child worker with notifications off and role metadata, and records `start` with thread and planned branch | AC-1.3, FR-106, FR-107, FR-108, FR-109 | example | PENDING | `test/acceptance/tools-dispatch.test.ts` |
| A4 | `factoryman_dispatch` with an incomplete profile, empty description, or unknown kind is refused before any task or thread exists | AC-1.4, FR-106 | example | PENDING | `test/acceptance/tools-dispatch.test.ts` |
| A5 | `factoryman_dispatch` whose spawn fails records the task as `failed` with the spawn error as evidence | AC-1.5, FR-105 | example | PENDING | `test/acceptance/tools-dispatch.test.ts` |
| A6 | `factoryman_report` records handoff, ready, or report as kind and mode require, block or fail for those outcomes, and logs a refusal for empty evidence | AC-1.6, FR-110, FR-105 | example | PENDING | `test/acceptance/tools-report.test.ts` |
| A7 | `factoryman_status` reads one task or a filtered project list and writes nothing to the log | AC-1.7, FR-111 | example | PENDING | `test/acceptance/tools-status.test.ts` |
| A8 | A submitted approval records the request and the owner's approval, runs the merge once, and ends the task `merged` | AC-1.8, FR-112, FR-113, FR-115, SC-002 | example | PENDING | `test/acceptance/tools-merge.test.ts` |
| A9 | A submitted denial is recorded, nothing merges, and the task stays `awaiting_approval` | AC-1.9, FR-114, SC-002 | example | PENDING | `test/acceptance/tools-merge.test.ts` |
| A10 | A cancelled or timed-out form records no approval, merges nothing, leaves `awaiting_approval`, and a later call opens a new form | AC-1.10, FR-114, SC-002 | example | PENDING | `test/acceptance/tools-merge.test.ts` |
| A11 | A form value that is not exactly an approval or a denial records nothing and is reported as unreadable | AC-1.11, FR-113 | example | PENDING | `test/acceptance/tools-merge.test.ts` |
| A12 | Under `yolo` no form opens, the merge runs, and the merge event carries the `yolo` flag | AC-1.12, FR-116 | example | PENDING | `test/acceptance/tools-merge.test.ts` |
| A13 | An approved merge whose command fails records no `merge` event and leaves `awaiting_approval` | AC-1.13, FR-115 | example | PENDING | `test/acceptance/tools-merge.test.ts` |
| A14 | `factoryman_merge` on a wrong state, a scout, or a worker caller is refused and opens no form | AC-1.14, FR-105, FR-112 | example | PENDING | `test/acceptance/tools-merge.test.ts` |
| A15 | Teardown with uncommitted changes or unpushed commits is refused, logged, and removes no environment | AC-1.15, FR-118, FR-119 | example | PENDING | `test/acceptance/tools-teardown.test.ts` |
| A16 | Teardown of a landed worktree records `torn_down` and then retires the worker environment | AC-1.16, FR-120 | example | PENDING | `test/acceptance/tools-teardown.test.ts` |
| A17 | The plugin factory opens the store on the host database, recovers, and registers exactly five tools | AC-1.17, FR-101, FR-121 | example | PENDING | `test/acceptance/plugin.test.ts` |
| A18 | The supervisor command stamps the role on a non-worker thread and refuses a recorded worker | AC-1.18, FR-122 | example | PENDING | `test/acceptance/tools-supervisor-command.test.ts` |
| A19 | A worker thread failure on a `working` task fails the task with evidence and wakes the supervisor once | AC-2.1, FR-203 | example | PENDING | `test/acceptance/wiring-events.test.ts` |
| A20 | An idle worker thread on a `working` task wakes the supervisor and leaves the state unchanged | AC-2.2, FR-205 | example | PENDING | `test/acceptance/wiring-events.test.ts` |
| A21 | A deleted worker thread fails the task, and an archived worker thread only warns the supervisor | AC-2.3, FR-204, FR-206 | example | PENDING | `test/acceptance/wiring-events.test.ts` |
| A22 | A pending interaction from another source wakes the supervisor with its title, and this plugin's own form does not | AC-2.4, FR-207 | example | PENDING | `test/acceptance/wiring-events.test.ts` |
| A23 | Only a transition into `needs_decision`, `review_ready`, `report_ready`, `blocked`, or `failed` sends a wake message | AC-2.5, FR-208 | example | PENDING | `test/acceptance/wiring-events.test.ts` |
| A24 | Events for non-worker threads, terminal tasks, and post-handoff states change nothing and send nothing | AC-2.6, FR-202 | example | PENDING | `test/acceptance/wiring-events.test.ts` |
| A25 | A replayed sequence of at least ten thread events, with a duplicate failure, yields exactly the expected wake messages | AC-2.7, SC-004 | example | PENDING | `test/acceptance/wiring-events.test.ts` |
| A26 | A wake goes to the worker's parent in `auto` mode, no parent warns, and a failed send never undoes the transition | AC-2.8, FR-209, FR-210, FR-211 | example | PENDING | `test/acceptance/wiring-events.test.ts` |
| A27 | Start-up appends one `reconcile` row and one message per mismatch, changes no state, and repeats nothing on a second restart | AC-2.9, FR-212, FR-213 | example | PENDING | `test/acceptance/wiring-startup.test.ts` |
| A28 | The real recorded bb payloads produce the transitions and messages of the scenarios above | AC-2.10, SC-006 | example | PENDING | `test/acceptance/wiring-recorded.test.ts` |
| A29 | The validator interface offers start, status, findings, answer, and cancel on the fake and on the no-mistakes adapter | AC-3.1, FR-301, FR-302 | example | PENDING | `test/acceptance/validator-fake.test.ts` |
| A30 | A worker's handoff on a `no-mistakes` task makes it `validating` and starts the validator in the worktree with the task's intent | AC-3.2, FR-305 | example | PENDING | `test/acceptance/validator-fake.test.ts` |
| A31 | A validator gate makes the task `needs_decision` and wakes the supervisor with each finding verbatim | AC-3.3, FR-306 | example | PENDING | `test/acceptance/validator-fake.test.ts` |
| A32 | An answer, or a changed validator view, returns the task to `validating`, and the plugin never answers a finding on its own | AC-3.4, FR-307, FR-308 | example | PENDING | `test/acceptance/validator-fake.test.ts` |
| A33 | A finished run with `checks-passed` and a pull request makes the task `review_ready` with the pull request URL | AC-3.5, FR-309 | example | PENDING | `test/acceptance/validator-fake.test.ts` |
| A34 | A run that ends `failed` or `cancelled` makes the task `failed` with the validator's error as evidence | AC-3.6, FR-310 | example | PENDING | `test/acceptance/validator-fake.test.ts` |
| A35 | An override, skipped steps, or a missing pull request make the task `needs_decision`, and unreadable output advances nothing | AC-3.7, FR-304, FR-310 | example | PENDING | `test/acceptance/validator-fake.test.ts` |
| A36 | The adapter reads every recorded no-mistakes file into the same gate, findings, outcome, pull request, and error, from stdout only | AC-3.8, FR-303, FR-304, SC-006 | example | PENDING | `test/acceptance/validator-recorded.test.ts` |
| A37 | After a restart a `validating` or `needs_decision` task resumes from the worktree without a second run | AC-3.9, FR-311, FR-312 | example | PENDING | `test/acceptance/validator-fake.test.ts` |
| A38 | A `direct-PR` or `local-only` task never starts the validator | AC-3.10, FR-305 | example | PENDING | `test/acceptance/validator-fake.test.ts` |

## Inner loop: unit behaviors

Grouped by the component from `plan.md` that owns them.
Each line names one observable result.
Boundaries have both sides, and error paths name the failure.

### `src/exec.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1 | A finished command returns stdout, stderr, and exit code 0 | FR-303 | example | DONE | `src/exec.test.ts::[U1] returns stdout, stderr, and exit code 0 for a finished command` |
| U2 | A non-zero exit returns its code and output and does not throw | FR-303, FR-115 | example | DONE | `src/exec.test.ts::[U2] returns the exit code and output of a failing command without throwing` |
| U3 | The command runs in the given `cwd` | FR-303, FR-118 | example | DONE | `src/exec.test.ts::[U3] runs the command in the given cwd` |
| U4 | A missing binary returns a failed result and does not throw | FR-301, FR-115 | example | DONE | `src/exec.test.ts::[U4] returns a failed result for a missing binary without throwing` |
| U5 | Arguments reach the command literally, with no shell interpretation | FR-303 | example | DONE | `src/exec.test.ts::[U5] passes arguments literally with no shell interpretation` |

### `src/runtime.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U6 | `apply` records the event through the task log and returns its outcome | FR-105 | example | DONE | `src/runtime.test.ts::[U6] records the event through the task log and returns its outcome` |
| U7 | An applied event calls every listener once with the outcome | FR-208 | example | DONE | `src/runtime.test.ts::[U7] calls every listener once with the applied task and event` |
| U8 | A refused event calls no listener | FR-208 | example | DONE | `src/runtime.test.ts::[U8] calls no listener for a refused event` |
| U9 | A throwing listener is logged, does not undo the event, and does not stop the other listeners | FR-211, FR-214 | example | DONE | `src/runtime.test.ts::[U9] logs a throwing listener, keeps the event, and still runs the other listeners` |

### `src/bb/adapter.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U10 | `spawnWorker` sends project, parent thread, off parent notifications, role metadata, profile, and a managed worktree, and returns the thread ID | FR-107, FR-108 | example | DONE | `src/bb/adapter.test.ts::[U10] spawns a worker with the project, parent, off notifications, role metadata, profile, and a managed worktree`, `src/bb/adapter.test.ts::[U10] uses the default base branch when none is set` |
| U11 | `getThread` returns ID, project, status, parent, and environment | FR-209, FR-213 | example | DONE | `src/bb/adapter.test.ts::[U11] reads a thread as id, project, status, parent, and environment` |
| U12 | `getThread` returns null when bb does not know the thread | FR-213 | example | DONE | `src/bb/adapter.test.ts::[U12] reads an unknown thread as null, and rethrows other failures` |
| U13 | `sendMessage` sends one text input in `auto` mode | FR-209 | example | DONE | `src/bb/adapter.test.ts::[U13] sends one text input in auto mode` |
| U14 | `retireWorker` archives the thread and then deletes the environment, in that order | FR-120 | example | DONE | `src/bb/adapter.test.ts::[U14] retires a worker by archiving the thread and then deleting the environment` |
| U15 | `requestInput` forwards renderer, title, payload, timeout, and signal and returns the result unchanged | FR-112 | example | DONE | `src/bb/adapter.test.ts::[U15] forwards a form request and returns the owner`, `src/bb/adapter.test.ts::[U15] returns a cancelled form as a cancelled result` |
| U16 | `setThreadMetadata` writes the plugin metadata of the thread | FR-122 | example | DONE | `src/bb/adapter.test.ts::[U16] stamps plugin metadata on the thread under the plugin` |
| U17 | `getEnvironmentPath` returns the path, or null when the environment has none | FR-118 | example | DONE | `src/bb/adapter.test.ts::[U17] reads an environment path, or null when the environment has none` |
| U18 | `getProjectCheckout` returns the project's default source path, or null | FR-117 | example | DONE | `src/bb/adapter.test.ts::[U18] reads the project` |

### `src/tools/access.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U19 | A thread recorded as a task's worker is a worker with that task | FR-103 | example | DONE | `src/tools/access.test.ts::[U19] reads a thread recorded as a task` |
| U20 | A thread that no task records is `other` | FR-103 | example | DONE | `src/tools/access.test.ts::[U20] reads a thread that no task records as other` |
| U21 | The worker thread of a `torn_down` task is still a worker | FR-104 | example | DONE | `src/tools/access.test.ts::[U21] still reads the worker thread of a torn down task as a worker` |
| U22 | A task in another project is outside the caller's reach | FR-103, edge cases | example | DONE | `src/tools/access.test.ts::[U22] keeps a task out of reach of a caller in another project` |

### `src/tools/preview.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U23 | `wouldAccept` returns ok for a legal event and writes no row | FR-115 | example | DONE | `src/tools/preview.test.ts::[U23] says ok for a legal event and writes no row` |
| U24 | `wouldAccept` returns the machine's refusal for an illegal event and writes no row | FR-115 | example | DONE | `src/tools/preview.test.ts::[U24] returns the machine` |
| U25 | `wouldAccept` refuses an unknown task | FR-115 | example | DONE | `src/tools/preview.test.ts::[U25] refuses an unknown task` |

### `src/tools/results.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U26 | A refusal becomes error text with its reason code and message | FR-105, FR-123 | example | DONE | `src/tools/results.test.ts::[U26] turns a refusal into error text with its reason code and message` |
| U27 | A success becomes plain text that names the task and its state | FR-123 | example | DONE | `src/tools/results.test.ts::[U27] turns a success into plain text that names the task and its state` |
| U28 | Text longer than the limit is cut, and text exactly at the limit is unchanged | FR-210, FR-123 | example | DONE | `src/tools/results.test.ts::[U28] cuts text longer than the limit and leaves text at or under the limit unchanged` |

### `src/tools/prompt.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U29 | The worker prompt names the task ID, kind, mode, branch, and the report tool | FR-108 | example | DONE | `src/tools/prompt.test.ts::[U29] names the task ID, kind, mode, branch, description, and the report tool` |
| U30 | A `no-mistakes` prompt says never to push | FR-108, DESIGN direct pushes | example | DONE | `src/tools/prompt.test.ts::[U30] tells a no-mistakes worker never to push` |
| U31 | A `direct-PR` prompt asks for an open pull request and a `local-only` prompt asks for landed commits | FR-110 | example | DONE | `src/tools/prompt.test.ts::[U31] asks a direct-PR worker for an open pull request and a local-only worker for landed commits` |
| U32 | Every prompt tells the worker not to contact the owner | DESIGN worker silence | example | DONE | `src/tools/prompt.test.ts::[U32] tells every worker not to contact the owner` |

### `src/tools/register.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U33 | `configure` returns the four supervisor tools for role `supervisor` | FR-102 | example | DONE | `src/tools/register.test.ts::[U33] offers the four supervisor tools to role supervisor` |
| U34 | `configure` returns only `factoryman_report` for role `worker` | FR-102 | example | DONE | `src/tools/register.test.ts::[U34] offers only factoryman_report to role worker` |
| U35 | `configure` returns no tool for a missing role, an unknown role, or a role that is not a string | FR-102 | example | DONE | `src/tools/register.test.ts::[U35] offers no tool for a missing role, an unknown role, or a role that is not a string` |
| U36 | The plugin registers exactly the five tool names and no sixth | FR-101, FR-404 | example | DONE | `src/tools/register.test.ts::[U36] registers exactly the five tool names and no sixth` |
| U37 | The dispatch schema rejects an extra field | FR-106 | example | DONE | `src/tools/register.test.ts::[U37] advertises a dispatch schema that forbids extra fields and lists the three permission modes` |
| U38 | The dispatch schema rejects a blank profile field and a permission mode outside the three modes | FR-106 | example | DONE | `src/tools/register.test.ts::[U38] refuses a call with a bad argument through the tool` |
| U39 | A tool outcome that is not ok reaches bb as an error result | FR-105 | example | DONE | `src/tools/register.test.ts::[U39] returns an ok outcome as plain text and a failed outcome as an error result` |
| U40 | A full dispatch, report, merge, and teardown flow makes no `bb.sdk.plugins` call | FR-402 | example | PENDING | |

### `src/tools/dispatch.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U41 | A ship dispatch creates a ship task in the project's configured delivery mode | FR-106 | example | DONE | `src/tools/dispatch.test.ts::[U41] creates a ship task in the project` |
| U42 | A project with no config dispatches in `no-mistakes` mode with `yolo` off | FR-106, edge cases | example | DONE | `src/tools/dispatch.test.ts::[U42] dispatches a project with no config in no-mistakes mode` |
| U43 | A scout dispatch creates a scout task | FR-106 | example | DONE | `src/tools/dispatch.test.ts::[U43] creates a scout task for a scout dispatch` |
| U44 | The planned branch is the configured prefix plus the task ID, and `fm/` plus the task ID when there is no prefix | FR-108, D-034 | example | DONE | `src/tools/dispatch.test.ts::[U44] plans the branch as the configured prefix plus the task ID, or fm/ plus the task ID` |
| U45 | `start` carries the profile, the worker thread, the branch, and the description as evidence | FR-108, D-033 | example | DONE | `src/tools/dispatch.test.ts::[U45] records start with the profile, the worker thread, the branch, and the description as evidence` |
| U46 | The worker spawns once, as a child of the caller, with notifications off and role metadata with task ID and kind | FR-107, FR-108 | example | DONE | `src/tools/dispatch.test.ts::[U46] spawns one worker as a child of the caller with role metadata and the built prompt` |
| U47 | A worker caller is refused with no task and no spawn | FR-104 | example | DONE | `src/tools/dispatch.test.ts::[U47] refuses a worker caller with no task and no spawn` |
| U48 | Invalid arguments are refused with no task and no spawn | FR-106 | example | DONE | `src/tools/dispatch.test.ts::[U48] refuses invalid arguments with no task and no spawn` |
| U49 | A spawn error records `fail` with evidence that contains the error | FR-105 | example | DONE | `src/tools/dispatch.test.ts::[U49] records fail with the spawn error as evidence when the spawn fails` |
| U50 | A worker thread that is already in error after `start` is recorded as failed | FR-105, FR-203 | example | DONE | `src/tools/dispatch.test.ts::[U50] records fail when the worker thread is already in error after start` |
| U51 | The result names the task ID, the worker thread, and the branch | FR-123 | example | DONE | `src/tools/dispatch.test.ts::[U51] names the task ID, the worker thread, and the branch in the result` |

### `src/tools/report.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U52 | A scout `done` records `report` and the task becomes `report_ready` | FR-110 | example | DONE | `src/tools/report.test.ts::[U52] records report for a scout done and the task becomes report_ready` |
| U53 | A `no-mistakes` ship `done` records `handoff` and the task becomes `validating` | FR-110 | example | DONE | `src/tools/report.test.ts::[U53] records handoff for a no-mistakes ship done and the task becomes validating` |
| U54 | A `direct-PR` ship `done` with a pull request URL records `ready` | FR-110 | example | DONE | `src/tools/report.test.ts::[U54] records ready for a direct-PR ship done with a pull request URL` |
| U55 | A `direct-PR` ship `done` without a pull request URL is refused by the machine | FR-110 | example | DONE | `src/tools/report.test.ts::[U55] refuses a direct-PR ship done without a pull request URL` |
| U56 | A `local-only` ship `done` with one landed commit records `ready`, and with zero landed commits is refused | FR-110 | example | DONE | `src/tools/report.test.ts::[U56] records ready for a local-only ship done with one landed commit, and refuses zero` |
| U57 | `blocked` records `block` and `failed` records `fail` | FR-110 | example | DONE | `src/tools/report.test.ts::[U57] records block for blocked and fail for failed` |
| U58 | Blank or whitespace evidence is refused and leaves a refused log row | FR-105, FR-110 | example | DONE | `src/tools/report.test.ts::[U58] refuses blank or whitespace evidence and leaves a refused log row` |
| U59 | The recorded actor is `worker` | FR-110 | example | DONE | `src/tools/report.test.ts::[U59] records the worker as the actor` |
| U60 | A caller that is not a recorded worker is refused | FR-103 | example | DONE | `src/tools/report.test.ts::[U60] refuses a caller that is not a recorded worker` |
| U61 | The result names the new state | FR-123 | example | DONE | `src/tools/report.test.ts::[U61] names the new state in the result` |

### `src/tools/status.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U62 | A task ID returns one block with ID, kind, mode, state, thread, branch, pull request URL, and description | FR-111 | example | DONE | `src/tools/status.test.ts::[U62] returns one block with the ID, kind, mode, state, thread, branch, pull request, and description` |
| U63 | Without a task ID the project's tasks are listed in task ID order | FR-111 | example | DONE | `src/tools/status.test.ts::[U63] lists the project` |
| U64 | A state filter keeps only the listed states | FR-111 | example | DONE | `src/tools/status.test.ts::[U64] keeps only the listed states when a state filter is given` |
| U65 | An unknown task ID is reported as an error | FR-111 | example | DONE | `src/tools/status.test.ts::[U65] reports an unknown task ID as an error` |
| U66 | A task in another project is not shown | FR-103, edge cases | example | DONE | `src/tools/status.test.ts::[U66] does not show a task from another project` |
| U67 | The log has the same number of rows after any status call | FR-111 | example | DONE | `src/tools/status.test.ts::[U67] leaves the log with the same number of rows` |
| U68 | The description is the first line of the `start` evidence, and a task before `start` shows none | D-033 | example | DONE | `src/tools/status.test.ts::[U68] shows the first line of the start evidence as the description, and none before start` |

### `src/git/report.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U69 | A clean worktree reports no uncommitted changes and no unpushed commits | FR-118, FR-119 | example | DONE | `src/git/report.test.ts::[U69] reports a clean worktree with no uncommitted changes and no unpushed commits` |
| U70 | A modified tracked file reports uncommitted changes | FR-118 | example | DONE | `src/git/report.test.ts::[U70] reports a modified tracked file as an uncommitted change` |
| U71 | An untracked file reports uncommitted changes | FR-118 | example | DONE | `src/git/report.test.ts::[U71] reports an untracked file as an uncommitted change` |
| U72 | A pull request mode counts a commit that is on no remote ref as unpushed | FR-119 | example | DONE | `src/git/report.test.ts::[U72] counts a commit that is on no remote ref as unpushed in a pull request mode` |
| U73 | A pull request mode counts a pushed commit as landed | FR-119 | example | DONE | `src/git/report.test.ts::[U73] counts a pushed commit as landed in a pull request mode` |
| U74 | A pull request mode with no remote counts every commit as unpushed | FR-119, hard rule 8 | example | DONE | `src/git/report.test.ts::[U74] counts every commit as unpushed when the repository has no remote` |
| U75 | A `local-only` branch counts commits not reachable from the base branch, and counts none once it is merged | FR-119 | example | DONE | `src/git/report.test.ts::[U75] counts local-only commits that the base branch lacks, and none once they are merged` |
| U76 | A `local-only` report without a base branch is an error | FR-117, edge cases | example | DONE | `src/git/report.test.ts::[U76] is an error for local-only without a base branch` |
| U77 | A failed git command is an error and never an empty report | FR-118, hard rule 8 | example | DONE | `src/git/report.test.ts::[U77] is an error and never an empty report when git fails` |

### `src/git/merge.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U78 | The pull request executor runs `gh pr merge <url> --squash` by default | FR-117, D-042 | example | DONE | `src/git/merge.test.ts::[U78] runs` |
| U79 | The `mergeMethod` setting maps `merge` and `rebase` to their flags | FR-117, D-042 | example | DONE | `src/git/merge.test.ts::[U79] maps the merge and rebase methods to their flags` |
| U80 | An unknown merge method falls back to `--squash` | FR-117, hard rule 8 | example | DONE | `src/git/merge.test.ts::[U80] falls back to --squash for an unknown merge method` |
| U81 | A non-zero `gh` exit is a failed merge with the error output | FR-115 | example | DONE | `src/git/merge.test.ts::[U81] turns a non-zero gh exit into a failed merge with the error output` |
| U82 | Preflight refuses a pull request task that has no pull request URL | FR-117 | example | DONE | `src/git/merge.test.ts::[U82] refuses at preflight a pull request task that has no pull request URL` |
| U83 | Local preflight refuses a project without a base branch | FR-117, edge cases | example | DONE | `src/git/merge.test.ts::[U83] refuses at preflight a project without a base branch` |
| U84 | Local preflight refuses a dirty checkout | FR-117 | example | DONE | `src/git/merge.test.ts::[U84] refuses at preflight a dirty checkout` |
| U85 | Local preflight refuses a checkout that is not on the base branch | FR-117 | example | DONE | `src/git/merge.test.ts::[U85] refuses at preflight a checkout that is not on the base branch` |
| U86 | The local executor merges the branch with a merge commit and the base branch then holds its commits | FR-117 | example | DONE | `src/git/merge.test.ts::[U86] merges the branch with a merge commit so the base branch holds its commits` |
| U87 | A local merge conflict is aborted, fails, and leaves the checkout clean | FR-117 | example | DONE | `src/git/merge.test.ts::[U87] aborts a conflicting local merge, fails, and leaves the checkout clean` |
| U88 | The executor is chosen by delivery mode | FR-117 | example | DONE | `src/git/merge.test.ts::[U88] runs gh for the pull request modes and git for local-only` |

### `src/tools/merge.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U89 | Without `yolo` the form opens on the caller's thread with the renderer ID, task ID, branch, pull request URL, and evidence | FR-112 | example | DONE | `src/tools/merge.test.ts::[U89] opens the form on the caller` |
| U90 | The form timeout comes from the approval timeout setting and defaults to ten minutes | FR-112 | example | DONE | `src/tools/merge.test.ts::[U90] takes the form timeout from the approval timeout setting` |
| U91 | An approved answer records `record_approval` with actor `user` and scope `merge`, then merges once | FR-113, FR-115 | example | DONE | `src/tools/merge.test.ts::[U91] records the owner` |
| U92 | An approval comment becomes the approval event's evidence | FR-113 | example | DONE | `src/tools/merge.test.ts::[U92] records the approval comment as the approval event` |
| U93 | A denied answer records a denial, runs no merge, and leaves `awaiting_approval` | FR-114 | example | DONE | `src/tools/merge.test.ts::[U93] records a denial, runs no merge, and leaves the task awaiting approval` |
| U94 | A cancelled form records nothing, for the reasons timeout, user, and thread-stopped | FR-114 | example | DONE | `src/tools/merge.test.ts::[U94] records nothing for a cancelled form, whatever the reason` |
| U95 | A submitted object with an extra field is unreadable and records nothing | FR-113 | example | DONE | `src/tools/merge.test.ts::[U95] treats a submitted object with an extra field as unreadable and records nothing` |
| U96 | A submitted decision other than `approved` or `denied` is unreadable and records nothing | FR-113 | example | DONE | `src/tools/merge.test.ts::[U96] treats a decision other than approved or denied as unreadable and records nothing` |
| U97 | A submitted value that is not an object is unreadable and records nothing | FR-113 | example | DONE | `src/tools/merge.test.ts::[U97] treats a submitted value that is not an object as unreadable and records nothing` |
| U98 | Under `yolo` no form opens, the task passes through `awaiting_approval`, and the merge event carries `yolo: true` | FR-116 | example | DONE | `src/tools/merge.test.ts::[U98] skips the form under yolo, passes through awaiting approval, and records yolo on the merge event` |
| U99 | A failed executor records no merge event and returns the error | FR-115 | example | DONE | `src/tools/merge.test.ts::[U99] records no merge event and returns the error when the executor fails` |
| U100 | A merge the machine would refuse never reaches the executor | FR-115 | example | DONE | `src/tools/merge.test.ts::[U100] never reaches the executor when the machine would refuse the merge` |
| U101 | From `review_ready` the tool records `request_approval` first, and from `awaiting_approval` it does not record it again | FR-112, edge cases | example | DONE | `src/tools/merge.test.ts::[U101] records request_approval from review_ready and does not record it again from awaiting_approval` |
| U102 | A preflight failure leaves the task in `review_ready` with no form | FR-117 | example | DONE | `src/tools/merge.test.ts::[U102] leaves the task in review_ready with no form when preflight fails` |
| U103 | A second call while the form is open is refused, and a call after it settles opens a new form | edge cases | example | DONE | `src/tools/merge.test.ts::[U103] refuses a second call while the form is open and opens a new form after it settles` |
| U104 | An approval submitted after the task left `awaiting_approval` is refused by the machine and merges nothing | edge cases, FR-115 | example | DONE | `src/tools/merge.test.ts::[U104] merges nothing when the approval arrives after the task left awaiting approval` |
| U105 | A task in another project is refused with no form | FR-103 | example | DONE | `src/tools/merge.test.ts::[U105] refuses a task in another project with no form` |
| U106 | An executor success followed by a refused `merge` event reports that the forge merged and the log refused | FR-115, hard rule 8 | example | DONE | `src/tools/merge.test.ts::[U106] says the forge merged and the log refused when the merge event is refused after a successful merge` |

### `src/tools/teardown.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U107 | A merged task with a landed worktree records `teardown` and then retires the worker, in that order | FR-120 | example | DONE | `src/tools/teardown.test.ts::[U107] records teardown for a landed worktree and then retires the worker, in that order` |
| U108 | A dirty worktree is refused with a logged refusal, and the worker is not retired | FR-118 | example | DONE | `src/tools/teardown.test.ts::[U108] refuses a dirty worktree with a logged refusal and does not retire the worker` |
| U109 | Unpushed commits are refused with a logged refusal, and the worker is not retired | FR-118 | example | DONE | `src/tools/teardown.test.ts::[U109] refuses unpushed commits with a logged refusal and does not retire the worker` |
| U110 | A worktree report that cannot be read refuses teardown and records no event | FR-118, hard rule 8 | example | DONE | `src/tools/teardown.test.ts::[U110] refuses when the worktree report cannot be read, and records no event` |
| U111 | A failed task can be torn down through the same check | D-011 | example | DONE | `src/tools/teardown.test.ts::[U111] tears down a failed task through the same check` |
| U112 | A task whose state does not allow `teardown` is refused by the machine | FR-105 | example | DONE | `src/tools/teardown.test.ts::[U112] refuses a task whose state does not allow teardown` |
| U113 | A retire failure after the event is reported and does not undo `torn_down` | FR-120 | example | DONE | `src/tools/teardown.test.ts::[U113] reports a retire failure after the event and keeps the task torn down` |
| U114 | A task whose environment has no path is refused | FR-118 | example | DONE | `src/tools/teardown.test.ts::[U114] refuses a task whose environment has no path, and records no event` |
| U115 | A worker caller is refused | FR-104 | example | DONE | `src/tools/teardown.test.ts::[U115] refuses a worker caller` |
| U116 | A `local-only` teardown uses the project's base branch for the report | FR-119 | example | DONE | `src/tools/teardown.test.ts::[U116] uses the project` |

### `src/tools/supervisor-command.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U117 | The command stamps `{ role: "supervisor" }` and prints a confirmation | FR-122 | example | DONE | `src/tools/supervisor-command.test.ts::[U117] stamps the supervisor role on a thread and prints a confirmation` |
| U118 | The command refuses a thread that is a recorded worker and stamps nothing | FR-122 | example | DONE | `src/tools/supervisor-command.test.ts::[U118] refuses a recorded worker thread and stamps nothing` |
| U119 | The command without a thread ID prints usage and exits non-zero | FR-122 | example | DONE | `src/tools/supervisor-command.test.ts::[U119] prints usage and exits non-zero without a thread ID or with an unknown command` |

### `src/server.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U120 | The factory opens the store on the host's database and runs recovery | FR-121 | example | PENDING | |
| U121 | The factory logs a corrupt task from recovery and still loads | FR-121, constitution III | example | PENDING | |
| U122 | The factory defines the `mergeMethod` and approval timeout settings | FR-117, FR-112 | example | PENDING | |
| U123 | The factory registers the command, the five tools, the event handlers, and one service | FR-101, FR-122, FR-201 | example | PENDING | |
| U124 | A seeded random walk of tool calls and thread events leaves the replayed task rows equal to the cached rows | FR-105, constitution III | example | PENDING | |

### `src/wiring/wake.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U125 | Each of the five attention states sends one message | FR-208 | example | PENDING | |
| U126 | The states `queued`, `working`, `validating`, `awaiting_approval`, `merged`, and `torn_down` send nothing | FR-208 | example | PENDING | |
| U127 | The message names the task, kind, mode, state, evidence, thread, and branch | FR-210 | example | PENDING | |
| U128 | Evidence is cut to 600 characters, and evidence of exactly 600 is unchanged | FR-210 | example | PENDING | |
| U129 | The target is the parent of the worker thread as `getThread` reports it | FR-209 | example | PENDING | |
| U130 | A worker with no parent sends nothing and logs a warning | FR-209 | example | PENDING | |
| U131 | A failed send is logged and does not throw | FR-211 | example | PENDING | |
| U132 | Findings are listed one per line exactly as the validator wrote them | FR-306 | example | PENDING | |
| U133 | A wake that is not a transition uses the same first line with a reason in place of the state | FR-205, FR-206, FR-207 | example | PENDING | |
| U134 | The wake is registered as a runtime listener and fires after tool-driven transitions | FR-208 | example | PENDING | |

### `src/wiring/handlers.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U135 | `thread.failed` on a `working` task applies `fail` with the thread's error text | FR-203 | example | PENDING | |
| U136 | `thread.failed` with no error text uses the remembered turn failure's category and status code | FR-203 | example | PENDING | |
| U137 | `thread.failed` with neither uses the fixed fallback text | FR-203 | example | PENDING | |
| U138 | `thread.failed` on a `blocked` task fails it | FR-203 | example | PENDING | |
| U139 | `thread.failed` on `validating`, `needs_decision`, `review_ready`, `awaiting_approval`, `merged`, or `report_ready` is ignored | FR-202, FR-203 | example | PENDING | |
| U140 | A second `thread.failed` for the same task sends no second message and adds no second `fail` | AC-2.7 | example | PENDING | |
| U141 | `thread.deleted` fails a task in any state before `torn_down` | FR-204 | example | PENDING | |
| U142 | `thread.deleted` on a `torn_down` task is ignored | FR-202, FR-204 | example | PENDING | |
| U143 | `thread.idle` on a `working` task wakes and changes nothing | FR-205 | example | PENDING | |
| U144 | `thread.idle` on any other state is ignored | FR-205 | example | PENDING | |
| U145 | `thread.archived` wakes with the worktree warning and changes nothing, and is ignored on a `torn_down` task | FR-206 | example | PENDING | |
| U146 | `interaction.pending` from another source wakes with the interaction title | FR-207 | example | PENDING | |
| U147 | `interaction.pending` raised by this plugin sends nothing | FR-207 | example | PENDING | |
| U148 | An event for a thread that no task records writes no log row and sends nothing | FR-202 | example | PENDING | |
| U149 | A queued task has no thread and is never matched | FR-202 | example | PENDING | |
| U150 | `turn.failed` is remembered per thread, and the memory is bounded | FR-203 | example | PENDING | |
| U151 | Other thread events are ignored | FR-201 | example | PENDING | |
| U152 | A handler whose store call throws is logged and does not throw | FR-214 | example | PENDING | |

### `src/wiring/startup.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U153 | A deleted or unknown worker thread observes as `missing` | FR-213 | example | PENDING | |
| U154 | A worker thread in `error` observes as `failed` unless the log already says `failed` | FR-213 | example | PENDING | |
| U155 | Any other worker thread observes as the logged state | FR-213 | example | PENDING | |
| U156 | A task with no worker thread is not observed | FR-212 | example | PENDING | |
| U157 | Each written `reconcile` row sends one message | FR-212 | example | PENDING | |
| U158 | A second start-up with the same mismatch writes and sends nothing | FR-212 | example | PENDING | |
| U159 | Corrupt tasks are logged and not observed, and terminal tasks are skipped | FR-212, constitution III | example | PENDING | |
| U160 | A thread read that fails for one task is logged and does not stop the others | FR-214 | example | PENDING | |

### `src/validator/types.ts` and `src/validator/fake.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U161 | The fake offers the five operations and returns its scripted views in order | FR-301, FR-302 | example | PENDING | |
| U162 | The fake records every call with its input | FR-302 | example | PENDING | |
| U163 | The fake returns a scripted error as a result and does not throw | FR-301 | example | PENDING | |

### `src/validator/toon.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U164 | The recorded review gate decodes to step, status, and two findings with ID, severity, file, action, and description | FR-304 | example | PENDING | |
| U165 | The recorded fix-review gate decodes to one finding in phase `gate` | FR-304 | example | PENDING | |
| U166 | The recorded cancelled status decodes to phase `finished`, outcome `cancelled`, the error, and the run ID | FR-304 | example | PENDING | |
| U167 | The recorded pull-request status under `other_branch_run` decodes to the pull request URL and outcome | FR-304 | example | PENDING | |
| U168 | The recorded abort output decodes as an abort result | FR-304 | example | PENDING | |
| U169 | The recorded error output decodes as a command failure with its message | FR-304 | example | PENDING | |
| U170 | Empty output and undecodable output are `unreadable` | FR-304, hard rule 8 | example | PENDING | |
| U171 | An outcome outside the six known values is `unreadable` | FR-304, hard rule 8 | example | PENDING | |
| U172 | Finding columns come from the header, so a missing `line` column and an extra column both decode | FR-304 | example | PENDING | |
| U173 | A gate written as a bare step name decodes | FR-304 | example | PENDING | |
| U174 | A status with neither gate nor outcome decodes as phase `running` | FR-304 | example | PENDING | |
| U175 | Finding text with commas, quotes, and backticks decodes unchanged | FR-306 | example | PENDING | |

### `src/validator/no-mistakes.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U176 | `start` runs `no-mistakes axi run --intent <intent> --wait <wait>` in the given `cwd` | FR-303 | example | PENDING | |
| U177 | `status` runs `no-mistakes axi status`, and adds `--run <id>` when given a run ID | FR-303 | example | PENDING | |
| U178 | `findings` returns the gate's findings, and an empty list when there is no gate | FR-301 | example | PENDING | |
| U179 | `answer` maps approve, skip, and fix with finding IDs and instructions to `axi respond` flags | FR-303 | example | PENDING | |
| U180 | No operation ever passes `--yes` or `-y` | FR-308, FR-303 | example | PENDING | |
| U181 | `cancel` runs `no-mistakes axi abort`, with `--run <id>` when given | FR-301 | example | PENDING | |
| U182 | Only stdout is decoded, and banner text on stderr is ignored | FR-303 | example | PENDING | |
| U183 | Exit code 1 with a decodable `failed` outcome decodes as a finished run | FR-304 | example | PENDING | |
| U184 | Exit code 2 or a missing binary is a command failure | FR-304 | example | PENDING | |

### `src/validator/driver.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U185 | `ensure` on a `validating` task starts one loop, and a second `ensure` starts none | FR-311 | example | PENDING | |
| U186 | The loop calls `start` with the worker environment's path and the `start` evidence as intent | FR-303, D-033 | example | PENDING | |
| U187 | A gate applies `finding` with evidence naming the step and the finding count | FR-306 | example | PENDING | |
| U188 | A `needs_decision` task whose view is unchanged stays parked | FR-307 | example | PENDING | |
| U189 | A `needs_decision` task whose view changed applies `resolve` | FR-307 | example | PENDING | |
| U190 | A `needs_decision` task whose run is running again applies `resolve` | FR-307 | example | PENDING | |
| U191 | A status error in `needs_decision` keeps waiting | FR-304 | example | PENDING | |
| U192 | `answer` calls the validator and then applies `resolve` with the caller's actor | FR-307 | example | PENDING | |
| U193 | A failed `answer` applies no `resolve` | FR-307 | example | PENDING | |
| U194 | No scripted run makes the loop call `answer` | FR-308 | example | PENDING | |
| U195 | `checks-passed` with a pull request applies `validated` with `pipelineFinished` and the URL | FR-309 | example | PENDING | |
| U196 | `checks-passed` without a pull request applies `finding` | FR-310 | example | PENDING | |
| U197 | `passed-with-override`, `passed-with-skips`, and `passed` each apply `finding` | FR-310 | example | PENDING | |
| U198 | `failed` and `cancelled` each apply `fail` with the validator's error | FR-310 | example | PENDING | |
| U199 | Four validator errors in a row keep trying, and the fifth applies `finding` | FR-304, D-039 | example | PENDING | |
| U200 | A successful call resets the error count | FR-304 | example | PENDING | |
| U201 | A running view keeps the loop waiting through the injected sleep | FR-311, FR-314 | example | PENDING | |
| U202 | `resumeAll` starts loops for `validating` and `needs_decision` tasks only | FR-312 | example | PENDING | |
| U203 | A task that is not on the `no-mistakes` mode never gets a loop | FR-305 | example | PENDING | |
| U204 | `dispose` stops every loop and cancels no run | FR-313 | example | PENDING | |
| U205 | The loop ends when the task leaves its two states | FR-311 | example | PENDING | |
| U206 | A task whose environment path cannot be read counts as a validator error | FR-304 | example | PENDING | |
| U207 | A `needs_decision` task takes its first view after a restart as the baseline | FR-307, FR-312 | example | PENDING | |

### `test/acceptance/layout.test.ts`

Added mid-loop: the milestone 1 layout test said `src/tools` must not exist, which the scope amendment (D-032) made wrong.

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U208 | The repository keeps the milestone 1 to 3 directories and has no `src/dispatch` or `skills` directory | FR-401, D-032 | example | DONE | `test/acceptance/layout.test.ts::[U208] has the milestone 1 to 3 directories and none for milestones 7 to 11` |

## Invariants and edge cases still to place

None.
Every edge case in `spec.md` maps to a numbered behavior above.

## Out of scope

- The dispatch resolver, machine placement, the extension surface, limits and budgets, the webhook, the firstmate import, and skills (milestones 7 to 11).
- Hard rules 5, 6, and 7 (D-009).
- Running a real merge against a real forge, a real bb server, or a real no-mistakes pipeline inside the suite. The spike covers the real tools, and the recorded fixtures keep their shapes under test.
- Coverage numbers and automated mutation runs. The tools are not installed, so `/speckit.tdd.verify` uses deliberate mutants.
- A tool to answer a pipeline finding (D-031).
- Scout report export to `.bb/factoryman/<task-id>/report.md`.

## Cycle plan

Behaviors on one function or file batch into one cycle.
Each behavior in a batch still needs its own failing test, and the cycle log records the failing output for each id.
The outer-loop tests of a story are written first and stay red until their units land.

| cycle group | behaviors | story |
| --- | --- | --- |
| H0 | A1 to A18 (written red first) | US1 |
| C1 | U1 to U5: `src/exec.ts` | Foundational |
| C2 | U6 to U9: `src/runtime.ts` | Foundational |
| C3 | U10 to U18: `src/bb/adapter.ts` | Foundational |
| C4 | U19 to U22: `src/tools/access.ts` | Foundational |
| C5 | U23 to U25: `src/tools/preview.ts` | Foundational |
| C6 | U26 to U28: `src/tools/results.ts` | Foundational |
| C7 | U29 to U32: `src/tools/prompt.ts` | US1 |
| C8 | U33 to U40: `src/tools/register.ts` | US1 |
| C9 | U41 to U51: `src/tools/dispatch.ts` | US1 |
| C10 | U52 to U61: `src/tools/report.ts` | US1 |
| C11 | U62 to U68: `src/tools/status.ts` | US1 |
| C12 | U69 to U77: `src/git/report.ts` | US1 |
| C13 | U78 to U88: `src/git/merge.ts` | US1 |
| C14 | U89 to U106: `src/tools/merge.ts` | US1 |
| C15 | U107 to U116: `src/tools/teardown.ts` | US1 |
| C16 | U117 to U119: `src/tools/supervisor-command.ts` | US1 |
| C17 | U120 to U124: `src/server.ts` | US1 |
| H1 | A19 to A28 (written red first) | US2 |
| C18 | U125 to U134: `src/wiring/wake.ts` | US2 |
| C19 | U135 to U152: `src/wiring/handlers.ts` | US2 |
| C20 | U153 to U160: `src/wiring/startup.ts` | US2 |
| H2 | A29 to A38 (written red first) | US3 |
| C21 | U161 to U163: `src/validator/types.ts` and `src/validator/fake.ts` | US3 |
| C22 | U164 to U175: `src/validator/toon.ts` | US3 |
| C23 | U176 to U184: `src/validator/no-mistakes.ts` | US3 |
| C24 | U185 to U207: `src/validator/driver.ts` | US3 |

## Verification commands

Copied verbatim from `.specify/memory/tdd-profile.md` at planning time:

- Single test: `pnpm vitest run <file> -t "<name>"`
- Single file: `pnpm vitest run <file>`
- Full suite: `pnpm test`
- Type-check: `pnpm run typecheck`
- Lint: `pnpm run lint`
- Coverage: none (tool not installed)
- Mutation: none (tool not installed; deliberate mutants instead)
