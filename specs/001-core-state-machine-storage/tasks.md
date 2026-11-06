---

description: "Task list for core scaffold, task state machine, and event storage"
---

# Tasks: Core scaffold, task state machine, and event storage

**Input**: Design documents from `specs/001-core-state-machine-storage/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are mandatory (constitution principle V). Every test task precedes the implementation task it drives, and every test must be seen failing first.

**Organization**: Tasks group by user story. User story 1 is milestone 1, user story 2 is milestone 2, and user story 3 is milestone 3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task belongs to (US1, US2, US3)
- Each task names the exact file path

## Phase 1: Setup (toolchain only, no behavior)

**Purpose**: Give the repository a test stack so `/speckit.tdd.setup` can verify it. These tasks add configuration and no feature behavior.

- [x] T001 Create `package.json` (name, scripts, exact SDK pin, dev dependencies) and `pnpm-workspace.yaml` at the repository root
- [x] T002 [P] Create `tsconfig.json` and `vitest.config.ts` at the repository root
- [x] T003 [P] Create baseline `eslint.config.js` without the isolation rule at the repository root
- [x] T004 [P] Create `.gitignore` at the repository root
- [x] T005 Run `pnpm install` and commit `pnpm-lock.yaml`
- [x] T006 Write the dependency smoke test in `test/toolchain.test.ts` (xstate and zod import; `better-sqlite3` opens an in-memory database)
- [ ] T007 Run `/speckit.tdd.setup` to write `.specify/memory/tdd-profile.md`

**Checkpoint**: The suite runs green with the smoke test, and the profile exists.

---

## Phase 2: User story 1 - Scaffold a loadable, lintable plugin (Priority: P1) - milestone 1

**Goal**: A loadable empty plugin, a manifest, and a lint rule that keeps bb imports out of `src/machine/`.

**Independent test**: `pnpm test`, `pnpm run lint`, and `pnpm run typecheck` pass. A fixture import of `@get-bb/*` under `src/machine/` fails lint.

### Tests for user story 1 (write first, watch fail)

- [ ] T010 [P] [US1] Manifest test in `test/acceptance/manifest.test.ts` (package name, `bb.server`, exact SDK pin, scripts, `build` calls `bb plugin build`)
- [ ] T011 [P] [US1] Layout test in `test/acceptance/layout.test.ts` (required directories exist, no later-milestone directories)
- [ ] T012 [P] [US1] Plugin load test in `test/acceptance/plugin.test.ts` (fake host loads, registers nothing, disposes)
- [ ] T013 [P] [US1] Lint isolation test in `test/acceptance/lint-isolation.test.ts` (restricted imports fail under `src/machine/`, pass elsewhere)

### Implementation for user story 1

- [ ] T014 [US1] Add the `bb` manifest block, `engines`, and keywords to `package.json`
- [ ] T015 [P] [US1] Create the empty plugin factory in `src/server.ts` and the empty `src/machine/` and `src/store/` directories
- [ ] T016 [US1] Add the `no-restricted-imports` override for `src/machine/**` to `eslint.config.js`
- [ ] T017 [US1] Create `docs/DECISIONS.md` with the milestone 1 entries (bb CLI missing, manifest keys, tooling versions)
- [ ] T018 [US1] Commit milestone 1

**Checkpoint**: User story 1 passes on its own.

---

## Phase 3: User story 2 - Enforce the delivery contract in a pure state machine (Priority: P2) - milestone 2

**Goal**: `createTask` and `transition` refuse every illegal move with a reason code.

**Independent test**: The table-driven suite shows every illegal state and event pair is refused, including merge without approval and teardown with unlanded work.

### Tests for user story 2 (write first, watch fail)

- [ ] T020 [P] [US2] Vocabulary and event schema tests in `src/machine/events.test.ts`
- [ ] T021 [P] [US2] Guard unit tests in `src/machine/guards.test.ts` (both sides of every boundary)
- [ ] T022 [P] [US2] Table consistency tests in `src/machine/table.test.ts` (against a hand-written legal set)
- [ ] T023 [US2] Transition facade tests in `src/machine/transition.test.ts` (purity, no throw, no mutation, refusal order)
- [ ] T024 [P] [US2] Exhaustive state-by-event matrix in `test/acceptance/machine-matrix.test.ts` (SC-001)
- [ ] T025 [P] [US2] Hard-rule acceptance tests in `test/acceptance/machine-gates.test.ts` (AC-2.1 to AC-2.12)

### Implementation for user story 2

- [ ] T026 [P] [US2] Define vocabulary and context types in `src/machine/types.ts`
- [ ] T027 [P] [US2] Define reason codes and `Refusal` in `src/machine/refusal.ts`
- [ ] T028 [US2] Define event schemas in `src/machine/events.ts`
- [ ] T029 [US2] Implement the named guards in `src/machine/guards.ts`
- [ ] T030 [US2] Define the ship and scout transition tables in `src/machine/table.ts`
- [ ] T031 [US2] Generate the xstate machines in `src/machine/machines.ts`
- [ ] T032 [US2] Implement `createTask` and `transition` in `src/machine/transition.ts`
- [ ] T033 [US2] Record machine deviations and open questions in `docs/DECISIONS.md`
- [ ] T034 [US2] Commit milestone 2

**Checkpoint**: User stories 1 and 2 pass on their own.

---

## Phase 4: User story 3 - Survive restarts with an append-only event log (Priority: P3) - milestone 3

**Goal**: An event log, a task cache, replay, rebuild, recovery, and reconcile behind one store interface.

**Independent test**: A test destroys the task cache and rebuilds identical rows from the log. Both stores pass one contract suite.

### Tests for user story 3 (write first, watch fail)

- [ ] T040 [P] [US3] Shared store contract suite in `test/store-contract.ts`
- [ ] T041 [P] [US3] In-memory store contract run in `src/store/memory.test.ts`
- [ ] T042 [P] [US3] SQLite store contract run and trigger tests in `src/store/sqlite.test.ts`
- [ ] T043 [P] [US3] Task log tests in `src/store/task-log.test.ts` (atomicity, refusal logging, unknown task)
- [ ] T044 [P] [US3] Replay, rebuild, and recovery tests in `src/store/replay.test.ts`
- [ ] T045 [P] [US3] Reconcile tests in `src/store/reconcile.test.ts`
- [ ] T046 [US3] Restart and rebuild acceptance tests in `test/acceptance/store-restart.test.ts` (AC-3.1 to AC-3.9, SC-003 random walk)

### Implementation for user story 3

- [ ] T047 [P] [US3] Define row types in `src/store/types.ts` and the interface in `src/store/store.ts`
- [ ] T048 [US3] Implement the in-memory store in `src/store/memory.ts`
- [ ] T049 [US3] Implement the SQLite store and schema in `src/store/sqlite.ts`
- [ ] T050 [US3] Implement `TaskLog` in `src/store/task-log.ts`
- [ ] T051 [US3] Implement replay, rebuild, and recovery in `src/store/replay.ts`
- [ ] T052 [US3] Implement reconcile in `src/store/reconcile.ts`
- [ ] T053 [US3] Record storage deviations in `docs/DECISIONS.md`
- [ ] T054 [US3] Commit milestone 3

**Checkpoint**: All three user stories pass.

---

## Phase 5: Polish and lifecycle

- [ ] T060 Run `/speckit.tdd.verify` and fix its findings
- [ ] T061 Run `/speckit.implement` for any remaining non-behavior tasks
- [ ] T062 Run `/speckit.checklist`, `/speckit.analyze`, and `/speckit.converge`
- [ ] T063 Run the full gate (`pnpm run check`) and leave the worktree clean

---

## Dependencies and order

- Phase 1 blocks everything.
- User story 1 comes before user story 2 because the lint rule must exist before machine code lands.
- User story 2 comes before user story 3 because the task log runs the machine.
- Inside a story, a test task runs before its implementation task.
- Each milestone commit comes after that story's checkpoint.
