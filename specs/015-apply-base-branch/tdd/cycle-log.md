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
