# Analysis: Registry apply

**Purpose**: Check the finished change against `spec.md`, `plan.md`, and `tasks.md`, and against the constitution.
**Created**: 2026-11-10
**Feature**: [spec.md](spec.md)

This analysis is read-only.
It was run on the tree at `be58227` after the implementation, so it checks what was built against what was written.
It changed no source, test, or specification file.

## Findings

| ID | Category | Severity | Location | Summary | Recommendation |
| --- | --- | --- | --- | --- | --- |
| C1 | Constitution | MEDIUM | `src/limits/registry-apply.ts` (`yolo: entry.yolo`), principle I | The apply is the first code path that can store `yolo: true`. Principle I says only the `yolo` flag skips the approval form, and it does not say who may set it. No MUST is violated. The bypass can come only from an explicit `+yolo` token in the owner's own registry, never from a bare `yolo`, and D-148 records the reasoning. | Keep. The owner should read the report's `yolo` column (`on`) before running the apply. `CUTOVER.md` already says to read every line. |
| I1 | Inconsistency | LOW | `data-model.md` against `src/limits/registry-apply.ts` | The data model shows `untouched: string[]` and no `forge` field. The code has `untouched: Array<{ field, value }>` and a `forge` string on the plan. | Update `data-model.md` to the built shape. Behavior is unaffected. |
| I2 | Inconsistency | MEDIUM | `spec.md` SC-004 against the diff | SC-004 says the existing dry-run tests pass without edits except the two that assert the `--apply` refusal. The diff also edits `[A1108]` and `[A1109]` in `live-check.test.ts`, by adding one row label and one allowed flag. Both are additions that the live-check runbook change needs. No assertion was removed. | Read SC-004 as "no existing assertion is loosened". The verification report lists all four edited tests with before and after. |
| I3 | Inconsistency | LOW | `plan.md` file list | The plan does not list `test/fixtures/plugin-host.ts` (the new `projectListError` option) or `test/acceptance/live-check.test.ts` and `registry-apply-docs.test.ts`. | The tasks name them. No change needed beyond noting it here. |
| I4 | Inconsistency | LOW | `tasks.md` Phase 9 and 10 | T015 sits before T014 in the file because the verification inserted remediation work and T015 was added late. Both are ticked. | None. The ids are not reordered, by the rule that ids are never renumbered. |
| U1 | Underspecification | LOW | `spec.md` FR-013 | FR-013 says each field is printed with its old and new value. An unchanged field is printed once, because old and new are equal. | Read as intended. The contract in `contracts/cli.md` shows the printed form. |
| E1 | Coverage | LOW | `spec.md` scenario 3.10 | The write-failure scenario is tested at the command function with the in-memory store, not through the plugin with a failing SQLite store. | Recorded as a limit in D-149. The rollback itself is the store's contract. |
| E2 | Coverage | MEDIUM | `tdd/verification.md` finding 1 | Nine acceptance behaviors were written after the code, so the verification verdict is `FAIL` until the owner waives it. Mutants stand in for the reds. | The owner decides (D-149). It does not change the specification or the plan. |

No duplicated requirement, no unresolved placeholder, no `[NEEDS CLARIFICATION]` marker, and no conflicting requirement was found.
The terms are used the same way in the three files: "stored config", "registry line", "bb project", "flagged", and "unchanged".

## Coverage summary

| Requirement | Has task? | Task ids | Evidence |
| --- | --- | --- | --- |
| FR-001 explicit only | Yes | T003, T005, T009 | `[U1909]`, `[A1023]`, `[A1901]` |
| FR-002 `--project` required | Yes | T004, T005 | `[U1904]`, `[A1907]` |
| FR-003 one project | Yes | T007 | `[A1907]` |
| FR-004 no or repeated registry line | Yes | T002, T007, T008 | `[U1902]`, `[U1907]`, `[A1906]` |
| FR-005 bb project unknown, repeated, or list failure | Yes | T002, T007, T008 | `[U1902]`, `[U1907]`, `[A1906]`, `[A1907]` |
| FR-006 flagged line refused | Yes | T002, T003, T007 | `[U1902]`, `[A1902]`, `[A1906]` |
| FR-007 fields written, bare `yolo` never on | Yes | T002, T003 | `[U1901]`, `[A1901]`, `[A1902]`, `[A1903]` |
| FR-008 conditional policy mapped, note printed | Yes | T003 | `[A1903]` |
| FR-009 base branch and machine untouched | Yes | T002, T003 | `[U1901]`, `[A1904]` |
| FR-010 idempotent | Yes | T002, T006 | `[U1903]`, `[U1906]`, `[A1905]` |
| FR-011 one transaction, no event or approval | Yes | T008, T010 | `[U1908]`, `[A1908]` |
| FR-012 no registry write, no process, no bb write | Yes | T010, T018 | `[A1908]`, `[U1905]` |
| FR-013 output | Yes | T004, T005 | `[U1905]`, `[A1901]` |
| FR-014 failed write | Yes | T008 | `[U1908]` |
| FR-015 help | Yes | T009 | `[U1910]`, `[U1904]`, `[A1109]` |
| FR-016 documents | Yes | T011 | `[A1910]` |

Success criteria: SC-001 and SC-002 by `[A1906]` and `[A1908]`; SC-003 by `[A1905]`; SC-004 with the note in I2; SC-005 by the 19 mutants of the cycle log and the verification (none survives); SC-006 by `pnpm run check`.

**Unmapped tasks**: none.
**Constitution alignment issues**: none. C1 is a note on principle I and not a conflict.

## Metrics

- Requirements: 16 functional, 6 success criteria
- Tasks: 24
- Coverage (requirements with at least one task): 100 %
- Ambiguities: 0
- Duplications: 0
- Critical issues: 0
- High issues: 0
- Medium issues: 3 (C1, I2, E2)
- Low issues: 5

## Next actions

- No critical or high issue. The change may go to `/speckit.converge`.
- I1 is a documentation fix in `data-model.md` that does not change behavior; it is applied in the convergence step.
- E2 and the live check are the owner's decisions.
