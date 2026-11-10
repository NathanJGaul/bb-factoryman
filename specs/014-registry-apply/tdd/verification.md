---
feature: 014-registry-apply
verdict: FAIL
standard: .specify/extensions/tdd/templates/tdd-test-quality-rubric.md
verified_at: 45822ba
behaviors: 21
proven: 10
likely: 0
test_after: 9
no_test: 0
not_applicable: 1
dropped: 1 # proposed: A1911, see finding 9
high_smells: 1
criteria_total: 30
criteria_covered: 30
mutation_score: n/a (no mutation tool in the profile)
mutants_survived: 1 of 16 deliberate mutants (V1, finding 2)
suite: 2331 passed, 0 failed, 162 files, 156 s (`pnpm run check`)
---

# TDD verification: Registry apply

**Verdict: FAIL.** Nine acceptance behaviors (A1901 to A1909) were written after the code they test, and one deliberate mutant (a substring name match in `planApply`) survived every test.
Every other check held: all 30 spec scenarios have a test, the dry-run output is pinned byte for byte, and no existing assertion was loosened.

**This audit was not independent.**
The session that wrote the tests also ran this audit.
It re-read every file from disk and judged them against the rubric, and it did not use a fresh-context subagent for the smell pass.
Treat the smell pass as one reader's, not two.

## Test-first evidence

The history is one commit per cycle group, with the test and its code in the same commit (the repository's commit-at-green rule, D-099).
The cycle log carries the reds.
The log and the history agree: no log entry claims a red that the history contradicts.
Cycle 3's commit `2f292cf` left one existing acceptance test (`[A1023]`) red on purpose; the next commit replaced it.
That is a commit on a red suite and it is reported here (finding 10).

| Behaviors | Class | Evidence |
| --- | --- | --- |
| U1901, U1902, U1903 | PROVEN | cycle 1: `TypeError: planApply is not a function`, 22 failed; `ee12d6d` adds tests and code together |
| U1904 to U1908 | PROVEN | cycle 3: 18 failed with the old refusal and exit codes; `2f292cf` |
| U1910 | PROVEN | cycle 5: `AssertionError` on the old usage; `45822ba` |
| A1910 | PROVEN | cycle 6: 3 failed before the documents changed; `45822ba` |
| U1909 | NOT_APPLICABLE | characterization, green against untouched code (cycle 2); a mutant check is below |
| A1901 to A1909 | TEST_AFTER | cycle 4: written after the code, 13 of 16 passed at once; the other 3 failed on errors in the tests themselves. Nine mutants kill them. The deviation is recorded in D-149. |
| A1911 | DROPPED (proposed) | a one-time measurement by hand, not a behavior (finding 9) |

Totals: 10 PROVEN, 9 TEST_AFTER, 1 NOT_APPLICABLE, 1 proposed DROPPED (21 rows).

### Tests that existed before the feature

I diffed the feature's range against `04d8272` (removed lines only).

| File and test | Before | After | Judgment |
| --- | --- | --- | --- |
| `src/tools/supervisor-command.test.ts` `[U1030]` | with `--apply` and a file: exit 2, stderr matches `/dry run/`, no file read | the three assertions are gone; the usage, missing-file, and unreadable-file checks stay | The rule changed (FR-001, D-148). The exit 2, the usage text, and "reads nothing" are now pinned for the three malformed apply calls by `[U1904]` (8 cases), which is stricter. Superseded, not weakened. |
| `test/acceptance/limits-cutover.test.ts` `[A1023]` | `--apply` alone: exit 2, stderr `/dry run/`, no table on stdout | the same call: exit 2, stderr names `--apply --project <name>`, no table, and every store table is unchanged; a plain dry run is also checked | Same shape, with the store comparison added. Superseded. |
| `test/acceptance/live-check.test.ts` `[A1109]` | `import-registry` flags: `--file`, `--apply` | adds `--project` | A longer allowed list. It lets a live-check call use the new flag, so it is looser by one flag, and that is what the feature adds. The test still fails for any other flag. |
| `test/acceptance/live-check.test.ts` `[A1108]` | the tier 0 row labels | adds `The import apply` | A longer exact list. |

A removed assertion is a `FAIL` condition when it is a weakening.
These removals are the pins on a refusal that the spec reverses.
The reader should still check the table above, because the rubric does not allow the auditor to waive it silently.
`vitest.config.ts`, `eslint.config.js`, `package.json`, and `tsconfig.json` did not change.

### Task checkboxes against the list

- T001 to T013 are ticked and their behaviors are `DONE` or `BASELINE`. T012 (the profile note) and T013 (`[A1911]`) are done: the note is in `.specify/memory/tdd-profile.md`, and the leak check is in cycle 7.
- T014 and T015 are open on purpose. T014 is this audit's mutants (below). T015 closes after the remediation.
- No behavioral task is unticked with its behavior `DONE`.

## Findings

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | HIGH | Nine behaviors are test-after: no red was recorded before the code that satisfies them (A1901 to A1909). Each is shown able to fail by deliberate mutants (cycle 4: nine mutants, all killed). The rubric fails the feature for it. D-149 records the deviation, and the owner decides whether to waive it, as in D-099 and D-144. | `tdd/cycle-log.md` cycle 4; `test/acceptance/registry-apply.test.ts` |
| 2 | HIGH | A mutant survived inside a `DONE` behavior: V1 changes `same()` to a substring match (`a.includes(b)`) and all 94 tests pass. With it, `--project gadgets` would match the registry line and the bb project `prod gadgets` too, or pick the wrong one of two. No test has a name that contains another name. This is the safety rule of D-148 ("exactly one project, found by name"). | `src/limits/registry-apply.ts:27`; `src/limits/registry-apply.test.ts` `[U1902]` |
| 3 | HIGH | Conditional logic in a test: `if (result.ok) return;` follows `expect(result.ok).toBe(false)`, so the later assertions on `code` and `message` are skipped on a run where the first assertion failed. It cannot hide a failure (the first `expect` throws), but the rubric fixes the severity. Replace the guard with a narrowing helper that throws. | `src/limits/registry-apply.test.ts:62` |
| 4 | MED | FR-012 ("no bb method that changes state") is pinned only for `threads.spawn` and for `execCalls`. A change that called another bb write would pass. Assert that the fake bb port saw `listProjects` and nothing else. | `test/acceptance/registry-apply.test.ts` `[A1908]`; `src/tools/supervisor-command.test.ts` `[U1905]` |
| 5 | MED | The spec edge case "`--file` given twice: the last wins, as today" has no test. | `spec.md` edge cases; `[U1904]` |
| 6 | MED | `[A1903]` and `[A1905]` each exercise three or four behaviors with unlabelled assertions (eager test, assertion roulette), so a failure does not say which rule broke. | `test/acceptance/registry-apply.test.ts` `[A1903]`, `[A1905]` |
| 7 | MED | `[A1906]` compares the down-world's tables with a freshly loaded world's tables and not with its own snapshot, which is an odd baseline (two empty worlds compare equal for any reason). | `test/acceptance/registry-apply.test.ts:173` |
| 8 | LOW | The test list says `spec_criteria: 38`. The spec has 30 acceptance scenarios (8, 3, 10, 2, 3, 4). | `tdd/test-list.md` frontmatter |
| 9 | LOW | A1911 (no temporary directory leaks) is a hand measurement and not a test: the count of a shared `/tmp` moved between runs for reasons outside the feature (3159, then 1672). The list should drop it with that reason. | `tdd/cycle-log.md` cycle 7 |
| 10 | LOW | Commit `2f292cf` left `[A1023]` red in the suite. The next commit fixed it. The cycle log notes it; the commit rule says never to commit on red. | `git log` |
| 11 | LOW | `registryFile`, `cli`, and a table dump are copied from `limits-cutover.test.ts` into the new acceptance file (duplicated setup). The repository has no shared helper for them. | `test/acceptance/registry-apply.test.ts:10-30` |
| 12 | LOW | The write-failure refusal (spec 3.10) is tested only at the command function (`runFactorymanCommand` with the memory store), which is the CLI handler. No test through the plugin factory makes the real SQLite store fail. | `[U1908]` |

Checked and clean: no assertion-free test, no snapshot, no skipped or empty test, no credential, no real clock, random value, or sleep in a test, no `.only`, and no instruction addressed to an auditor in any file.
The output-text assertions (`written:`, `unchanged:`, `Nothing was written.`) are coupled to wording, but the wording is the contract in `contracts/cli.md`, so I did not count them as implementation-coupled.

## Mutation results

The profile has no mutation tool, so the evidence is deliberate mutants.
Each mutant changes one thing, runs the four feature test files (94 tests), and is restored with `git checkout`.
The audited tree was clean before and after (`git status` empty).

| Mutant | Behavior | Survived | Killed by |
| --- | --- | --- | --- |
| skip the flag check | U1902 | No | `[U1902]`, `[A1902]`, `[A1906]` |
| `yolo` always on | U1901 | No | 11 tests |
| write on a no-op | U1903 | No | `[U1903]`, `[U1906]` |
| no bb project ambiguity check | U1902 | No | `[U1902]`, `[U1907]`, `[A1906]` |
| no registry line ambiguity check | U1902 | No | `[U1902]`, `[U1907]`, `[A1906]` |
| clobber the stored base branch | U1901 | No | `[U1901]`, `[U1903]`, `[U1905]`, `[A1904]` |
| `--project` without `--apply` accepted | U1904 | No | `[U1904]`, `[A1907]` |
| `--apply` without `--project` accepted | U1904 | No | `[U1904]`, `[A1907]` |
| empty prefix stored as `""` | U1901 | No | `[U1901]`, `[U1903]`, `[A1903]` |
| V1 substring name match | U1902 | **Yes** | none (94 passed) |
| V2 swallow the bb list error | U1907 | No | `[U1907]`, `[A1906]` |
| V3 drop `Nothing was written.` | U1906 | No | `[U1906]`, `[A1905]` |
| V4 write twice | U1908 | No | `[U1908]` (the failing write throws on the first call) |
| V5 accept `--file` with a flag as its value | U1904 | No | `[U1030]` |
| V6 mode always `no-mistakes` | U1901 | No | 11 tests |
| V7 flag threshold: ignore a single flag | U1902 | No | `[U1902]`, `[A1902]`, `[A1906]` |

Sampled behaviors: the refusals, the field mapping, idempotence, and the argument rules.
Not sampled: the output wording beyond the two sentences above, the document tests, and `[U1909]` (checked below).
`[U1909]` mutant: the cycle log's pin is a full-string equality, so any change to the dry-run text fails it; I did not run a separate mutant.
Mutants sampled: 16. Survived: 1 (V1). Coverage was not measured (the profile has no coverage tool).

## Traceability

| Criterion | Tests | End to end |
| --- | --- | --- |
| US1.1 to US1.8 | `A1901` to `A1904`, `U1901`, `U1905` | Yes (plugin factory) |
| US2.1 to US2.3 | `A1905`, `U1903`, `U1906` | Yes |
| US3.1, US3.2, US3.9 | `U1904`, `A1907` | Yes |
| US3.3 to US3.8 | `A1906`, `U1902`, `U1907` | Yes |
| US3.10 | `U1908` | Command function only (finding 12) |
| US4.1 | `U1909`, `A1023` | Yes |
| US4.2 | `U1910`, `U1904`, `A1109` | Yes |
| US5.1 to US5.3 | `A1908`, `A1909` | Yes |
| US6.1 to US6.4 | `A1910` | Yes (tracked documents) |

Untested statements: the `--file` twice edge case (finding 5). Tests tracing to nothing: none.
Every `traces` value in the list resolves to a spec id.
The edge case "a name with leading or trailing space" has no test either, because the dry run's name trimming is `parseRegistry`'s and is pinned by `[U1022]`.

## What was not audited

- The look of the command's output in a real terminal and a real `bb`: the fake host cannot show it. The live check (`docs/LIVE-CHECK.md`, "The import apply") is the owner's step.
- Mutation across the whole repository: no tool. Only the files this feature changed were sampled.
- Performance and load: no criterion, no test.
- Real SQLite failure paths (finding 12) and a registry file with thousands of lines.
- Independence: this audit was done by the author's session.

## Addendum: after the remediation (`/speckit.implement`, tasks T016 to T024)

Re-checked at the head of the remediation commit.

| Finding | State | Evidence |
| --- | --- | --- |
| 1 (HIGH, test-after) | Open: waiver pending | D-149 records the deviation. Sixteen mutants now stand in for the missing reds. The verdict stays `FAIL` under the rubric until the owner waives it. |
| 2 (HIGH, survivor V1) | Cleared | `[U1902]` (two rows and the exact-name test) and `[A1907]`; V1 now fails 4 tests |
| 3 (HIGH, `if` in a test) | Cleared | `refusalOf` throws instead of returning; `src/limits/registry-apply.test.ts` |
| 4 (MED) | Cleared | `[U1905]` and `[A1908]` assert that bb saw `listProjects` and nothing else; mutant V8 fails both |
| 5 (MED) | Cleared | `[U1904]` for `--file` twice; mutant V9 fails it |
| 6 (MED) | Cleared | `[A1903]` and `[A1905]` split into three tests each |
| 7 (MED) | Cleared | `[A1906]` compares with the down-world's own snapshot |
| 8, 9 (LOW) | Cleared | `spec_criteria: 30`; `A1911` dropped with its reason |
| 10 (LOW) | Stays | a note in history and in the cycle log; a commit cannot be changed |
| 11 (LOW) | Stays | the helpers are file-local copies as before; the repository has no shared one |
| 12 (LOW) | Recorded | D-149 states the limit |

Suite after the remediation: `pnpm run check` -> type check and lint clean, 162 files, 2340 tests passed (about 160 s).
Mutants sampled across the audit and the remediation: 19. Survived now: 0.
Only finding 1 is blocking, and it needs the owner's waiver.
