# Cycle Log: Core scaffold, task state machine, and event storage

Append only. Newest last. Every entry's `red` block is the evidence that the test existed and failed before the implementation.

Batching rule: behaviors on one function or file share a cycle, as the cycle plan in `test-list.md` lists.
Each behavior in a batch still has its own test, and each entry records the failing output per behavior id.

## Baseline

- suite: `pnpm test` -> 1 file, 3 passed, 0 failed
- commit: `d4a96f4`
- recorded: cycle 0, before any feature change

## Cycle G1: A2 manifest names the package and declares the server entry; A5 build script (baseline)

- test: `test/acceptance/manifest.test.ts::names the package, declares the server entry, and pins the SDK to one exact version` (new, A2)
- test: `test/acceptance/manifest.test.ts::builds through bb plugin build` (new, A5, characterization)
- red (A2): `pnpm vitest run test/acceptance/manifest.test.ts`
  -> `AssertionError: expected undefined to be './src/server.ts'` (1 failed, 1 passed)
- A5 passed on first run because the toolchain scaffold (T001) already set the script. Deliberate mutant: changed `"build"` to `"tsc"` in `package.json`, ran
  `pnpm vitest run test/acceptance/manifest.test.ts -t "builds through bb plugin build"`
  -> `AssertionError: expected 'tsc' to be 'bb plugin build'` (1 failed). Restored `package.json` exactly. A5 is `BASELINE`.
- green: `package.json` gained the `bb` block (`name`, `description`, `server`), `engines`, and the `bb-plugin` keyword. Suite `pnpm test` -> 2 files, 5 passed, 0 failed. `pnpm run lint` and `pnpm run typecheck` clean.
- refactor: none needed, one config block
- commit: G1

## Cycle G2: A1 plugin loads in the fake host and registers nothing beyond its identity

- test: `test/acceptance/plugin.test.ts::loads in the fake host, registers nothing beyond its identity, and disposes cleanly` (new, A1)
- red: added a no-op stub `src/server.ts` so the import resolves, then `pnpm vitest run test/acceptance/plugin.test.ts`
  -> `AssertionError: expected [] to deeply equal [ { level: 'info', …(1) } ]` (1 failed)
- green: `src/server.ts:8` logs `bb-factoryman loaded` through `bb.log.info`. Suite `pnpm test` -> 3 files, 6 passed, 0 failed. Lint and type-check clean.
- refactor: none needed
- note: "identity" is the one load log line. The design does not define it, so the choice is recorded in `docs/DECISIONS.md`.
- commit: G2

## Cycle G3: U9 repository layout

- test: `test/acceptance/layout.test.ts::has the milestone 1 to 3 directories and none for later milestones` (new, U9)
- red: `pnpm vitest run test/acceptance/layout.test.ts`
  -> `AssertionError: src/machine should exist: expected false to be true` (1 failed)
- green: created `src/machine/.gitkeep` and `src/store/.gitkeep`. Suite `pnpm test` -> 4 files, 7 passed, 0 failed. Lint and type-check clean.
- refactor: none needed
- commit: G3

## Cycle G4: A3, A4, U1, U2, U3, U4 lint rule keeps bb imports out of src/machine

- tests: `test/acceptance/lint-isolation.test.ts` (new): `fails lint on an @get-bb import and names the restricted module` (A3), `passes lint on the same import outside src/machine` (A4), `fails lint on a type-only @get-bb import` (U1), `fails lint on an @get-bb subpath import` (U2), `fails lint on a dynamic import of an @get-bb module` (U3), `fails lint on a re-export from an @get-bb module` (U4)
- red: `pnpm vitest run test/acceptance/lint-isolation.test.ts`
  -> 5 failed, 1 passed. A3, U1, U2, U3, U4 each: `AssertionError: expected [] to have a length of 1 but got +0`
- A4 passed on first run (negative test). Deliberate mutant: widened the override from `src/machine/**/*.ts` to `src/**/*.ts`, ran
  `pnpm vitest run test/acceptance/lint-isolation.test.ts -t "passes lint on the same import outside"`
  -> `AssertionError: expected [ Array(1) ] to deeply equal []` (1 failed). Restored `eslint.config.js` exactly.
- green, step 1: added the `no-restricted-imports` override with the `@get-bb/*` pattern. Run -> only U3 still failed (`expected [] to have a length of 1 but got +0`), because ESLint 10's `no-restricted-imports` does not see `import()`.
- green, step 2: added `no-restricted-syntax` on `ImportExpression` for `src/machine/**`. Suite `pnpm test` -> 5 files, 13 passed, 0 failed. Lint and type-check clean.
- refactor: none needed
- note: the rule bans every dynamic import in `src/machine/`, not only `@get-bb` ones, so a computed specifier cannot hide a bb import. Recorded in `docs/DECISIONS.md`.
- commit: G4

## Cycle G5: U5, U6, U7, U8 lint rule keeps storage, Node built-ins, and src/store out of src/machine

- tests: `test/acceptance/lint-isolation.test.ts` (extended): `fails lint on an import of better-sqlite3` (U5), `fails lint on an import of a node built-in, with or without the node: prefix` (U6), `fails lint on an import from src/store` (U7), `passes lint on xstate, zod, and sibling machine imports` (U8)
- red: `pnpm vitest run test/acceptance/lint-isolation.test.ts`
  -> 3 failed, 7 passed. U5, U6, U7 each: `AssertionError: expected [] to have a length of 1 but got +0`
- U8 passed on first run (negative test). Deliberate mutant: added `"xstate"` to the `better-sqlite3` pattern group, ran
  `pnpm vitest run test/acceptance/lint-isolation.test.ts -t "passes lint on xstate"`
  -> `AssertionError: expected [ Array(1) ] to deeply equal []` (1 failed). Restored `eslint.config.js` exactly.
- green: `eslint.config.js` gained three pattern groups: `better-sqlite3`, `node:*` plus the names in `builtinModules`, and `**/store` plus `**/store/**`. Suite `pnpm test` -> 5 files, 17 passed, 0 failed. Lint and type-check clean.
- refactor: none needed
- commit: G5

## Cycle G6 (opened): A6 to A17 written red first

- tests: `test/acceptance/machine-gates.test.ts` and `test/acceptance/machine-matrix.test.ts`, with `test/fixtures/machine.ts` (new). They enter through `transition` from `src/machine/transition`.
- red: `pnpm vitest run test/acceptance/machine-gates.test.ts test/acceptance/machine-matrix.test.ts`
  -> `Error: Cannot find module '../../src/machine/transition'` (2 files failed, no tests ran). This is the expected outer-loop red: the entry point does not exist yet.
- The two files stay uncommitted and red while the inner loop (G7 to G17) builds the units. During those cycles the suite run excludes them with `--exclude`, which narrows nothing for the unit under test. Entry closes when they go green.

## Cycle G7: U10 to U15 event parsing

- tests: `src/machine/events.test.ts` (new): `parses a valid %s event` x15 (U10), `refuses an unknown event type as unknown_event` (U11), `refuses an event with an unknown extra key` (U12), `refuses %s without %s as invalid_event` x9 (U13), `refuses %s with a bad value %j as invalid_event` x16 (U14), `refuses non-object input %j as invalid_event` x6 (U15)
- red: declared `src/machine/types.ts` and `src/machine/refusal.ts` (data only) and a stub `parseEvent` that throws, then `pnpm vitest run src/machine/events.test.ts`
  -> `Error: not implemented` (49 failed, 1 passed). The one pass is `covers all 15 event types`, a fixture sanity check.
- green: `src/machine/events.ts` defines a strict `zod` schema per event type, a discriminated union, and `parseEvent`, which maps failures to `unknown_event` or `invalid_event`. `pnpm vitest run src/machine/events.test.ts` -> 50 passed. Suite without the two open outer files -> 6 files, 67 passed, 0 failed. Lint clean. Type-check fails only on the two open outer files, which import `transition` before it exists.
- refactor: none needed
- commit: G7

## Cycle G5b: U8 follow-up, a Node built-in name must not block a sibling module

- found by: linting `src/machine/events.test.ts` in G7 reported `'./events' import is restricted ... Node built-ins`. The G7 commit (`feat: parse and validate machine events [G7]`) was made with that lint error present, because the lint output and the commit ran in one command. This cycle fixes it.
- test: `test/acceptance/lint-isolation.test.ts::passes lint on a sibling module whose name matches a Node built-in` (new, extends U8)
- red: `pnpm vitest run test/acceptance/lint-isolation.test.ts`
  -> `AssertionError: expected [ …(3) ] to deeply equal []` (1 failed, 10 passed)
- green: `eslint.config.js` now restricts built-ins through exact-name `paths` entries (plus the `node:*` pattern), so `./events`, `./path`, and `../machine/util` pass. Lint-isolation file -> 11 passed. Suite without the two open outer files -> 6 files, 68 passed, 0 failed. `pnpm eslint .` clean.
- refactor: none needed
- commit: G5b

## Cycle G8: U16, U17, U18 evidence, profile, and actor guards

- tests: `src/machine/guards.test.ts` (new): `evidenceProvided refuses evidence %j` x4 and `accepts evidence %j` x3 (U16), `profileResolved refuses a start event with profile %j` x2 and `accepts a start event with a complete profile` (U17), `notWorker refuses only the worker actor` and `ownerOnly accepts only the user actor` (U18)
- red: declared `GUARDS` as an empty registry, then `pnpm vitest run src/machine/guards.test.ts`
  -> `TypeError: GUARDS.evidenceProvided is not a function` (12 failed, 0 passed)
- green: `src/machine/guards.ts` implements `evidenceProvided` (trimmed, non-empty), `profileResolved`, `notWorker`, and `ownerOnly`. The other nine guards are placeholders that refuse with `internal_mismatch`, so an unwritten gate fails closed. `pnpm vitest run src/machine/guards.test.ts` -> 12 passed. Gate script (lint, type-check, suite without the two open outer files) -> 7 files, 80 passed, 0 failed.
- refactor: none needed
- commit: G8

## Cycle G9: U19, U20, U21, U22 mode, ready, pipeline, and scope guards

- tests: `src/machine/guards.test.ts` (extended, 13 new): `modeIsNoMistakes accepts only the no-mistakes mode` and `modeIsNotNoMistakes accepts direct-PR and local-only and refuses no-mistakes` (U19); `direct-PR needs a pull request URL`, `direct-PR does not need landed commits`, `local-only needs one or more landed commits, so 0 and a missing count fail and 1 passes`, `local-only does not need a pull request URL`, `refuses for the no-mistakes mode ...`, `refuses an event that is not a ready event` (U20); `refuses an unfinished pipeline and accepts a finished one`, `refuses an event that is not a validated event` (U21); `approvalScopeIsMerge accepts only the merge scope`, `approvalScopeIsPromote accepts only the promote scope`, `refuse an event that is not an approval event` (U22)
- red: `pnpm vitest run src/machine/guards.test.ts`
  -> 13 failed, 12 passed. Decisive lines: `AssertionError: expected 'internal_mismatch' to be 'mode_check_failed'` (x5), `expected { code: 'internal_mismatch', …(1) } to be null` (x5), `expected 'internal_mismatch' to be 'mode_mismatch'` (x2). The placeholders from G8 refuse, so the accepting and the coded-refusal cases both fail.
- green: `src/machine/guards.ts` implements the two mode guards, `readyModeCheck`, `pipelineFinishedWithPr`, and the two scope guards. Guards file -> 25 passed. Gate script -> 7 files, 93 passed, 0 failed.
- refactor: none needed
- commit: G9

## Cycle G10: U23, U24, U25 merge, promotion, and worktree guards

- tests: `src/machine/guards.test.ts` (extended, 10 new): `mergeAuthorized` accepts yolo, accepts an approved decision, refuses a denied, missing, or other-scope decision, and refuses a non-merge event (U23); `promotionAuthorized` accepts an approved promote decision and refuses denied, missing, or other-scope decisions (U24); `worktreeLanded` accepts clean with zero unpushed, refuses uncommitted changes, refuses a single unpushed commit, refuses a non-teardown event (U25)
- red: `pnpm vitest run src/machine/guards.test.ts`
  -> 10 failed, 25 passed. Decisive lines: `AssertionError: expected { code: 'internal_mismatch', …(1) } to be null` (x4), `expected 'internal_mismatch' to be 'unlanded_work'` (x3). The placeholders still refuse.
- green: `src/machine/guards.ts` implements `mergeAuthorized`, `promotionAuthorized`, and `worktreeLanded`. Guards file -> 35 passed. Gate script -> 7 files, 103 passed, 0 failed.
- refactor: removed the now-unused `pending` placeholder helper, and simplified the test helper type to `TaskContext["approvals"]`. Gate re-run green.
- commit: G10

## Cycle G11: U26, U27, U28, U29 transition tables and generated xstate machines

- tests: `src/machine/table.test.ts` (new): `lists exactly the legal pairs and targets for %s tasks` x2 (U26), `lists each %s row's guards in the documented order, and every guard exists` x2 (U27), `gives the ship machine exactly the ship states` and `gives the scout machine exactly the scout states` (U28), `accepts exactly the table's transitions in the %s machine` x2 (U29). The oracles live in `test/fixtures/legal-set.ts`, written by hand from the design and not read from `src/machine`.
- red: stubbed `TABLES` as empty lanes and `MACHINES` as one-state machines, then `pnpm vitest run src/machine/table.test.ts`
  -> 8 failed. Decisive lines: `AssertionError: ship/queued/start should be possible: expected false to be true`, and the table and state-set comparisons failing against the empty stubs.
- green, step 1: `src/machine/table.ts` holds the ship and scout lanes. `src/machine/machines.ts` generates both xstate machines from the table, wrapping each named guard. Run -> 6 passed, 2 failed: `ship/awaiting_approval/record_approval should be possible: expected false to be true`. xstate's `can()` is false for a targetless transition that has no action.
- green, step 2: every generated transition now runs one `applyEffects` assign action from `src/machine/effects.ts`, which returns the context unchanged for now. Later cycles drive real effects. Run -> 8 passed. Gate script (lint, type-check, suite without the two open outer files) -> 8 files, 111 passed, 0 failed.
- refactor: none needed
- commit: G11

## Cycle G12: U30 to U35 createTask and the transition facade

- tests: `src/machine/transition.test.ts` (new, 35 cases): `createTask returns a queued snapshot with null defaults and no approvals` (U30); `createTask refuses %s` x8 and `refuses non-object input %j` x5 (U31); `transition never throws` for 9 garbage events and 8 bad snapshots (U32); `transition is pure` x2 (U33); `gives every refusal a code from the closed list and a message` (U34); `carries the from state, the to state, and the parsed event on success` (U35)
- red: stubbed `createTask` and `transition` to throw, then `pnpm vitest run src/machine/transition.test.ts`
  -> `Error: not implemented` (35 failed, 0 passed)
- green: `src/machine/events.ts` gained `parseCreate`. `src/machine/transition.ts` implements `createTask` and the `transition` facade: parse, validate the snapshot, look up the table row, run its guards in order, compute the next snapshot with xstate, and cross-check the target. The whole call sits in a `try`, so it never throws. The result is a deep clone. `pnpm vitest run src/machine/transition.test.ts` -> 35 passed. Gate script -> 9 files, 146 passed, 0 failed.
- refactor: none needed
- note: with the facade in place the open outer files go 48 passed, 4 failed. The four failures are the effect-driven cases (profile recorded, prUrl recorded, approval recorded, promote), which G13 to G15 drive. The matrix file passes in full.
- commit: G12

## Cycle G13: U36, U37, U38 guard order, start effects, and pull request URL effects

- tests: `src/machine/transition.test.ts` (extended, 8 new): `guard order` x4 (U36: names the actor before the missing approval on a worker merge; the mode before the missing evidence on a no-mistakes ready; the missing evidence before the missing pull request on a direct-PR ready; the actor before the unlanded work on a worker teardown), `start` x2 (U37), `pull request URL` x2 (U38)
- red: `pnpm vitest run src/machine/transition.test.ts`
  -> 2 failed, 41 passed. `AssertionError: expected { taskId: 'task-1', …(9) } to match object { profile: { …(4) }, …(3) }` (start records) and `AssertionError: expected null to be 'https://github.com/acme/widgets/pull/9'` (URL recorded).
- Six of the eight new tests passed on first run: the four order tests (the table already lists guards in order), `records a null machine when none is pinned`, and `stays null when a local-only ready event carries none` (the default context already holds null). Deliberate mutants, each run with `pnpm vitest run src/machine/transition.test.ts` and restored exactly afterwards:
  - A: swapped `notWorker` and `mergeAuthorized` on the merge row -> `names the actor before the missing approval on a worker merge` failed.
  - B: moved `evidenceProvided` before `modeIsNotNoMistakes` on the ready row -> `names the mode before the missing evidence ...` failed.
  - C: moved `readyModeCheck` before `evidenceProvided` -> `names the missing evidence before the missing pull request ...` failed.
  - D: swapped `notWorker` and `worktreeLanded` on the merged teardown row -> `names the actor before the unlanded work ...` failed.
  - E: `machine: event.machine ?? "default"` -> `records a null machine when none is pinned` failed.
  - F: `ready` always sets `prUrl` -> `stays null when a local-only ready event carries none` failed.
- green: `src/machine/effects.ts` now records profile, thread, branch, and machine on `start`, and the pull request URL on `ready` (when present) and `validated`. `pnpm vitest run src/machine` -> all passed. Gate script -> 9 files, 154 passed, 0 failed.
- refactor: none needed
- commit: G13

## Cycle G14: U39, U40, U41 approvals and the yolo merge path

- tests: `src/machine/transition.test.ts` (extended, 5 new): `record_approval stores the decision, keeps the state, and lets a later decision replace an earlier one` and `stores a promote decision for a scout in report_ready` (U39); `is refused outside awaiting_approval and report_ready, so approval cannot be banked in advance` and `is refused for the wrong scope in each state` (U40); `merge under yolo is still refused from review_ready, because every merge passes through awaiting_approval` (U41)
- red: `pnpm vitest run src/machine/transition.test.ts`
  -> 2 failed, 46 passed. `AssertionError: expected {} to deeply equal { merge: 'denied' }` and `AssertionError: expected { merge: 'approved' } to deeply equal { merge: 'approved', …(1) }`.
- Three tests (U40 x2, U41) passed on first run because the table already encodes them. Deliberate mutants, each run with `pnpm vitest run src/machine/transition.test.ts` and restored exactly:
  - G: added a `merge` row to `review_ready` -> `is still refused from review_ready ...` failed.
  - H: dropped `approvalScopeIsMerge` from the `awaiting_approval` approval row -> `is refused for the wrong scope in each state` failed.
- green: `src/machine/effects.ts` records `approvals[scope] = decision` on `record_approval`. `pnpm vitest run src/machine/transition.test.ts` -> 48 passed. Gate script -> 9 files, 159 passed, 0 failed.
- refactor: none needed
- commit: G14

## Cycle G15: U42, U43 promotion

- tests: `src/machine/transition.test.ts` (extended, 3 new): `promote makes a queued ship task, keeps the identity and placement, and clears profile, approvals, and URL` (U42); `accepts ship events afterwards and refuses scout events` (U43); `needs a fresh merge approval after promotion` (U43)
- red: `pnpm vitest run src/machine/transition.test.ts`
  -> 3 failed, 48 passed. `AssertionError: expected { taskId: 'task-1', …(9) } to deeply equal { taskId: 'task-1', …(9) }` (the kind stayed `scout` and the profile, URL, and approvals were not cleared). The other two failed because the promoted task still behaved as a scout.
- green: `src/machine/effects.ts` sets `kind: "ship"` and clears `profile`, `prUrl`, and `approvals` on `promote`. The facade already picks the machine from `context.kind`, so no facade change was needed. `pnpm vitest run src/machine/transition.test.ts` -> 51 passed. Gate script -> 9 files, 162 passed, 0 failed.
- outer loop: with promotion in place the open outer files pass in full (`pnpm vitest run test/acceptance/machine-gates.test.ts test/acceptance/machine-matrix.test.ts` -> 52 passed, 0 failed). A6 to A17 are green.
- refactor: none needed
- commit: G15
- note: this entry was appended after the G15 commit, not before it, because a failed `cd` skipped the log step of the commit command. No behavior changed between the run above and the commit.

## Cycle G16: U44, U45 fail and teardown edges

- tests: `src/machine/transition.test.ts` (extended, 14 cases): `fail is refused from failed and from torn_down` and `records the failing state's evidence in the result and leaves the context as it was` (U44); `teardown tears down %s when the worktree is clean` x4, `refuses to tear down %s with uncommitted changes or an unpushed commit` x4, and `refuses teardown from the states that still hold work` (U45)
- All 14 passed on first run, because the table and the `worktreeLanded` guard already encode them. Deliberate mutants, each run with `pnpm vitest run src/machine/transition.test.ts` and restored exactly:
  - I: allowed `fail` from `failed` -> `is refused from failed and from torn_down` failed.
  - J: allowed `teardown` from a working ship task -> `refuses teardown from the states that still hold work` failed.
  - K: removed `worktreeLanded` from the failed-lane teardown -> the failed ship and failed scout dirty-teardown tests failed.
  - L: changed `unpushedCommits === 0` to `>= 0` -> four dirty-teardown tests failed.
  - M: removed `worktreeLanded` from the scout `report_ready` teardown -> the scout dirty-teardown test failed.
- green: no code change needed.
- refactor: none needed
- commit: G16

## Cycle G17: U46 fail-closed cross-check

- tests: `src/machine/transition.test.ts` (extended, 3 new): `refuses with internal_mismatch when the xstate machine lands somewhere the table does not allow`, `refuses with internal_mismatch when the xstate machine throws`, `agrees with the real machines on the same input` (U46)
- red: `pnpm vitest run src/machine/transition.test.ts`
  -> `TypeError: transitionUsing is not a function` (3 failed, 62 passed). The seam did not exist yet.
- green: `src/machine/transition.ts` now exports `transitionUsing(machines, snapshot, raw)`, and `transition` calls it with the real machines. The first version of the "throws" test used a throwing action, and it failed with `AssertionError: expected true to be false` because `getNextSnapshot` does not run custom actions. The test now uses a throwing guard. `pnpm vitest run src/machine/transition.test.ts` -> 65 passed. Gate script -> 9 files, 176 passed, 0 failed.
- A first draft of the facade also checked `next.status !== "active"`. Deliberate mutant N disabled that check and every test still passed, and a probe showed that xstate throws on a failing `assign` (the `try` catches it). The check was unreachable, so it was removed. Mutant O (target cross-check disabled) failed `refuses with internal_mismatch when the xstate machine lands somewhere the table does not allow`, so that check is covered.
- refactor: none needed
- commit: G17

## Cycle G6 (closed): A6 to A17 green

- command: `pnpm vitest run test/acceptance/machine-gates.test.ts test/acceptance/machine-matrix.test.ts`
  -> 2 files, 52 passed, 0 failed
- history: red at G6 (`Cannot find module '../../src/machine/transition'`); 4 effect-driven cases still red after G12 (profile recorded, URL recorded, approval recorded, promote); green after G15.
- note: the matrix file was refactored in the middle of the milestone to import its oracle from `test/fixtures/legal-set.ts`. That moved the hand-written legal set out of the test body and changed no assertion.
- commit: G6

## Cycle G18 (opened): A18 to A26 written red first

- tests: `test/acceptance/store-contract.test.ts` (A24, A25), `test/acceptance/store-restart.test.ts` (A18 to A23, A26), `test/store-contract.ts` (the shared contract suite), and `test/fixtures/store.ts` (a fake clock, create events, and event paths). They enter through `TaskLog`, `replayTask`, `rebuildCache`, `recover`, `reconcile`, `createMemoryStore`, and `openSqliteStore`.
- red: `pnpm vitest run test/acceptance/store-contract.test.ts test/acceptance/store-restart.test.ts`
  -> `Error: Cannot find module '../../src/store/memory'` (2 files failed, no tests ran). This is the expected outer-loop red.
- The three outer files stay uncommitted and red while the inner loop (G19 to G26) builds the units. During those cycles the gate run excludes them with `--exclude`.

## Cycle G19: U47 to U55 the in-memory store and the shared contract

- tests: `test/store-contract.ts` (new, run by `src/store/memory.test.ts`): `assigns strictly increasing seq values to appended events` (U47), `reads back an appended event equal to what was written ...` (U48), `does not let a caller change the store by mutating a returned row` (U49), `filters events by task and by afterSeq and returns them in seq order` (U50), `commits every write of a transaction and returns the function's value` (U51), `rolls back every write of a transaction and rethrows when the function throws` (U52), `returns the default config for an unknown project and the stored config after a put` (U53), `puts, gets, replaces, lists, filters, and clears task rows without touching events or approvals` (U54), `keeps approvals in insertion order per task` (U55)
- red: declared `src/store/types.ts` and `src/store/store.ts` (types and the default config) and a stub `createMemoryStore` that throws, then `pnpm vitest run src/store/memory.test.ts`
  -> `Error: not implemented` (9 failed, 0 passed)
- green: `src/store/memory.ts` keeps events, approvals, tasks, and configs in plain structures, hands out frozen deep copies, and implements `transaction` by saving a deep copy of its state and restoring it when `fn` throws. `pnpm vitest run src/store/memory.test.ts` -> 9 passed. Gate script (lint, type-check, suite without the open outer files) -> 12 files, 237 passed, 0 failed.
- refactor: none needed
- commit: G19

## Cycle G20: U56 to U60 the SQLite store

- tests: `src/store/sqlite.test.ts` (new): the shared contract run against `openSqliteStore(":memory:")` (U47 to U55 on SQLite, 9 cases), `aborts a raw UPDATE or DELETE on task_event` (U56), `aborts a raw UPDATE or DELETE on approval` (U57), `records the schema version and refuses a newer one` (U58), `keeps its data when the same file is closed and reopened` (U59), `rejects raw rows whose enum values are not in the vocabulary` (U60)
- red: a stub `openSqliteStore` that throws, then `pnpm vitest run src/store/sqlite.test.ts`
  -> `Error: not implemented` (14 failed, 0 passed)
- green: `src/store/sqlite.ts` creates the schema from the vocabulary lists in `src/machine/types.ts` (with `CHECK` constraints), adds `BEFORE UPDATE` and `BEFORE DELETE` triggers that abort on `task_event` and `approval`, records `PRAGMA user_version`, refuses a newer version, maps rows to frozen camel-case objects, and runs `transaction` through `db.transaction`. It accepts a path, `:memory:`, or an open database and closes only what it opened. `pnpm vitest run src/store/sqlite.test.ts` -> 14 passed. Gate script -> 14 files, 271 passed, 0 failed.
- outer loop: `test/acceptance/store-contract.test.ts` (A24, A25) now passes with both stores, so it is committed with this cycle.
- refactor: none needed
- commit: G20

## Cycle G23 (run before G21 and G22): U71 to U75 replay

- order change: `TaskLog.apply` decides from a replay, so replay is built first. The tests write history by folding the machine (`test/fixtures/history.ts`), not through `TaskLog`, so they do not depend on it.
- tests: `src/store/replay.test.ts` (new): `returns the snapshot that folding the recorded events through the machine produces` and `replays only the asked-for task` (U71); `skips refused rows and reconcile rows` (U72); `reports not_found for a task with no applied rows`; `reports a task as corrupt when an applied row is refused by the machine` (U73); `reports a task as corrupt when an applied row's to_state differs from the machine's result` (U74); `reports a task as corrupt when its first applied row is not create, or it has a second create` (U75)
- red: a stub `replayTask` that throws, then `pnpm vitest run src/store/replay.test.ts`
  -> `Error: not implemented` (7 failed, 0 passed)
- green: `src/store/rows.ts` maps snapshots to task rows and rows back to raw events. `src/store/replay.ts` folds applied non-`reconcile` rows through `createTask` and `transition`, and returns `corrupt` with the failing `seq` when the machine refuses a row, when a row's recorded from or to state differs from the machine's, or when the first row is not a well-formed `create`.
- test correction (a mistake in my test, not in the code): the first run failed with `AssertionError: expected 'awaiting_approval' to be 'review_ready'` and `expected 'Log row 8 ...' to contain 'illegal_transition'`. I had sliced `shipPath()` at 6 events, which ends after `request_approval`, where the tests assumed `review_ready`. I changed the slice to 5 events. The assertions are unchanged.
- deliberate mutants, each run with `pnpm vitest run src/store/replay.test.ts` and restored exactly:
  - P: dropped the from/to cross-check -> `reports a task as corrupt when an applied row's to_state differs ...` failed.
  - Q: folded `reconcile` rows into the replay -> `skips refused rows and reconcile rows` failed.
  - R: folded refused rows into the replay -> `skips refused rows and reconcile rows` and `reports not_found ...` failed.
  - S: dropped the "first row must be create" check -> survived at first, because a non-create row fails the later parse anyway. I added a case where a `start` row carries create-shaped fields; mutant S then failed that test.
  - T: dropped the "create goes from nothing to queued" check -> survived. I added a case with a `create` row that records `working`; mutant T then failed that test.
- gate script -> 15 files, 278 passed, 0 failed.
- refactor: none needed
- commit: G23

## Cycle G21: U61 to U66 TaskLog create, apply, refusal, and approvals

- tests: `src/store/task-log.test.ts` (new, 7 cases): `create appends an applied row from nothing to queued and writes the task row` (U61); `refuses a repeated create with task_exists, logs it, and leaves the task alone` and `logs a create that fails validation as a refused row` (U62); `apply on success appends an applied row ... and updates the task row` (U63); `on refusal appends a refused row ... and leaves the task row unchanged` (U64); `refuses an event for an unknown task with unknown_task and logs it` (U65); `writes an approval row for record_approval and for no other event` (U66)
- red: a stub `TaskLog` that throws, then `pnpm vitest run src/store/task-log.test.ts`
  -> `Error: not implemented` (7 failed, 0 passed)
- green: `src/store/task-log.ts` implements `create` and `apply` as a first, deliberately minimal version: it replays the task to get the snapshot, calls `transition`, then appends the row, updates the cache, and adds an approval row for `record_approval`. It uses the wall clock, runs outside a transaction, and assumes the raw event is an object. G22 drives those three gaps. `pnpm vitest run src/store/task-log.test.ts` -> 7 passed. Gate script -> 16 files, 285 passed, 0 failed.
- refactor: none yet. The first version has rough edges (a cast in `create`, repeated row building). The refactor runs at the end of G22, once the remaining behaviors are green.
- commit: G21

## Cycle G22: U67 to U70 TaskLog atomicity, clock, log-as-input, and unreadable input

- tests: `src/store/task-log.test.ts` (extended, 15 new): `TaskLog atomicity on the %s store` x2 stores x2 cases (U67); `TaskLog clock` x3 (U68); `TaskLog uses the log, not the cache, to decide` x2 (U69); `TaskLog with unreadable input` x5 plus `keeps the readable parts of a broken event and never throws on values that cannot be stored` (U70)
- red: `pnpm vitest run src/store/task-log.test.ts`
  -> 8 failed, 14 passed. Decisive failures: the four atomicity cases (the log row stayed after a failing `putTask` or `addApproval`), `stamps each recorded row with one tick of the injected clock, in order`, `logs undefined as a refused row ...` and `logs null as a refused row ...` (a `TypeError` while reading the raw event), and `keeps the readable parts of a broken event ...`.
- green: `src/store/task-log.ts` now wraps each call in `store.transaction`, takes `now` from the options (wall clock by default) and reads it once per call, and describes unreadable input safely (`<invalid>` event, `unknown` actor, a JSON-safe payload that falls back to `{}`). `pnpm vitest run src/store/task-log.test.ts` -> 22 passed. Gate script -> 16 files, 300 passed, 0 failed.
- seven tests passed on first run (the two tamper tests, the wall-clock fallback, the approval tick, and three unreadable inputs that happened to parse). Deliberate mutants, each run with `pnpm vitest run src/store/task-log.test.ts` and restored exactly:
  - U: decide from the cache row's state -> both tamper tests failed.
  - V: wall-clock default removed -> `falls back to the wall clock in ISO 8601 UTC form` failed.
  - W: approval row takes a second clock tick -> `stamps an approval row with the same tick as its log row` failed.
  - X: `jsonSafe` without its `try`/`catch` -> `keeps the readable parts of a broken event ...` failed.
  - Y: `create` outside a transaction -> both `rolls back the log append when writing the task row fails` cases failed.
- refactor: on green I rewrote `src/store/task-log.ts` to drop the casts and the duplicated row building from G21. Suite re-run green after the rewrite (22 passed, gate OK).
- commit: G22

## Cycle G24: U76 to U79 rebuild the cache and recover at start-up

- tests: `src/store/replay.test.ts` (extended, 5 first-pass cases plus 7 added after mutants): `rebuildCache produces rows equal to the incrementally written rows after the cache is cleared` (U76); `writes no row for a corrupt task, lists it, and still rebuilds the healthy tasks` (U77); `recover replays every non-terminal task and skips torn_down tasks` (U78); `repairs a missing or diverged cache row, reports it, and leaves matching rows alone`, `reports a corrupt non-terminal task and does not guess its row` (U79)
- red: stubbed `rebuildCache` and `recover` to throw, then `pnpm vitest run src/store/replay.test.ts`
  -> `Error: not implemented` (5 failed, 7 passed)
- green: `src/store/replay.ts` gained `rebuildCache` (clear, replay every created task, write rows for the healthy ones, list the corrupt ones, all in one transaction) and `recover` (skip tasks whose last state row is `torn_down`, replay the rest, repair a missing or differing cache row, report repaired, corrupt, replayed, and skipped tasks). `pnpm vitest run src/store/replay.test.ts` -> 12 passed. Gate script -> 16 files, 305 passed, 0 failed.
- deliberate mutants, each run with `pnpm vitest run src/store/replay.test.ts` and restored exactly:
  - Z1: `rebuildCache` keeps old rows -> `writes no row for a corrupt task ...` failed.
  - Z2: `recover` replays terminal tasks -> `replays every non-terminal task and skips torn_down tasks` failed.
  - Z3: `recover` reports repairs but never writes them -> `repairs a missing or diverged cache row ...` failed.
  - Z4: the row comparison ignores `branch` -> survived, because the diverged row in the test also had a wrong state. I added seven cases (`repairs a row that differs from its replay in only the %s field`, one per field except the task ID and state), and Z4 then failed `... only the branch field`. The suite is 19 passed.
  - Z5: `rebuildCache` writes a row for a corrupt task -> `writes no row for a corrupt task ...` failed.
- refactor: none needed
- commit: G24

## Cycle G1c: A2 follow-up, the manifest needs bb.branding for `bb plugin build`

- trigger: steering message 001 from Firstmate said the bb CLI (bb 0.48.1) was now installed. `pnpm run build` (`bb plugin build`) failed with `Error: invalid plugin package.json (bb.branding) ... Invalid input: expected object, received undefined`, and warned that the pinned SDK 0.6.125 differs from this bb's SDK 0.6.104.
- test: `test/acceptance/manifest.test.ts::names the package, declares the server entry, and pins the SDK to one exact version` (extended with `expect(manifest.bb?.branding?.icon).toBeTruthy()`, A2)
- red: `pnpm vitest run test/acceptance/manifest.test.ts`
  -> `AssertionError: expected undefined to be truthy` (1 failed, 1 passed)
- green: `package.json` gained `bb.branding.icon` (`Factory`). `pnpm run build` -> exit 0, writing `dist/server.js`, `dist/server.js.map`, `dist/server.meta.json`. Manifest test -> 2 passed.
- dependency change, not a behavior: the SDK pin moved from 0.6.125 to 0.6.104 (the SDK of the installed bb) and `engines.bbPluginSdk` to `>=0.6.104`. The lockfile was regenerated, because pnpm's release-age policy rejected the stale 0.6.125 entry. The pnpm release-age exception was removed, since 0.6.104 is old enough. After the change the build prints no warning, and the gate script (lint, type-check, suite without the open outer files) -> 16 files, 312 passed, 0 failed.
- refactor: none needed
- commit: G1c
