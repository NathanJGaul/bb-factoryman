# Specification analysis: Apply a base branch

**Created**: 2026-11-12
**Scope**: `spec.md`, `plan.md`, `tasks.md`, the constitution, and the code and tests as built at `e596ce3`.
This analysis changed no artifact. The findings below are recorded here and handled in `converge.md`.

## Findings

| ID | Category | Severity | Location | Summary | Recommendation |
| --- | --- | --- | --- | --- | --- |
| I1 | Inconsistency | MEDIUM | `spec.md` SC-004 and `test/acceptance/live-check.test.ts` `[A1109]` | SC-004 says the existing tests pass without edits, but `[A1109]` lists the allowed flags of each command and needed `--base-branch` added. No assertion was weakened, and the edit is a changed requirement. | Reword SC-004 to name that one edit (done in `converge.md`). |
| I2 | Inconsistency | LOW | `tasks.md` T008 | T008 says the `[A1506]` test lives in `registry-apply-base-branch.test.ts`. It lives in `registry-apply-base-branch-docs.test.ts`, with the `[A1507]` tests. | Note only. The test list names the true file. |
| I3 | Terminology | LOW | `plan.md`, `research.md` ("hint line") against `spec.md` and the output ("Warning:") | The same output line has two names. | Note only. The contract, the test, and D-150 use `Warning:`. |
| I4 | Process | LOW | commit 3659ecc | The spec commit cited D-150 before `docs/DECISIONS.md` held it, so the decision-log test was red at that commit. Green from bbc2a6f. | Recorded in `tdd/cycle-log.md` cycle 1 and `tdd/verification.md` finding 4. |
| I5 | Coverage | LOW | `spec.md` edge case "Branch names are case-sensitive" | No test shows that `Main` and `main` stay distinct. The code stores the value as typed, so the behavior holds by construction, and the mutant that trims showed a related path. | Accept. No bug class here that a test would catch beyond V9. |

No CRITICAL or HIGH finding.

## Constitution alignment

- I. Gates fail closed: the flag is owner-typed, validated in code, and `workflow.json` cannot set it (D-078 holds). No gate is removed or loosened. Aligned.
- II. Machine core pure: `src/machine/` is untouched. Aligned.
- III. Event log: the apply writes the config cache only, as D-148 recorded. Aligned.
- IV. Storage behind an interface: no store change. Aligned.
- V. Test first: every behavior has a recorded red. The two remediation cases of cycle 4 are test-after and say so, with mutants as proof. No principle is violated, because they add no behavior.
- VI. Scope: the scout report file and the other findings stayed out. Aligned.

## Coverage summary

| Requirement | Has task | Tasks | Tests |
| --- | --- | --- | --- |
| FR-001 flag needs `--apply --project` | yes | T004, T005, T013 | U1504, A1504 |
| FR-002 usage errors | yes | T004, T005 | U1504, A1504 |
| FR-003 invalid name, exit 2, before read | yes | T002, T004, T005 | U1501, U1504, A1504 |
| FR-004 stored in one `putProjectConfig` | yes | T002, T003, T005 | U1502, U1505, A1501 |
| FR-005 idempotent | yes | T002, T007 | U1502, U1505, A1505 |
| FR-006 no flag, no change | yes | T002, T006 | U1503, A1503 |
| FR-007 warning on `local-only` with none | yes | T002, T006 | U1503, U1506, A1503 |
| FR-008 no event, approval, process, or `workflow.json` | yes | T007 | A1505, U1507 |
| FR-009 usage and docs | yes | T008, T009 | A1506, A1507 |

All 18 acceptance scenarios and 6 success criteria map to a task and a test (`tdd/verification.md` traceability table).

## Unmapped tasks

None. T010 to T014 are the polish and remediation tasks and map to SC-005 and SC-006 and to verification findings 1 and 2.

## Metrics

- Requirements: 9 functional, 6 success criteria
- Tasks: 14
- Coverage: 100 percent of requirements have at least one task and test
- Ambiguity count: 0
- Duplication count: 0
- Critical issues: 0
