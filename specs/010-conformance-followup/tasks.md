# Tasks: Conformance follow-up after the harness contracts landed

**Input**: Design documents from `specs/010-conformance-followup/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/driver-delivery-mode.md, quickstart.md, tdd/test-list.md

**Tests**: Mandatory. The constitution (principle V) makes every behavior change test first.
Every test is seen failing for the right reason before its implementation, and the failure goes in `tdd/cycle-log.md`.
A bracketed id such as `[U1501]` ties a task to a behavior in `tdd/test-list.md`.
`/speckit.tdd.run` ticks a task only when it can read an id from it.

**Organization**: Tasks are grouped by user story. Commands run from the repository root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: The user story in `spec.md` that the task serves.

## Phase 1: Setup

- [X] T001 Run `pnpm install --frozen-lockfile` and `pnpm run check` on the clean branch, and record in `specs/010-conformance-followup/tdd/cycle-log.md` that the baseline is green (tests, lint, type check) and how long it takes.
- [X] T002 Count the `bb-fake-plugin-host-*` directories directly under `${TMPDIR:-/tmp}` before and after one `pnpm run test`, and record both numbers in `tdd/cycle-log.md` as the leak baseline for SC-006.

## Phase 2: Foundational

No foundational task. The five user stories touch separate files and do not block each other.

## Phase 3: User story 1 - Pi runs in a mode the plugin admits (P1)

**Goal**: The runner builds the lab project with the driver's delivery mode, Pi names `direct-PR`, and S4 follows the mode.

**Independent test**: The tests below pass, and a live Pi run (T033) passes S2 to S8, S11, and S12.

### Tests for user story 1 (write first, see them fail)

- [X] T003 [P] [US1] Write the driver tests in `tools/conformance/drivers/drivers.test.ts` for `deliveryModeOf` and the driver values: [U1501] returns `local-only` for a driver that names none, [U1502] returns the mode a driver names, [U1503] Pi names `direct-PR`, [U1504] Claude Code, Codex, omp, and the stub name none.
- [X] T004 [P] [US1] Write the tests in `tools/conformance/lab-env.test.ts` for `projectRowScript(projectId, mode)`: [U1507] a `direct-PR` script carries the mode, the project ID, base branch `main`, and `yolo` 0, and no `local-only` literal; [U1508] a `local-only` script carries `local-only`.
- [X] T005 [P] [US1] Write the fake lab tests in `test/fixtures/conformance-lab.test.ts` (new): [U1514] the task mode comes from the driver and defaults to `local-only`; [U1515] a dispatch of a provider whose contract (`src/harness/contracts.ts`) refuses the project's mode is blocked with `provider_not_admitted` and no task; [U1516] a `direct-PR` ship task reaches `review_ready` with a pull request URL and stays `working` without one. The fake lab reads the real contract table.
- [X] T006 [US1] Write the S4 tests in `tools/conformance/scenarios/scenarios.test.ts`: [U1510] in `direct-PR`, S4 dispatches with the `pr=` flag, passes, and sets the mode note on `S4.review-ready`; [U1511] in `direct-PR` it fails `S4.review-ready` when no pull request is reported; [U1512] for a `no-mistakes` driver it fails and says S4 does not run in that mode; [U1513] the scenario title is "Ship" and names no mode. The existing [U1387] covers [U1509] and [U1517].
- [X] T007 [US1] Write the acceptance tests in `test/acceptance/conformance-tier15.test.ts` and `test/acceptance/conformance-docs.test.ts`: [A1501] Pi passes every scenario and exits 0 against a fake lab that refuses Pi in `local-only`; [A1502] Claude Code, Codex, and omp still pass with project mode `local-only`; [A1503] the Pi result file holds the S4 note and the other harnesses' S4 results hold none; [A1504] the generated document shows the `direct-PR` note next to Pi's S4 and the name "Ship".

### Implementation for user story 1

- [X] T008 [US1] Add the type `DeliveryMode`, the optional field `deliveryMode` on `Driver`, and `deliveryModeOf` to `tools/conformance/drivers/types.ts`, and set `deliveryMode: "direct-PR"` in `tools/conformance/drivers/pi.ts` with a comment that cites the Pi admission rule (D-111). Covers [U1501] [U1502] [U1503] [U1504].
- [X] T009 [US1] Add `projectRowScript` to `tools/conformance/lab-env.ts` and use it in `tools/conformance/real-lab.ts` in place of the inline `'local-only'` literal. Covers [U1507] [U1508].
- [X] T010 [US1] Make the fake lab in `test/fixtures/conformance-lab.ts` take the mode from the driver, refuse a provider in a mode its contract refuses, and require a pull request URL for `review_ready` in `direct-PR`. Covers [U1514] [U1515] [U1516].
- [X] T011 [US1] Make `tools/conformance/scenarios/s04-ship.ts` follow `deliveryModeOf(lab.driver)`: dispatch with `{ flag: "pr=https://github.com/conformance/lab/pull/1" }` in `direct-PR`, keep the three checks, add the note, rename the title to "Ship", and fix the doc comment. Covers [U1510] [U1511] [U1512] [U1513] and, with T008 to T010, [A1501] [A1502] [A1503] [A1504].
- [ ] T012 [US1] Update the S4 row and the "Add a harness" steps in `docs/CONFORMANCE.md`: name the `deliveryMode` field and say that S4 follows it.

## Phase 4: User story 2 - omp asks for a level its model lists (P1)

**Goal**: The omp profile dispatches in a real lab.

**Independent test**: The tests below pass, and a live omp run (T034) passes S2 to S8, S11, and S12.

- [X] T013 [P] [US2] Write the omp driver tests in `tools/conformance/drivers/drivers.test.ts`: [U1505] the profile names reasoning level `auto`; [U1506] the unsupported profile differs from the profile in the permission mode only.
- [X] T014 [US2] Teach the fake lab in `test/fixtures/conformance-lab.ts` to block a profile whose reasoning level the model does not list (omp lists `off` and `auto`) and to name the levels it lists, and write [U1518] in `test/fixtures/conformance-lab.test.ts`.
- [X] T015 [US2] Write the acceptance tests in `test/acceptance/conformance-tier15.test.ts`: [A1505] omp passes every scenario and exits 0 against that fake lab; [A1506] the unsupported profile is blocked with no task, and the block names the permission mode and not the reasoning level.
- [X] T016 [US2] Change `reasoningLevel` from `low` to `auto` in `tools/conformance/drivers/omp.ts`, and note in the comment that bb lists `off` and `auto` for the lab model (D-113 and D-114 describe the per-model check). Covers [U1505] [U1506] [U1518] [A1505] [A1506].

## Phase 5: User story 3 - A conformance run exits 0 when nothing is wrong (P1)

**Goal**: No run reports a stale gap.

**Independent test**: The tests below pass, and tier 1 exits 0 (T031).

- [X] T017 [P] [US3] Write the tests in `tools/conformance/gaps.test.ts` that read the real `conformance/known-gaps.json`: [U1519] it has no entry for S1.unready-blocks, S1.remedy, or S7.cause; [U1520] it still lists S9.start-command (all harnesses), S9.stamp-advice for codex, and S9.stamp-advice for omp, each with task `H4`.
- [X] T018 [US3] Write the acceptance tests in `test/acceptance/conformance-gaps.test.ts`: [A1507] `loadGaps` on the committed file returns exactly the three S9 entries; [A1508] `main` with tier 1 and the committed list against a fake lab where the S9 checks fail as in the real lab exits 0 and prints no stale gap.
- [X] T019 [US3] Remove the entries S1.unready-blocks, S1.remedy, and S7.cause from `conformance/known-gaps.json`. Covers [U1519] [U1520] [A1507] [A1508].

## Phase 6: User story 4 - The decision log has one entry per number (P2)

**Goal**: The log stays unique and its citations resolve.

**Independent test**: The guard passes on master, and the checker's own tests show it fails on a duplicate and on a dangling citation.

- [X] T020 [P] [US4] Write the checker tests in `test/fixtures/decision-log.test.ts` (new): [U1521] a heading number that appears twice is reported with both line numbers; [U1522] a citation whose number has no heading is reported with file and line; [U1523] unique headings and valid citations give no report.
- [X] T021 [US4] Write the guard in `test/acceptance/decision-log.test.ts` (new) over the real `docs/DECISIONS.md` and the tracked text files from `git ls-files`: [A1509] no duplicate heading number; [A1510] every cited `D-nnn` names a heading. Print the offending file and number on failure.
- [X] T022 [US4] Create the checker `test/fixtures/decision-log.ts` (pure functions over text). Covers [U1521] [U1522] [U1523] [A1509] [A1510].
- [ ] T023 [US4] Spot-check the citations of D-100 to D-117 outside `docs/DECISIONS.md` against their headings (done in planning: all fit) and record the evidence in `checklist.md`.

## Phase 7: User story 5 - The test suite leaves nothing behind in `/tmp` (P1)

**Goal**: No `bb-fake-plugin-host-*` directory outlives its test file.

**Independent test**: The child-process acceptance test passes, and the count of leaked directories after `pnpm run test` equals the count before.

### Tests for user story 5 (write first, see them fail)

- [X] T024 [P] [US5] Write the unit tests in `test/setup/private-tmpdir.test.ts` (new) for `createPrivateTmpdir` and its `restore`: [U1524] it makes a new directory inside the current temporary directory and points `TMPDIR` at it; [U1525] `restore` removes the directory with everything inside and puts the earlier `TMPDIR` back; [U1526] when `TMPDIR` was unset, `restore` unsets it; [U1527] `restore` removes only its own directory and leaves a sibling; [U1528] `restore` called twice does not throw.
- [X] T025 [US5] Create the fixtures `test/fixtures/leak/leaky.fixture.ts` (builds one host with `loadWorld` and one with `createFakePluginHost`, disposes neither) and `test/fixtures/leak/failing.fixture.ts` (a test that fails on purpose), and `test/fixtures/leak/vitest.config.ts` (lists both fixtures, and the setup file unless the environment variable `LEAK_WITHOUT_SETUP` is set, which the red phase uses).
- [X] T026 [US5] Write [A1511] in `test/acceptance/tmpdir-leak.test.ts` (new): start a child `vitest run --config test/fixtures/leak/vitest.config.ts` with `TMPDIR` set to a fresh private directory, wait, and expect no entry named `bb-fake-plugin-host-*` anywhere under it, even though a fixture test failed. The test also expects that the child ran both fixtures, so it cannot pass by running nothing. Record the red run (with `LEAK_WITHOUT_SETUP=1`) in `tdd/cycle-log.md`.

### Implementation for user story 5

- [X] T027 [US5] Create `test/setup/private-tmpdir.ts`: export `createPrivateTmpdir(env)` that makes `mkdtempSync(join(tmpdir(), "bb-factoryman-test-"))`, sets `env.TMPDIR` to it, and returns a `restore` that restores or unsets `TMPDIR` and removes the directory with `rmSync(dir, { recursive: true, force: true })`; and register `beforeAll` and `afterAll` hooks that call it. Covers [U1524] [U1525] [U1526] [U1527] [U1528].
- [X] T028 [US5] Add `setupFiles: ["test/setup/private-tmpdir.ts"]` to `vitest.config.ts`, and confirm that the main run does not collect the fixtures (they are not `*.test.ts`). Covers [A1511].
- [ ] T029 [US5] Run `pnpm run check` twice, and record the leaked-directory count before and after in `tdd/cycle-log.md` (A1512, SC-006).

## Phase 8: Live runs and results

**Purpose**: The only end-to-end proof for the lab changes (A1513, A1514). Run them one after another. Commit the code first, so the result files name the right plugin commit.

- [ ] T030 Commit the code and test changes of phases 3 to 7 in small commits (one concern each, no co-author line), and run `pnpm run check`.
- [ ] T031 [US6] Declare the wait (`paused`) and run tier 1: `pnpm run conformance -- --tier 1 --lab-dir /var/tmp/bblab-conformance-followup`. Expect exit 0, S9 as the only known gap, and a clean isolation check. The first run may need the network once, for the pinned bb and its toolchain. [A1513] [A1514]
- [ ] T032 [US6] Run `pnpm run conformance -- --tier 1.5 --harness claude-code --lab-dir /var/tmp/bblab-conformance-followup` and the same for `--harness codex`, and expect exit 0 for both. [A1513] [A1514]
- [ ] T033 [US1] Run the same for `--harness pi`. Expect S2 to S8, S11, and S12 to pass and the S4 note to read `direct-PR`. A failure that comes from `src/` is a finding: record it and do not change `src/`. [A1513] [A1514]
- [ ] T034 [US2] Run the same for `--harness omp`. Expect S2 to S8, S11, and S12 to pass, and the unsupported profile to be refused for its permission mode. [A1513] [A1514]
- [ ] T035 [US6] Run `pnpm run conformance:docs`, read `docs/HARNESS-SUPPORT.md`, and confirm that S9 is the only known gap and that no scenario failed.
- [ ] T036 [US6] Copy the five run logs and a one-line verdict table to `/home/nathanjgaul/Projects/firstmate/data/bb-factoryman-conformance-followup/`, and confirm that no lab process or listener remains.

## Phase 9: Decisions and documents

- [ ] T037 Record in `docs/DECISIONS.md` (D-118 onward) every decision of this feature: the driver-owned delivery mode and `direct-PR` for Pi with S4 following it (Q1 to Q3), the omp level `auto` (Q4), the guard instead of a renumbering with the finding that master was already consistent (Q5), the per-file temporary directory (Q6, Q7), and any deviation the live runs forced. Each entry names its source and keeps one sentence per line.
- [ ] T038 Add a note to `docs/CONFORMANCE.md` only if the runs changed how the suite is used (for example the lab-directory advice), and otherwise leave it.

## Phase 10: Lifecycle closing tasks

- [ ] T039 Run `/speckit.tdd.verify`, which writes `tdd/verification.md` (test-first evidence, test smells, deliberate mutants, acceptance coverage).
- [ ] T040 Run `/speckit.implement` for the tasks that no behavior covers (phases 8 and 9) and for the remediation tasks of the verification.
- [ ] T041 Run `/speckit.checklist`, which writes `checklist.md`.
- [ ] T042 Run `/speckit.analyze`, which writes `analyze.md`.
- [ ] T043 Run `/speckit.converge`, which writes `converge.md` with the verdict table of the five runs, the merge readiness, the risk, and any remaining work.
- [ ] T044 Run `pnpm run check` a last time, leave the worktree clean, commit, and append the `done` status line.

## Acceptance gates (one per acceptance behavior)

- [ ] T045 [US1] [A1501] [A1502] [A1503] [A1504] are green before user story 1 counts as complete.
- [ ] T046 [US2] [A1505] [A1506] are green before user story 2 counts as complete.
- [ ] T047 [US3] [A1507] [A1508] are green before user story 3 counts as complete.
- [ ] T048 [US4] [A1509] [A1510] are green before user story 4 counts as complete.
- [ ] T049 [US5] [A1511] is green, and [A1512] is measured, before user story 5 counts as complete.
- [ ] T050 [US6] [A1513] [A1514] are recorded from the live runs before user story 6 counts as complete.

## Dependencies and order

- T001 and T002 come first.
- The user story phases are independent. Run them in the order 3, 4, 5, 6, 7, or in parallel where the files differ (the `[P]` tasks).
- Within a story, the test tasks come before the implementation tasks.
- T025 before T026 before T027. T027 before T028.
- Phase 8 needs phases 3 to 7 committed (T030).
- T035 needs T031 to T034. T037 needs T033 and T034, because the live runs may force a deviation.
- Phase 10 comes last and in order.

## Parallel opportunities

- T003, T004, T005 touch different test files.
- T013, T017, T020, and T024 touch different files and different stories.

## Implementation strategy

- MVP: user story 1 plus the known-gap edit (US3), because those two turn tier 1 and the Pi run green.
- Then US2 (omp), US5 (the leak, which protects every later `pnpm run check`), and US4 (the guard).
- Run the live runs once, at the end, on committed code. A run costs about 30 minutes in all.
