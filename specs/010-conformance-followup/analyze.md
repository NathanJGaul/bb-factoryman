# Specification analysis: Conformance follow-up after the harness contracts landed

**Scope**: `spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `contracts/driver-delivery-mode.md`, `tdd/test-list.md`, and the implementation at `5555706`.
**Mode**: Read-only analysis. The only file written is this report.
**Date**: 2026-11-09

## Result

One finding is `CRITICAL` by the constitution's rule, and it is a recorded deviation that waits for the captain (A1).
No finding is `HIGH`.
Every requirement and every success criterion has a task and a test or a recorded live run.
The plan and the implementation differ in one place (the setup file is two files), and the plan text was left as written.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
| --- | --- | --- | --- | --- | --- |
| A1 | Constitution | CRITICAL | constitution V; `tdd/verification.md` finding 1; D-122 | Eleven behaviors have no recorded red, because the behavior was already true: U1506, U1509, U1529, and A1509 (the audit's four), and U1530 to U1535 and A1515 (the remediation's seven). Principle V says every behavior change is driven by a test that failed first. Each has a killing mutant on record. | The captain accepted D-122 on 2026-11-09, as for D-107 and D-116. Nothing to change in the code |
| B1 | Inconsistency | LOW | `plan.md` "Project structure" and Q6; `tasks.md` T021 and T027; D-121 | The plan and tasks name one setup file, `test/setup/private-tmpdir.ts`. The implementation has two: a pure module (`private-tmpdir.ts`) and the hook file (`private-tmpdir.setup.ts`). D-121 and `tdd/cycle-log.md` say so. | Leave the plan as the record of the design, and rely on D-121 for the final shape |
| B2 | Inconsistency | LOW | `plan.md` Q6 and `spec.md` edge cases | The plan says the setup file removes the directory after the file and the worker exit. The exit hook was removed after the audit (it was dead code), so only `afterAll` does the work. | D-121 says so. No change |
| C1 | Underspecification | MED | `spec.md` FR-010 | FR-010 asks that each citation of a decision number names an entry that says what the citation claims. The guard checks that the number exists, not that it fits. The fit was checked by reading (CHK1521) and D-120 says so. | Accept. A mechanical check of meaning is not possible. Keep the review step |
| C2 | Coverage | LOW | `tasks.md` | FR-013 (no change under `src/`, no deletion of directories that a run did not make) has no task, only a check in the checklist (CHK1504) and `git diff -- src`, which is empty. | Accept. The requirement is a constraint, and the checklist holds its evidence |
| C3 | Coverage | LOW | `spec.md` US5.4, SC-006; `tdd/test-list.md` A1512 | The leak count after a full run (SC-006) is a manual measure, not a test. The tests that keep it true are U1532 (the root config wires the setup file) and A1511 (the setup file removes what hosts leave). | Accept. The measure is in the cycle log, and the final `pnpm run check` repeats it |
| D1 | Duplication | LOW | `tdd/test-list.md` A1501 and A1505, existing A1313 | The pass half of A1501 and A1505 repeats the 12-row table that A1313 pins. | Accept. Each names the behavior of its own user story |
| E1 | Inconsistency | LOW | `spec.md` Edge cases, first bullet | The edge case says the runner does not check a mode that the contract refuses. U1529 and the fake lab now check it in the tests (not in the runner). | Accept. The runner still does not check it, and the tests do |
| E2 | Inconsistency | LOW | `spec.md` FR-014; result files | The result files name the plugin commit `1e7be3e`, and the final commit is later. Nothing under `tools/`, `src/`, `package.json`, the lock file, or `conformance/known-gaps.json` changed after `1e7be3e` (`git diff 1e7be3e..HEAD --stat -- tools src conformance/known-gaps.json package.json pnpm-lock.yaml` is empty), so the runs are runs of the final lab code. | Accept. The converge report says it |
| F1 | Ambiguity | LOW | `spec.md` SC-001 to SC-004 | The outcomes name verdicts of real runs and not a tool version. The omp CLI moved from 18.14.1 (live check) to 18.18.3 (these runs). | Accept. The result file names the version that ran |

No unresolved placeholder (`TODO`, `???`, `[NEEDS CLARIFICATION]`) remains in the spec, plan, or tasks.

## Coverage summary

| Requirement | Task ids | Behaviors and evidence |
| --- | --- | --- |
| FR-001 | T003, T008 | U1501, U1502, U1504 |
| FR-002 | T003, T008 | U1503, U1529, A1501 |
| FR-003 | T004, T009 | U1507, U1508, U1531, live runs |
| FR-004 | T006, T011 | U1509 to U1513, U1530 |
| FR-005 | T005, T010, T011 | U1510, U1511, U1516 |
| FR-006 | T006, T007, T011 | U1510, A1503, A1504 |
| FR-007 | T006, T011 | U1513, A1504 |
| FR-008 | T013 to T016, T055 | U1505, U1506, U1518, U1533, A1505, A1506 |
| FR-009 | T017 to T019 | U1519, U1520, A1507, A1508 |
| FR-010 | T020 to T023, T057 | U1521 to U1523, A1509, A1510, A1515 |
| FR-011 | T024 to T028, T053, T056 | U1524 to U1528, U1532, U1534, U1535, A1511 |
| FR-012 | T026, T053 | A1511, U1532 |
| FR-013 | none (constraint) | CHK1504, `git diff -- src` |
| FR-014 | T030 to T036 | A1513, A1514, the five result files |
| FR-015 | T037, T059 | D-118 to D-122 |

Success criteria SC-001 to SC-007 are each backed by a live run, a measure, or a test: SC-001 to SC-004 by the five runs, SC-005 by A1509, A1510, and A1515, SC-006 by the measure and U1532, SC-007 by `pnpm run check`.

## Constitution alignment

| Principle | Result |
| --- | --- |
| I. Gates live in code | No gate changed. The runs observe the Pi admission gate and the `direct-PR` review-ready gate. |
| II. Machine core is pure | `src/machine/` is untouched. |
| III. Event log is the source of truth | S4 still reads the event log and the task rows. |
| IV. Storage behind an interface | Untouched. U1531 reads the project row back through the store interface. |
| V. Test first | Met for 39 of 50 behaviors (35 with a recorded red and 4 live checks or existing tests). Eleven behaviors passed on their first run (A1). Test strength was checked with 14 deliberate mutants, then 7 more after the audit, and the survivors were closed. Every acceptance scenario has a test or a recorded live run. |
| VI. Scope | The captain's intent and the Firstmate spec name every edit. No tier 2 run, no credential, no change under `src/`. The live install into the owner's bb was not touched: every run happened in `bblab`. |

## Unmapped tasks

None. T001, T002, T012, T025, T029 to T037, T044 are setup, document, and measure tasks that serve a requirement (FR-014, FR-015, SC-006) without a behavior id.

## Metrics

- Requirements: 15 functional, 7 success criteria.
- Tasks: 60 (57 ticked, 3 open before the converge step: T042 this analysis, T043 the converge report, T044 the final check).
- Behaviors: 43 at planning, 50 after the remediation (A1501 to A1515 without A1512 to A1514 counted as live, U1501 to U1535).
- Coverage: 15 of 15 requirements have a task or a recorded check (100 percent), one of them (FR-013) through the checklist.
- Ambiguity findings: 1 (F1). Duplication findings: 1 (D1). Critical findings: 1 (A1, a recorded deviation).

## Next actions

- The captain accepted D-122 (A1) on 2026-11-09. Nothing else blocks the merge.
- Run `/speckit.converge` for the merge-readiness record, then the final `pnpm run check` (T044).
- Offer: concrete remediation edits for B1 and B2 (the plan text) are not needed, because D-121 holds the final design.
