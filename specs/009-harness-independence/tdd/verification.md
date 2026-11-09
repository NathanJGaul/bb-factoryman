---
feature: 009-harness-independence
verdict: FAIL
standard: .specify/extensions/tdd/templates/tdd-test-quality-rubric.md
verified_at: 2c4ee15
behaviors: 227
proven: 137
likely: 0
test_after: 71
no_test: 0
not_applicable: 19
high_smells: 0
criteria_total: 47
criteria_covered: 47
mutation_score: unmeasured (no mutation tool in the profile). Deliberate mutants only: 58 in the revert-red ledger (every one killed), 20 in the first audit and 9 in this one (every one killed)
mutants_survived: 0 (two survived a first version of a test in the loop, and one survived at acceptance level in the first audit; all were killed after the test was strengthened)
suite: 1626 passed, 0 failed, 107 files, 33 to 48 s
---

# TDD verification: Agent-harness independence (second run)

**Verdict: FAIL.** One rule still blocks: 71 of 227 behaviors have no recorded red, because their tests passed on the first run (42 acceptance tests written after their code and 29 unit tests that pin what stays true), and only the captain can accept that as a recorded deviation (D-108), as feature 008 did with D-099.
Everything else the first run found is repaired: no `HIGH` smell is open, no ticked task names a behavior that is not `DONE`, every acceptance criterion (47 of 47) reaches a test through its real entry point, no existing test was weakened, and every deliberate mutant that was run was killed.
Eleven new findings of `MED` and `LOW` severity are open.
None blocks, and each is a change to a test or a record.

**This audit was not fully independent.**
The session that wrote the code and the tests ran it.
It re-read every file it assessed, and a fresh-context read-only subagent did the smell pass over the remediation diff (`e25b94a..2c4ee15`, 26 files) and re-checked the 16 earlier findings.
The auditor opened the lines it cites for the new `MED` findings.
The subagent ran no mutants.

## Test-first evidence

The repository commits only on green (D-099), so the history shows each group's tests and code in one commit, and the cycle log is the only record of order.
No commit puts source before its test, and no log entry claims a red that its commit contradicts.
The remediation range changed no production code (`git diff e25b94a..HEAD -- src ':!*.test.ts'` is empty).

| Class | Count | Behaviors |
| --- | --- | --- |
| `PROVEN` | 137 | Every behavior whose test failed against a stub or the old code, with the command and the failure line in the cycle log of its group (including U1477, whose red is the one that group 6 recorded under the old tag U1411) |
| `TEST_AFTER` | 71 | The same 71 as in the first run, listed below |
| `NOT_APPLICABLE` | 19 | 15 formerly `BASELINE` behaviors, now `DONE` with their existing test named (they hold against code that this feature did not change); U1474 to U1476 (characterization of existing branches, `BASELINE`); A1349 (a manual run of the build) |
| `NO_TEST` | 0 | None |

`TEST_AFTER`, acceptance tests written after their code (42): A1301 to A1311, A1313, A1316 to A1344, A1350.
`TEST_AFTER`, unit tests that passed on their first run (29): U1306, U1307, U1312, U1315, U1316, U1336, U1346, U1357, U1359 to U1362, U1368, U1376 to U1378, U1383 to U1385, U1389, U1391, U1395, U1396, U1407, U1445, U1447, U1455, U1469, and U1473.
In place of a red, `tdd/cycle-log.md` ("Remediation 1") holds a ledger with one killing mutant for each of the 71 (58 mutants, no survivor).
This audit counted 71 rows and re-ran 9 of its mutants (see "Mutation results").
D-108 in `docs/DECISIONS.md` records the deviation and leaves the choice (accept, or order the 71 redone test-first) to the captain.
The ledger does not make them test-first, and the rubric has no class for "accepted deviation".

### What the feature did to tests that already existed

The first run's table stands: no assertion was weakened, no test skipped, and `vitest.config.ts`, `package.json`, and `tsconfig.json` have no diff.
The remediation range removed no test.
A comparison of every test title before and after found these successors: the eight argument rows of `dispatch init` became eight tests with ids U1412 to U1417; U1418 became two tests; U1446 became five; U1451 became two; the second U1348 is U1349; the second U1411 is U1477; A1313, A1335, and A1345 have new titles and stronger assertions; U1340 gained a second test (finding 17).
One assertion was loosened: finding 20.

### Task checkboxes against the list

All 84 tasks are ticked, and no ticked task names a behavior whose state is not `DONE` (a script check of every `[Uxxxx]` and `[Axxxx]` marker).
T1414 is ticked although its proof ("three red entries") is not met as written (finding 22).

## The 16 findings of the first run

| # | Status | Evidence |
| --- | --- | --- |
| 1 | OPEN, by design | 71 `TEST_AFTER`; D-108 waits for the captain (`docs/DECISIONS.md`) |
| 2 | FIXED | `harness-docs.test.ts:39-56` checks each task in its own sentence with word boundaries; dropping H1 and swapping the two lists both fail it |
| 3 | FIXED | literal tool and skill lists in `register.test.ts:107-128`; literal fragment in `gate.test.ts:98-102` |
| 4 | CHANGED | the 15 formerly `BASELINE` behaviors are `DONE`; U1474 to U1476 are `BASELINE` and T1414 is ticked (finding 22) |
| 5 | FIXED | `harness-admission.test.ts:15,52,94`: `CONFIG_DEFAULT_ONLY` has no rules; a resolver that ignores `default` fails A1318 and A1321 |
| 6 | FIXED | `harness-models.test.ts:81-91`: the array ends in `ultra`; mutant L37 fails A1335 |
| 7 | FIXED | `init.test.ts:52`: the row reaches the guard; removing the guard fails U1414 |
| 8 | FIXED, residual | one model list (`test/fixtures/models.ts`) and `test/fixtures/defaults.test.ts`; finding 18 says what the pin does not catch |
| 9 | OPEN (LOW to MED) | the redundant tests were kept (finding 19) |
| 10 | FIXED | A1329 asserts the exact SDK path set and the shape of the written file; U1440 is an allowlist (but see finding 20) |
| 11 | FIXED | exact message count and wording in the lint cases, the full runbook sentence, and all 18 role and provider pairs in A1313 |
| 12 | FIXED | two A710 cases script a ready state beside an unavailable and an unlisted provider |
| 13 | FIXED | `init.test.ts` uses `providerState()` |
| 14 | FIXED | ids U1412 to U1417 each have a test; U1477 and U1349 are retagged |
| 15 | MOSTLY FIXED | U1446, U1454, U1467, U1468, U1418, U1410, U1407 (first assertion), `harness-failure.test.ts:16`, and the config regexes are fixed; U1451, the magic numbers, and U1340 remain (findings 17, 21, 23) |
| 16 | FIXED | U1474, U1475, and two U1476 tests in `init.test.ts:180-208`; the four mutants fail them |

## Findings (open)

Ordered by severity. The auditor opened the lines of findings 17 to 20.

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | HIGH by rule | 71 behaviors `TEST_AFTER` (see above) | cycle log, ledger; D-108 |
| 17 | MED, redundant test with a misleading name | The second `[U1340]` runs `gateProfile(new FakeBbPort(), ...)` and expects `{ok:true}`, which is U1339 again. Its title claims a contrast with the remote machine, but it shares no `bb` with the first U1340 | `src/dispatch/gate.test.ts:26-28` against `:12-14` |
| 18 | MED, the pin checks the wiring, not the content | `defaults.test.ts` compares the fakes' model IDs with `DEFAULT_MODEL_IDS`, which it imports from `models.ts`. Removing `"m"` from the list passes this file (A1319 and A1323 fail instead), and removing `"opus"` fails it only through the dispatch case. The T1407 proof overclaims. It should assert the literal IDs that the tests rely on | `test/fixtures/defaults.test.ts:28-48`, `test/fixtures/models.ts:6` |
| 19 | MED, redundant tests | U1410 repeats U811's source assertions, so only the "no `BUILTIN_PROFILE` export" line is new; U1306 to U1309 repeat U1301 to U1305; A1310 and A1311 sit at the level of U1301 to U1304; U1322 equals U730; the second A1324 case repeats the first | `resolver.test.ts:103-109` and `:58-62`, `contracts.test.ts:131-165`, `harness-configure.test.ts:15-24`, `availability.test.ts:123`, `harness-default.test.ts:167-174` |
| 20 | MED, assertion loosened | At `e25b94a` U1440 asserted that the set of methods called equals `{getProjectCheckout, listProviders, listModels}`. Now any extra read passes. The loosening is not recorded, and A1329 catches it only at the SDK path level | `src/dispatch/init.test.ts:276-284` |
| 21 | LOW | `lint-isolation.test.ts:156` keys the expected message count on a display label (`name === "a bare node built-in" ? 2 : 1`); `config.test.ts:92` pins a path that comes from zod's union error; `failure-cause.test.ts:60-62` is titled as a precedence case but `OMP_NO_MODEL` matches no sign-in pattern, so only `:64-66` tests precedence; leftover magic numbers in `harness-failure.test.ts` (`+ 200`, `.repeat(4)`, 400, 500) and the filesystem name limit in `files.test.ts:61` | as cited |
| 22 | LOW | U1474 to U1476 stay `BASELINE` and T1414 is ticked, though its proof ("three red entries") is not met; only the cycle log says so. The second U1476 test cannot tell the provider-wide fallback from the model's own levels, because all three agree on `medium` (`init.test.ts:204-208`), and the first packs two scenarios into one test | `tdd/test-list.md:307-309`, `tasks.md:198` |
| 23 | LOW | `init.test.ts:40-47` builds tests with a helper where the exemplar (`guards.test.ts:7,12`) uses `it.each`; the `test` column of U1349 points at `[U839]` and that of U1322 at `[U730]`, although tests with the new ids exist; `tdd-profile.md:64` still says feature 009 adds "no new file", and `test/fixtures/models.ts` and `defaults.test.ts` are new; `harness-docs.test.ts:35` accepts a missing D-108 and would fail on a D-109 | as cited |
| 24 | LOW | The mutant list and the runner of the ledger are in a scratch directory outside the repository, so a reader can confirm the 71 rows but not re-run the 58 mutants from the repository | `tdd/cycle-log.md`, "Remediation 1" |

Properties: deterministic (no real clock, network, or sleep), isolated, and fast (107 files in 33 to 48 seconds).
The fixtures still fail open by design (a ready state, a generous model list, a default `dispatch.json`), and the defaults are now pinned and documented where tests rely on them.

## Mutation results

No mutation tool is installed (the profile says so).
Scope: the production files of the feature, by deliberate mutants, one at a time, each restored and followed by a green suite.
This run re-ran nine mutants on behaviors that the remediation re-tested.

| Mutant | Killed by | Judgment |
| --- | --- | --- |
| an array ladder is ignored | A1335, U1396 | Caught (A1335 could not catch it in the first run) |
| the resolver ignores `default` | A1318, A1321, A1323, A1325, U1410, U1411 | Caught |
| `dispatch init` sends a message | A1329, U1440 | Caught |
| `boundCause` cuts at 299 | A1341, U1447 | Caught |
| the queue start fails a task on any block | A1307, A1350, U1351, U1352, U1368, U1473 | Caught |
| the value-is-a-flag guard removed | U1414 | Caught |
| the cut is one character too long | U1448, U1467 | Caught |
| `loadWorld` lists an unavailable provider as ready | the `defaults` case "answers providerStates..." | Caught |
| the default model list loses `opus` | the `defaults` case "dispatches the explicit test profile" | Caught, but not by the list pin (finding 18) |

The ledger and the first audit hold 78 more, with no survivor.
Coverage was not run (none installed).

## Traceability

All 47 acceptance criteria map to at least one `A` behavior and to a test that exists and runs (a script search found a test name that carries each `DONE` behavior's id, except the 15 formerly `BASELINE` behaviors, whose `test` column names the existing tests).
All 45 requirements and all 9 success criteria are named in the list.
AC-3.3's default leg, which the first run found unexercised, is now judged by A1318 and A1321 with a config that has no rule.
Untested criteria: none.
Tests tracing to nothing: a few cases carry no id (the "four named rows" count, the Pi pass-through case in `gate.test.ts`, the `readinessProblem` case, the lint pass cases, the fixture defaults); each guards a part of a listed behavior or a fixture.

## What was not audited

- Mutation was not measured by a tool. At least 87 deliberate mutants were run in total (58 in the ledger, 20 in the first audit, 9 in this one, and more in the loop), and none survives, but the sample is not exhaustive.
- Coverage: not installed.
- The unchanged remainder of the pre-existing test files that the feature edited.
- Whether bb's real `providerStates`, `providers.models`, and `threads.events.list` answers have the shapes the fakes use, and whether a spawn resolves a model by `id` or by `model`. That is the owner's live check (`quickstart.md`, part 2).
- The difference between `instructions: null` and an absent key (the fake host reports both as null).
- The mutants of the ledger, which this audit could not re-run from the repository (finding 24).
- Performance and load: no criterion, no test.
- Independence: the author ran the audit (see the note at the top).

## Update after the audit (not part of the audit)

Findings 17 to 24 were open at `verified_at: 2c4ee15`.
The worker repaired them afterwards in tasks T1415 to T1422 (tests, fixtures, records, and the ledger runner only; no production code), and `tdd/cycle-log.md` ("Remediation 3") has the evidence for each.
The audit did not re-read those changes.
The verdict and finding 1 do not change: 71 behaviors stay `TEST_AFTER` until the captain accepts D-108.
