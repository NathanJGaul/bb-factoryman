---
feature: 010-conformance-followup
verdict: FAIL
standard: .specify/extensions/tdd/templates/tdd-test-quality-rubric.md
verified_at: 5055faa
behaviors: 43
proven: 35
likely: 0
test_after: 4
no_test: 0
not_applicable: 4
high_smells: 0
criteria_total: 18
criteria_covered: 18
mutation_score: 71 # scope: the 10 production and fixture files that this feature changed, 14 hand-made mutants, no mutation tool in the profile
mutants_survived: 4 # M9, M11, M12 need a test; M7b is dead code
suite: 141 files, 1835 passed, 0 failed, about 31 s
---

# TDD verification: Conformance follow-up after the harness contracts landed

**Verdict: FAIL.** Four behaviors (U1506, U1509, U1529, A1509) have no recorded red, because the behavior was already true when its test was written, and three mutants survive in code that finished behaviors rely on (M9, M11, M12).
Discipline is otherwise good: 35 of 43 behaviors have a recorded red and a test in the same commit as the code, no pre-existing test was weakened, no smell of `HIGH` severity exists, and every acceptance scenario of the spec has a test or a recorded live run.

The audit was not independent in the sense the rubric asks for: the session that wrote the tests ran it.
It re-read every file from disk and sent the smell pass to a fresh-context subagent (read-only, no suite run, no mutant).
Each finding it reported was checked against the cited line before it entered this report.

## Test-first evidence

The history shows each group of tests and its code in the same commit (groups were committed at green, as `D-099` describes), so the commit order cannot prove a test came first.
The cycle log carries the red command and the failure line for each group, and the history agrees with it: the red runs name stubs and tests that exist in the commit that turned them green.

| Behavior | Class | Evidence |
| --- | --- | --- |
| U1501 to U1504, U1507, U1508 | PROVEN | group 1 red (6 failures, assertion lines recorded); commit `14854dd` holds tests and code |
| U1505, U1510 to U1516, U1518, A1501 to A1506 | PROVEN | group 2 reds: seven existing tests went red when the fake lab learned the plugin's rules, then 17 new tests failed on assertions; commit `b65c46f` |
| U1519, U1520, A1507, A1508 | PROVEN | group 3 red (4 failures); commit `dc5a1fd` |
| U1521 to U1523, A1510 | PROVEN | group 4 red (3 stub failures; A1510 went red on a real citation of a decision not yet written); commit `f179478` |
| U1524 to U1528, A1511 | PROVEN | group 5 red (5 unit failures against a stub, one leak found in the child process with an empty setup file); commit `06b107f` |
| U1506 | TEST_AFTER | passed on its first run (the omp driver already had that shape). A killing mutant is recorded (`cycle-log.md`, correction to group 2) |
| U1509 | TEST_AFTER | passed on its first run (S4 in `local-only` is the old path). Its first mutant survived, then the fake lab learned the plugin's rule and the same mutant was killed (group 2) |
| U1529 | TEST_AFTER | passed on its first run (Pi already named `direct-PR` after group 1). Killing mutant recorded (group 2, step 1) |
| A1509 | TEST_AFTER | passed on its first run (the log was already unique). Killing mutant recorded (group 4) |
| U1517 | NOT_APPLICABLE | the unchanged `local-only` ship path in the fake lab, covered by the existing U1387 |
| A1512, A1513, A1514 | NOT_APPLICABLE | live measurement and live runs, with evidence in `cycle-log.md` and the five result files |

**What the diff did to existing tests**: nothing that weakens them.
`git diff 3b827b8..HEAD` removes two import lines (`drivers.test.ts:4` and `lab-env.test.ts:5`), each replaced by a superset import.
No assertion was removed or loosened, no test was skipped, renamed, or excluded, and the only change to `vitest.config.ts` is the added `setupFiles` line.
The seven existing tests that went red when the fake lab learned the rules (U1383, U1387, U1388, U1406, U1424, A1308, A1313) went green without an edit.

**Tasks against the list**: every task ticked `[X]` names behaviors that are `DONE` (T003 to T028, T045 to T050) or is a task with no behavior (T001, T002, T012, T025, T029 to T037), and each of those has its evidence in the cycle log.
No behavioral task is open while its behavior is `DONE`.

## Findings

Ordered by severity.
Nothing is `HIGH` by the smell catalogue.
The `FAIL` comes from the rubric's rule on `TEST_AFTER` and from the survivors below.

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | HIGH (rubric: `TEST_AFTER`) | Four behaviors have no recorded red: U1506, U1509, U1529, A1509. Each passed on its first run because its behavior was already true. Each has a killing mutant on record, and U1509 got a stronger fake lab because its first mutant survived. | `tdd/cycle-log.md`, groups 1 to 4 and the correction note |
| 2 | MED | Mutant M9 survives: removing the fake lab rule that refuses a `local-only` report with a pull request and no commits fails no test. U1509 depends on that rule to catch an S4 that always sends `pr=`, so U1509 is vacuous against that bug if the rule goes. | `test/fixtures/conformance-lab.ts` (the `local-only` and `pr=` block); mutant run: 46 passed |
| 3 | MED | Mutant M11 survives: swapping the first two column names of the `INSERT` in `projectRowScript` fails no test. U1507 and U1508 assert substrings of the SQL text and never read the row back. | `tools/conformance/lab-env.test.ts:73-75`; `tools/conformance/lab-env.ts` (`projectRowScript`) |
| 4 | MED | Mutant M12 survives: removing `setupFiles` from the root `vitest.config.ts` fails no test, and the leak comes back unseen. A1511 runs the child on its own config, which lists the setup file. Only the manual measure A1512 covers the root config. FR-012 (cover a test file written later) rests on this line. | `vitest.config.ts:10`; `test/acceptance/tmpdir-leak.test.ts:28-37`; mutant run: 6 passed |
| 5 | LOW | Mutant M7b survives: the `process.once("exit", ...)` line in the setup file does nothing that a test can see (M7, which removes `afterAll`, is caught, so `afterAll` does the work). The line is untested and unneeded for the covered paths. | `test/setup/private-tmpdir.setup.ts:8` |
| 6 | MED | A1506 asserts the fake lab's own message text. The branch of the fake lab that words a block by what differs (the permission mode or the reasoning level) has no test of its own. | `test/acceptance/conformance-tier15.test.ts:105-118`; `test/fixtures/conformance-lab.ts` (the `what` branch) |
| 7 | LOW | U1528 cannot fail if the `restored` guard goes: `rmSync` has `force`, and a second call writes the same `TMPDIR`. The branch for an empty `TMPDIR` (`earlier === ""`) has no test. | `test/setup/private-tmpdir.test.ts:54-63`; `test/setup/private-tmpdir.ts:19,25` |
| 8 | LOW | A1509 passes if the log holds no heading at all (a changed heading format would pass it), and A1510 reads only tracked `.md`, `.ts`, `.tsx`, `.json`, `.yml`, and `.yaml` files, while FR-010 says "in the repository". No other file type cites a decision number today. | `test/acceptance/decision-log.test.ts:8,13-17,22` |
| 9 | LOW | `tmpdir-leak.test.ts` pins the number of leaked hosts (`toHaveLength(3)`) and vitest's summary line, and it holds a dead `mkdirSync` (the helper already made the directory). The test costs two `vitest` boots (about 2 s each here) and is deterministic by design (private `TMPDIR`, minimal environment, `NO_COLOR`). | `test/acceptance/tmpdir-leak.test.ts:21,31-35` |
| 10 | LOW | Redundant tests at one level: U1519 is implied by U1520, and A1507 repeats U1520 through `loadGaps`. A1501's pass half and A1505 repeat the 12-row table that the existing A1313 pins. Kept on purpose: each names the behavior of its own user story, and none is a duplicate of a test in a different layer. | `tools/conformance/gaps.test.ts:48-58`; `test/acceptance/conformance-gaps.test.ts:33-36`; `test/acceptance/conformance-tier15.test.ts:60-81` |
| 11 | LOW | Style: `.ts` import extensions in test files under `test/` where neighbours use none; the `committed` helper is copied in two gap tests. | `test/acceptance/decision-log.test.ts:5`; `tools/conformance/gaps.test.ts:46`; `test/acceptance/conformance-gaps.test.ts:31` |
| 12 | LOW | The call of `projectRowScript(project.id, deliveryModeOf(driver))` in `real-lab.ts` has no unit test: only a live run proves that the lab honors the driver's mode. The live Pi run did (it passes S2 to S8, S11, and S12 in `direct-PR`, where the run before the change failed them all). | `tools/conformance/real-lab.ts:357`; D-107 records the same position for the real lab |
| 13 | LOW | `tdd/test-list.md` says `spec_criteria: 24`; the spec has 18 acceptance scenarios (US1.1 to US6.3). | `tdd/test-list.md:5`; `spec.md` |

Properties of the suite: no real clock, random, network, or sleep in the new tests; the new child-process test is the only slow one (about 2 s per boot) and does not share state with the rest; failures name the behavior and the file.
The full suite takes about 31 s, as at planning.

## Mutation results

No mutation tool is in the profile, so this uses deliberate mutants.
Scope: the production and fixture files that this feature changed.
Sample: 14 mutants on 10 files, one at a time, each restored with `git checkout` and checked afterwards (the tree was clean and the suite green: 141 files, 1835 passed).
The runs are not exhaustive: the real lab (`tools/conformance/real-lab.ts`) and the lab scripts have no unit tests and were not mutated.

| Mutant | File | Result | Judgment |
| --- | --- | --- | --- |
| M1 S4 never sends the `pr=` flag in `direct-PR` | `s04-ship.ts` | Caught (A1313, A1501, U1387, U1388, U1510 and more) | Pinned |
| M2 S4 sets no mode note | `s04-ship.ts` | Caught (A1503, A1504, U1510) | Pinned |
| M3 the default mode becomes `direct-PR` | `drivers/types.ts` | Caught (U1501, U1504, U1514, A1502) | Pinned |
| M4 omp asks for `low` | `drivers/omp.ts` | Caught (U1505, A1502, A1505) | Pinned |
| M5 `restore` does not remove the directory | `private-tmpdir.ts` | Caught (U1525 to U1528) | Pinned |
| M6 the setup file never restores | `private-tmpdir.setup.ts` | Caught (A1511) | Pinned |
| M7 the setup file has no `afterAll` | `private-tmpdir.setup.ts` | Caught (A1511) | Pinned, so `afterAll` is the working hook |
| M7b the setup file has no exit hook | `private-tmpdir.setup.ts` | **Survived** | Dead code for every path a test covers (finding 5) |
| M8 the fake lab never refuses a mode | `conformance-lab.ts` | Caught (U1515, A1501) | Pinned |
| M9 the fake lab accepts `pr=` in `local-only` | `conformance-lab.ts` | **Survived** | Real gap (finding 2) |
| M10 the duplicate check needs three headings | `decision-log.ts` | Caught (U1521) | Pinned |
| M11 two column names swapped in the project row | `lab-env.ts` | **Survived** | Real gap (finding 3) |
| M12 the root config drops the setup file | `vitest.config.ts` | **Survived** | Real gap (finding 4) |
| M13 S4.review-ready accepts any state but `failed` | `s04-ship.ts` | Caught (U1388, U1511) | Pinned |

Score: 10 of 14 caught (71 percent), scope as above, no tool version.
Mutants recorded in the cycle log during the loop (U1506, U1509, U1520, U1529, A1509, A1510) all failed their test and are not counted again.

## Traceability

| Criterion | Tests | End to end |
| --- | --- | --- |
| US1.1 (Pi's project mode admits it) | A1501, U1503, U1507, U1514, U1515, U1529 | Yes (A1501 through `main`, and the live Pi run) |
| US1.2 (a driver with no mode stays `local-only`) | A1502, U1501, U1504, U1508 | Yes |
| US1.3 (S4 in `direct-PR`) | U1510, U1511, A1501, A1313 | Yes |
| US1.4 (the support document names the mode) | A1503, A1504 | Yes |
| US2.1 (omp's level is listed) | A1505, U1505, U1518 | Yes (A1505 and the live omp run) |
| US2.2 (the unsupported profile is refused for its mode) | A1506, U1506, U1383 | Yes, with finding 6 |
| US3.1, US3.2 (stale gaps gone, S9 kept) | A1507, A1508, U1519, U1520 | Yes |
| US3.3 (the document shows no S1 or S7 gap) | A1329 (existing) and the five result files | Yes (live results) |
| US4.1, US4.2 (the decision log) | A1509, A1510, U1521 to U1523 | Yes |
| US5.1 to US5.3 (no leaked directory) | A1511, U1524 to U1528 | Yes, but not through the root config (finding 4) |
| US5.4 (a full run adds none) | A1512 | Manual measure only |
| US6.1 to US6.3 (the five runs) | A1513, A1514 | Live runs, five exits of 0 |

Untested criteria: none.
Tests that trace to nothing: none (U1529 traces FR-002).

## What was not audited

- `tools/conformance/real-lab.ts`, `tools/conformance/lab-scripts/`, and `tools/bblab/` have no unit tests, and no mutant was applied to them. The five live runs are their only test.
- Mutation was a hand-made sample of 14 mutants, not a tool run, so the score is not comparable with a tool's score.
- The audit was not independent (finding in the verdict paragraph). The smell pass came from a fresh-context subagent, and the mutants and the history checks came from the session that wrote the tests.
- Performance beyond the wall time of the suite and of the child-process test was not assessed.
- Coverage: the profile has no coverage command, so none was run.
- Tier 2 and any real model: out of scope for this feature.

## Status after remediation (added at `5555706`, the audit above is unchanged)

The audit above was verified at `5055faa`. The remediation tasks T051 to T059 ran afterwards, and `tdd/cycle-log.md` holds their evidence.

| Finding | Status |
| --- | --- |
| 1 (`TEST_AFTER`: U1506, U1509, U1529, A1509) | Open by nature. A test cannot fail first against behavior that was already true. D-122 records it, and the captain accepted it on 2026-11-09. The seven behaviors that the remediation added (U1530 to U1535, A1515) are in the same class, so D-122 counts eleven |
| 2 (M9, fake lab rule) | Closed by U1530. The mutant now fails the suite |
| 3 (M11, project row columns) | Closed by U1531, which runs the script against the plugin's own schema. The mutant now fails the suite |
| 4 (M12, root config) | Closed by U1532. The mutant now fails the suite |
| 5 (exit hook) | Closed: the line is removed, and D-121 matches |
| 6 (A1506 asserts the fake lab's text) | Closed by U1533, which pins the branch in the fake lab |
| 7 (U1528, empty `TMPDIR`) | Closed by U1535 and U1534 |
| 8 (A1509 vacuous without headings) | Closed by A1515. The mutant that removes the headings now fails A1515 and A1510 |
| 9, 11 (dead line, import style) | Closed for the dead line and the import in `decision-log.test.ts`. The hard-coded host count of the control run, the copied `committed` helper, and the other `.ts` imports stay, as a style note |
| 10 (redundant tests at one level) | Accepted: each test names the behavior of its own user story |
| 12 (`real-lab.ts` has no unit test) | Open by design, as in D-107. The five live runs are its test |
| 13 (`spec_criteria`) | Closed: the list reads 18 |

Survivors after remediation: none of the four that the audit listed.
Re-running the rubric's verdict rule gives `FAIL` while finding 1 is open. The captain has accepted D-122 as a recorded deviation, so the accepted verdict is `PASS_WITH_GAPS`; the rubric's own computation stays `FAIL`, because an auditor does not accept an exception.
The suite is 143 files and 1842 tests, all passing.
