---
feature: 015-apply-base-branch
verdict: FAIL
standard: .specify/extensions/tdd/templates/tdd-test-quality-rubric.md
verified_at: 56fce92
behaviors: 14
proven: 14
likely: 0
test_after: 0
no_test: 0
not_applicable: 0
dropped: 0
high_smells: 0
criteria_total: 18
criteria_covered: 18
mutation_score: n/a (no mutation tool in the profile)
mutants_survived: 2 of 13 deliberate mutants (V2 and V9, findings 1 and 2)
suite: 2411 passed, 0 failed, 164 files, about 30 s (`pnpm test`)
---

# TDD verification: Apply a base branch

**Verdict: FAIL.** One deliberate mutant that removes the "`--base-branch` needs `--apply`" rule survived every test, so spec scenario 3.1 and FR-001 are not pinned for the call that has neither `--apply` nor `--project`.
Every other check held: all 18 spec scenarios have a test, every behavior has a recorded red and a test and its code in one commit, and no existing assertion was weakened.

**This audit was not independent.**
The session that wrote the tests also ran this audit.
It re-read the test files, the source, the history, and the log from disk, and it did not use a fresh-context subagent for the smell pass.
Treat the smell pass as one reader's, not two.

## Test-first evidence

| Behavior | Class | Evidence |
| --- | --- | --- |
| U1501 U1502 U1503 | PROVEN | Cycle 1: red `Tests  36 failed | 26 passed (62)`. Test and code are in commit bbc2a6f. |
| A1501 A1502 A1503 A1504 A1505, U1504 U1505 U1506 U1507 | PROVEN | Cycle 2: red `Tests  23 failed | 64 passed (87)`, tests written before the code. Test and code are in commit 4d3199d. Seven cases passed on their first run (see finding 3). |
| A1506 A1507 | PROVEN | Cycle 3: red `Tests  4 failed (4)`. Test and code are in commit 56fce92. |

The history cannot show that a test was written before its code inside one commit, so ordering rests on the log's recorded reds, which the history does not contradict (each commit holds both files, none holds code alone).
The lesson of D-149 held: no acceptance test was written after its code.

### Existing tests

- `test/acceptance/live-check.test.ts` `[A1109]`: the expected flag list of `import-registry` gained `--base-branch`. A changed requirement, a list widened by the new flag, and no assertion loosened.
- `src/limits/registry-apply.test.ts` and `src/tools/supervisor-command.test.ts` only gained appended tests and one import name.
- No test was skipped, filtered, renamed out of a filter, or given a lower threshold.

### tasks.md

T001 to T009 are ticked and each carries behavior ids that are `DONE` (T002 U1501 to U1503, T003 A1501 A1502, T004 U1504 U1505, T005 all of those, T006 A1503 U1506, T007 A1504 A1505 U1507, T008 A1506, T009 A1507). T010 to T012 carry no behavior id and are still open, as they should be. No ticked task lacks evidence.

## Findings

1. **HIGH, survivor V2.** `src/tools/supervisor-command.ts` `parseImportArgs` (`(baseBranch !== null && !apply)`): removing that clause leaves all 153 feature tests green.
   Every `--base-branch without --apply` case in `[U1504]` and `[A1504]` also passes `--project`, and `--project` without `--apply` is already a usage error, so the clause is never the reason for the refusal.
   The call `import-registry --file <path> --base-branch main` would then run the dry run and silently ignore the flag.
   Should assert: that call prints the usage, exits 2, and reads nothing (spec 3.1, FR-001).
2. **MEDIUM, survivor V9.** The command trims no value today, and no command-level test shows it.
   Replacing `args[i + 1]` with `(args[i + 1] as string).trim()` leaves every test green, so ` main` with a leading space would be accepted as `main`, against the spec ("surrounding space is a refusal, not trimmed").
   `[U1501]` covers the pure check with leading and trailing space, but nothing runs a spaced value through the command.
   Should assert: `--base-branch " main"` and `"main "` each exit 2 and store nothing.
3. **LOW, first-run passes.** Seven cases of cycle 2 (the usage-error rows of `[A1504]` and `[U1504]`) passed on their first run, because a usage error already exits 2 and writes nothing.
   Mutants V1, V7, V11, and V12 now kill the ones that matter, and findings 1 and 2 are the two that still escape.
4. **LOW, process.** The spec commit 3659ecc cited D-150 before `docs/DECISIONS.md` held it, so `[A1510]` (`decision-log.test.ts`) was red at that commit. It was green from commit bbc2a6f on. Recorded in cycle 1.
5. **LOW, docs tests by regular expression.** `[A1507]` reads documents with substring checks, as the existing `[A1910]` does. It follows the repository's own convention (exemplar `registry-apply-docs.test.ts`), so it is a note and not a defect.

## Mutation results

No mutation tool is in the profile. Thirteen deliberate mutants ran one at a time on the feature's files, each restored with `git checkout` and the suite re-run green (2411 passed).

| Id | Mutant | Result |
| --- | --- | --- |
| V1 | Skip the base branch name check in `importRegistry` | killed (7 failed) |
| V2 | Drop the `--base-branch` needs `--apply` clause | **survived** |
| V3 | Never print the warning | killed (2) |
| V4 | `needsBaseBranch` always false | killed (3) |
| V5 | Base branch always `changed` | killed (3) |
| V6 | Leave the base branch out of `next` | killed (7) |
| V7 | Drop the leading `-` rule | killed (4) |
| V8 | `needsBaseBranch` ignores the given value | killed (2) |
| V9 | Trim the flag value | **survived** |
| V10 | Always list `baseBranch` as untouched | killed (2) |
| V11 | Accept `--base-branch` twice | killed (2) |
| V12 | Accept `--base-branch` with no value | killed (2) |
| V13 | Swallow a write failure | killed (2) |

Sample: 13 mutants over the 4 highest-risk behaviors (the name check, the flag rules, the idempotent write, and the warning). It is not exhaustive. There is no equivalent-mutant judgment to make: both survivors are real gaps.

## Traceability

| Criterion | Tests |
| --- | --- |
| US1.1 to US1.3, US1.5 | A1501, U1502, U1505 |
| US1.4 | A1502 (real `worktreeReport` and merge preflight on a real git repository) |
| US2.1 to US2.4 | A1503, U1503, U1506 |
| US3.1 | U1504, A1504 (gap: finding 1) |
| US3.2 | U1504, A1504 |
| US3.3 | U1501, U1504, A1504 (gap: finding 2) |
| US3.4 | A1504 |
| US3.5 | U1507 |
| US4.1 to US4.4 | A1506, A1507 |

Every criterion reaches a test through the real entry point (`runCli` of the fake host) or the real consumers. No test traces to nothing.

## What was not audited

- Test speed beyond the suite total, and flakiness across repeated runs (no flaky failure was seen in the runs of this audit).
- A fresh-context smell pass.
- Mutation across the whole of `src/`; only the feature's two source files were mutated, and only by hand.
- How a real `bb factoryman import-registry` prints in a terminal. That is the owner's live check.

## Resolution

Findings 1 and 2 were cleared in cycle 4 (`tdd/cycle-log.md`) by adding the missing cases to `[U1504]` and `[A1504]`.
Mutants V2 and V9 now fail 2 and 4 tests, and the suite is green again (`pnpm run check`: 164 files, 2417 tests).
The two tests passed on their first run, so they are test-after, with the mutants as their proof; the cycle log says so.
The verdict above stays `FAIL` as the audit's own record at the time. `/speckit.converge` records the state after the fix.
