---
feature: 001-core-state-machine-storage
verdict: PASS_WITH_GAPS
standard: .specify/extensions/tdd/templates/tdd-test-quality-rubric.md
verified_at: 6535cc5
behaviors: 112
proven: 103
likely: 8
test_after: 0
no_test: 0
not_applicable: 1
high_smells: 0
criteria_total: 26
criteria_covered: 26
mutation_score: 95 # scope: the 22 mutants in the first run, hand-applied, 21 non-control; the survivor was an equivalent mutant and its code is removed
mutants_survived: 1 # plus 1 control that must survive; see the mutation table
suite: 336 passed, 0 failed, 21s
---

# TDD verification: core scaffold, task state machine, and event storage

**This is the second run.** The first run (commit `101e9ea`, in git history) returned `FAIL` with two `HIGH` smells and eight `TEST_AFTER` behaviors. The remediation tasks R001 to R011 cleared them, and this run re-checks the result. Findings 1 to 7 and 12 are fixed, and finding 13 now has retro-red records. Findings 8 to 11 are accepted for the reasons given.

**Verdict: PASS_WITH_GAPS.** No `HIGH` smell remains and every criterion has an end-to-end test, but eight behaviors have only retro-red evidence: their tests landed after the code that already satisfied them.

**Independence.** The same session wrote the code and the tests, so this audit is not independent. To limit that, a fresh-context agent ran the smell pass over every test file, and I opened every line it cited before accepting a finding. I also re-read the files rather than rely on memory. The mutation sample, the history check, and the traceability check are mine.

## Evidence base

| Source | Result |
| --- | --- |
| Cycle log | 30 cycle headings (some cycles have an opening and a closing entry), each with the red command and output, or with a deliberate-mutant record where the test passed first. |
| Git history | One commit per cycle, 34 commits since the base. Each cycle commit adds the test and the code together, as the loop prescribes. History therefore shows no ordering by itself, and the cycle log carries the red. |
| Files as they stand | 19 test files, 336 tests, 21 seconds. |

No discrepancy exists between the cycle log and the history. Two entries were written after their commit (G15) or after a slip in the commit step (G7 committed with a lint error, repaired by G5b). Both entries say so.

## Test-first evidence

`PROVEN` means the cycle log records the failing command and output, and the test and code share a commit. Cycle IDs are in `cycle-log.md`.

| Cycle | Behaviors | Class | Evidence |
| --- | --- | --- | --- |
| G1 | A2 | PROVEN | `expected undefined to be './src/server.ts'` |
| G1 | A5 | NOT_APPLICABLE | Characterization baseline; mutant killed |
| G2 | A1 | PROVEN | `expected [] to deeply equal [ { level: 'info' ...` |
| G3 | U9 | PROVEN | `src/machine should exist` |
| G4 | A3, U1, U2, U3, U4 | PROVEN | `expected [] to have a length of 1` |
| G4 | A4 | LIKELY (retro-red) | Negative test, passed first; mutant killed |
| G5, G5b | U5, U6, U7, U8 | PROVEN | `expected [] to have a length of 1`; U8 red at G5b |
| G6 and G12 to G17 | A6 to A17 | PROVEN | Outer files red at G6, green at G15 |
| G7 | U10 to U15 | PROVEN | `Error: not implemented` (49 failed) |
| G8 to G10 | U16 to U25 | PROVEN | `TypeError` and placeholder refusals |
| G11 | U26 to U29 | PROVEN | Table and state-set mismatches |
| G12 | U30 to U35 | PROVEN | `Error: not implemented` (35 failed) |
| G13 | U37, U38 | PROVEN | Profile and URL not recorded |
| G13 | U36 | LIKELY (retro-red) | Four order tests passed first; six mutants killed |
| G14 | U39 | PROVEN | `expected {} to deeply equal { merge: 'denied' }` |
| G14 | U40, U41 | LIKELY (retro-red) | Passed first; mutants G and H killed |
| G15 | U42, U43 | PROVEN | Kind and approvals not reset |
| G16 | U44, U45 | LIKELY (retro-red) | All 14 passed first; mutants I to M killed |
| G17 | U46 | PROVEN | `transitionUsing is not a function` |
| G18 to G26 | A18 to A26 | PROVEN | Outer files red at G18, green at G26 |
| G19, G20 | U47 to U60 | PROVEN | `Error: not implemented` |
| G21, G22 | U61 to U68, U70 | PROVEN | Stub and atomicity reds |
| G22 | U69 | LIKELY (retro-red) | Both tests passed first (the G21 code already replayed from the log); mutant U killed |
| G23 | U71 to U75 | PROVEN | `Error: not implemented`; extra cases added after mutants S and T |
| G24 | U76 to U79 | PROVEN | `Error: not implemented` |
| G25 | U80 | LIKELY (retro-red) | An invariant test written over finished code; mutants W1 to W4 killed |
| G26 | U81 to U86 | PROVEN | `Error: not implemented` |

Counts: 103 `PROVEN`, 8 `LIKELY` (A4, U36, U40, U41, U44, U45, U69, U80), 1 `NOT_APPLICABLE` (A5), 0 `TEST_AFTER`, 0 `NO_TEST`.

The eight `LIKELY` behaviors are regression pins on behavior that an earlier red-first test already drove.
For example, U40, U41, U44, and U45 sit under the matrix test A11, which was written red at G6 before the table existed.
The first run classed them `TEST_AFTER`, because no red was recorded for the pin itself, and that alone made the verdict `FAIL`.
Remediation R010 added a retro-red record for each one to the cycle log: the covering code was broken once, the test failed for the right reason, and the code was restored. That makes them `LIKELY`. They do not become `PROVEN`, because the history shows the tests arriving with or after the code, and a retro-red proves strength and not order.

### Changes to tests that already existed

I diffed every modified test file across the history. The only removed lines are four import lines and one type annotation (`manifest.test.ts`, widened for `branding`).
No assertion was removed, loosened, skipped, or filtered, and no coverage or mutation threshold exists to lower.
Two edits of a test before its first commit are worth knowing: the slice fix in `replay.test.ts` (G23, a mistake in my expected value) and the refactor of the matrix oracle into `test/fixtures/legal-set.ts` (G6). Neither is in the history as a change to an existing test, and both are in the cycle log.
The G25 richness threshold was set from my first guess of 2000 to 1200 after I measured the walk. It guards the walk's richness and not the invariant.

### Task checkboxes against the list

Every ticked behavioral task has its behavior `DONE` or `BASELINE`.
The `Confirm ...` tasks (T021, T050, T054, T078) carry no behavior of their own and were ticked by hand. No behavioral task is unticked while its behavior is `DONE`.
Open at the time of the audit: T090 to T093, which are this lifecycle.

## Findings

Severity follows the rubric. Line numbers are from `HEAD` (`9ab26df`) and were checked by opening each line.

| # | Severity | Smell | Finding | Evidence |
| --- | --- | --- | --- | --- |
| 1 | HIGH (fixed) | Tautological assertion | `agrees with the real machines on the same input` compares `transitionUsing(MACHINES, ...)` with `transition(...)`, and `transition` is defined as that call. It cannot fail. | `src/machine/transition.test.ts:371-373`, `src/machine/transition.ts` (`transition`) |
| 2 | HIGH (fixed) | Vacuous assertion | The manifest test accepts any truthy `bb.name`, `bb.description`, and `bb.branding.icon`. An icon of `"x"` passes. | `test/acceptance/manifest.test.ts:20-22` |
| 3 | MED | Passes for a wrong implementation | The negative branch of `accepts exactly the table's transitions` builds a snapshot with no satisfied gates, so `can()` is false when a guard refuses, even if an extra table row exists. The matrix test catches it, so the pin is unit-level only. | `src/machine/table.test.ts:65` |
| 4 | MED | Passes for a wrong implementation | The wall-clock tests assert only that `at` parses as an ISO time, so a constant `1970-01-01T00:00:00.000Z` passes. | `src/store/task-log.test.ts:225-230`, `src/store/reconcile.test.ts:124-129` |
| 5 | MED | Passes for a wrong implementation | The lint helper keeps only `no-restricted-*` messages. The `passes lint` tests would also pass if ESLint ignored the file or hit a parse error. | `test/acceptance/lint-isolation.test.ts:10-15` |
| 6 | MED | Assertion weaker than its name | `log.apply` on a corrupt task asserts only `.ok === false`, not the `corrupt_log` code. | `test/acceptance/store-restart.test.ts:152` |
| 7 | MED | Re-implemented expectation | `nonTerminal` is derived from the store's own rows with the filter that `recover` uses. The replay tests compute their expected snapshot by folding the same machine. Literal row projections do exist in `task-log.test.ts` and `store-restart.test.ts`. | `test/acceptance/store-restart.test.ts:210,214`, `src/store/replay.test.ts:11-16` |
| 8 | MED | Redundant test | The shared store contract runs three times for each store (`memory.test.ts`, `sqlite.test.ts`, `store-contract.test.ts`). `machine-gates.test.ts` repeats cases that the matrix and `transition.test.ts` pin. Double-loop overlap is intended, but the contract triple run is plain duplication. | `src/store/memory.test.ts:4`, `src/store/sqlite.test.ts:9`, `test/acceptance/store-contract.test.ts:15-16` |
| 9 | MED | Decays at the next milestone | The layout test requires that `src/tools`, `src/dispatch`, and `skills` do not exist, so milestone 4 must change it. This follows FR-006 on purpose. | `test/acceptance/layout.test.ts:16` |
| 10 | MED | Implementation coupled | Several tests match error text (`/append-only/`, `/newer/`, `/CHECK/`, `"Log row"`) and the walk's richness thresholds. | `src/store/sqlite.test.ts`, `src/store/replay.test.ts`, `test/acceptance/store-random-walk.test.ts:112-113` |
| 11 | LOW | Several | `if (result.ok)` narrowing after an `expect`, duplicated `populate` and `STORES` helpers, a second event builder (`row` and `newEvent`), `KINDS` redefined in `table.test.ts`, and an unlabelled multi-assertion in `manifest.test.ts` and `store-contract.ts`. No assertion can be skipped by the narrowing. | `src/store/replay.test.ts`, `test/acceptance/store-restart.test.ts`, `test/fixtures/history.ts:10`, `test/store-contract.ts:7` |
| 12 | LOW | Redundant code | Mutant M15 shows that the final `structuredClone(next.context)` in `transition` is redundant, because the restored context is already a clone. It is an equivalent mutant. | `src/machine/transition.ts` (`run`) |
| 13 | HIGH in run 1 (rubric: `TEST_AFTER`) | Test-first | Eight behaviors were `TEST_AFTER`: A4, U36, U40, U41, U44, U45, U69, U80. | Test-first table above |

### Status after remediation

| # | Status |
| --- | --- |
| 1 | Fixed (R001). The test asserts literals, and two mutants fail the file. |
| 2 | Fixed (R002). Exact name, icon, and description pattern. |
| 3 | Fixed (R003). The negative branch also checks the configured events. |
| 4 | Fixed (R004). The time must fall between a read before and a read after. |
| 5 | Fixed (R005). The helper fails on a fatal message or an ignored file. |
| 6 | Fixed (R006). The `corrupt_log` code is asserted. |
| 7 | Fixed (R007). Task IDs and the replayed context are literal. |
| 8 | Accepted (R011). The triple contract run costs about 20 ms, and deleting a test to dedupe is not worth the audit risk. |
| 9 | Accepted (R011). FR-006 requires the test until milestone 4 replaces it. |
| 10 | Accepted (R011). The matched strings are documented store errors. |
| 11 | Accepted (R011). Cosmetic. |
| 12 | Fixed (R008). The redundant clone is gone. |
| 13 | Downgraded to `LIKELY` by the retro-red records (R010). It stays listed as a gap. |

The remaining points from the cold pass are accepted as they stand:
literal timing thresholds in the random walk are tripwires on richness and not on the invariant;
tests share no mutable state, use seeded randomness, and clean their temporary directories;
the random walk takes about 15 of the 21 seconds, so the suite stays under the 60 second target in SC-005.

## Mutation results

No mutation tool is installed, so I used deliberate mutants. I applied each one alone, ran the **full** suite, and restored the file from the committed copy.
After the run, `git status` showed a clean tree and the suite was green.
Sample: 22 mutants across 12 behaviors, covering every hard rule this feature enforces (1, 2, 3, 4, 8), the mode checks, the append-only log, atomicity, replay, and promotion. The cycle log records about 30 further mutants run during the loop.

| Mutant | File | Behavior | Result |
| --- | --- | --- | --- |
| M01 `mergeAuthorized` always passes | `guards.ts` | A6, U23 | Killed (6 tests) |
| M02 a denied merge decision authorizes | `guards.ts` | U23 | Killed (2) |
| M03 uncommitted changes ignored | `guards.ts` | A8, U25 | Killed (6) |
| M04 one unpushed commit allowed | `guards.ts` | U25 | Killed (6) |
| M05 whitespace counts as evidence | `guards.ts` | A9, U16 | Killed (8) |
| M06 any promote decision authorizes | `guards.ts` | A10, U24 | Killed (1) |
| M07 any non-worker records approvals | `guards.ts` | A17, U18 | Killed (2) |
| M08 merge row loses `mergeAuthorized` | `table.ts` | A6 | Killed (6) |
| M09 promote row loses `promotionAuthorized` | `table.ts` | A10 | Killed (3) |
| M10 ready row loses `modeIsNotNoMistakes` | `table.ts` | A12 | Killed (2) |
| M11 handoff row loses `modeIsNoMistakes` | `table.ts` | A13 | Killed (3) |
| M12 approval stored under `merge` for every scope | `effects.ts` | U39 | Killed (21) |
| M13 promotion keeps approvals | `effects.ts` | U42 | Killed (1) |
| M14 facade skips the guards | `transition.ts` | A6 to A17 | Killed (31) |
| M15 drop the output `structuredClone` | `transition.ts` | U33 | **Survived**: equivalent (finding 12) |
| M16 events accept unknown keys | `events.ts` | U12 | Killed (2) |
| M17 `task_event` UPDATE trigger disabled | `sqlite.ts` | A20, U56 | Killed (2) |
| M18 memory rollback removed | `memory.ts` | U52 | Killed (4) |
| M19 SQLite transaction without rollback | `sqlite.ts` | U52 | Killed (4) |
| M20 refused events not logged | `task-log.ts` | A19 | Killed (15) |
| M21 no-op change (control) | `reconcile.ts` | none | Survived, as a control must |
| M22 replay ignores a machine refusal | `replay.ts` | A22, U73 | Killed (1) |

Score: 20 of 21 non-control mutants killed (95%). The survivor is equivalent, so every behavior-changing mutant was caught. Remediation removed the redundant line that M15 mutated, so M15 no longer exists.
Scope: the 22 hand-applied mutants above, run against commit `9ab26df`, not the whole repository. The score is comparable only to a later run of the same list.
After remediation I re-ran 14 retro-red mutants for R010 and 9 strength mutants for R001 to R007 against the strengthened tests. All were killed (see the cycle log). I did not re-run the full list of 22.

The cold smell pass also named two weaknesses that the sample did not test: a lint-positive test that runs no rules (finding 5) and a constant timestamp (finding 4). Remediation tasks cover both.

## Traceability

Every scenario has at least one acceptance test through a real entry point.
The real entry point is the public function of the module (`transition`, `createTask`, `TaskLog`, the store factories, `replayTask`, `rebuildCache`, `recover`, `reconcile`, the plugin factory, and the ESLint API). No process-level or UI runner exists, so the acceptance layer is an in-process integration test.

| Criterion | Tests | End to end |
| --- | --- | --- |
| AC-1.1 | A1 `plugin.test.ts` | Yes (fake host) |
| AC-1.2 | A2 `manifest.test.ts` | Yes |
| AC-1.3, AC-1.4 | A3, A4, U1 to U8 `lint-isolation.test.ts` | Yes (ESLint API) |
| AC-1.5 | A5 `manifest.test.ts` | Yes, script wiring only; the owner-run build is in D-001 |
| AC-2.1, AC-2.2 | A6, A7 `machine-gates.test.ts`, U23 | Yes |
| AC-2.3 | A8, U25 | Yes |
| AC-2.4 | A9, U16 | Yes |
| AC-2.5 | A10, U24, U42, U43 | Yes |
| AC-2.6 | A11 `machine-matrix.test.ts`, U26 to U29 | Yes (330 pairs) |
| AC-2.7, AC-2.8 | A12, A13, U19 to U21, U38 | Yes |
| AC-2.9 | A14, U17, U37 | Yes |
| AC-2.10, AC-2.11 | A15, A16, U44 | Yes |
| AC-2.12 | A17, U18, U22, U39, U40 | Yes |
| AC-3.1, AC-3.2 | A18, A19, U61 to U67 | Yes (both stores) |
| AC-3.3 | A20, U49, U56, U57 | Yes |
| AC-3.4 | A21, U76, U80 | Yes (both stores) |
| AC-3.5 | A22, U73 to U75, U77 | Yes |
| AC-3.6 | A23, U81 to U86 | Yes |
| AC-3.7 | A24 `store-contract.test.ts`, U47 to U55 | Yes |
| AC-3.8 | A25, U53 | Yes |
| AC-3.9 | A26, U78, U79 | Yes (reopened SQLite file) |

Untested criteria: none.
Tests that trace to nothing: `test/toolchain.test.ts` (a dependency smoke test that guards the native `better-sqlite3` build) and the fixture sanity checks `covers every kind, state, and event type once` and `covers all 15 event types`. They guard the toolchain and the oracles and trace to no criterion on purpose.
Success criteria: SC-001 (matrix), SC-002 (A6 to A10 and A11), SC-003 (U80), SC-004 (A3), SC-005 (21 seconds), and SC-006 (A24) each have a check.

## What was not audited

- Coverage was not measured: `@vitest/coverage-v8` is not installed and setup may not add it.
- Mutation testing ran by hand on 22 mutants. No tool measured the whole repository.
- `bb plugin install` and a live bb load were not run. `bb plugin build` ran once, outside the suite, and passed (D-001).
- Concurrency between processes on one SQLite file, crash behavior mid-write beyond transaction rollback, and large logs (thousands of events per task) were not assessed. Replay cost is linear in a task's events.
- Performance was assessed only as total suite time.
- The audit is not independent of the author, apart from the cold smell pass, which I vetted line by line.
- The spec, plan, and task list were approved by the captain's stated intent and not by a separate review (D-007).
