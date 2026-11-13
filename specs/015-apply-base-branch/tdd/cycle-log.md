# Cycle log: Apply a base branch

Append only. Newest last. Every entry's `red` block is the evidence that the test existed and failed before the implementation.

## Baseline

- suite: `pnpm test` -> 162 files, 2340 tests passed, 0 failed (about 30 s)
- commit: `c1ee439`
- recorded: cycle 0, before any change

## Cycle 1: U1501, U1502, U1503 the branch name check and the plan extension (one group, 36 test cases)

- test: `src/limits/registry-apply.test.ts` `[U1501]` (29 cases), `[U1502]` (2), `[U1503]` (6)
- red: `pnpm vitest run src/limits/registry-apply.test.ts` with no change to `registry-apply.ts` -> `TypeError: checkBranchName is not a function` (29 cases), `expected undefined to be false` for `needsBaseBranch` and failed `baseBranch` change lookups; `Tests  36 failed | 26 passed (62)`
- green: `checkBranchName`, the `baseBranch` input, and `needsBaseBranch` added to `registry-apply.ts`. `pnpm vitest run src/limits/registry-apply.test.ts` -> 62 passed
- suite: `pnpm test` -> 162 files, 2377 tests passed
- note: the first full run failed `[A1510]` (`test/acceptance/decision-log.test.ts`), because the spec commit 3659ecc and this code cite D-150 before `docs/DECISIONS.md` had it. That commit was made with the suite red on this one existing check; the D-150 heading, added in this cycle's commit, fixes it. Recorded as a deviation.
- note: lint rejected a control-character regular expression (`no-control-regex`), so `hasForbiddenCharacter` uses code points instead. No test changed.
- refactor: none needed

## Cycle 2: A1501 to A1505 and U1504 to U1507 the flag through the command (one group, 23 failing cases)

- test: `test/acceptance/registry-apply-base-branch.test.ts` `[A1501]` to `[A1505]` (16 cases) and `src/tools/supervisor-command.test.ts` `[U1504]` to `[U1507]` (14 cases), written before any change to `supervisor-command.ts`
- red: `pnpm vitest run test/acceptance/registry-apply-base-branch.test.ts src/tools/supervisor-command.test.ts` -> `Tests  23 failed | 64 passed (87)`. Decisive lines: `AssertionError: expected 2 to be +0` (the apply with `--base-branch` was a usage error), `expected 'Usage: bb factoryman import-registry …' to match /whitespace/` (no name check), and `[U1506]` and `[A1503]` without the warning. Seven of the 30 new cases passed on the first run because a usage error already exits 2 and writes nothing (the `--base-branch` refusals in `[A1504]` and part of `[U1504]`); mutants in task T011 prove they now test the new rules.
- green: flag parsing, the name check, `baseBranch` pass-through to `planApply`, the warning, and the usage text in `src/tools/supervisor-command.ts`. 87 passed in both files.
- note: `[A1502]` first failed on an error in the test itself (`unpushedCommits` 0, because the checkout was on `main` while `worktreeReport` ran). The test was corrected to read the report on the task branch. The code was not changed for it.
- suite: `pnpm test` -> 163 files, 2407 tests passed. `pnpm exec eslint src test` and `tsc6 --noEmit` clean.
- refactor: none needed

## Cycle 3: A1506, A1507 the help and the documents (one group, 4 failing cases)

- test: `test/acceptance/registry-apply-base-branch-docs.test.ts` `[A1506]` (1) and `[A1507]` (3), and the expected flag list of `import-registry` in `test/acceptance/live-check.test.ts` `[A1109]` (now lists `--base-branch`, a changed requirement, no assertion weakened)
- red: `pnpm vitest run test/acceptance/registry-apply-base-branch-docs.test.ts` -> `Tests  4 failed (4)`. Decisive lines: `expected 'bb factoryman import-registry --file …' to contain '--apply --project <name> [--base-branch <name>]'`, `expected '# Cutover from firstmate...' to contain '--apply --project <name> --base-branch <branch>'`, `D-037: expected ' Nothing writes a project config yet …' to contain 'D-150'`, `expected '# Live check runbook...' to contain '--base-branch'`
- green: usage and summary in `src/server.ts`, `docs/CUTOVER.md`, pointers in `docs/DECISIONS.md` (D-037, D-078, D-148), `docs/LIVE-CHECK.md`, and the supervisor skill. 4 passed.
- note: the full run then failed two existing tests that pin the documents' shape (`[A1108]` counts the live-check rows, `[A1116]` rejects an unknown quoted name in the skill). The new live-check text went into the existing apply row, and the skill names the flag inside a `bb factoryman ...` command. Neither test changed.
- note: D-150's own text was added in cycle 1 (see its note), so only the three pointers were red here.
- suite: `pnpm test` -> 164 files, 2411 tests passed. `eslint .` and `tsc6 --noEmit` clean.
- refactor: none needed
