---
feature: 001-core-state-machine-storage
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 26
planned_at: d4a96f4
updated_at: 0ef5f71
suite_baseline: green
---

# Test List: Core scaffold, task state machine, and event storage

The acceptance layer is an in-process integration test through the public API.
No browser or process-level runner exists, so every `A` behavior is weaker than an end-to-end test.
The suite baseline was 1 file and 3 tests, all passing.

## Outer loop: acceptance behaviors

One per acceptance criterion in `spec.md`.
`A5` is a planned `BASELINE`: the toolchain scaffold created the `build` script before the profile existed, so its test is green on first run and its strength comes from the deliberate-mutant check in `/speckit.tdd.verify`.

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| A1 | The plugin factory loads in the fake host, registers nothing, and disposes cleanly | AC-1.1, FR-003 | example | DONE | `test/acceptance/plugin.test.ts::loads in the fake host, registers nothing beyond its identity, and disposes cleanly` |
| A2 | The manifest names `bb-factoryman`, declares the server entry, and pins the SDK to one exact version | AC-1.2, FR-001, FR-002 | example | DONE | `test/acceptance/manifest.test.ts::names the package, declares the server entry, and pins the SDK to one exact version` |
| A3 | Lint fails on an `@get-bb/*` import inside `src/machine/` and names the restricted import | AC-1.3, FR-005, SC-004 | example | DONE | `test/acceptance/lint-isolation.test.ts::fails lint on an @get-bb import and names the restricted module` |
| A4 | Lint passes on the same import outside `src/machine/` | AC-1.4, FR-005 | example | DONE | `test/acceptance/lint-isolation.test.ts::passes lint on the same import outside src/machine` |
| A5 | The `build` script delegates to `bb plugin build` | AC-1.5, FR-004 | characterization | BASELINE | `test/acceptance/manifest.test.ts::builds through bb plugin build` |
| A6 | A `merge` event without an approval and without `yolo` is refused and the task stays in `awaiting_approval` | AC-2.1, FR-016, SC-002 | example | DONE | `test/acceptance/machine-gates.test.ts::hard rule 1: merge needs a recorded approval` |
| A7 | A `merge` event under `yolo` moves the task to `merged` | AC-2.2, FR-016, SC-002 | example | DONE | `test/acceptance/machine-gates.test.ts::hard rule 1: merges under yolo without an approval` |
| A8 | A `teardown` event with uncommitted changes or unpushed commits is refused and the task stays `merged` | AC-2.3, FR-017, SC-002 | example | DONE | `test/acceptance/machine-gates.test.ts::hard rule 2: teardown needs landed work` |
| A9 | A completion event or `fail` event with blank evidence is refused | AC-2.4, FR-015, SC-002 | example | DONE | `test/acceptance/machine-gates.test.ts::hard rule 3: completion and failure need evidence` |
| A10 | A `promote` event is refused without an owner approval and moves a scout to a queued ship task with one | AC-2.5, FR-018, SC-002 | example | DONE | `test/acceptance/machine-gates.test.ts::hard rule 4: promotion needs a recorded approval` |
| A11 | Every state and event pair outside the legal set is refused with a reason code and an unchanged snapshot | AC-2.6, FR-011, FR-013, FR-014, SC-001 | example | DONE | `test/acceptance/machine-matrix.test.ts::state and event matrix` |
| A12 | Review ready applies the delivery mode's check for each of the three modes | AC-2.7, FR-020 | example | DONE | `test/acceptance/machine-gates.test.ts::delivery modes decide what review ready means` |
| A13 | A `no-mistakes` task passes through `validating` and `needs_decision`, and the other modes cannot reach them | AC-2.8 | example | DONE | `test/acceptance/machine-gates.test.ts::validating and needs_decision belong to no-mistakes projects` |
| A14 | A `start` event without a resolved profile is refused | AC-2.9, FR-021 | example | DONE | `test/acceptance/machine-gates.test.ts::start needs a resolved profile` |
| A15 | A `block` event moves a working task to `blocked`, an `unblock` event returns it, and `block` elsewhere is refused | AC-2.10, FR-022 | example | DONE | `test/acceptance/machine-gates.test.ts::blocked loops back to working` |
| A16 | A `fail` event with evidence moves any task that is not `torn_down` or `failed` to `failed` | AC-2.11 | example | DONE | `test/acceptance/machine-gates.test.ts::any state before torn_down can fail with evidence` |
| A17 | Approval events from a non-owner actor are refused, and worker actors are refused on four events | AC-2.12, FR-019 | example | DONE | `test/acceptance/machine-gates.test.ts::approvals and authority` |
| A18 | Recording an event writes one log row, the task row, and any approval row together | AC-3.1, FR-033 | example | DONE | `test/acceptance/store-restart.test.ts::%s store: recording events writes one log row, the task row, and any approval row together` |
| A19 | A refused event leaves a refused log row with its reason and an unchanged task row | AC-3.2, FR-034 | example | DONE | `test/acceptance/store-restart.test.ts::%s store: recording events logs a refused event with its reason ...` |
| A20 | A stored log row cannot be updated or deleted | AC-3.3, FR-030 | example | DONE | `test/acceptance/store-restart.test.ts::log immutability` |
| A21 | After the task cache is destroyed, a rebuild from the log equals the original rows field for field | AC-3.4, FR-036 | example | DONE | `test/acceptance/store-restart.test.ts::%s store: rebuilding the cache rebuilds task rows equal to the originals ...` |
| A22 | Replay reports a task as corrupt when an applied row no longer passes the machine | AC-3.5, FR-035 | example | DONE | `test/acceptance/store-restart.test.ts::%s store: rebuilding the cache reports a task as corrupt ...` |
| A23 | Reconcile appends one `reconcile` row per mismatch, changes no task state, and skips an identical repeat | AC-3.6, FR-037 | example | DONE | `test/acceptance/store-restart.test.ts::%s store: reconcile` |
| A24 | The shared contract suite passes against both the in-memory and the SQLite store | AC-3.7, FR-032, SC-006 | example | DONE | `test/acceptance/store-contract.test.ts::memory store contract / sqlite store contract` |
| A25 | An unregistered project reads as `no-mistakes` with `yolo` off | AC-3.8, FR-038 | example | DONE | `test/acceptance/store-contract.test.ts::project config defaults` |
| A26 | Start-up recovery on a reopened SQLite file replays every non-terminal task | AC-3.9, FR-039 | example | DONE | `test/acceptance/store-restart.test.ts::start-up recovery` |

## Inner loop: unit behaviors

### `eslint.config.js` and repository layout

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1 | A type-only `@get-bb/*` import under `src/machine/` fails lint | AC-1.3, FR-005 | example | DONE | `test/acceptance/lint-isolation.test.ts::fails lint on a type-only @get-bb import` |
| U2 | A subpath import such as `@get-bb/plugin-sdk/testing` under `src/machine/` fails lint | FR-005 | example | DONE | `test/acceptance/lint-isolation.test.ts::fails lint on an @get-bb subpath import` |
| U3 | A dynamic `import()` of an `@get-bb/*` module under `src/machine/` fails lint | FR-005 | example | DONE | `test/acceptance/lint-isolation.test.ts::fails lint on a dynamic import of an @get-bb module` |
| U4 | A re-export from an `@get-bb/*` module under `src/machine/` fails lint | FR-005 | example | DONE | `test/acceptance/lint-isolation.test.ts::fails lint on a re-export from an @get-bb module` |
| U5 | An import of `better-sqlite3` under `src/machine/` fails lint | FR-012 | example | DONE | `test/acceptance/lint-isolation.test.ts::fails lint on an import of better-sqlite3` |
| U6 | An import of a `node:` built-in under `src/machine/` fails lint | FR-012 | example | DONE | `test/acceptance/lint-isolation.test.ts::fails lint on an import of a node built-in, with or without the node: prefix` |
| U7 | An import from `src/store` under `src/machine/` fails lint | FR-012 | example | DONE | `test/acceptance/lint-isolation.test.ts::fails lint on an import from src/store` |
| U8 | Imports of `xstate`, `zod`, and sibling machine modules under `src/machine/` pass lint | FR-005, FR-012 | example | DONE | `test/acceptance/lint-isolation.test.ts::passes lint on xstate, zod, and sibling machine imports` |
| U9 | The repository has `src/machine`, `src/store`, `spike`, and `docs`, and has no `src/tools`, `src/dispatch`, or `skills` | FR-006 | example | DONE | `test/acceptance/layout.test.ts::has the milestone 1 to 3 directories and none for later milestones` |

### `src/machine/events.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U10 | Each of the 15 event types parses from a valid example | FR-011, FR-023 | example | DONE | `src/machine/events.test.ts::parseEvent parses a valid %s event` |
| U11 | An unknown event type is refused with `unknown_event` | FR-023, edge cases | example | DONE | `src/machine/events.test.ts::refuses an unknown event type as unknown_event` |
| U12 | An event with an unknown extra key is refused with `invalid_event` | FR-023 | example | DONE | `src/machine/events.test.ts::refuses an event with an unknown extra key` |
| U13 | An event missing a required field is refused with `invalid_event` | FR-017, FR-023 | example | DONE | `src/machine/events.test.ts::refuses %s without %s as invalid_event` |
| U14 | An event with a bad value is refused with `invalid_event`: negative or fractional counts, a malformed URL, or an unknown actor | FR-023 | example | DONE | `src/machine/events.test.ts::refuses %s with a bad value %j as invalid_event` |
| U15 | A non-object input is refused with `invalid_event` | FR-023 | example | DONE | `src/machine/events.test.ts::refuses non-object input %j as invalid_event` |

### `src/machine/guards.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U16 | `evidenceProvided` refuses empty, whitespace-only, and missing evidence and accepts padded text | FR-015, edge cases | example | DONE | `src/machine/guards.test.ts::evidenceProvided` |
| U17 | `profileResolved` refuses a missing or null profile and accepts a complete one | FR-021 | example | DONE | `src/machine/guards.test.ts::profileResolved` |
| U18 | `notWorker` refuses only the worker actor and `ownerOnly` accepts only the user actor | FR-019 | example | DONE | `src/machine/guards.test.ts::notWorker and ownerOnly` |
| U19 | The mode guards accept `no-mistakes` for one and the other two modes for the other | FR-020 | example | DONE | `src/machine/guards.test.ts::mode guards` |
| U20 | `readyModeCheck` needs a pull request URL for `direct-PR` and one or more landed commits for `local-only` | FR-020 | example | DONE | `src/machine/guards.test.ts::readyModeCheck` |
| U21 | `pipelineFinishedWithPr` refuses an unfinished pipeline and accepts a finished one | FR-020 | example | DONE | `src/machine/guards.test.ts::pipelineFinishedWithPr` |
| U22 | The approval scope guards accept only their own scope | FR-016, FR-018, edge cases | example | DONE | `src/machine/guards.test.ts::approval scope guards` |
| U23 | `mergeAuthorized` accepts `yolo` or an approved merge decision and refuses a denied, missing, or other-scope decision | FR-016, edge cases | example | DONE | `src/machine/guards.test.ts::mergeAuthorized` |
| U24 | `promotionAuthorized` accepts only an approved promote decision | FR-018 | example | DONE | `src/machine/guards.test.ts::promotionAuthorized` |
| U25 | `worktreeLanded` refuses uncommitted changes or one unpushed commit and accepts zero of each | FR-017 | example | DONE | `src/machine/guards.test.ts::worktreeLanded` |

### `src/machine/table.ts` and `src/machine/machines.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U26 | The table's legal pairs equal a hand-written legal set for each kind | FR-014, SC-001 | example | DONE | `src/machine/table.test.ts::lists exactly the legal pairs and targets for %s tasks` |
| U27 | Every guard name in the table exists, and each row lists its guards in the documented order | FR-013 | example | DONE | `src/machine/table.test.ts::lists each %s row's guards in the documented order, and every guard exists` |
| U28 | The ship machine has exactly the ship states and the scout machine exactly the scout states | FR-010 | example | DONE | `src/machine/table.test.ts::xstate machines gives the ship machine / scout machine exactly its states` |
| U29 | Each xstate machine accepts exactly the transitions the table lists | FR-011 | example | DONE | `src/machine/table.test.ts::accepts exactly the table's transitions in the %s machine` |

### `src/machine/transition.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U30 | `createTask` returns a `queued` snapshot with null defaults and no approvals | FR-010 | example | DONE | `src/machine/transition.test.ts::createTask returns a queued snapshot with null defaults and no approvals` |
| U31 | `createTask` refuses blank IDs, an unknown kind, an unknown mode, and non-object input | FR-023 | example | DONE | `src/machine/transition.test.ts::createTask refuses %s` |
| U32 | `transition` never throws and returns a refusal for garbage events and an unknown snapshot state | FR-011, FR-023 | example | DONE | `src/machine/transition.test.ts::transition never throws` |
| U33 | `transition` returns equal results for equal inputs and leaves a frozen input unchanged | FR-011, FR-012 | example | DONE | `src/machine/transition.test.ts::transition is pure` |
| U34 | Every refusal carries a code from the closed list and a non-empty message | FR-013 | example | DONE | `src/machine/transition.test.ts::gives every refusal a code from the closed list and a message` |
| U35 | A successful result carries the from state, the to state, and the parsed event | FR-011 | example | DONE | `src/machine/transition.test.ts::carries the from state, the to state, and the parsed event on success` |
| U36 | The first failing guard in table order decides the refusal code | FR-013 | example | DONE | `src/machine/transition.test.ts::guard order` |
| U37 | `start` moves `queued` to `working` and records profile, thread, branch, and machine | FR-021 | example | DONE | `src/machine/transition.test.ts::start` |
| U38 | `ready` and `validated` record the pull request URL in the context | FR-020 | example | DONE | `src/machine/transition.test.ts::pull request URL` |
| U39 | `record_approval` stores the decision, a later decision replaces it, and the state stays | FR-016, edge cases | example | DONE | `src/machine/transition.test.ts::record_approval stores the decision ...` |
| U40 | `record_approval` is refused outside `awaiting_approval` and `report_ready`, and refused for the wrong scope | edge cases | example | DONE | `src/machine/transition.test.ts::record_approval is refused outside awaiting_approval and report_ready ...` |
| U41 | `merge` under `yolo` is still refused from `review_ready` | FR-016 | example | DONE | `src/machine/transition.test.ts::merge under yolo` |
| U42 | `promote` makes a queued ship task, keeps thread, branch, and machine, and clears profile, approvals, and URL | FR-018, edge cases | example | DONE | `src/machine/transition.test.ts::promote makes a queued ship task ...` |
| U43 | A promoted task accepts ship events and refuses scout events | FR-018 | example | DONE | `src/machine/transition.test.ts::promote accepts ship events afterwards and refuses scout events` |
| U44 | `fail` is refused from `failed` and from `torn_down` | edge cases | example | DONE | `src/machine/transition.test.ts::fail` |
| U45 | `teardown` from `failed`, `merged`, and `report_ready` needs a landed worktree report | FR-017 | example | DONE | `src/machine/transition.test.ts::teardown` |
| U46 | `transition` refuses with `internal_mismatch` when xstate disagrees with the table | FR-011, plan decision 2 | example | DONE | `src/machine/transition.test.ts::fail-closed cross-check` |

### `src/store/` contract (runs against both stores)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U47 | `appendEvent` assigns strictly increasing `seq` values | FR-030 | example | DONE | `test/store-contract.ts::assigns strictly increasing seq values to appended events` (run by memory.test.ts, sqlite.test.ts) |
| U48 | An appended event reads back equal, including null fields and nested payload | FR-030 | example | DONE | `test/store-contract.ts::reads back an appended event equal to what was written ...` |
| U49 | Mutating a returned row does not change the store | FR-030, AC-3.3 | example | DONE | `test/store-contract.ts::does not let a caller change the store by mutating a returned row` |
| U50 | `listEvents` filters by task and by `afterSeq` and returns `seq` order | FR-030 | example | DONE | `test/store-contract.ts::filters events by task and by afterSeq and returns them in seq order` |
| U51 | `transaction` commits every write when the function returns | FR-033 | example | DONE | `test/store-contract.ts::commits every write of a transaction and returns the function's value` |
| U52 | `transaction` rolls back every write and rethrows when the function throws | FR-033 | example | DONE | `test/store-contract.ts::rolls back every write of a transaction and rethrows when the function throws` |
| U53 | `getProjectConfig` returns the default for an unknown project and the stored config after `putProjectConfig` | FR-031, FR-038 | example | DONE | `test/store-contract.ts::returns the default config for an unknown project and the stored config after a put` |
| U54 | `putTask` replaces the row, `getTask` returns null for an unknown ID, `clearTasks` leaves events and approvals, and `listTasks` orders by ID and filters | FR-031, FR-036 | example | DONE | `test/store-contract.ts::puts, gets, replaces, lists, filters, and clears task rows ...` |
| U55 | `addApproval` and `listApprovals` keep insertion order per task | FR-031 | example | DONE | `test/store-contract.ts::keeps approvals in insertion order per task` |

### `src/store/sqlite.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U56 | A raw `UPDATE` or `DELETE` on `task_event` aborts | AC-3.3, FR-030 | example | DONE | `src/store/sqlite.test.ts::aborts a raw UPDATE or DELETE on task_event` |
| U57 | A raw `UPDATE` or `DELETE` on `approval` aborts | FR-031 | example | DONE | `src/store/sqlite.test.ts::aborts a raw UPDATE or DELETE on approval` |
| U58 | The schema version is recorded and a newer version is refused | plan decision 9 | example | DONE | `src/store/sqlite.test.ts::records the schema version and refuses a newer one` |
| U59 | Data survives closing and reopening the same file | AC-3.9 | example | DONE | `src/store/sqlite.test.ts::keeps its data when the same file is closed and reopened` |
| U60 | A raw insert with an unknown outcome or state value is rejected by a check constraint | FR-030 | example | DONE | `src/store/sqlite.test.ts::rejects raw rows whose enum values are not in the vocabulary` |

### `src/store/task-log.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U61 | `create` appends an applied row from null to `queued` and writes the task row | AC-3.1, FR-033 | example | DONE | `src/store/task-log.test.ts::TaskLog.create appends an applied row from nothing to queued ...` |
| U62 | A repeated `create` is refused with `task_exists` and logged | edge cases | example | DONE | `src/store/task-log.test.ts::TaskLog.create refuses a repeated create with task_exists ...` |
| U63 | `apply` on success appends an applied row with from, to, event, actor, evidence, and payload and updates the task row | AC-3.1, FR-033 | example | DONE | `src/store/task-log.test.ts::TaskLog.apply on success appends an applied row ...` |
| U64 | `apply` on refusal appends a refused row with code and message and leaves the task row unchanged | AC-3.2, FR-034 | example | DONE | `src/store/task-log.test.ts::TaskLog.apply on refusal appends a refused row ...` |
| U65 | `apply` for an unknown task is refused with `unknown_task` and logged | FR-034 | example | DONE | `src/store/task-log.test.ts::TaskLog.apply refuses an event for an unknown task ...` |
| U66 | `record_approval` writes an approval row and other events write none | AC-3.1 | example | DONE | `src/store/task-log.test.ts::TaskLog.apply writes an approval row for record_approval ...` |
| U67 | A failure while writing the task row rolls back the log append | AC-3.1, FR-033 | example | DONE | `src/store/task-log.test.ts::TaskLog atomicity on the %s store` |
| U68 | Rows carry the injected clock time in strictly ordered `seq` | FR-030 | example | DONE | `src/store/task-log.test.ts::TaskLog clock` |
| U69 | A decision comes from the log even when the cache row is tampered with | plan decision 5 | example | DONE | `src/store/task-log.test.ts::TaskLog uses the log, not the cache, to decide` |
| U70 | Unreadable input is logged as a refused row with placeholder event and actor | FR-023, FR-034 | example | DONE | `src/store/task-log.test.ts::TaskLog with unreadable input` |

### `src/store/replay.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U71 | `replayTask` returns the snapshot that incremental recording produced | FR-035 | example | DONE | `src/store/replay.test.ts::replayTask returns the snapshot that folding the recorded events ...` |
| U72 | `replayTask` skips refused rows and `reconcile` rows | FR-035, FR-037 | example | DONE | `src/store/replay.test.ts::replayTask skips refused rows and reconcile rows` |
| U73 | `replayTask` reports a task as corrupt when an applied row is refused by the machine | AC-3.5, FR-035 | example | DONE | `src/store/replay.test.ts::replayTask reports a task as corrupt when an applied row is refused by the machine` |
| U74 | `replayTask` reports a task as corrupt when an applied row's `to_state` differs from the machine's result | AC-3.5, FR-035 | example | DONE | `src/store/replay.test.ts::replayTask reports a task as corrupt when an applied row's to_state differs ...` |
| U75 | `replayTask` reports a task as corrupt when its first applied row is not `create` | FR-035 | example | DONE | `src/store/replay.test.ts::replayTask reports a task as corrupt when its first applied row is not create ...` |
| U76 | `rebuildCache` produces rows equal to the incrementally written rows | AC-3.4, FR-036 | example | DONE | `src/store/replay.test.ts::rebuildCache produces rows equal to the incrementally written rows ...` |
| U77 | `rebuildCache` writes no row for a corrupt task and lists it | FR-035, FR-036 | example | DONE | `src/store/replay.test.ts::rebuildCache writes no row for a corrupt task, lists it, ...` |
| U78 | `recover` replays non-terminal tasks and skips `torn_down` tasks | AC-3.9, FR-039 | example | DONE | `src/store/replay.test.ts::recover replays every non-terminal task and skips torn_down tasks` |
| U79 | `recover` repairs a missing or diverged cache row and reports the task ID | AC-3.9, FR-039 | example | DONE | `src/store/replay.test.ts::recover repairs a missing or diverged cache row ...` |
| U80 | Over 200 seeded random event sequences, incremental rows equal rebuilt rows on both stores | SC-003 | property | DONE | `test/acceptance/store-random-walk.test.ts::seeded random walks on the %s store` |

### `src/store/reconcile.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U81 | A mismatching observation appends one `reconcile` row with the replayed state on both sides and the observed state in the payload | AC-3.6, FR-037 | example | DONE | `src/store/reconcile.test.ts::appends one reconcile row per mismatch ...` |
| U82 | A matching observation appends nothing | AC-3.6 | example | DONE | `src/store/reconcile.test.ts::appends nothing for an observation that matches the replayed state` |
| U83 | An identical repeated mismatch appends nothing and a changed observation appends a new row | AC-3.6, edge cases | example | DONE | `src/store/reconcile.test.ts::appends nothing for an identical repeated mismatch ...` |
| U84 | An observation of `missing` counts as a mismatch | FR-037 | example | DONE | `src/store/reconcile.test.ts::counts an observation of missing as a mismatch` |
| U85 | An observation for an unknown or corrupt task is reported and not logged | FR-037 | example | DONE | `src/store/reconcile.test.ts::reports an observation for an unknown or corrupt task ...` |
| U86 | Reconcile never changes the replayed state, the task rows, or the approvals | FR-037 | example | DONE | `src/store/reconcile.test.ts::never changes the replayed state, the task rows, or the approvals` |

## Invariants and edge cases still to place

SC-005 (the suite finishes in under 60 seconds) is a measured property of the whole suite and not a behavior, so no line traces to it. `pnpm run check` timing is its check.
Every spec edge case maps to a line above:
a `fail` on `torn_down` (U44), a bad payload (U12 to U15), an unknown event type (U11), whitespace evidence (U16), a wrong-scope approval (U22, U23, U40), a denied approval (U23, U39), approval out of state (U40), strict sequence order (U47, U68), a matching reconcile (U82), and a promoted task's fresh profile (U42).

## Out of scope

- Hard rules 5, 6, and 7: they need machine placement and extension code (milestones 8 and 9). Only the `blocked` state exists here.
- Tools, event wiring, validators, dispatch rules, skills, and the read RPC: milestones 4 to 11.
- Running `bb plugin build` inside the test suite: it needs the `bb` command-line tool, which not every checkout has. `A5` checks that the script is wired, and the owner-run build is recorded in `docs/DECISIONS.md` (D-001).
- Coverage numbers and automated mutation runs: the tools are not installed, so `/speckit.tdd.verify` uses deliberate mutants.
- Concurrency between processes on one SQLite file: the plugin runs one process.

## Cycle plan

Behaviors on one function or one file batch into one cycle.
Each behavior in a batch still needs its own failing test, and the cycle log records the failing output for each id.
The outer-loop tests for a milestone are written first and stay red until their units land.

| cycle group | behaviors | milestone |
| --- | --- | --- |
| G1 | A2, A5 | 1 |
| G2 | A1 | 1 |
| G3 | U9 | 1 |
| G4 | A3, A4, U1, U2, U3, U4 | 1 |
| G5 | U5, U6, U7, U8 | 1 |
| G6 | A6 to A17 (written red first) | 2 |
| G7 | U10 to U15 | 2 |
| G8 | U16, U17, U18 | 2 |
| G9 | U19, U20, U21, U22 | 2 |
| G10 | U23, U24, U25 | 2 |
| G11 | U26, U27, U28, U29 | 2 |
| G12 | U30, U31, U32, U33, U34, U35 | 2 |
| G13 | U36, U37, U38 | 2 |
| G14 | U39, U40, U41 | 2 |
| G15 | U42, U43 | 2 |
| G16 | U44, U45 | 2 |
| G17 | U46 | 2 |
| G18 | A18 to A26 (written red first) | 3 |
| G19 | U47 to U55 on the in-memory store | 3 |
| G20 | U56 to U60 and the contract on SQLite | 3 |
| G21 | U61 to U66 | 3 |
| G22 | U67 to U70 | 3 |
| G23 | U71 to U75 | 3 |
| G24 | U76 to U79 | 3 |
| G25 | U80 | 3 |
| G26 | U81 to U86 | 3 |

Execution notes: replay (G23) ran before the task log (G21 and G22), because the task log decides from a replay. A follow-up cycle G5b fixed a lint rule defect, and G1c added the manifest branding that `bb plugin build` needs. The cycle log records both.

## Verification commands

Copied verbatim from `.specify/memory/tdd-profile.md` at planning time:

- Single test: `pnpm vitest run <file> -t "<name>"`
- Single file: `pnpm vitest run <file>`
- Full suite: `pnpm test`
- Type-check: `pnpm run typecheck`
- Lint: `pnpm run lint`
- Coverage: none (tool not installed)
- Mutation: none (tool not installed; deliberate mutants instead)
