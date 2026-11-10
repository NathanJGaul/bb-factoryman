# Tasks: Registry apply

**Input**: Design documents from `specs/014-registry-apply/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cli.md, quickstart.md, tdd/test-list.md

**Tests**: Mandatory. The constitution (principle V) makes every behavior change test first.
Every test is seen failing for the right reason before its implementation, and the failure goes in `tdd/cycle-log.md`.
A bracketed id such as `[U1901]` ties a task to a behavior in `tdd/test-list.md`.
`/speckit.tdd.run` ticks a task only when it can read an id from it.

**Organization**: Tasks are grouped by user story.
The pure plan comes first (foundational), because the command and every acceptance test use it.
Commands run from the repository root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: The user story in `spec.md` that the task serves.

## Phase 1: Setup

- [X] T001 Run `pnpm install --frozen-lockfile` and `pnpm run check` on the clean branch, and record in `specs/014-registry-apply/tdd/cycle-log.md` that the baseline is green (tests, lint, type check) and how long it takes. Count the `bb-fake-plugin-host-*` directories directly under `${TMPDIR:-/tmp}` before and after one `pnpm run test`, as the leak baseline for [A1911].

## Phase 2: Foundational (blocks every story)

**Purpose**: The pure plan that every story uses.

- [X] T002 [P] Write the plan tests in `src/limits/registry-apply.test.ts`: [U1901] a clean entry gives a plan whose three changes hold the stored and target values of `deliveryMode`, `yolo`, and `branchPrefix`, with an empty prefix as `null`, `no-mistakes-prod-only` as `no-mistakes`, and `untouched` listing `baseBranch` and `defaultMachine` with their stored values; [U1902] the refusal table: no entry (`no_entry`), two entries with the same name (`ambiguous_entry`), a flagged entry for an unknown mode, an unexpected token, an unclosed bracket, and a bare `yolo` (`flagged`), no bb project (`unknown_project`), two bb projects with the same name in any letter case (`ambiguous_project`), and a case-insensitive match that succeeds (table-driven); [U1903] `next` is null when every field equals the target, each change flags `changed` only when its values differ, a stored `yolo` on with an entry that has none changes to off, and `next` keeps the stored `baseBranch` and `defaultMachine`. Then add `src/limits/registry-apply.ts` with `planApply`. Covers [U1901] [U1902] [U1903].

## Phase 3: User story 1 - Copy one project's registry settings into its stored config (P1)

**Goal**: `--apply --project <name>` writes one project's config and says what it wrote.

**Independent test**: [A1901] to [A1904] pass through the plugin factory.

- [X] T003 [US1] Write the acceptance tests in `test/acceptance/registry-apply.test.ts` through `loadWorld` with `projectList`: [A1901] a `direct-PR branch=wip/` line for `gizmos` writes `direct-PR`, `yolo` off, and `wip/` to `proj-gizmos` and the output lists the written fields; [A1902] `+yolo` writes `yolo` on, and a bare `yolo` line writes nothing and exits 1; [A1903] `no-mistakes-prod-only` writes `no-mistakes` and the output prints the note; a line with no bracket writes `no-mistakes` with `yolo` off; `branch=` writes a null prefix; `forge=gerrit` writes and prints that the forge is not stored; [A1904] a stored `baseBranch` and `defaultMachine` stay and are listed as unchanged. See them fail.
- [X] T004 [US1] Write the unit tests in `src/tools/supervisor-command.test.ts`: [U1904] the argument table: `--apply` without `--project`, `--project` without `--apply`, `--project` twice, `--project` with no value or a `--` value, an unknown flag, and a stray argument each print the usage with exit 2 and read nothing; [U1905] an apply writes the config, prints `Applied registry line`, lists `written:` and `unchanged:`, and reads only the registry file; replace the two `--apply` refusal assertions in the existing `[U1030]` test with the new truth. See them fail.
- [X] T005 [US1] Implement the flags, the apply flow, and the output in `importRegistry` in `src/tools/supervisor-command.ts`: parse `--apply` and `--project`, read the file, list the bb projects, call `planApply`, and write `next` with `putProjectConfig` inside `store.transaction`. Update the `USAGE` text. The dry run path keeps its current code and text. Covers [A1901] [A1902] [A1903] [A1904] [U1904] [U1905].

## Phase 4: User story 2 - A rerun changes nothing (P1)

**Goal**: The same command twice leaves the store identical.

- [X] T006 [US2] Write [A1905] in `test/acceptance/registry-apply.test.ts`: a second run leaves every table identical and prints every field as unchanged and `Nothing was written.`; a stored config that differs in one field changes only that field; a stored `yolo` on with a line that has none is turned off. And [U1906] in `src/tools/supervisor-command.test.ts`: a no-op run calls `putProjectConfig` zero times (a spy on the store). See them fail, then make them pass in `src/tools/supervisor-command.ts`. Covers [A1905] [U1906].

## Phase 5: User story 3 - The command refuses before it writes (P1)

**Goal**: Every refusal leaves the store identical.

- [X] T007 [US3] Write [A1906] in `test/acceptance/registry-apply.test.ts`: a refusal table through the plugin (no registry line for the name, two lines, a flagged line of each kind, no bb project, two bb projects, a bb list failure, a missing file) where each case exits 1, names the reason, and leaves every table of the store identical; and [A1907] with eight projects in the file and one named, only the named project's row is written. See them fail.
- [X] T008 [US3] Write [U1907] in `src/tools/supervisor-command.test.ts`: each refusal exits 1 with a message that holds the reason and the project name, a list failure logs a warning, and a flagged refusal prints the line's flags; and [U1908]: when `putProjectConfig` throws, the stored config is unchanged, the exit code is 1, and the message says the write failed (use a store wrapper that throws, and the memory store to check the rollback). See them fail, then make them pass in `src/tools/supervisor-command.ts`. Covers [A1906] [A1907] [U1907] [U1908].

## Phase 6: User story 4 - The dry run is the default and does not change (P1)

- [X] T009 [US4] Write [U1909] in `src/tools/supervisor-command.test.ts`: the dry-run output for the existing registry fixture is byte-identical to a pinned copy of today's output (take the pin from the current code before any edit, in `tdd/cycle-log.md`), and the dry run with `--file` alone never calls `putProjectConfig`. It passes at once (a characterization test of unchanged behavior); record that in the cycle log. Then write [U1910] in `src/server.test.ts`: the registration of `import-registry` shows `--apply` and `--project <name>` in its usage. See [U1910] fail, then update the registration in `src/server.ts`, the `allowedFlags` of `import-registry` in `test/acceptance/live-check.test.ts` (add `--project`), and the usage line in `src/tools/supervisor-command.ts`. Covers [U1909] [U1910].

## Phase 7: User story 5 - The apply touches only one config row (P1)

- [X] T010 [US5] Write [A1908] in `test/acceptance/registry-apply.test.ts`: after a successful apply, exactly one `project_config` row differs, and `task`, `task_event`, and `approval` are identical; the registry file's bytes and modification time are unchanged; `execCalls` is empty; and the bb fake saw no call that changes state. And [A1909]: a task created before the apply keeps its mode, and a task created after uses the new mode. See them fail or pass as the code allows; if one passes at once, record that it is a characterization test and mutate the code to prove it can fail. Covers [A1908] [A1909].

## Phase 8: User story 6 - The docs match the behavior (P2)

- [X] T011 [US6] Write [A1910] in `test/acceptance/registry-apply-docs.test.ts`: `docs/CUTOVER.md` shows `--apply --project`, no longer says the apply path is a follow-up, and still says tasks, approvals, and history are not imported and that firstmate is untouched; `docs/DECISIONS.md` has `### D-148` and D-078 and D-088 each mention `D-148`; `docs/LIVE-CHECK.md` no longer says `--apply` is refused; `skills/factoryman-supervisor/SKILL.md` names `--apply --project`. See it fail. Then edit the four files and add D-148. Covers [A1910].

## Phase 9: Polish and cross-cutting

- [X] T012 Update `.specify/memory/tdd-profile.md` notes (the new test files and the suite size) and run `pnpm run check`; record the result in `tdd/cycle-log.md`. [A1911] counts the `bb-fake-plugin-host-*` directories again and compares with the T001 baseline.
- [X] T013 Write [A1911] in `test/acceptance/registry-apply.test.ts` (or in the cycle log when no test can hold it): the new tests leak no temporary directory beyond the T001 baseline. Covers [A1911].
- [ ] T015 Run the whole outer loop: [A1901] to [A1910] are green through their real entry points before the feature is reported done, and `pnpm run check` passes. Record the result in `tdd/cycle-log.md`.
- [ ] T014 After `/speckit.tdd.verify`, run the deliberate mutants for the highest-risk behaviors (write without `--project`, write a flagged line, turn `yolo` on from a bare token, write a second project, skip the ambiguity check, write on a no-op) and record which test fails for each, in `tdd/verification.md`.

## Dependencies

- T001 first. T002 before T003 to T011 (the plan). T003 to T005 before T006 to T010 (the flow). T011 anytime after T005.
- T014 after the TDD run.

## Parallel opportunities

- T002 is the only task that stands alone in Phase 2.
- T006, T007, and T009 touch different test files or sections and can run together once T005 is done, except that all of them edit `src/tools/supervisor-command.ts` in the end, so the implementation steps run in order.

## Implementation strategy

MVP is Phase 2 and Phase 3 (the pure plan and the happy path).
Phases 4 to 8 then add the rerun, the refusals, the dry-run pin, the isolation checks, and the docs.

## Phase 10: TDD remediation

The verification of `tdd/verification.md` returned `FAIL`.
The feature is not done until the owner waives finding 1 (the test-after acceptance tests, recorded as D-149) and findings 2 and 3 are cleared.
These tasks change tests and the list, and they change no behavior of the command.

- [ ] T016 Finding 2 (HIGH), `src/limits/registry-apply.ts:27` and `src/limits/registry-apply.test.ts` `[U1902]`: add a case where the `--project` name is a substring of another registry name and of another bb project name (`gadgets` against `prod gadgets`), and expect the exact match to win and the other project's row to stay as stored; add the same through the plugin in `test/acceptance/registry-apply.test.ts` `[A1907]`. Proof: the V1 mutant (`includes` in `same`) fails the new test, and `pnpm vitest run src/limits/registry-apply.test.ts test/acceptance/registry-apply.test.ts` passes on the real code.
- [ ] T017 Finding 3 (HIGH), `src/limits/registry-apply.test.ts:62`: replace `if (result.ok) return;` with a helper that throws unless the result is a refusal, as `planOf` does for a plan. Proof: `pnpm vitest run src/limits/registry-apply.test.ts` passes and `pnpm run typecheck` is clean.
- [ ] T018 Finding 4 (MED), `test/acceptance/registry-apply.test.ts` `[A1908]` and `src/tools/supervisor-command.test.ts` `[U1905]`: assert that the fake bb port's calls are `listProjects` and nothing else. Proof: both tests pass, and a mutant that calls `bb.setThreadMetadata` in the apply fails them.
- [ ] T019 Finding 5 (MED), `src/tools/supervisor-command.test.ts`: add a test that `--file a --file b` reads `b` only, and that `--apply` twice is accepted. Proof: `pnpm vitest run src/tools/supervisor-command.test.ts` passes.
- [ ] T020 Finding 6 (MED), `test/acceptance/registry-apply.test.ts` `[A1903]` and `[A1905]`: split each into one test per behavior (conditional policy, no bracket, empty prefix and forge; rerun, one differing field, yolo off), reusing the file's helpers. Proof: `pnpm vitest run test/acceptance/registry-apply.test.ts` passes with the new test count.
- [ ] T021 Finding 7 (MED), `test/acceptance/registry-apply.test.ts:173`: take a snapshot of the down-world's own tables before the call and compare with it. Proof: the file passes.
- [ ] T022 Findings 8, 9, and 10 (LOW), `tdd/test-list.md`: set `spec_criteria: 30`, mark `A1911` `DROPPED` with the reason (a hand measurement in a shared `/tmp`; cycle 7), and remove it from `tasks.md` T013's claim. The commit on red stays in the history; the note stays in the log.
- [ ] T023 Finding 12 (LOW): record in `docs/DECISIONS.md` D-149 that the write-failure path is tested at the command function only, and why. Proof: `pnpm vitest run test/acceptance/decision-log.test.ts` passes.
- [ ] T024 Finding 1: write D-149 in `docs/DECISIONS.md` (the nine acceptance behaviors were written after the code, and nine mutants stand in for their reds). The owner decides whether to waive it. Do not report the feature done as clean until Firstmate relays the answer or the report says plainly that the waiver is pending.
