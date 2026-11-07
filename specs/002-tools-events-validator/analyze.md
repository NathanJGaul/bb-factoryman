# Analysis: tools and approval, event wiring, and the validator

**Run**: after `/speckit.tdd.run`, `/speckit.tdd.verify`, the audit remediation, `/speckit.implement` (every remaining task was already done), and `/speckit.checklist`.
**Inputs**: `spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`, `contracts/`, `tdd/*`, `checklist.md`, the constitution (version 1.1.0), and the code at `HEAD`.
**Method**: a mechanical cross-check (a script that matches requirement IDs to behaviors and behaviors to task markers), plus a read of each artifact against the code.
This report only reads.
The doc fixes it names were made afterwards, in the commit that follows it.

## Summary

The artifacts agree with the code on every behavior.
The analysis found one critical finding, a constitution finding about test-first evidence that only the owner can close.
It found four medium and several low drifts between the design documents and the code.
The doc drifts are fixed in the follow-up commit.

| Check | Result |
| --- | --- |
| Functional requirements traced to a behavior | 55 of 55 (FR-403 is a process rule, and FR-401 traces to U208) |
| Functional requirements with a task through a behavior marker | 53 of 55 (FR-401 and FR-403, see F5) |
| Acceptance scenarios traced to a task | 38 of 38 |
| Success criteria with a check | 9 of 9 (see `checklist.md` CHK022) |
| Behaviors in the test list | 255 (38 `A`, 217 `U`), all `DONE` |
| Behaviors without a task marker | 1 (U208, see F5) |
| Tasks | 90, one open (T104, this step) |
| Constitution principles with a violation | 1 (principle V, see F1) |

## Findings

| ID | Category | Severity | Location | Summary | Recommendation |
| --- | --- | --- | --- | --- | --- |
| F1 | Constitution | CRITICAL | `constitution.md` principle V, `tdd/verification.md` finding 3, cycle logs H0 and H1 | Principle V says every behavior change is driven by a test that failed first. Six behaviors (U40, U120, U121, U122, U123, U124) were written after the code. The audit labelled them `TEST_AFTER`. Cycle R1 re-derived a red for each with a deliberate mutant, which is weaker than the original red. | The owner decides: waive the six, or require them to be rewritten test first. Until then the audit stays FAIL on this point. |
| F2 | Inconsistency | MEDIUM | `contracts/events.md` row `thread.failed`, `research.md` R10, `spec.md` FR-203 | The documents say that the handler reads the last remembered turn failure. The code waits 500 ms through the injected `sleep` first, because `turn.failed` arrives after `thread.failed` (D-047). | Update the contract, R10, and FR-203 to name the wait. |
| F3 | Inconsistency | MEDIUM | `data-model.md` (`ThreadInfo`, `MergeExecutor`), `src/bb/port.ts`, `src/git/merge.ts` | `ThreadInfo` has a `deleted` flag in the code and not in the data model. The data model gives `MergeExecutor.merge` a `worktreePath` input, and the code takes `checkoutPath` and `method`. | Update the data model. |
| F4 | Underspecification | MEDIUM | `spec.md` FR-213 and AC-2.9, `contracts/events.md` Start-up | The spec says a deleted or unknown worker thread observes as `missing` and the supervisor is told once. When bb answers 404 the parent is unknown, so the plugin writes the `reconcile` row and logs a warning, but cannot message anyone (D-047). | State the limit in FR-212 and AC-2.9. |
| F5 | Coverage | LOW | `tasks.md`, `tdd/test-list.md` U208 | U208 (the layout rule) was added in a test-change cycle and has no task marker, so FR-401 reaches no task. FR-403 is a process rule with no behavior. | Add a marker to a task or a note that U208 stands alone. FR-403 needs no change. |
| F6 | Ambiguity | MEDIUM | `spec.md` SC-005, `test/acceptance/validator-recorded.test.ts`, D-049 | SC-005 says a recorded no-mistakes run drives a task from handoff to review ready. No `checks-passed` output could be recorded, so the review-ready step uses a derived fixture. | Reword SC-005 to say "recorded or derived from a recorded run", and keep D-049. |
| F7 | Underspecification | LOW | `spec.md` FR-106, `src/tools/dispatch.ts` | FR-106 asks for a complete profile. The code, and `contracts/tools.md`, also restrict the permission mode to `accept-edits`, `auto`, and `full`. The spec does not say so. | Add the three modes to FR-106. |
| F8 | Risk | HIGH | `spec.md` Assumptions, D-030, `spike/RESULTS.md` item 20 | A submitted approval form is not proof of a human, because bb records no submitter. The plugin validates strictly but cannot close this. The spec lists it only as an assumption, not as a requirement or an acceptance criterion. | Keep D-030 in the final report for the owner. Branch protection and scoped tokens are the backstop. |
| F9 | Open decision | MEDIUM | `spec.md` Assumptions, D-031 | No tool answers a pipeline finding, and a run that ends in an override parks a task until someone starts a new run in no-mistakes. The live smoke test showed a supervisor escalating exactly this case. | The owner decides on a sixth tool or another path. |
| F10 | Inconsistency | LOW | `spec.md` Status and the plan-phase edits | The spec says "Approved", and the plan phase then changed AC-1.2, AC-3.3, AC-3.7, FR-306, FR-307, and one edge case, without a new approval. The captain's intent fixed the scope, and the edits made the spec match the design. | Note the edits in `docs/DECISIONS.md` if the owner wants a record. They are in git history. |
| F11 | Inconsistency | LOW | `plan.md` design decision 3, D-044 | The plan says tools bind through `registerTool` with `zod` schemas. The code registers raw JSON schemas made from the `zod` schemas, so a bad call reaches the tool. D-044 records this. | Add one clause to the plan. |
| F12 | Coverage | LOW | `tdd/verification.md` "What was not audited" | The audit ran 19 hand-picked mutants, and several files rest only on the mutants of their own cycles. | A second audit or a mutation tool would close it. See `checklist.md` CHK046. |

## Coverage summary

| Requirement group | Tasks | Behaviors | Notes |
| --- | --- | --- | --- |
| FR-101 to FR-123 tools and approval | T010 to T056, R001 to R013 | A1 to A18, U1 to U116, U209 to U216 | FR-109 holds because dispatch has no resolver, machine, or cap code (U41 to U51). |
| FR-201 to FR-214 event wiring | T060 to T071 | A19 to A28, U125 to U160, U214, U215 | FR-214 through U152 and U160. |
| FR-301 to FR-314 validator | T080 to T095 | A29 to A38, U161 to U207, U212, U217 | FR-313 and FR-314 are met, with the dispose limit in D-054. |
| FR-401 to FR-404 constraints | T018, T040 to T052, R-tasks | U208, U36, U40, A17 | FR-401 through the empty `src/machine` diff and the lint rule. FR-403 is the process rule in F1. |

## Constitution alignment

| Principle | Result |
| --- | --- |
| I. Gates live in code and fail closed | Pass. The tools build events and the machine decides. F8 is the one residual risk, and the design already lists it. |
| II. The machine core is pure | Pass. `git diff cd761f4..HEAD -- src/machine` is empty. |
| III. The event log is the source of truth | Pass. Every change goes through `Runtime.apply`, and start-up reconciles without repairing. |
| IV. Storage sits behind an interface | Pass. The new code takes a `Store`. |
| V. Test first | One violation, F1. |
| VI. Scope discipline | Pass. The amendment is recorded as D-032, and nothing from milestones 7 to 11 exists. |

## Unmapped tasks

Sixteen tasks carry no behavior marker.
Each is non-behavioral by design: T001 to T004 (test helpers), T016 (port types), T054, T069, T070, T093, T094 (wiring and commit tasks), T080 (the dependency), and T100 to T104 (build, check, and close-out steps).
T104 is the only open task, and it is this step.

## Metrics

- Total requirements: 55 functional and 9 success criteria
- Total tasks: 90
- Coverage (requirements with at least one task): 96% (53 of 55)
- Ambiguity count: 3 (F4, F6, F7)
- Duplication count: 0
- Critical issues: 1 (F1)

## Next actions

- F1 needs the owner. Everything else can proceed.
- Fix F2, F3, F4, F6, F7, F11, and the note in F5 in the follow-up commit. They change documents only.
- Carry F8 and F9 into the final summary for the owner.
