# Tasks: Apply a base branch

**Input**: Design documents from `specs/015-apply-base-branch/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cli.md, quickstart.md

**Tests**: Mandatory. The constitution (principle V) makes every behavior change test first.
Every test is seen failing for the right reason before its implementation, and the failure goes in `tdd/cycle-log.md`.
A bracketed id such as `[U1501]` ties a task to a behavior in `tdd/test-list.md`.
Acceptance tests are written before the code they cover (the lesson of D-149).

**Organization**: Tasks are grouped by user story.
Commands run from the repository root.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Run `pnpm run check` on the clean branch and record in `specs/015-apply-base-branch/tdd/cycle-log.md` that the baseline is green and how long it takes.

## Phase 2: Foundational (blocks every story)

**Purpose**: The pure branch name check and the plan extension.

- [X] T002 [P] Write the tests in `src/limits/registry-apply.test.ts`: [U1501] `checkBranchName` is null for `main`, `release/1.0`, `feature/a_b-c`, and `v1.2`, and returns a reason for each of: empty, blank, leading space, trailing space, `-x`, `--x`, `a b`, a tab, a newline, `a..b`, `a~b`, `a^b`, `a:b`, `a?b`, `a*b`, `a[b`, `a\b`, `a@{b`, `a//b`, `/a`, `a/`, `a.`, `a.lock`, and `@` (table-driven); [U1502] `planApply` with `baseBranch: "main"` lists `baseBranch` in `changes` with the stored and target values, marks it changed only when it differs, omits it from `untouched`, and puts it in `next`; [U1503] `needsBaseBranch` is true for a `local-only` result with no base branch (stored none, no flag), false when a stored or given base branch exists, and false for `direct-PR` and `no-mistakes` with none; without the flag `untouched` still lists `baseBranch`. See them fail. Then add `checkBranchName`, the `baseBranch` input, and `needsBaseBranch` to `src/limits/registry-apply.ts`. Covers [U1501] [U1502] [U1503].

## Phase 3: User story 1 - Store the base branch while applying (P1)

**Goal**: `--base-branch <name>` stores the base branch, and merge and teardown stop refusing.

**Independent test**: [A1501] and [A1502] pass through the plugin factory.

- [X] T003 [US1] Write the acceptance tests in `test/acceptance/registry-apply-base-branch.test.ts` through `loadWorld` with `projectList`: [A1501] a `local-only` line applied with `--base-branch main` stores `local-only` and `main` in `project_config`, and the output lists `baseBranch: (none) -> main` as written; a stored `develop` becomes `main` with both values shown; [A1502] the bug reproduction: after an apply without the flag, `worktreeReport` and the local merge preflight (both fed the stored config) refuse with the "needs a base branch" message, and after an apply with the flag they do not. See them fail.
- [X] T004 [US1] Write [U1504] and [U1505] in `src/tools/supervisor-command.test.ts`: [U1504] the argument table: `--base-branch` without `--apply`, with no value, with a `--` value, given twice, each print the usage with exit 2 and read nothing; an invalid name exits 2, names the broken rule, and reads nothing; [U1505] with a valid name the output lists `baseBranch` under `written:` or `unchanged:`, and a rerun prints `Nothing was written.`. See them fail.
- [X] T005 [US1] Implement the flag in `parseImportArgs`, `importRegistry`, and `applyReport` in `src/tools/supervisor-command.ts`, and update the `IMPORT_USAGE` text. Covers [A1501] [A1502] [U1504] [U1505].

## Phase 4: User story 2 - Without the flag nothing changes, and the output says what is missing (P1)

- [X] T006 [US2] Write [A1503] in `test/acceptance/registry-apply-base-branch.test.ts`: without the flag the stored `baseBranch` stays (none or `develop`) and the output keeps `baseBranch: ... (not in the registry)`; a `local-only` result with no base branch prints the `Warning:` line, also on a rerun that writes nothing; no warning for `direct-PR` with no base branch, for `local-only` with a stored base branch, or after the flag. And [U1506] in `src/tools/supervisor-command.test.ts` for the exact warning text. See them fail, then add the warning to `applyReport`. Covers [A1503] [U1506].

## Phase 5: User story 3 - The flag refuses bad input before anything is read or written (P1)

- [X] T007 [US3] Write [A1504] in `test/acceptance/registry-apply-base-branch.test.ts`: a refusal table through the plugin with the flag present (usage errors, an invalid name, no registry line, a flagged line, an unknown bb project, a list failure) where each case leaves every store table identical (compare with a snapshot taken before the call). Write [A1505]: a rerun with the same flag leaves every table identical, and one `project_config` row differs after a first apply while `task`, `task_event`, and `approval` do not. Write [U1507] in `src/tools/supervisor-command.test.ts`: when `putProjectConfig` throws with the flag present, the config is unchanged and the exit code is 1. Covers [A1504] [A1505] [U1507].

## Phase 6: User story 4 - The docs and help match the behavior (P2)

- [X] T008 [US4] Write [A1506] in `test/acceptance/registry-apply-base-branch.test.ts` and `test/acceptance/live-check.test.ts`: the server's `import-registry` registration usage and the live-check expected flag list show `--base-branch`. Update `src/server.ts` and `test/acceptance/live-check.test.ts`. Covers [A1506].
- [X] T009 [US4] Write [A1507] in `test/acceptance/registry-apply-base-branch-docs.test.ts`: `docs/CUTOVER.md` shows `--base-branch`, says a `local-only` project needs it, and no longer says the base branch is never written; `docs/DECISIONS.md` has D-150 and D-037, D-078, and D-148 point to it. See it fail, then update `docs/CUTOVER.md`, `docs/DECISIONS.md` (D-150), `docs/LIVE-CHECK.md`, and `skills/factoryman-supervisor/SKILL.md`. Covers [A1507].

## Phase 7: Polish and cross-cutting

- [X] T010 Run `pnpm run check` and record the result in `tdd/cycle-log.md`.
- [X] T011 After `/speckit.tdd.verify`, run the deliberate mutants for the highest-risk behaviors (store the flag without validation, write `baseBranch` without the flag, drop the `local-only` warning, write on a no-op, skip the usage error without `--apply`) and record the result.
- [X] T012 Run the whole outer loop: [A1501] to [A1507] are green through their real entry points and `pnpm run check` passes. Record the result in `tdd/cycle-log.md`.

## Dependencies

- T001 first. T002 before T003 to T009 (the plan). T003 and T004 before T005. T006 to T009 after T005.
- T011 after the TDD run.

## Parallel opportunities

- T002 stands alone in Phase 2.
- T006, T007, and T009 touch different test files and can be written together once T005 is done. The implementation steps all edit `src/tools/supervisor-command.ts`, so they run in order.

## Implementation strategy

MVP is Phase 2 and Phase 3 (the pure check and the happy path).
Phases 4 to 6 then add the warning, the refusals, and the docs.

## Phase 8: TDD remediation

The verification in `tdd/verification.md` returned `FAIL`.
The feature is not done until findings 1 and 2 are cleared.
These tasks add tests and change no behavior of the command.

- [X] T013 Finding 1 (HIGH), `src/tools/supervisor-command.test.ts` `[U1504]` and `test/acceptance/registry-apply-base-branch.test.ts` `[A1504]`: add the call `import-registry --file <path> --base-branch main` (no `--apply`, no `--project`) to both tables, expecting the usage, exit 2, and no read. Proof: both files pass, and removing the `(baseBranch !== null && !apply)` clause in `parseImportArgs` makes them fail.
- [X] T014 Finding 2 (MEDIUM), `src/tools/supervisor-command.test.ts` `[U1504]` and `test/acceptance/registry-apply-base-branch.test.ts` `[A1504]`: add `--base-branch " main"` and `--base-branch "main "` to the refusal rows, expecting exit 2 and an unchanged store. Proof: both files pass, and trimming the value in `parseImportArgs` makes them fail.
