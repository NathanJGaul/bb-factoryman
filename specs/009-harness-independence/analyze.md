# Specification analysis: agent-harness independence

**Purpose**: Check the finished implementation against `spec.md`, `plan.md`, `tasks.md`, the contracts, the test list, and the constitution, after the implementation and the second TDD audit.
**Created**: 2026-11-08
**Feature**: [spec.md](spec.md)
**Analyzed at**: `d7977aa` (code and docs read, not only the artifacts)

This analysis changed no file other than itself.
The author of the code ran it, so it is not independent.

## Summary

The implementation matches the specification, the plan, and the contracts in every behavior that the tests pin.
Every requirement (45 of 45), every acceptance criterion (47 of 47), and every success criterion (9 of 9) has a task, a test, or a recorded rule that covers it.
One constitution item is open and known: principle V (71 behaviors have no recorded red), which D-108 records for the captain to accept.
The other findings are one gap in the admission rule, one race to settle in the live check, one question about the constitution's scope text, and a handful of places where a document lags the code.
None of them blocks the pull request, and the two that need a decision belong to the captain.

## Findings

| ID | Category | Severity | Location | Summary | Recommendation |
| --- | --- | --- | --- | --- | --- |
| C1 | Constitution | CRITICAL (known, recorded) | `.specify/memory/constitution.md` principle V; `docs/DECISIONS.md` D-108; `tdd/verification.md` finding 1 | 71 of 227 behaviors have no recorded red (42 acceptance tests written after their code, 29 unit tests that passed on the first run). Each has a killing mutant in the ledger. The repository commits only on green, so the order cannot be rewritten | The captain accepts D-108, as D-099 was accepted for feature 008, or orders the 71 redone test-first. Not a worker decision |
| C2 | Constitution | RESOLVED (was MEDIUM) | `.specify/memory/constitution.md` "VI. Scope discipline" and "Governance"; `docs/DECISIONS.md` D-100 | Principle VI lists milestones 1 to 11 as the scope. This feature extends it by the captain's task. D-100 gives the reason and leaves the text as it is (precedent D-068), but Governance says an amendment needs a reason and a version bump | Resolved on 2026-11-09: the captain ordered the amendment, and constitution 1.3.0 adds the scope line to Principle VI (D-117) |
| U1 | Underspecification | MEDIUM | `src/dispatch/gate.ts:17-23`; `src/harness/contracts.ts` (generic row); `spec.md` FR-1326 | The Pi refusal keys on the bb provider ID `pi`. The same harness behind another provider ID (an ACP registry entry such as `pi-acp`) gets the generic row, which has `sandbox: "unknown"` and no refused mode, so it is admitted in `local-only` mode. FR-1326 says that a provider with no row is never refused by this rule, and the captain's decision D3 names Pi only | The captain decides whether a harness with an unknown sandbox is also refused in `local-only`, or whether each such provider gets its own row when it is admitted. Record the choice in D-103 |
| U2 | Underspecification | MEDIUM | `src/wiring/handlers.ts:40,47`; `spec.md:223` | The edge case says that the grace wait applies when the thread's events are not yet written. The wait runs only when the error text is empty (`:40`). With an error text, the cause is read at once, so if bb writes the error event after it sends `thread.failed`, the evidence silently lacks the cause (the fail-closed fallback of FR-1356 keeps today's text) | Add a live-check step that fails a worker with an error text and reads the evidence, and wait briefly before the read if the cause is missing. Not covered by a fake |
| U3 | Underspecification | LOW | `src/dispatch/gate.ts:48-52`; `src/limits/queue.ts` (drain) | Every dispatch, and every queued task on every drain, now makes three bb reads (providers, states, models). The model read may start a CLI in a real bb. The latency was not measured | Time the three reads in the live check. Cache nothing before there is a number |
| I1 | Inconsistency | MEDIUM | `contracts/dispatch-gate.md:31` against `src/dispatch/availability.ts:66-83` | The contract says that every `provider_unavailable` message ends "No other provider was tried." The mode, level, and model messages do not end with it (they keep today's text), and only the readiness, listing, and admission messages do | Change the contract to name those three messages |
| I2 | Inconsistency | LOW | `plan.md:88` against `src/harness/contracts.ts` | The plan says the generic row is a frozen object. The rows are `readonly` in their type and are not frozen at run time, so a caller of `contractFor` could change the shared table | Freeze the rows with `Object.freeze` (and test it), or edit the plan |
| I3 | Inconsistency | LOW | `plan.md` "Source layout" against `src/dispatch/types.ts`, `config.ts` | The plan puts `ladderFor` in `config.ts`. It is in `types.ts`, and `config.ts` re-exports it, because test A718 lets the resolver import only `./types`. D-105 records it. The layout also omits `test/fixtures/models.ts`, `test/fixtures/defaults.test.ts`, and `tdd/ledger-mutants.py` | Update the plan's layout |
| I4 | Inconsistency | LOW | `contracts/cli-dispatch-init.md`; `spec.md` FR-1333 against `src/dispatch/init.ts:32` | A flag whose value is another flag also gives the usage error. The contract and FR-1333 list a missing, blank, repeated, or unknown flag only | Add the case to the contract (U1414 pins it) |
| I5 | Inconsistency | LOW | `tdd/test-list.md` frontmatter | `updated_at` is still `b0ccb09`, though rows changed in every group, and U1474 to U1477 were added after planning | Set `updated_at` to the final commit |
| I6 | Inconsistency | LOW | `tdd/cycle-log.md:6` | The log's intro says tests are committed with stubs first. The repository commits on green only, and the log's notes say so. The log is append only | Leave it; the notes correct it |
| I7 | Inconsistency | LOW | `src/dispatch/gate.ts:9,57`; `data-model.md` "Gate result" | `permanent` is typed `boolean` on `provider_unavailable` but is always `false` there; the data model says it is true for the admission refusal only | Type it as the literal `false` for readiness blocks |
| I8 | Inconsistency | LOW | `skills/factoryman-supervisor/SKILL.md:38` | The supervisor skill tells the supervisor to tell the owner what a block means. That covers the new blocks, but it does not name `no_default_profile` or `dispatch init`, which only the owner can run | Optional: one line that readiness and `no_default_profile` blocks are the owner's to fix |

## Coverage

All 45 functional requirements and all 9 success criteria are covered.
The table names the tasks that carry a requirement's behaviors and the behaviors that trace to it (first five).

| Requirement | Has task? | Task IDs | Behaviors |
| --- | --- | --- | --- |
| FR-1301 | Yes | T1311, T1313, T1314, T1315 (+1) | A1310, A1312 |
| FR-1302 | Yes | T1310, T1313, T1314, T1317 | A1310, U1301, U1302, U1303, U1304 (+1) |
| FR-1303 | Yes | T1310, T1313, T1314, T1317 | A1311, U1309, U1310, U1311 |
| FR-1304 | Yes | T1310, T1314 | U1301, U1302, U1303, U1304, U1305 |
| FR-1305 | Yes | T1312, T1313, T1316, T1317 | A1313, U1312 |
| FR-1306 | Yes | T1310, T1312, T1313, T1314 (+2) | A1314, A1315, U1308, U1313, U1314 (+3) |
| FR-1307 | Yes | T1312, T1313, T1316, T1317 | A1313, U1312 |
| FR-1311 | Yes | T1320, T1321, T1325, T1328 (+3) | A1305, U1318, U1319, U1340 |
| FR-1312 | Yes | T1320, T1321, T1324, T1325 (+6) | A1301, A1304, U1320, U1321, U1329 (+8) |
| FR-1313 | Yes | T1324, T1328, T1330, T1335 | A1301, A1302, A1303, U1323, U1324 (+4) |
| FR-1314 | Yes | T1328, T1335, T1342, T1343 (+1) | A1301, A1309, A1321 |
| FR-1315 | Yes | T1326, T1328, T1334, T1335 | A1306, U1346, U1347, U1348, U1349 |
| FR-1316 | Yes | T1325, T1327, T1328, T1331 (+2) | A1307, U1345, U1351, U1352, U1354 |
| FR-1317 | Yes | T1324, T1330 | U1333, U1334, U1335, U1337, U1338 |
| FR-1318 | Yes | T1322, T1323, T1352, T1407 | none (a fixture rule: pinned by test/fixtures/defaults.test.ts, and the whole suite) |
| FR-1321 | Yes | T1310, T1314 | U1303, U1306, U1307 |
| FR-1322 | Yes | T1340, T1342, T1343, T1344 | A1316, U1358, U1363 |
| FR-1323 | Yes | T1340, T1342, T1343, T1344 | A1316, U1364 |
| FR-1324 | Yes | T1340, T1342, T1343, T1344 | A1317, U1359, U1360 |
| FR-1325 | Yes | T1341, T1342, T1343, T1344 | A1316, A1318, A1320, U1367, U1368 |
| FR-1326 | Yes | T1340, T1342, T1343, T1344 | A1319, U1361, U1362 |
| FR-1331 | Yes | T1372, T1375, T1377, T1379 | A1322, A1323, U1408, U1410, U1477 |
| FR-1332 | Yes | T1372, T1376, T1377 | U1410, U1411 |
| FR-1333 | Yes | T1373, T1374, T1375, T1378 (+2) | A1327, U1412, U1413, U1414, U1415 (+8) |
| FR-1334 | Yes | T1370, T1371, T1373, T1375 (+3) | A1324, A1326, U1405, U1406, U1407 (+2) |
| FR-1335 | Yes | T1373, T1375, T1378, T1379 (+1) | A1324, A1325, U1437 |
| FR-1336 | Yes | T1373, T1375, T1378, T1379 (+1) | A1324, A1328, U1419, U1420, U1421 (+10) |
| FR-1337 | Yes | T1373, T1375, T1378, T1379 | A1329, U1440 |
| FR-1338 | Yes | T1374, T1378 | U1443 |
| FR-1341 | Yes | T1353, T1357, T1359, T1361 | A1335, U1389, U1390, U1391, U1392 (+3) |
| FR-1342 | Yes | T1353, T1354, T1357, T1359 (+1) | A1336, A1337, U1396, U1397, U1398 (+4) |
| FR-1343 | Yes | T1350, T1351, T1355, T1360 | U1369, U1370, U1371, U1386, U1387 |
| FR-1344 | Yes | T1350, T1351, T1355, T1357 (+2) | A1330, A1331, A1334, U1371, U1374 (+2) |
| FR-1345 | Yes | T1350, T1351, T1355, T1357 (+2) | A1332, A1333, U1372, U1379, U1380 (+5) |
| FR-1346 | Yes | T1350, T1351, T1356, T1357 (+2) | A1338, U1344, U1373 |
| FR-1347 | Yes | T1357, T1360, T1361, T1398 | A1350, U1473 |
| FR-1351 | Yes | T1381, T1382, T1384, T1385 (+1) | A1339, U1456, U1457, U1458 |
| FR-1352 | Yes | T1383, T1384, T1385, T1386 | A1339, U1461, U1462, U1463, U1469 |
| FR-1353 | Yes | T1383, T1384, T1385, T1386 | A1341, U1470, U1471, U1472 |
| FR-1354 | Yes | T1380, T1383, T1384, T1385 (+1) | A1342, U1449, U1450, U1451, U1452 (+4) |
| FR-1355 | Yes | T1380, T1383, T1384, T1385 (+1) | A1344, U1445, U1446, U1447, U1448 (+1) |
| FR-1356 | Yes | T1383, T1384, T1385, T1386 | A1343, U1465, U1466 |
| FR-1361 | Yes | T1390, T1391, T1394 | A1345, A1346, A1347 |
| FR-1362 | Yes | T1390, T1392, T1394 | A1348 |
| FR-1371 | Yes | T1329, T1332 | U1357 |
| SC-1301 | Yes | T1328, T1335 | A1301, A1302, A1303, A1304 |
| SC-1302 | Yes | T1328, T1335 | A1305 |
| SC-1303 | Yes | T1342, T1343, T1344 | A1316, A1317 |
| SC-1304 | Yes | T1375, T1379 | A1322, A1325 |
| SC-1305 | Yes | T1357, T1361 | A1330, A1331, A1332, A1336 |
| SC-1306 | Yes | T1384, T1385, T1386 | A1340, A1341 |
| SC-1307 | Yes | T1313, T1316, T1317 | A1313 |
| SC-1308 | Yes | T1395 | A1349 |
| SC-1309 | Process | T1329, T1358, T1376 (update the existing tests) | none (a rule: recorded in the cycle log and D-107) |

All 47 acceptance criteria map to at least one `A` behavior (`tdd/verification.md`, "Traceability"), and each of those behaviors has a task that was ticked only when the behavior was `DONE`.

## Constitution alignment

| Principle | Result |
| --- | --- |
| I. Gates live in code and fail closed | Met. Every new check is a refusal before a task exists, and a failed read blocks. The eight hard rules did not change (`git diff b4e462a..HEAD` over `src/machine`, `src/store`, and the authority tools is empty). U1 is a scope question of the captain's decision, not a gate that fails open |
| II. The machine core is pure | Met. `src/machine/` has no diff |
| III. The event log is the source of truth | Met. The cause enters the `fail` event as evidence. No cache path changed |
| IV. Storage behind an interface | Met. `Files` gained `writeNew`, and the store is untouched |
| V. Test first | **Not met for 71 behaviors** (C1). Met for 137 behaviors. Mutation evidence exists for all 71. Tests were not weakened: one loosening was found by the second audit and restored (T1418) |
| VI. Scope discipline | Met (the captain's task, D-100, no non-goal added, no live install). The text question C2 is resolved by constitution 1.3.0 (D-117) |

Engineering constraints and workflow: the stack is unchanged and no dependency was added; the docs follow the sentence-per-line and plain-language rules; commits are small and carry no co-author line; `CHANGELOG.md` was not touched.

## Unmapped tasks

Twenty-nine of the 92 tasks carry no behavior id: T1301, T1322, T1323, T1352, T1358, T1393, T1396, T1397, T1399 to T1411, T1413, T1414, T1416, and T1418 to T1422.
They are the baseline run, the fixtures, the updates of existing tests, the docs and profile notes, the final gate, and the remediation and follow-up tasks.
Each traces to a requirement rule (FR-1318, FR-1362, SC-1308, SC-1309) or to an audit finding.
None is an orphan.

## Metrics

| Metric | Value |
| --- | --- |
| Requirements (FR, SC) | 45 FR and 9 SC (54), plus 47 acceptance criteria |
| Tasks | 92, all ticked |
| Behaviors on the test list | 227 (224 `DONE`, 3 `BASELINE`) |
| Requirements with at least one task | 54 of 54 (100%) |
| Acceptance criteria with an end-to-end test | 47 of 47 |
| Ambiguity count | 1 (U2) |
| Duplication count | 0 |
| Critical issues | 1 (C1, known and recorded) |
| Open findings of MEDIUM severity | 3 (U1, U2, I1); C2 is resolved (D-117) |

## Next actions

- The captain's items come first: accept D-108 or order the rework (C1), decide U1 and C2. They are listed in `checklist.md` as CHK1338 and CHK1339, and the worker's final status line will name them.
- Safe edits to documents, if wanted before the pull request: I1, I2, I3, I4, I5, I7, and I8. None changes behavior, and none is done here because this command writes only its own report.
- The live check (`quickstart.md`, part 2) should also settle U2 and U3.

## Update: C2 is resolved

On 2026-11-09 the captain ordered the constitution amended.
Constitution 1.3.0 adds a scope line for harness independence to Principle VI, with the reason and date in `docs/DECISIONS.md` D-117.
Finding C2 is resolved.
The text above stays as written at `d7977aa`, apart from the C2 row, the principle VI row, and the metric that C2 changes.
