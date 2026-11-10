# Specification analysis: the `factoryman_decide` tool

**Analyzed at**: `e768ef5`, after the implementation, the verification, and the live runs.
**Scope**: `spec.md`, `plan.md`, `tasks.md`, the test list, the decision log (D-136 to D-146), the constitution (1.5.0), and the code.
The analysis found two defects in the work, and the work fixed both before this report was written (A1, A2).
The report was written by the session that built the feature, so it is not independent.

## Findings

| ID | Category | Severity | Location | Summary | State |
| --- | --- | --- | --- | --- | --- |
| A1 | Coverage | HIGH | `spec.md` FR-017, `docs/DECISIONS.md` D-140, `src/tools/decide.ts` | FR-017 and D-140 say that a denied, cancelled, timed-out, or unreadable form, and a changed gate, are kept in the plugin log. The code made no log call, and no test looked. | Fixed in cycle 14 (`e768ef5`), test first (`[U1849]`, four tests) |
| A2 | Inconsistency | MEDIUM | `spec.md` FR-005 against `plan.md`, D-138, `src/validator/key.ts` | The spec said "the sorted finding IDs". The plan, D-138, and the code keep the validator's order, and `[U1803]` pins that a change of order changes the key. | The spec now says "in the order the validator reported them" |
| A3 | Constitution | CRITICAL (acknowledged) | Principle V, `tdd/verification.md` finding 1, D-144 | Eleven behaviors have no red recorded before their code (test-after). Each was proved able to fail with deliberate mutants (41, none survived). The rubric fails the feature for it. | Open: the owner decides whether to waive, as before (D-099, D-122, D-133, D-135). Task T047 |
| A4 | Coverage | MEDIUM | `spec.md` FR-021, `conformance/results/*.json` | The five result files name commit `1a890a9`. The code changed after it (A1's log lines in `decide.ts`; none of S1 to S12 reaches them). | The runs repeat on the last code commit before the pipeline; the files then name that commit |
| A5 | Coverage | MEDIUM | `spec.md` Edge cases, D-146 | The look of the form, a restart while a form is open, and the validator's own wait timeout have no test. The spec has no measurable criterion for the look. | Recorded as limits in D-146; the owner runs the lab check before the first real decision |
| A6 | Underspecification | LOW | `tasks.md` T008, T011, T020 | T008 still lists `[U1826]`, which the list drops (A1801 is the proof), and T011 builds `[U1818]`, which T020 also names. | Harmless: the checkboxes and the list agree; the log explains both |
| A7 | Underspecification | LOW | `spec.md` Assumptions | "The existing approval-timeout setting is reused" did not say that its label changes. D-139 and `[U1843]` say so. | Recorded in D-139 |

No ambiguity marker, placeholder, or duplicate requirement remains.

## Coverage of the requirements

| Requirement | Task | Tests |
| --- | --- | --- |
| FR-001, FR-002 (registration, flat schema) | T006 to T009 | `A1816`, `U1824`, `U1825`, `U1816` |
| FR-003, FR-004 (task and live view) | T012, T014 | `A1805`, `A1810`, `U1808`, `U1809` |
| FR-005 (the key) | T002, T004 | `U1801` to `U1803`, `U1805` to `U1807`, `A1813`, `A1808` |
| FR-006, FR-007 (answer rules) | T011, T020, T021 | `U1817`, `U1818`, `U1848`, `A1805`, `A1811`, `A1812` |
| FR-008, FR-009, FR-018, FR-019 (the form) | T003, T017 to T019 | `U1813` to `U1815`, `U1828` to `U1833`, `A1814`, `A1815`, `A1821`, `A1806` |
| FR-010, FR-011 (strict approval, second read) | T012, T015, T016 | `A1807`, `A1808`, `U1823` |
| FR-012, FR-013 (resolve and evidence) | T004, T012, T021 | `A1801`, `A1802`, `A1803`, `A1811`, `U1810` to `U1812`, `U1820` |
| FR-014 (no machine change) | none (a constraint) | `git diff` of `src/machine` is empty (checklist CHK1810) |
| FR-015 (no `--yes`) | T010 | `A1804`, `U180`, `U194` |
| FR-016 (one form per task) | T005, T016 | `A1809` |
| FR-017 (no log row, plugin log line) | T012, cycle 14 | `A1807`, `U1849` |
| FR-020, FR-021 (harness suite) | T022 to T025 | `U1837`, `U1838`, `U1839`, `U1847`, `A1817`, `A1818` (five runs) |
| FR-022 to FR-024 (documents) | T026 to T028 | `U1836`, `U1840` to `U1842`, `A1819` |
| FR-025, FR-026 (hard rules, temporary directories) | T029 | checklist CHK1801 to CHK1815, `A1511` |

The success criteria SC-001 to SC-008 each have a test or a recorded measurement (checklist CHK1801 to CHK1845).
Every task maps to a requirement, a story, or the lifecycle (setup, polish, remediation).

## Constitution alignment

| Principle | Result |
| --- | --- |
| I. Gates live in code and fail closed | Held. The tool refuses before the form and after it, never reads `yolo`, and sends nothing on any failed read. The gate is in the tool, because the validator call is outside the machine (D-140). |
| II. The machine core is pure | Held. `src/machine/` has no change. |
| III. The event log is the source of truth | Held. `resolve` carries the answer and the approval. A denial leaves no row, which D-140 records as a gap, and A1 makes the plugin log carry it. |
| IV. Storage behind an interface | Held. No store change. |
| V. Test first | Not fully held: A3. |
| VI. Scope discipline | Held after the amendment (1.5.0, D-136). The live install stays the owner's step. |

## Metrics

- Requirements: 26 functional, 8 success criteria. Tasks: 47 (T001 to T047). Behaviors on the list: 67.
- Requirements with at least one task and one test: 26 of 26. Success criteria with evidence: 8 of 8.
- Ambiguity count: 0. Duplication count: 0.
- Defects found by this analysis: 2 (A1, A2), both fixed.
- Critical issues open: 1 (A3, the owner's decision).

## Next actions

1. Run `/speckit.converge` to record merge readiness.
2. Repeat the five offline conformance runs on the last code commit (A4), then ship through the pipeline.
3. Ask the owner about A3 (T047) and about the look of the form (A5).
