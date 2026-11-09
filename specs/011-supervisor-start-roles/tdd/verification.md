---
feature: 011-supervisor-start-roles
verdict: FAIL
standard: .specify/extensions/tdd/templates/tdd-test-quality-rubric.md
verified_at: d961810
behaviors: 141
proven: 122
likely: 5
test_after: 7
no_test: 0
not_applicable: 7
high_smells: 3 # findings 3 to 5; findings 1 and 2 are a surviving mutant and the TEST_AFTER class
criteria_total: 46
criteria_covered: 46
mutation_score: 96 # deliberate mutants, 27 sampled, 26 caught; scope: the changed source files
mutants_survived: 1 # a real gap, not an equivalent mutant (finding 1)
suite: 2013 passed, 0 failed, 25s
---

# TDD verification: Supervisor start command, role advice, and the dispatch roles block

**Verdict: FAIL.** Seven behaviors are `TEST_AFTER` (guards of behavior that already held, each killed by a recorded mutant), and the `READ_SCRIPT` shell that reads the validator's configuration is never executed by any test, so a script with its present and absent branches swapped survives every test.

**This audit was not independent.**
The session that wrote the tests ran it.
Three things reduce that risk and are named so the reader can weigh them:

- The smell pass was done by a fresh-context subagent that read the committed tree cold, with no access to the cycle log's reasoning. I opened every line it cited before it went into this report, and I kept only what I could confirm.
- The ordering evidence does not rest on the cycle log alone. For each cycle commit I rebuilt the parent commit's source in a scratch directory, overlaid only that commit's tests and fixtures, and ran them, so the reds are reproduced from git.
- The mutants were applied by a script, one at a time, each restored with `git checkout` and checked.

The auditor's own bias still applies to the findings it did not look for.

## Test-first evidence

The repository commits only at green (D-099), so each cycle commit holds its test and its implementation together, and the history cannot show a test commit before a source commit.
A behavior is `PROVEN` here when the cycle log records the red **and** the reproduction from git agrees (the test fails against the parent commit's source).

| Class | Count | Behaviors |
| --- | --- | --- |
| `PROVEN` | 122 | every other behavior |
| `LIKELY` | 5 | `U1704` (the red was against my first implementation, recorded in prose with no verbatim output); `U1709`, `U1710`, `U1715` (their red depends on the fake-lab fixture, which changed in the same commit, so the overlay cannot isolate it); `A1619` (the regenerated data was committed one commit before the test) |
| `TEST_AFTER` | 7 | `U1649`, `U1650`, `U1702`, `U1714`, `U1716`, `U1719`, `A1612` |
| `NOT_APPLICABLE` | 7 | `U1611`, `U1694`, `U1718` (credited to existing tests that pass before and after), `A1615`, `A1616`, `A1617`, `A1620` (live measures, not automated tests) |

The reproduction from git, per cycle commit (failures at the parent commit's source with the commit's tests overlaid):

| Commit | Cycle | Reproduced failing ids |
| --- | --- | --- |
| `93dd8eb` | 1 | `U1601` to `U1610` (13 failed) |
| `3ef268f` | 2 | `A1606`, `U1612` to `U1622` (19 failed) |
| `c97ee1f` | 3 | `A1601` to `A1605`, `U1642`, `U1643`; the whole file of `U1623` to `U1641` fails because the module does not exist |
| `a93ce68` | 4 | `A1607`, `U1644` to `U1648`; the whole file of `U1651` to `U1655` fails |
| `e2ffffb` | 5a | the whole file of `U1656` to `U1689` fails (module absent) |
| `851080b` | 5b | `U1690` to `U1693`, `U1695` to `U1698` (11 failed, with the adapted `U838`) |
| `3b6b38f` | 5c | `A1608` to `A1611`, `A1613`, `U1699`, `U1700`, `U1701`, `U1703`, `U1705`; **`U1702`, `U1704`, `U1719`, `A1612` pass** |
| `5042e16` | 6 | `A1507`, `A1614`, `U1706` to `U1708`, `U1711` to `U1713`, `U1717`; **`U1714`, `U1716` pass** |
| `53eeae8` | 7 | the whole file of `U1720`, `U1721` fails (module absent) |
| `d961810` | records | `A1618`, `A1122` (and `A1510`, which fails only because the scratch copy has no git repository) |

The seven `TEST_AFTER` behaviors all guard something that held when their test was written: a refusal that already read nothing (`U1649`, `U1650`), a hand-off that adds no line for other modes (`U1702`), blank evidence that stays blank (`U1719`), an S9 check that already existed (`U1714`, `U1716`), and a preflight refusal that cycle 5b had already built (`A1612`, written after its units).
Each has a recorded killing mutant in `tdd/cycle-log.md`, and this audit killed the last one again (`M19` and `M20` fail `A1612`).
The class is the same one that decisions D-099, D-116, and D-122 recorded for earlier features, and the rubric fails a feature for it.
`tasks.md` against the list: no task is ticked `[X]` with a behavior that is not `DONE`, and no behavioral task is open with its behavior `DONE`.

### What the diff did to tests that already existed

| Test | Before | After | Judgment |
| --- | --- | --- | --- |
| `U838` (`src/machines/preflight.test.ts:34`) | every call ran with `cwd === "/work/gpu"` | the new read is in the exact call list and is excluded from the cwd check | Legitimate, with one gap: the read's own cwd is unpinned (finding 8). |
| `U856` (`src/tools/supervisor-command.test.ts:141`) | every call ran in the source path | same exemption, plus exactly one read | Same as `U838`. |
| `U11` (`src/bb/adapter.test.ts:116`) | exact thread shape | adds `providerId: null` | Stronger. |
| `U701` (`src/dispatch/config.test.ts:25`) | exact minimal config | adds the default `roles` | Stronger. |
| `U1397`, `U1398`, `U1520`, `A1507`, `A1508` | pinned the three S9 gaps and the old S9 checks | replaced by `U1711` to `U1717`, `A1507`, `A1614` | Legitimate: FR-025 removes the gaps. Isolation of the start check is lost when the command is missing (it now fails two checks). |
| `U1519` (`tools/conformance/gaps.test.ts:48`) | closed checks absent from a three-entry list | the list is empty, so `not.toContain` cannot fail | **Made vacuous by the data change** (finding 9). |
| `A1122`, `A1109` (`test/acceptance/live-check.test.ts`) | pinned the wrong "next session" sentence; `supervisor` allowed no flag | pins the corrected sentence and forbids the old text; allows the three flags | Legitimate; the whitelist is keyed by command and not by subcommand (finding 12). |
| `test/fixtures/bb-cli.json` | recorded at 0.48.1 | `thread clear` added by hand from `bb thread clear --help` | Weakens the provenance that `A1109` relies on (finding 12). |

No test was skipped, excluded, renamed out of a filter, or given a lower threshold, and `vitest.config.ts` is unchanged.

## Findings

Ordered by severity. `HIGH` findings block `PASS`.

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | HIGH | **Surviving mutant in a `DONE` behavior.** No test executes `READ_SCRIPT`. Every double answers when `args[1] === READ_SCRIPT` (the imported constant), and the script is only checked with `toContain` and a denylist. Mutant `M17` swapped the present and absent branches and survived `agent.test.ts`, `validator-observe.test.ts`, `preflight.test.ts`, and `report.test.ts`. The script is the only part of the observation that reads the host, and the live runs never reach it (no `no-mistakes` project in the lab). | `src/validator/agent.ts:45`; `src/validator/agent.test.ts:227-236` |
| 2 | HIGH | **Seven `TEST_AFTER` behaviors** (see above). Each has a killing mutant. | `tdd/cycle-log.md` groups 4, 5c, 6 |
| 3 | HIGH | Re-implemented expectation. `U1689` builds the expected problem text with the same transformation as `validatorProblem`, and repeats its readiness guard. `U1710` builds the expected stamp text with `roleAdvice`, which `FakeLab.stamp` calls. | `src/validator/agent.test.ts:297-305`; `test/fixtures/conformance-lab.test.ts:125-126` |
| 4 | HIGH | Tautological assertion. `U1709` expects the exact string and tool list that `FakeLab.startSupervisor` hard-codes. No test feeds the **real** command's output to `startedThreadId`, so a wording change in the real command keeps every unit test green and breaks S9 only in the live lab. | `test/fixtures/conformance-lab.test.ts:105-116`; copies of the line at `src/tools/supervisor-start.test.ts:33`, `test/acceptance/supervisor-start.test.ts:27`, `tools/conformance/readers.test.ts:61` |
| 5 | HIGH | Conditional logic in a test. `if (!ready)` decides which checks run for a case, and `if (label === ...)` decides which `A1610` cases get the not-ready check. No run asserts nothing, so the impact is low, but the rubric fixes the severity. | `src/validator/agent.test.ts:300-303`; `test/acceptance/validator-observe.test.ts:64` |
| 6 | MED | **Overstated trace.** `A1605` is traced to `US2.1` (the `roles.supervisor.profile` fallback) but only exercises the flag winning. The fallback itself is covered only by the unit test `U1626`, so `US2.1` has no acceptance-level test. This blocks `PASS`. | `test/acceptance/supervisor-start.test.ts:77-80` |
| 7 | MED | Bypassed test utility. The acceptance test hand-rolls provider and model objects that `providerFixture` and `modelFixture` already build, and five other acceptance files use them. | `test/acceptance/supervisor-start.test.ts:59,70,72,78` |
| 8 | MED | The new read's working directory is unpinned in `U838` and `U856`: the exemption removed the only assertion that would show the read running in an unexpected place. | `src/machines/preflight.test.ts:34`; `src/tools/supervisor-command.test.ts:141` |
| 9 | MED | Vacuous after a data change: `U1519` can no longer fail. The empty gap list is pinned three times (`U1717`, `A1507`, the first line of `A1614`), and the spawn-order check in `U1639` repeats what `U1635` to `U1637` force. | `tools/conformance/gaps.test.ts:48-51,53`; `test/acceptance/conformance-gaps.test.ts:33`; `src/tools/supervisor-start.test.ts:186-187` |
| 10 | MED | Framework under test: `A1606` pins zod's wording `Unrecognized key: "surprise"`. Implementation coupled: `U1698` checks a warning log containing `validator_agent` (the existing `U1057` does the same). | `test/acceptance/roles-config.test.ts:18`; `src/limits/queue.test.ts:236` |
| 11 | MED | Eager tests and assertion roulette: four to seven behaviors in one test with unlabelled `expect`s (`A1604`, `A1605`, `A1607`, `A1611`, `A1612`, `A1613`, `U1678`, `U1680`, `U1681`, `U1629`, `U1630`, `U1633`, `U1636`), so the first failure hides the rest. | `test/acceptance/supervisor-start.test.ts:52-95`; `test/acceptance/validator-observe.test.ts:86-162`; `src/validator/agent.test.ts:201,214,223-236`; `src/tools/supervisor-command.test.ts` |
| 12 | MED | Provenance and breadth: the `bb-cli.json` recording was edited by hand; the `A1109` whitelist is keyed by command, so the stamp form may now name `--profile` too. | `test/fixtures/bb-cli.json`; `test/acceptance/live-check.test.ts:91` |
| 13 | LOW | Duplicated setup: the `command === "sh" && args[1] === READ_SCRIPT` router appears in eight places and `isRead` twice; `bare` and the profile helpers repeat across two acceptance files. | `report.test.ts`, `dispatch.test.ts`, `queue.test.ts`, `supervisor-command.test.ts`, `validator-observe.test.ts` |
| 14 | LOW | Unclear names: two tests share `[U1692]` and two share `[A1606]`; the constant `CODEX` holds provider `claude-code`; weak bounds `>= 1` and `>= 3`; titles that promise more than they assert (`A1604` says "no event" and checks tasks only, `U1636` says "model" and tests the level, `U1606` names `gateProfile` and never calls it). | `src/machines/preflight.test.ts:152,168`; `src/tools/supervisor-start.test.ts:10`; `test/acceptance/validator-observe.test.ts:92,158` |

Properties beyond the catalogue:

- **Isolation and determinism.** No real clock, random, network, or sleep was found in the added tests. Temporary directories come from the existing `makeCheckout` and `tmpDir` helpers under the per-file private `TMPDIR`, and a full suite run adds no directory (3212 before and after).
- **Speed.** The whole suite is 25 s, unchanged from the baseline of 26 s, with 171 more tests (1842 before, 2013 after).
- **Specificity.** The multi-world acceptance tests stop at the first failing assertion and many `expect`s have no label (finding 11).
- **Refactoring sensitivity.** The `READ_SCRIPT` constant couples eight files to one string, so a change to the script's text moves every test at once (finding 13), and the message "Started factoryman supervisor thread <id> ..." is copied in four places (finding 4).
- **Live-only glue.** `tools/conformance/real-lab.ts` (the call to `bb`, the project setup, the wait for the catalog) has no unit test; only the live runs exercise it.

## Mutation results

Tool: none in the profile (StrykerJS is not installed), so these are **deliberate mutants**: one change each, applied by a script, the relevant test files run, the file restored with `git checkout`, and the full suite re-run at the end (150 files, 2013 tests, green; `git status` clean).
**Sample: 27 mutants over 14 source files.** It is a sample of the highest-risk behaviors, and not an exhaustive run, so the score is `26 of 27 = 96 percent` for this sample only.

| Mutant | Behavior | Result |
| --- | --- | --- |
| `M1` the file's `default` profile used when neither names one | `U1628` | caught (`A1605`, `U1628`) |
| `M2` no `role` metadata at spawn | `U1623` | caught (`A1601`, `A1602`, `U1623`) |
| `M3` the worker admission rule applied to the supervisor | `U1638` | caught (`A1604`, `U1638`) |
| `M4` the gate result ignored | `U1635` to `U1637` | caught (4) |
| `M5` `--prompt` ignored | `U1624` | caught (`A1603`, `U1624`) |
| `M6` profile looked up through the prototype | `U1629` | caught |
| `M7` a repeated flag accepted | `U1641` | caught |
| `M8` validator agent `set` accepted | `U1617` | caught (5) |
| `M9` supervisor profile need not be defined | `U1614` | caught (`A1606`, `U1614`) |
| `M10` advice branches swapped | `U1651` to `U1655` | caught (13) |
| `M11` the stamp never reads the provider | `U1645` | caught (6) |
| `M12` an unchecked agent counts as ready | `U1671` | caught (`U1671`, `U1673`) |
| `M13` an indented `agent` key counts | `U1662` | caught |
| `M14` a host with no file is unobserved | `U1676` | caught (`A1610`, `U1676`) |
| `M15` `claude` mapped to the wrong provider | `U1666` | caught (9) |
| `M16` read bound doubled | `U1681` | caught |
| **`M17` `READ_SCRIPT` present and absent branches swapped** | `U1676`, `U1681`, `A1608` | **SURVIVED** (finding 1) |
| `M18` `READ_SCRIPT` ignores `NM_HOME` | `U1681` | caught (by a `toContain` on the script text, which is brittle but real) |
| `M19` the observation runs for every mode | `U1693` | caught (7) |
| `M20` an unready agent is a note, not a problem | `U1690`, `U1691` | caught (`A1612`, `U1690`, `U1691`, `U1696`) |
| `M21` the line goes before the worker's evidence | `U1699` | caught (8) |
| `M22` the task's machine ignored | `U1703` | caught (`A1611`, `U1701`, `U1703`) |
| `M23` wait gives up one attempt early | `U1721` | caught |
| `M24` `getThread` drops the provider | `U1601` | caught |
| `M25` supervisor spawn names a parent notification | `U1603` | caught |
| `M26` the lab drops `--prompt` | `U1706` | caught |
| `M27` the thread ID read from any line | `U1707` | caught |

Earlier in the session the loop also recorded killing mutants for the guards that passed first: `U1649` and `U1650` (a thread read before the worker check and before the stamp), `U1702` and `U1719` (the mode condition and the blank-evidence condition removed from `report.ts`), and `U1714` and `U1716` and `U1713` (three S9 mutants).
Coverage is not measured (`@vitest/coverage-v8` is not installed), so it did not back the traceability.

## Traceability

The mapping was built by script from `spec.md` and the test list's `traces` column, and each claimed test file was opened to confirm that the `[id]` title is in it.

| Measure | Result |
| --- | --- |
| Acceptance criteria (46) with at least one behavior | 46 |
| Acceptance criteria with an acceptance-level (`A`) behavior | 46 on paper, **45 in fact**: `US2.1` is claimed by `A1605` but only the unit test `U1626` exercises the fallback (finding 6) |
| Functional requirements (29) and success criteria (9) with a behavior | 29 and 9 |
| `traces` tokens that do not resolve to a criterion, requirement, or success criterion | 0 |
| Behaviors that trace to nothing | 0 |
| Claimed tests that do not exist | 0 |

The criteria `US6.1` to `US6.5`, `US6.7`, and `US6.8` have an in-process acceptance test (`A1614`, against the fake lab), and their proof through a real bb and real harnesses is the live runs, which are not automated tests (results in `conformance/results/*.json`). `SC-009` is a measured count.
Untested criteria: none. Tests tracing to nothing: none.

## What was not audited

- Mutation was a **sample of 27 deliberate mutants**, not a tool run over the changed files. The surviving-mutant search is therefore not exhaustive: the files `src/dispatch/gate.ts`, `src/bb/adapter.ts` (worker path), `tools/conformance/real-lab.ts`, and the fake lab (`test/fixtures/conformance-lab.ts`) were not mutated beyond the cases above.
- Line and branch coverage: no tool is installed.
- `tools/conformance/real-lab.ts`: it drives a real bb and is checked only by the five live runs. No static or mutation audit of it was done.
- Whether the validator observation works against a real no-mistakes pipeline: the lab has no `no-mistakes` project, so the shell read and the agent mapping were never run live (finding 1).
- The shipped skills, the web UI, and the merge approval form: untouched by this feature.
- Performance and load behavior: no criterion, no test, not assessed.
- The subagent read the changed files in full or by diff, but did not read `FakeLab` or `real-lab.ts` end to end; I did not re-read them cold either.

## Re-check after the remediation

This section was written by the session that fixed the findings, so it is **not independent**, and it does not replace a fresh audit.
It records, finding by finding, what changed and the evidence, for the next reader to confirm.
The verdict above is the verdict of the audited commit `d961810`.

| # | Status | Evidence |
| --- | --- | --- |
| 1 | Cleared | `src/validator/agent.shell.test.ts` runs `READ_SCRIPT` under a real `sh` (`U1723` to `U1726`). Five mutants of the script, including `M17`, each fail it. |
| 2 | Not clearable by a fix | The seven `TEST_AFTER` behaviors stay. The remediation added six more guards that passed on first run (`U1723` to `U1726`, `A1621`, `A1622`), so thirteen behaviors have no recorded red, each with a killing mutant. D-133 records the deviation, and the captain accepted it on 2026-11-09. |
| 3 | Cleared | `U1689` and `U1710` use literal text. A mutant of `validatorProblem` and a mutant of `roleAdvice` each fail them. |
| 4 | Cleared | `A1622` feeds the real command's output to `startedThreadId`, and a reworded line fails it. `U1709` now asserts through the same reader and fails when the fake lab prints another first line. |
| 5 | Cleared | The two `if`s are gone: `U1689` is two tables, and `A1610` uses `exactly(...)` patterns. |
| 6 | Cleared | `A1621` runs `supervisor start` with no `--profile` against `roles.supervisor.profile`, and a mutant that ignores the field fails it. |
| 7 | Cleared | `A1604` and `A1621` use `providerFixture` and `modelFixture` through one `piWorld` helper. |
| 8 | Cleared | `U838` and `U856` assert that the read runs with no working directory. |
| 9 | Cleared, with one decision | `U1519` was deleted because it could not fail, and `U1717` and `A1507` pin the empty list. The order check in `U1639` stays on purpose. |
| 10 | Cleared | `A1606` matches the key name, and `U1698` checks the preflight in the warning, as `U1057` does. |
| 11 | Cleared for the tests named, with one exception | `A1604`, `A1605`, `A1607`, `A1611`, `A1612`, `U1629`, `U1630`, `U1633`, `U1636`, `U1678`, `U1680`, `U1681` are one behavior per test. `A1613` stays one flow over two worlds. |
| 12 | Cleared | The flag whitelist of `A1109` is keyed by subcommand, and a flag on the stamp form fails it. The `thread clear` entry of `bb-cli.json` was read from `bb thread clear --help`. |
| 13 | Cleared | `test/fixtures/validator-read.ts` is the one place that routes the read. |
| 14 | Cleared | `U1722` has its own id, `SECOND` replaces the misleading `CODEX`, the bounds are exact (2 and 4), and the two titles that promised more now assert what they say. |

Suite after the remediation: 151 files, 2067 tests, 0 failed, 25 s; `pnpm run check` is clean; a full run adds no temporary directory.
The verdict stays `FAIL` under the rubric, because the thirteen behaviors with no recorded red cannot be cleared by a fix. The captain accepted D-133 on 2026-11-09 as a recorded test-after waiver, so the cause is accepted. A fresh audit would be the way to confirm findings 1 and 3 to 14.
