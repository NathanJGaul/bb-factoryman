# Quality gates: Registry apply

**Purpose**: Record the quality gates for the finished change, with the evidence for each.
**Created**: 2026-11-10
**Feature**: [spec.md](spec.md)

A checked item has evidence that I ran or read in this worktree, on the tree at `ec6d795` plus this file.
An unchecked item names what is missing and who owns it.
This file is the evidence record of the change, written by the session that built it.
The requirements-quality checklist of the specification is a separate file, `checklists/requirements.md`.

## Build and static checks

- [x] CHK1401 `pnpm run typecheck` passes for `src/`, `test/`, and `tools/`.
      Evidence: `pnpm run check` exited 0 on the tree at `ec6d795`.
- [x] CHK1402 `pnpm run lint` passes, including the rule that keeps `src/machine/` free of bb imports.
      Evidence: `pnpm run check`; `git diff --stat 04d8272..HEAD -- src/machine` prints nothing.
- [x] CHK1403 `pnpm test` passes with no skipped test.
      Evidence: 162 files, 2340 tests, 0 failed, about 160 s (159 files and 2270 tests at the baseline). `grep -nE "\.(skip|only|todo)\b|xit\(|xdescribe"` over the new test files prints nothing.
- [x] CHK1404 The new tests leave no temporary directory behind.
      Evidence: `/tmp/bb-fake-plugin-host-*` was 1672 before and 1672 after a run of the four new test files, and no `factoryman-registry-apply-*` directory remained (cycle 7). A shared `/tmp` moves for other reasons, so this is a hand measurement and not a test (verification finding 9).
- [x] CHK1405 No dependency, config, or store interface changed.
      Evidence: `git diff --stat 04d8272..HEAD -- package.json pnpm-lock.yaml vitest.config.ts eslint.config.js tsconfig.json src/store src/machine src/validator` prints nothing.

## Hard rules and scope (FR-001 to FR-003, FR-006, FR-009, FR-011, FR-012)

- [x] CHK1410 The dry run is the default and its output did not change.
      Evidence: `[U1909]` pins the whole result byte for byte and was green against the untouched command (cycle 2); `[A1023]` checks a plain call and the store tables.
- [x] CHK1411 Apply writes one project only, and only with `--apply --project <name>`.
      Evidence: `[U1904]` (eight malformed calls, each exit 2 with nothing read or written), `[A1907]` (only one `project_config` row exists after an apply from an eight-project file); mutants "project without apply" and "apply without project" killed.
- [x] CHK1412 A flagged line is never written, and a bare `yolo` never turns the bypass on.
      Evidence: `[U1902]`, `[A1902]`, `[A1906]`; mutants "skip the flag check" and "flag threshold" killed.
- [x] CHK1413 Ambiguity and unknown projects refuse and write nothing, including a name inside a longer name.
      Evidence: `[U1902]`, `[U1907]`, `[A1906]`, `[A1907]`; mutants "no bb project ambiguity check", "no registry line ambiguity check", and the substring mutant V1 (a survivor before the remediation) are killed.
- [x] CHK1414 `baseBranch` and `defaultMachine` are never written.
      Evidence: `[U1901]`, `[U1903]`, `[U1905]`, `[A1904]`; mutant "clobber the stored base branch" killed.
- [x] CHK1415 No event, approval, or task row changes, the registry file is untouched, no process runs, and bb sees only `listProjects`.
      Evidence: `[A1908]` (tables, file bytes and modification time, `execCalls`, and the SDK calls made during the command); `[U1905]` (bb calls); mutant V8 (an extra bb write) fails both.
- [x] CHK1416 The state machine did not change, and a task keeps the mode it was created with.
      Evidence: `git diff --stat 04d8272..HEAD -- src/machine` prints nothing; `[A1909]`.
- [x] CHK1417 Out of scope stayed out: no task import, no cancel-queued-task tool, no tool hint, no real-model run.
      Evidence: `git diff --stat 04d8272..HEAD` lists no tool, validator, harness, or conformance file.

## Behavior (FR-007, FR-008, FR-010, FR-013, FR-014)

- [x] CHK1420 The three fields are written from the line, with the conditional policy mapped and its note printed, and an empty prefix stored as none.
      Evidence: `[A1901]`, `[A1903]` (three tests), `[U1901]`; mutants "mode always no-mistakes", "yolo always on", and "empty prefix not null" killed.
- [x] CHK1421 A rerun writes nothing and prints every field as unchanged.
      Evidence: `[A1905]` (three tests), `[U1903]`, `[U1906]` (a spy on `putProjectConfig`); mutants "write on a no-op" and "drop the no-op line" killed.
- [x] CHK1422 A failed write leaves the stored config unchanged and exits 1.
      Evidence: `[U1908]` at the command function with the memory store. Not through the plugin with a failing SQLite store (D-149, verification finding 12).

## Documents and help (FR-015, FR-016)

- [x] CHK1430 The usage text, the command registration, and the live-check flag list show the new flags.
      Evidence: `[U1904]` (usage text), `[U1910]` (registration), `[A1109]` (live-check flags).
- [x] CHK1431 `docs/CUTOVER.md`, `docs/LIVE-CHECK.md`, the supervisor skill, and `docs/DECISIONS.md` (D-148, D-149; D-078 and D-088 point to D-148) describe the apply path.
      Evidence: `[A1910]` (three tests); `test/acceptance/decision-log.test.ts` passes with the new headings.
- [x] CHK1432 The docs follow the style rules: one sentence per line, no em dash.
      Evidence: `grep -n "—"` over `specs/014-registry-apply`, `docs/CUTOVER.md`, `src/limits/registry-apply.ts` prints nothing.

## TDD discipline

- [x] CHK1440 Every behavior is `DONE`, `BASELINE`, or `DROPPED` on the list, and tasks T001 to T024 are ticked except T015, which this lifecycle closes.
      Evidence: `tdd/test-list.md`, `tasks.md`.
- [ ] CHK1441 Every behavior has a red recorded before its code.
      Missing: `[A1901]` to `[A1909]` were written after the code (verification finding 1, D-149). Owner: the owner decides on the waiver.
- [ ] CHK1442 The live check in a real bb: `import-registry --apply --project` against a lab project, run twice.
      Missing: not run in this lane (offline tests only, per the task). Owner: the owner, with the "The import apply" row of `docs/LIVE-CHECK.md`.
