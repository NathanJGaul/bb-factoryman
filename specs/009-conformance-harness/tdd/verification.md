---
feature: 009-conformance-harness
verdict: FAIL
standard: .specify/extensions/tdd/templates/tdd-test-quality-rubric.md # resolved from the extension copy; no override or preset file exists
verified_at: eae7b62 # short SHA audited (branch fm/bb-factoryman-conformance-harness, range 8148863..eae7b62). The audit is not independent: see the verdict paragraph
behaviors: 158 # 30 acceptance (A1301-A1330) and 128 unit (U1301-U1428, with gaps)
proven: 125 # red recorded in the cycle log (against a stub or a missing file), and the test lands in the same commit as its code
likely: 2 # U1319 (its red came from the stub's empty output, not from the missing validator) and U1359 (it passed against a stub)
test_after: 26 # the code predates the test: A1301-A1306, A1308-A1313, A1316-A1321, A1324, A1326-A1328, A1330, U1422, U1427, U1428. Each has a recorded revert-red or a killing mutant
no_test: 0
not_applicable: 5 # A1307, A1314, A1315, A1322 (live part), A1323: the live runs in the lab, kept as result files
high_smells: 0 # one found by the cold pass (A1306, vacuous) and closed in eae7b62; 11 MED and 1 LOW groups remain open (see Findings)
criteria_total: 28 # AC-1.1 to AC-6.4
criteria_covered: 28 # every AC reaches a test or a live run; the real lab and the CLI entry are covered by live runs only
mutation_score: 98 # 53 of 54 hand-picked deliberate mutants killed, no tool; the 54th is an equivalent mutant. Scope: tools/ (not src/). Not a representative sample
mutants_survived: 1 # M51 (equivalent, see Mutation results). Four survived the first run; three were closed with new tests
suite: 1482 passed, 0 failed, 125 files, about 22 s of test time; pnpm run check (typecheck, lint, tests) exit 0
---

# TDD verification: Conformance harness for agent harnesses

**Verdict: FAIL.**
One rule blocks: 26 behaviors have tests that came after their code, and the rubric fails a feature for any `TEST_AFTER`.
Everything else is clean: no `HIGH` smell is open, 53 of 54 deliberate mutants are killed (the 54th is equivalent), every acceptance criterion reaches a test or a live run, and no existing test was changed.
I wrote the code and the tests, so this audit is not independent.
A fresh-context subagent did the smell pass, and I opened the lines it cited before I used them.
The captain accepted the `TEST_AFTER` set as a documented exception on 2026-11-09 (D-107), as for the earlier feature (D-099).
The verdict stays `FAIL` as computed.

Why so many `TEST_AFTER`: the feature is a test harness, and its real entry points (the runner, the document command, the fake model as a process) were built bottom-up from unit-tested parts.
Each acceptance test was written after the unit cycles had already built the behavior, so the first run passed.
For every one of them the cycle log records a revert-red (the code replaced by a stub or a mutation, the test failing with its failure line kept, the file restored) or a killing mutant.
The repository commits only on green, so history cannot show a test before its code.

## Test-first evidence

| Group (cycle-log section) | Behaviors | Class | Evidence |
| --- | --- | --- | --- |
| 1 verdict, gaps | U1301 to U1316 | PROVEN | 16 failed against stubs, failure lines recorded |
| 2 result, args | U1317, U1318, U1320 to U1326, U1414 | PROVEN | 14 failed first (U1414 failed on the `--` that pnpm passes) |
| 2 result | U1319 | LIKELY | red came from the stub's empty output (`SyntaxError`), not from a missing validator; mutant M08 kills it |
| 3 drivers | U1327 to U1334 | PROVEN | 8 failed first (U1332, U1333 were strengthened before they ran red, and U1329 and U1331 gained assertions after live runs, each red first) |
| 4 stub agent | U1335 to U1344, U1412 | PROVEN | 10 + 1 failed against a placeholder agent |
| 5 bblab | U1345 to U1349 | PROVEN | 5 failed; U1349 failed on the real defect of t01 finding 5.13 |
| 6 fake model tools, brain | U1350 to U1358, U1423, U1428 | PROVEN | 3 + 6 failed against stubs; U1423 failed on a real Claude Code request shape |
| 6 brain | U1359 | LIKELY | passed against the always-text stub; mutant M24 shows the weakness and U1428 closes it |
| 7 wire formats | U1360 to U1366, U1418, U1421 | PROVEN | stubs threw "not implemented"; U1418 and U1421 came from live runs and were red first |
| 8 server | U1367 to U1370, U1411, U1419, U1420, U1426 | PROVEN | 4 failed first; U1411, U1419, U1420, U1426 each red first |
| 9, 11 instructions, readers, lab env | U1371 to U1375, U1410, U1413, U1417 | PROVEN | stubs returned empty values; U1413 and U1417 red first |
| 10 scenarios | U1381 to U1405, U1424, U1425 | PROVEN | 25 failed against empty scenarios; U1424, U1425 red first |
| 12 runner | U1406 to U1409 | PROVEN | 4 failed against a `main` that returned 99 |
| 13, 14 docs, shell | U1376 to U1380, A1329, U1415, U1416 | PROVEN | stub or missing file first |
| runner acceptance | A1301 to A1306, A1308 to A1310, A1312, A1313, A1316, A1317, A1324 | TEST_AFTER | `main` existed from the unit cycle. A replaced `main` (returning 99) gave 12 red; A1303 and A1306 passed against the stub (structural), and A1306 was rewritten after the cold pass and killed by a mutant of `bblabCommand` |
| fake model acceptance | A1318 to A1321 | TEST_AFTER | revert-red with a renamed route, `0.0.0.0`, and an emptied skill list: 3 red (A1319 survived those three; the brain behavior it exercises is killed by M27 through U1356) |
| docs acceptance | A1311, A1326 to A1328 | TEST_AFTER | the CLI and its tests were written in one step; a stub CLI gave 5 red |
| layering | A1330 | TEST_AFTER | a forbidden import added to a tool gave the red |
| recorded request | U1422 | TEST_AFTER | the old parser restored from `HEAD` gave the red |
| mutant guards | U1427 | TEST_AFTER | a partial run already wrote no file; mutant M53 killed after the test |
| live | A1307, A1314, A1315, A1322, A1323 | NOT_APPLICABLE | manual live runs: `conformance/results/*.json`, `tdd/cycle-log.md` |

Discrepancies between the log and the history: none found.
The log records its own process errors (the docs CLI written with its tests, the `--port` file that got committed once, and a typed path that cost one command).

Changes to tests that already existed, from `git diff 8148863..HEAD`: none.
The pre-existing files that the feature changed are `docs/DECISIONS.md`, `docs/LIVE-CHECK.md` (one corrected sentence), `package.json` (two scripts and the `typecheck` script, which still starts with `tsc6`, so `[A1214]` holds), `tsconfig.json`, and `vitest.config.ts`.
No assertion was removed, loosened, skipped, or filtered, and no threshold exists to lower.

`tasks.md` against the list: every ticked task has its behaviors `DONE`.

## Findings

Ordered by severity. The cold pass was done by a fresh-context subagent that read every test, fixture, and covered source file. I opened each cited line before I used the finding.

| # | Severity | Finding | Evidence | State |
| --- | --- | --- | --- | --- |
| 1 | HIGH | A1306 asserted that a decoy `bblab` path did not start with the decoy's directory. The decoy was never on the `PATH`, so the assertion held for any `labPaths`. | `test/acceptance/conformance-tier1.test.ts` (old lines 64 to 72) | Closed. The real lab builds its commands with `bblabCommand`; the test puts a decoy first on the `PATH` and runs the command; a mutant that returns `bblab` is killed |
| 2 | MED | Six checks had no test that turns them red alone (S4.wake, S5.worker-skills, S6.stays-working, S9.unstamped-no-tools, S10.state-kept, S11.clean-removed). | `tools/conformance/scenarios/scenarios.test.ts` | Closed. A fault per check in the fake lab, and the exact failure sets pinned |
| 3 | MED | S2 only had a `wrongModel` fault. Dropping the provider, level, or mode comparison still passed. | `scenarios.test.ts` | Closed. A fault per field |
| 4 | MED | The fake lab is more forgiving than a real lab: it never waits, sets `busy` from the word `SLEEP`, and counted a commit for a ship task that never reported. If no provider is unready, S1 passed on one check. | `test/fixtures/conformance-lab.ts` | Partly closed. The commit follows the task state, and S1 fails closed. The fake still does not wait or time `busy`; the live runs cover timing |
| 5 | MED | Loose failure-side matchers (`toContain`, `arrayContaining`). | `scenarios.test.ts` | Closed. Exact sets |
| 6 | MED | Loops with no count guard (the scenario file loop of A1303, the layering loop of A1330 had a guard). | `conformance-tier1.test.ts` | Closed for A1303 (a count of 12). The others are type narrowing after an unconditional assertion |
| 7 | MED | Redundant tests: `run.test.ts` and the acceptance tests pin the same `main` behaviors at one level. | `run.test.ts`, `conformance-*.test.ts` | Open, left on purpose (T1392): the fix is to delete tests |
| 8 | MED | Source-text scans stand in for behavior (A1303, A1330, the `lab_x curl` check). | `conformance-tier1.test.ts`, `bblab.test.ts`, `conformance-tools-layering.test.ts` | Open, left on purpose (T1393): the fix is to change the script. The A1330 scan is the only guard for the layering and has a revert-red |
| 9 | MED | Weak assertions: A1312 does not assert the profile; A1326's expected value is the function the CLI calls; `HOST.PATH` equals the fallback; bare `toThrow()`. | listed in the pass | Closed (T1394). A1312 asserts the dispatched profile, the host `PATH` differs from the fallback, the `toThrow` messages name the field, and the literals are exact |
| 10 | MED | Real processes and time: a missing timeout on one `spawnSync`, an orphan `sleep`. | `conformance-fake-model.test.ts`, `shell.test.ts` | Closed for both |
| 11 | MED | Eager tests: seven flags in one brain test, several render tests. | `brain.test.ts`, wire tests | Closed (T1395). One behavior per test |
| 12 | MED | Raw `mkdtempSync` where `tmpDir` exists. | `gaps.test.ts`, `conformance-tier1.test.ts` | Closed |
| 13 | LOW | Duplicate behavior ids in two tests (`U1350`, `U1375`, `U1417`), builders copied across files, a dead variable. | | Closed (T1396): the result builder is shared. Two tests may pin one behavior id, so the ids stay |
| 14 | INFO | `real-lab.ts`, `cli.ts`, `lab-scripts/`, and `bblab up|x|status|down` have no automated test. | | The live runs cover them (D-107). The tier 1 and tier 1.5 results are the evidence |

Properties: the suite takes about 22 seconds for 1471 tests. The new tests start real child processes (the stub, the fake model, `bblab plan`), and each waits on a condition or has a lower bound only, so they should not flake. They ran green in every full run after the first fixes.

## Mutation results

Scope: `tools/` (the feature's code). Tool: none (the profile has none). 54 hand-written mutants, one at a time, each restored and verified. The set is a sample, not exhaustive. `src/` is out of scope, because the feature did not change it.

| Mutant | Behavior | Survived | Judgment |
| --- | --- | --- | --- |
| M01 to M15 (verdict, gaps, result, args, drivers) | U1301 to U1332 | No | Killed by the named tests |
| M16 bind keeps the `bin` directory | U1334 | Yes, then No | Survived: the Claude case binds the same directory either way. Closed with a Codex case |
| M17 to M23 (stub, bblab) | U1340 to U1349 | No | Killed |
| M24 first user turn used | U1359 | Yes, then No | Survived because no test had plain turns before the prompt. Closed with U1428 |
| M25 to M32 (brain, tools, wire) | U1350 to U1366, U1418 | No | Killed |
| M33 to M36 (server, instructions) | U1367 to U1370, U1419, U1410 | No | Killed |
| M37 to M46 (readers, lab env, isolation, docs) | U1374 to U1380, U1413, U1417 | No | Killed |
| M47 to M50 (scenarios) | U1385 to U1404 | No | Killed |
| M51 lab not closed on error | A1305 | Yes | Equivalent. The runner catches every scenario's error in its own `try`, so no error reaches the `finally` today. The `finally` is a guard for an error outside a scenario |
| M52 exit ignores isolation | A1305 | No | Killed |
| M53 partial run writes a result | A1301, U1427 | Yes, then No | Survived: no test ran a partial run. Closed with U1427 |
| M54 `exec` waits for pipes | U1415 | No | Killed |

Score: 53 of 54 killed; the 54th is equivalent.
Mutants M16, M24, and M53 are the three that the first run missed.

## Traceability

| Criterion | Tests | End to end |
| --- | --- | --- |
| AC-1.1 to AC-1.6 | A1301 to A1306, A1307 | `main` with a fake lab, and the live tier 1 run |
| AC-2.1 to AC-2.4 | A1308 to A1311 | `main` and the document command as processes |
| AC-3.1 to AC-3.6 | A1312 to A1317 | `main` with a fake lab; A1314, A1315 are live per harness |
| AC-4.1 to AC-4.4 | A1318 to A1321, U1426 | the server as a process |
| AC-5.1 to AC-5.4 | A1322 to A1325 | `bblab plan` as a process, and the offline proof in every live tier 1.5 run |
| AC-6.1 to AC-6.4 | A1326 to A1329 | the document command as a process |
| FR-1317 | A1330 | a static scan, and `git diff 8148863..HEAD -- src` is empty |

Untested criteria: none. Tests tracing to nothing: none.
AC-1.1, AC-3.3, AC-3.4, AC-5.2 are proven end to end only by the live runs, which are not part of `pnpm test`.

## What was not audited

- `src/`: the feature did not change it, and its tests are the earlier features' tests.
- `tools/conformance/real-lab.ts`, `cli.ts`, `lab-scripts/provider-states.ts`, and the `bblab up`, `x`, `status`, `down` paths: no automated test. The live runs are their test.
- Mutation was a sample of 54 hand-picked mutants in `tools/`, not a tool run and not the whole feature.
- Coverage: the profile has no coverage tool.
- The model-behavior checks M1 to M4 and tier 2: out of scope, and need a credential.
- A second machine, a no-mistakes pipeline run, and the provider catalogs of a real vendor.
- Flake rate over many runs: the full suite ran many times during the session and no flaky test appeared; it was not measured.

## Remediation tasks

Findings 9, 11, and 13 were closed after the captain's instruction of 2026-11-09 (T1394 to T1396). Findings 7 and 8 stay open (T1392, T1393) with the reasons in `tasks.md`.
Neither blocks the feature. The blocking finding is `TEST_AFTER` (the verdict), which a task cannot change: the captain accepted it (D-107).
