---

description: "Task list for core scaffold, task state machine, and event storage"
---

# Tasks: Core scaffold, task state machine, and event storage

**Input**: Design documents from `specs/001-core-state-machine-storage/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, tdd/test-list.md

**Tests**: Tests are mandatory (constitution principle V). Every test task precedes the implementation task it drives, and every test must be seen failing first. The bracketed ids (`[A1]`, `[U16]`) are behavior ids from `tdd/test-list.md`.

**Organization**: Tasks group by user story. User story 1 is milestone 1, user story 2 is milestone 2, and user story 3 is milestone 3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task belongs to (US1, US2, US3)
- **[A1], [U1]**: The behavior ids the task covers
- Each task names the exact file path

## Phase 1: Setup (toolchain only, no behavior)

**Purpose**: Give the repository a test stack so `/speckit.tdd.setup` can verify it. These tasks add configuration and no feature behavior.

- [x] T001 Create `package.json` (name, scripts, exact SDK pin, dev dependencies) and `pnpm-workspace.yaml` at the repository root
- [x] T002 [P] Create `tsconfig.json` and `vitest.config.ts` at the repository root
- [x] T003 [P] Create baseline `eslint.config.js` without the isolation rule at the repository root
- [x] T004 [P] Create `.gitignore` at the repository root
- [x] T005 Run `pnpm install` and commit `pnpm-lock.yaml`
- [x] T006 Write the dependency smoke test in `test/toolchain.test.ts` (xstate and zod import; `better-sqlite3` opens an in-memory database)
- [x] T007 Run `/speckit.tdd.setup` to write `.specify/memory/tdd-profile.md`

**Checkpoint**: The suite runs green with the smoke test, and the profile exists.

---

## Phase 2: User story 1 - Scaffold a loadable, lintable plugin (Priority: P1) - milestone 1

**Goal**: A loadable empty plugin, a manifest, and a lint rule that keeps bb imports out of `src/machine/`.

**Independent test**: `pnpm test`, `pnpm run lint`, and `pnpm run typecheck` pass. A fixture import of `@get-bb/*` under `src/machine/` fails lint.

### Tests for user story 1 (write first, watch fail)

- [x] T010 [P] [US1] [A2] [A5] Manifest test in `test/acceptance/manifest.test.ts` (package name, `bb.server`, exact SDK pin, `build` calls `bb plugin build`)
- [x] T011 [P] [US1] [A1] Plugin load test in `test/acceptance/plugin.test.ts` (fake host loads, registers nothing, disposes)
- [x] T012 [P] [US1] [U9] Layout test in `test/acceptance/layout.test.ts` (required directories exist, no later-milestone directories)
- [x] T013 [P] [US1] [A3] [A4] [U1] [U2] [U3] [U4] Lint isolation test for bb imports in `test/acceptance/lint-isolation.test.ts`
- [x] T014 [US1] [U5] [U6] [U7] [U8] Lint purity tests for non-bb imports in `test/acceptance/lint-isolation.test.ts`

### Implementation for user story 1

- [x] T015 [US1] [A2] [A5] Add the `bb` manifest block, `engines`, and keywords to `package.json`
- [x] T016 [P] [US1] [A1] Create the empty plugin factory in `src/server.ts`
- [x] T017 [P] [US1] [U9] Create `src/machine/` and `src/store/` with placeholder files
- [x] T018 [US1] [A3] [A4] [U1] [U2] [U3] [U4] Add the `@get-bb/*` `no-restricted-imports` override for `src/machine/**` to `eslint.config.js`
- [x] T019 [US1] [U5] [U6] [U7] [U8] Extend the override with `better-sqlite3`, `node:*`, and `src/store` patterns
- [x] T020 [US1] Create `docs/DECISIONS.md` with the milestone 1 entries (bb CLI missing, manifest keys, tooling versions, TDD sequencing)
- [x] T021 [US1] Confirm [A1] to [A5] are green and commit milestone 1

**Checkpoint**: User story 1 passes on its own.

---

## Phase 3: User story 2 - Enforce the delivery contract in a pure state machine (Priority: P2) - milestone 2

**Goal**: `createTask` and `transition` refuse every illegal move with a reason code.

**Independent test**: The table-driven suite shows every illegal state and event pair is refused, including merge without approval and teardown with unlanded work.

### Tests for user story 2 (write first, watch fail)

- [x] T030 [US2] [A6] [A7] [A8] [A9] [A10] [A11] [A12] [A13] [A14] [A15] [A16] [A17] Write the outer-loop acceptance tests in `test/acceptance/machine-gates.test.ts` and `test/acceptance/machine-matrix.test.ts` with fixtures in `test/fixtures/machine.ts`; they stay red until the units land
- [x] T031 [P] [US2] [U10] [U11] [U12] [U13] [U14] [U15] Event schema tests in `src/machine/events.test.ts`
- [x] T032 [US2] [U10] [U11] [U12] [U13] [U14] [U15] Define vocabulary, reason codes, and event schemas in `src/machine/types.ts`, `src/machine/refusal.ts`, and `src/machine/events.ts`
- [x] T033 [P] [US2] [U16] [U17] [U18] Guard tests for evidence, profile, and actor in `src/machine/guards.test.ts`
- [x] T034 [US2] [U16] [U17] [U18] Implement the evidence, profile, and actor guards in `src/machine/guards.ts`
- [x] T035 [US2] [U19] [U20] [U21] [U22] Guard tests for mode, ready check, pipeline, and scope in `src/machine/guards.test.ts`
- [x] T036 [US2] [U19] [U20] [U21] [U22] Implement the mode, ready, pipeline, and scope guards in `src/machine/guards.ts`
- [x] T037 [US2] [U23] [U24] [U25] Guard tests for merge, promotion, and worktree in `src/machine/guards.test.ts`
- [x] T038 [US2] [U23] [U24] [U25] Implement the merge, promotion, and worktree guards in `src/machine/guards.ts`
- [x] T039 [P] [US2] [U26] [U27] [U28] [U29] Table and machine tests in `src/machine/table.test.ts`
- [x] T040 [US2] [U26] [U27] [U28] [U29] Define the transition tables in `src/machine/table.ts` and generate the xstate machines in `src/machine/machines.ts`
- [x] T041 [P] [US2] [U30] [U31] [U32] [U33] [U34] [U35] Facade tests for `createTask` and `transition` basics in `src/machine/transition.test.ts`
- [x] T042 [US2] [U30] [U31] [U32] [U33] [U34] [U35] Implement `createTask` and the `transition` facade in `src/machine/transition.ts`
- [x] T043 [US2] [U36] [U37] [U38] Facade tests for guard order, `start`, and completion events in `src/machine/transition.test.ts`
- [x] T044 [US2] [U36] [U37] [U38] Implement the guard order and context assignments in `src/machine/transition.ts` and `src/machine/machines.ts`
- [x] T045 [US2] [U39] [U40] [U41] Facade tests for approvals and yolo merge in `src/machine/transition.test.ts`
- [x] T046 [US2] [U39] [U40] [U41] Implement approval recording in `src/machine/machines.ts`
- [x] T047 [US2] [U42] [U43] Facade tests for promotion in `src/machine/transition.test.ts`
- [x] T048 [US2] [U42] [U43] Implement promotion in `src/machine/machines.ts` and `src/machine/transition.ts`
- [x] T049 [US2] [U44] [U45] Facade tests for `fail` and `teardown` in `src/machine/transition.test.ts`
- [x] T050 [US2] [U44] [U45] Confirm `fail` and `teardown` behavior in `src/machine/machines.ts`
- [x] T051 [US2] [U46] Facade test for the fail-closed cross-check in `src/machine/transition.test.ts`
- [x] T052 [US2] [U46] Add the cross-check and its test seam in `src/machine/transition.ts`
- [x] T053 [US2] Record machine deviations and open questions in `docs/DECISIONS.md`
- [x] T054 [US2] Confirm [A6] to [A17] are green and commit milestone 2

**Checkpoint**: User stories 1 and 2 pass on their own.

---

## Phase 4: User story 3 - Survive restarts with an append-only event log (Priority: P3) - milestone 3

**Goal**: An event log, a task cache, replay, rebuild, recovery, and reconcile behind one store interface.

**Independent test**: A test destroys the task cache and rebuilds identical rows from the log. Both stores pass one contract suite.

### Tests for user story 3 (write first, watch fail)

- [x] T060 [US3] [A18] [A19] [A20] [A21] [A22] [A23] [A24] [A25] [A26] Write the outer-loop acceptance tests in `test/acceptance/store-restart.test.ts` and `test/acceptance/store-contract.test.ts`; they stay red until the units land
- [x] T061 [P] [US3] [U47] [U48] [U49] [U50] [U51] [U52] [U53] [U54] [U55] Shared store contract suite in `test/store-contract.ts` run by `src/store/memory.test.ts`
- [x] T062 [US3] [U47] [U48] [U49] [U50] [U51] [U52] [U53] [U54] [U55] Define row types and the `Store` interface, and implement the in-memory store, in `src/store/types.ts`, `src/store/store.ts`, and `src/store/memory.ts`
- [x] T063 [P] [US3] [U56] [U57] [U58] [U59] [U60] SQLite tests and the contract run in `src/store/sqlite.test.ts`
- [x] T064 [US3] [U56] [U57] [U58] [U59] [U60] Implement the SQLite store and schema in `src/store/sqlite.ts`
- [x] T065 [P] [US3] [U61] [U62] [U63] [U64] [U65] [U66] Task log tests for create, apply, refusal, and approvals in `src/store/task-log.test.ts`
- [x] T066 [US3] [U61] [U62] [U63] [U64] [U65] [U66] Implement `TaskLog` in `src/store/task-log.ts`
- [x] T067 [US3] [U67] [U68] [U69] [U70] Task log tests for atomicity, clock, log-as-input, and unreadable input in `src/store/task-log.test.ts`
- [x] T068 [US3] [U67] [U68] [U69] [U70] Complete `TaskLog` atomicity, clock, and input handling in `src/store/task-log.ts`
- [x] T069 [P] [US3] [U71] [U72] [U73] [U74] [U75] Replay tests in `src/store/replay.test.ts`
- [x] T070 [US3] [U71] [U72] [U73] [U74] [U75] Implement `replayTask` in `src/store/replay.ts`
- [x] T071 [US3] [U76] [U77] [U78] [U79] Rebuild and recovery tests in `src/store/replay.test.ts`
- [x] T072 [US3] [U76] [U77] [U78] [U79] Implement `rebuildCache` and `recover` in `src/store/replay.ts`
- [x] T073 [US3] [U80] Seeded random-walk test in `test/acceptance/store-random-walk.test.ts`
- [x] T074 [US3] [U80] Fix any divergence the random walk exposes in `src/store/`
- [x] T075 [P] [US3] [U81] [U82] [U83] [U84] [U85] [U86] Reconcile tests in `src/store/reconcile.test.ts`
- [x] T076 [US3] [U81] [U82] [U83] [U84] [U85] [U86] Implement `reconcile` in `src/store/reconcile.ts`
- [x] T077 [US3] Record storage deviations in `docs/DECISIONS.md`
- [x] T078 [US3] Confirm [A18] to [A26] are green and commit milestone 3

**Checkpoint**: All three user stories pass.

---

## Phase 5: Polish and lifecycle

- [ ] T090 Run `/speckit.tdd.verify` and fix its findings
- [ ] T091 Run `/speckit.implement` for any remaining non-behavior tasks
- [ ] T092 Run `/speckit.checklist`, `/speckit.analyze`, and `/speckit.converge`
- [ ] T093 Run the full gate (`pnpm run check`) and leave the worktree clean

---

## Dependencies and order

- Phase 1 blocks everything.
- User story 1 comes before user story 2 because the lint rule must exist before machine code lands.
- User story 2 comes before user story 3 because the task log runs the machine.
- Inside a story, a test task runs before its implementation task.
- Each outer-loop acceptance test is green before its story counts as complete (T021, T054, T078).
- Each milestone commit comes after that story's checkpoint.
