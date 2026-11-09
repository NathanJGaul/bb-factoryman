---
feature: 009-harness-independence
verdict: FAIL
standard: .specify/extensions/tdd/templates/tdd-test-quality-rubric.md
verified_at: 8ef693a
behaviors: 223
proven: 136
likely: 0
test_after: 71
no_test: 0
not_applicable: 16
high_smells: 2
criteria_total: 47
criteria_covered: 46
criteria_partial: 1
mutation_score: unmeasured (no mutation tool in the profile; 20 deliberate mutants sampled in this audit, 20 killed; the cycle log records more per group)
mutants_survived: 0 (one survived at acceptance level and was killed by a unit test, finding 6)
suite: 1604 passed, 0 failed, 106 files, 31s
---

# TDD verification: Agent-harness independence

**Verdict: FAIL.** 71 of 223 behaviors have no recorded red, because their tests passed on the first run (42 acceptance tests written after their code, 29 unit tests that pin what stays true), and two `HIGH` smells and a completion claim on `BASELINE` behaviors need repair.
Every sampled mutant was killed, every criterion has a test, and no existing assertion was weakened.
The blocking items are test-evidence and test-quality items. None of them shows a defect in the product code.

**This audit was not fully independent.**
The session that wrote the tests ran the audit.
It re-read every file it assessed, and it delegated the smell pass to a fresh-context read-only subagent, which read all 16 new test files in full.
Every finding of the subagent that appears below was verified against the cited line by the auditor.
The subagent ran no mutants and judged no test order.

## Test-first evidence

The repository commits only on green (D-099), and each group is one commit with its tests, its code, and its cycle-log entry.
Git history therefore cannot show a test before its code, and the log is the only evidence of order.
No commit puts source ahead of its test, and no log entry claims a red that its commit contradicts.
Where the log records the red command and its failure output for a behavior, the class is `PROVEN` (the commit holds the test and the code together).

| Class | Count | Behaviors |
| --- | --- | --- |
| `PROVEN` | 136 | Every other `DONE` behavior: its test failed against a stub or the old code, and the cycle log of its group records the command and the failure line |
| `TEST_AFTER` | 71 | See the two lists below |
| `NOT_APPLICABLE` | 16 | 15 `BASELINE` behaviors (existing tests that pass against untouched behavior) and A1349 (a manual run of the build) |
| `NO_TEST` | 0 | None |

`TEST_AFTER`, acceptance tests written after their code and green on their first run (42): A1310, A1311, A1313, A1301 to A1309, A1316 to A1321, A1322 to A1329, A1330 to A1338, A1339 to A1344, A1350.
For all of them the cycle log says so ("passed on the first run") and lists the mutants that show the test can fail.

`TEST_AFTER`, unit tests that passed on their first run (29): U1306, U1307, U1312, U1315, U1316, U1336, U1346, U1357, U1359 to U1362, U1368, U1376 to U1378, U1383 to U1385, U1389, U1391, U1395, U1396, U1407, U1445, U1447, U1455, U1469, and U1473.
Most of them pin a behavior that was already true (the hint stays off, a ready provider passes, Pi stays admitted in the other modes).
The log records them as "pass by design" and not as a red.
By the rubric, a test with no recorded red is `TEST_AFTER`, whatever the reason.

Mutant evidence for the 71 (the log plus this audit):

| | Behaviors |
| --- | --- |
| Killed by a recorded mutant (59) | all except the twelve below |
| No mutant has been run against them (12) | A1308, A1309, A1310, A1323, A1335 (at acceptance level, see finding 6), U1362, U1376, U1389, U1395, U1445, U1455, U1469 |

The precedent is D-099 (seven guard tests that came after their code, accepted by the captain as a recorded deviation, each with a revert-red and at least one killing mutant).
The count is ten times larger here, and the captain has not accepted it.

### What the feature did to tests that already existed

No assertion was weakened, no test skipped, no filter or threshold changed, and `vitest.config.ts`, `package.json`, and `tsconfig.json` have no diff.
A search of every new and changed test file found no `.skip`, `.only`, `.todo`, or `xit`.
Removed or replaced assertions, all forced by D-104 or D-101 (each is in the log and in D-107):

| File and test | Before | After |
| --- | --- | --- |
| `src/dispatch/availability.test.ts` U730 to U735 | `checkProfile(profile, [provider()])` | `checkProfile(profile, facts())`, same assertions |
| `src/dispatch/resolver.test.ts` U717 | `resolve(config())` is clear with source `builtin`, and `BUILTIN_PROFILE` is pinned | replaced by U1408 (blocked, full message) and U1410 |
| `src/dispatch/resolver.test.ts:61` (U811) | `toMatchObject({ source: "builtin", machine: null })` | `{ status: "blocked", code: "no_default_profile" }`; the comment still says "carries no machine" and nothing asserts it |
| `src/dispatch/resolver.test.ts` U710, U726 | titles name the built-in default | titles changed, assertions unchanged |
| `test/acceptance/dispatch-resolver.test.ts` A706, A713 | dispatch succeeds with `claude-code` | blocked with `no_default_profile`, no spawn |
| `test/acceptance/dispatch-resolver.test.ts` A710 rows 1 and 2 | "not available" | "is not installed", and "bb reports no state for the provider \`claude\`" |
| `test/acceptance/dispatch-resolver.test.ts` A717 | the untagged case relies on the built-in | the config has a `default` |
| `test/acceptance/limits-queue.test.ts` A1025, A1026 | the config has no default | the config has a `default` |
| `test/acceptance/machine-placement.test.ts` A826 | no profile in the call | an explicit profile |

These are behavior changes with their own list items (U1408, A1322), not weakened tests.
Finding 12 notes one coverage side effect of the A710 change.

### Task checkboxes against the list

No task is ticked whose behaviors are `PENDING`, and no behavior is `DONE` while its task is open.
Thirteen ticked tasks name behaviors whose state is `BASELINE` and not `DONE` (finding 4): T1324, T1326, T1327, T1330, T1333, T1334, T1353, T1354, T1359, T1372, T1377, T1383, T1385.
The cycle log discloses it.
The run command's own rule says a behavior covered by an existing passing test is marked `DONE` with the test named, so the state, and not the tick, is what should change.

## Findings

Verified by the auditor at the cited line. Ordered by severity.

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | HIGH (rubric: any `TEST_AFTER`) | 71 behaviors have no recorded red: 42 acceptance tests written after their code and 29 unit tests that passed on the first run. 59 have a killing mutant, 12 have none. This is a deviation from constitution principle V that only the captain can accept | cycle log groups 1 to 7; lists above |
| 2 | HIGH, vacuous assertion | A1345 asserts that D-100 contains `"H1"`, which passes through `"H10"` to `"H14"`. The regex `/stay[s]? open|not built|open/i` is `/open/i`. Swapping the built and the open lists would pass. It should split D-100 at "This release builds" and "stay open" and check each task in its own sentence with word boundaries | `test/acceptance/harness-docs.test.ts:38-41` |
| 3 | HIGH, re-implemented expectation | U1312 builds its expected tools and skills with `toolsForMetadata` and `skillsForMetadata`, the functions the callback calls. U1363 expects `message` equal to `admit("pi","local-only")`, the function the gate calls. Literal pins exist elsewhere (U1364, the old tests of the two functions, A1313's tool names), so the exposure is low. It should assert literal lists and a literal message fragment | `src/tools/register.test.ts:126-127`, `src/dispatch/gate.test.ts:99` |
| 4 | HIGH, completion claim | 13 ticked tasks name 15 behaviors that are `BASELINE` and not `DONE`. Mark each `DONE` with its named existing test (U1322, U1333 to U1335, U1337, U1338, U1349, U1353, U1354, U1394, U1399, U1404, U1409, U1465, U1472) | `tasks.md`, `tdd/test-list.md` |
| 5 | MED, wrong reason | A1318's "the configured default" case sends a `ship` task to a config that has a `ship` rule, so the profile comes from the rule and the default leg of AC-3.3 is never exercised. A1321 has the same property. It should use a config with no rule that matches (or no rules) | `test/acceptance/harness-admission.test.ts:13,50,90` |
| 6 | MED, weak acceptance test | A1335 (AC-5.6, "an array behaves as before") uses an array equal to the default ladder, so a mutant that ignores arrays (`ladderFor` returns the default) survives at acceptance level and only U1396 kills it. It should use an array that differs from the default | `test/acceptance/harness-models.test.ts:83-89`; audit mutant S8 |
| 7 | MED, wrong reason | The "a flag whose value is another flag" row has an odd number of arguments, so `parseFlags` returns null at the length check and the `startsWith("--")` guard is not reached. It should use an even-length input, for example `["--provider","--project","--model","x"]` | `src/dispatch/init.test.ts:44`, `src/dispatch/init.ts:28,32` |
| 8 | MED, mystery guest and fail-open defaults | `FakeBbPort` derives every state as `ready` and lists a generous model list for every provider, and `loadWorld` supplies `TEST_DEFAULT_DISPATCH` with `standingPermission.lowerReasoning: true`. A1319 and A1323 pass only because `opus`, `sonnet`, `haiku`, and `m` are in the unscripted list, and that dependence is invisible in them. A test that forgets to script a gate passes silently. The generous list is defined twice and can drift. The defaults are documented in the fixtures and in `tdd-profile.md`. It should add a fixture self-test that pins the defaults, define the list once, and comment the dependence where a test relies on it | `test/fixtures/bb-port.ts:14,193-212`, `test/fixtures/plugin-host.ts:59,219-233` |
| 9 | MED, redundant tests | U1306 to U1309 repeat what U1301 to U1305 pin; A1310 and A1311 sit at the level of U1301 to U1304 and U1310; U1322 equals U730; the second A1324 case repeats the directory creation that the first case covers | `src/harness/contracts.test.ts:131-155`, `test/acceptance/harness-configure.test.ts:15-24`, `src/dispatch/availability.test.ts:123`, `test/acceptance/harness-default.test.ts:163-170` |
| 10 | MED, weak negative predicates | U1440 keeps a denylist of write methods and an exact set of read methods, so a new write method is missed and an extra read fails it. A1329 uses a regex denylist of SDK paths and scans the file for credential words, which cannot find a real secret. Both should assert an allowlist of the exact reads | `src/dispatch/init.test.ts:243-245`, `test/acceptance/harness-default.test.ts:158-160` |
| 11 | MED, predicates that claim more than they assert | The harness lint case asserts `length > 0` where the sibling tests assert one message that names the module. The docs case "tells the runbook reader to stop..." only checks that `no_default_profile` appears. A1313 says "exactly the tools and skills as before" and asserts tool names for 2 of 18 combinations and never asserts skills | `test/acceptance/lint-isolation.test.ts:154`, `test/acceptance/harness-docs.test.ts:74-76`, `test/acceptance/harness-configure.test.ts:28-39` |
| 12 | MED, coverage side effect | After A710 rows 1 and 2 changed, no acceptance test reaches the `!found.available` branch of `checkProfile`, because the state check answers first. U731 and U732 still cover it. It should script `providerStates` as ready next to an unavailable or unlisted provider | `test/acceptance/dispatch-resolver.test.ts:131-132`, `src/dispatch/availability.ts:62` |
| 13 | MED, bypassed utility | An inline `ProviderState` literal where `providerState()` exists | `src/dispatch/init.test.ts:234` |
| 14 | LOW, wrong or missing ids | U1413 to U1417 carry no id of their own (all eight argument rows are tagged U1412). The test at `src/tools/dispatch.test.ts:238` is tagged U1411 and asserts the block (U1408 and A1322). The test at `src/machines/preflight.test.ts:80` is tagged U1348 and asserts U1349's behavior | `src/dispatch/init.test.ts:39-48`, `src/tools/dispatch.test.ts:238`, `src/machines/preflight.test.ts:80` |
| 15 | LOW | U1451's first assertion matches no sign-in pattern, so only its second tests precedence; U1454's second assertion tests a text pattern and not the category; U1446 packs six rules into one input; the first A1341 case cannot exceed 600 characters, so only the second A1341 case, U1470, and U1471 kill the limit mutant; U1468 is named "reads the cause once" and never counts reads; U1340 and U1418 test several behaviors; U1410 has an `if` in a loop, with an unconditional final assertion; U1407's second assertion depends on the OS name limit (`ENAMETOOLONG`); magic values (800, `+ 4`, 3); loose regexes in U1391 and U1392; `world.sent(...).length = 0` mutates a live array | `failure-cause.test.ts:19-21,44-48,58-61`, `harness-failure.test.ts:16,55-63,72`, `handlers.test.ts:125-135`, `gate.test.ts:15-26`, `init.test.ts:56-63`, `resolver.test.ts:103-111`, `files.test.ts:55-61`, `config.test.ts` |
| 16 | LOW, untested fail-closed branches | `init.ts` has no test for `getProjectCheckout` throwing (`:55-57`), `listProviders` throwing (`:61-65`), or the provider-wide level fallback (`:80`). The test list does not name them | `src/dispatch/init.ts` |

Properties: the suite is deterministic (no real clock, network, or sleep), isolated (each test builds its own world), and fast (31 seconds for 1604 tests, about 2 seconds for the 16 new files).
The new tests are mostly specific about what broke (exact messages), and mostly coupled to behavior and not to structure.
Several tests match log strings (U1351, U1352) where the test list requires the log to name the message.

## Mutation results

No mutation tool is installed (the profile says so), so test strength is a sample of deliberate mutants.
This audit applied 20 of its own, one at a time, each restored byte for byte (a hash check in the runner) and followed by a green suite.
Scope: the production files of the feature.
Not an exhaustive or a tool-measured score.

| Mutant | Killed by | Judgment |
| --- | --- | --- |
| S1 tool hint on by default at the plugin factory (`server.ts`) | A1313 | Caught |
| S2 an unknown provider gets the claude-code row | A1311, A1315, A1350, U1310, U1311, U1315, U1382, U1473 | Caught |
| S3 a hint for every worker | A1315, U1315 | Caught |
| S4a expired counts as ready | A1302, U1326, U1331, U1345, U1368 | Caught |
| S4b too-old version counts as ready | A1303, U1327, U1328 | Caught |
| S4c status unknown counts as ready | A1304, U1329 | Caught |
| S6 codex refused in local-only | A1319, U1302, U1361 | Caught |
| S7 a model with unknown levels judged by its listed levels | A1334, A710, U1377, U1378 | Caught |
| S8 an array ladder is ignored | U1396 only | Caught by a unit test; A1335 survived (finding 6) |
| S9 the queue start ignores the gate | A1307, A1320, A1350, U1351, U1352, U1367, U1368, U1473 | Caught |
| S11 init does not check that the provider is listed | A1327, U1432 | Caught |
| S12 init changes state in bb | A1329, U1440 | Caught |
| S13 no remedy line | A1341, A1342, U1449, U1450, U1451, U1464 | Caught |
| S17 the queue start fails a task on any block | A1307, A1350, U1351, U1352, U1368, U1473 | Caught |
| S18 a ready named provider gives a preflight problem | 31 tests, among them A1305, U1346 | Caught |
| S19 dispatch reads provider states before it places the machine | A1304, U1356, U1357 | Caught |
| S20 the level check runs before the mode check | A1330, U1336, U1374, U1375, U1386 to U1388 | Caught |
| S21 the failed wake limit is 600 | A1341, U1470, U1471 | Caught |
| S22 queue admission checks the wrong mode | A1320, U1367 | Caught |
| S23 a supervisor-like role also gets the hint | A1315, U1316 | Caught |

The cycle log records the mutants of each group (M1 to M20 of the test list, among them M7 and M13, which survived the first version of a test and were killed after it was strengthened).
No survivor sits inside a `DONE` behavior after the strengthening.
Coverage was not run (none installed).

## Traceability

All 47 acceptance criteria map to at least one `A` behavior, and every claimed test exists (a search found a test name that carries each `DONE` id, except U1413 to U1417, finding 14).
All 45 requirements and all 9 success criteria are named in the list's `traces` column.

| Criteria | Behaviors | End to end |
| --- | --- | --- |
| AC-1.1 to AC-1.8 | A1301 to A1308, U1323 to U1357 | Yes, through `loadWorld` and the registered tool, command, and handlers |
| AC-2.1, AC-2.2 | A1310, A1311 | The module's public function (the table has no other entry point) |
| AC-2.3 | A1312 | Yes, through ESLint's API |
| AC-2.4 to AC-2.6 | A1313 to A1315 | Yes, through `resolveAgentConfiguration` |
| AC-3.1, AC-3.2, AC-3.4 to AC-3.6 | A1316, A1317, A1319 to A1321 | Yes |
| AC-3.3 | A1318 | **Partial**: the override and rule legs, not the default leg (finding 5) |
| AC-4.1 to AC-4.8 | A1322 to A1329 | Yes, including the registered CLI command and a real temporary checkout |
| AC-5.1 to AC-5.9 | A1330 to A1338 | Yes. AC-5.6's test cannot tell an ignored array from a used one (finding 6) |
| AC-6.1 to AC-6.6 | A1339 to A1344 | Yes, through `thread.failed` |
| AC-7.1 to AC-7.4 | A1345 to A1348 | Reads the docs files (finding 2 and 11 weaken A1345) |

Untested criteria: none. Tests tracing to nothing: a few cases carry no id (the "four named rows" count, the Pi pass-through case in `gate.test.ts`, the `readinessProblem` case, and the pass cases of the lint tests); each guards a part of a listed behavior.

## What was not audited

- Mutation was not measured by a tool. 20 mutants were sampled in this audit, and the log adds the mutants of each group. About 12 `TEST_AFTER` behaviors have no mutant yet.
- Coverage: not installed.
- The unchanged remainder of the pre-existing test files that the feature edited. The subagent read the diffs with context.
- Whether bb's real `providerStates`, `providers.models`, and `threads.events.list` answers have the shapes the fakes use, and whether a spawn resolves a model by `id` or by `model`. That is the owner's live check (`quickstart.md`, part 2).
- The distinction between `instructions: null` and an absent key (the fake host reports both as null).
- Performance and load: no criterion, no test.
- The browser side (`src/app`), which this feature did not touch.
- Independence: the author ran the audit (see the note at the top).
