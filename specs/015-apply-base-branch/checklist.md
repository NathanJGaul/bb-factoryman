# Quality gates: Apply a base branch

**Purpose**: Record the quality gates for the finished change, with the evidence for each.
**Created**: 2026-11-12
**Feature**: [spec.md](spec.md)

A checked item has evidence that I ran or read in this worktree, on the tree at `e596ce3` plus this file.
An unchecked item names what is missing and who owns it.
This file is the evidence record of the change, written by the session that built it.
The requirements-quality checklist of the specification is a separate file, `checklists/requirements.md`.

## Build and static checks

- [x] CHK1501 `pnpm run typecheck` passes for `src/`, `test/`, and `tools/`.
      Evidence: `pnpm run check` exited 0 on the tree at `e596ce3`.
- [x] CHK1502 `pnpm run lint` passes, including the rule that keeps `src/machine/` free of bb imports.
      Evidence: `pnpm run check`; `git diff --stat c1ee439..HEAD -- src/machine` prints nothing. Lint found one `no-control-regex` error in cycle 1, fixed by checking code points.
- [x] CHK1503 `pnpm test` passes with no skipped test.
      Evidence: 164 files, 2417 tests, 0 failed, about 33 s (162 files and 2340 tests at the baseline). `grep -nE "\.(skip|only|todo)\b|xit\(|xdescribe"` over the new and changed test files prints nothing.
- [x] CHK1504 No dependency, config, or store interface changed.
      Evidence: `git diff --stat c1ee439..HEAD -- package.json pnpm-lock.yaml vitest.config.ts eslint.config.js tsconfig.json src/store src/machine src/validator` prints nothing.

## Hard rules and scope (FR-001 to FR-004, FR-006, FR-008)

- [x] CHK1510 The flag is owner-typed only: it needs `--apply --project`, and `workflow.json` still cannot set `baseBranch`.
      Evidence: `[U1504]` (five malformed calls, the call with neither `--apply` nor `--project`, and surrounding-space values, each exit 2 with nothing read), `[A1504]`; `src/workflow/config.ts` is unchanged (`git diff --stat c1ee439..HEAD -- src/workflow` prints nothing); mutants V2, V9, V11, and V12 killed.
- [x] CHK1511 A bad name is refused before the file is read and nothing is written.
      Evidence: `[U1501]` (29 cases), `[U1504]`, `[A1504]`; mutants V1 and V7 killed.
- [x] CHK1512 Without the flag nothing changes: the stored base branch stays, and the existing apply and dry-run tests pass without edits.
      Evidence: `[U1503]`, `[A1503]`, and the unchanged `[U1901]` to `[U1909]` and `[A1901]` to `[A1910]`; mutant V10 killed. The only edit to an existing test is the added `--base-branch` in the `[A1109]` flag list.
- [x] CHK1513 The apply writes one config row, and no event, approval, or task row changes, with the flag present too.
      Evidence: `[A1505]`; `[U1507]` for a failed write; mutant V13 killed.
- [x] CHK1514 The landed-work check and the merge preflight are unchanged, and a stored base branch now satisfies both.
      Evidence: `git diff --stat c1ee439..HEAD -- src/git` prints nothing; `[A1502]` runs the real `worktreeReport` and the local merge preflight on a real git repository, refused before and passing after.
- [x] CHK1515 No process runs and no bb state changes in the apply path.
      Evidence: the existing `[A1908]` and `[U1905]` still pass; `checkBranchName` is a pure function with no import.
- [x] CHK1516 Out of scope stayed out: no scout report file, no other finding, no `defaultMachine` or forge write, no inference of a base branch.
      Evidence: `git diff --stat c1ee439..HEAD` lists only the files named in `plan.md`.

## Behavior (FR-004, FR-005, FR-007)

- [x] CHK1520 The base branch is written from the flag, replaced when it differs, and unchanged when equal.
      Evidence: `[A1501]`, `[U1502]`, `[U1505]`; mutants V5 and V6 killed.
- [x] CHK1521 A rerun writes nothing and still shows the warning when a `local-only` project has no base branch.
      Evidence: `[A1503]`, `[A1505]`, `[U1506]`; mutants V3, V4, and V8 killed.

## Documents and help (FR-009)

- [x] CHK1530 The usage text, the command registration, and the live-check flag list show `--base-branch`.
      Evidence: `[U1504]` (usage), `[A1506]` (registration), `[A1109]` (live-check flags).
- [x] CHK1531 `docs/CUTOVER.md`, `docs/LIVE-CHECK.md`, the supervisor skill, and `docs/DECISIONS.md` (D-150; D-037, D-078, and D-148 point to it) describe the flag.
      Evidence: `[A1507]` (three tests); `test/acceptance/decision-log.test.ts` passes with the new heading.
- [x] CHK1532 The docs follow the style rules: one sentence per line, no em dash.
      Evidence: `grep -rn "—"` over `specs/015-apply-base-branch`, `docs/CUTOVER.md`, and the two changed source files prints nothing, and the added lines of `docs/DECISIONS.md` hold none.

## TDD discipline

- [x] CHK1540 Every behavior is `DONE` on the list, and tasks T001 to T014 are ticked.
      Evidence: `tdd/test-list.md`, `tasks.md`.
- [x] CHK1541 Every behavior has a red recorded before its code, except the two remediation cases.
      Evidence: `tdd/cycle-log.md` cycles 1 to 3. Cycle 4 admits that the two cases from verification findings 1 and 2 are test-after, with the surviving mutants as their proof.
- [x] CHK1542 Test strength was checked with deliberate mutants.
      Evidence: `tdd/verification.md`: 13 mutants, 2 survived, both killed after cycle 4.
- [ ] CHK1543 The live check in a real bb: `import-registry --apply --project ... --base-branch main` against a `local-only` lab project, run twice, then a scout teardown.
      Missing: not run in this lane (offline tests only). Owner: the owner, with the "The import apply" row of `docs/LIVE-CHECK.md` and case E-01 of the manual test plan.
- [ ] CHK1544 The `/speckit.tdd.verify` report still reads `FAIL` as the audit's record at the time.
      Missing: the audit was not independent and was not re-run after cycle 4. Its Resolution section and `converge.md` carry the current state. Owner: whoever reviews the pull request.
