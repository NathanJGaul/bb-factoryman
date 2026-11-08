# Analysis: skills and live check

**Run**: after `/speckit.tdd.run`, `/speckit.tdd.verify`, the audit remediation, and `/speckit.checklist`.
**Inputs**: `spec.md`, `plan.md`, `tasks.md`, `tdd/*`, `checklist.md`, constitution 1.2.0, `docs/DECISIONS.md`, and the code at `HEAD`.
**Method**: a read of each artifact against the code, and the counts in `tdd/test-list.md`.
This report only reads.

## Summary

The artifacts agree with the code.
No critical finding is open.
The audit found two defects in the product text (a skill that disagreed with `merge.ts`, and a machine name that does not exist in the lab) and many tests that checked words and not rules.
Both defects are fixed, and the tests now read structure and the code's own schemas.

| Check | Result |
| --- | --- |
| Functional requirements traced to a behavior | 9 of 9 |
| Acceptance scenarios traced to a behavior | 13 of 13 |
| Behaviors in the test list | 24 acceptance (`A1101` to `A1124`) and 3 unit, all `DONE` |
| Tasks | all ticked, including the remediation task |
| Constitution principles with a violation | none |
| Deviations recorded | D-090 to D-093 |
| Suite | 92 files, 1133 tests |

## Findings

| ID | Category | Severity | Location | Summary | Recommendation |
| --- | --- | --- | --- | --- | --- |
| F1 | Gap | Medium | D-093 | The tier 1 stub agent does not exist, so the gate before tier 2 is tier 0 plus a recorded skip. | The captain decides whether to build the stub agent first. |
| F2 | Risk | Medium | D-092 | The Claude CLI in the lab holds the token, an agent session may read it, and nobody tested whether a lab process can read the keeper's environment. | The captain revokes the token after the run. The runbook discloses it and starts from a fresh shell. |
| F3 | Risk | Medium | D-090 | A skill name that bb does not know rejects the plugin's whole selection, so the supervisor would lose its tools. | The live check confirms the supervisor has its tools. A test reads the names from the files. |
| F4 | Gap | Low | D-078 | The only way to reach `local-only` mode is a database write that the runbook spells out. | The owner decides on an apply path (D-078, D-088). |
| F5 | Risk | Low | D-091 | Which of a plugin skill and a project skill with the same name a session loads is unknown. | The live check records it. |
| F6 | Audit | Info | `tdd/verification.md` | The verdict stays FAIL at the audited commit, and the remediation was not re-audited. | The no-mistakes pipeline reviews the final tree. |

## Drift between documents

None open.
The cycle log matches the suite counts, the test list carries the new IDs, and the spec's acceptance criteria all trace to a test.
