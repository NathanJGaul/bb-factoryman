# Analysis: dispatch resolver

**Run**: after `/speckit.tdd.run`, `/speckit.tdd.verify`, the audit remediation, `/speckit.implement` (every remaining task was already done), and `/speckit.checklist`.
**Inputs**: `spec.md`, `plan.md`, `tasks.md`, `tdd/*`, `checklist.md`, constitution 1.2.0, and the code at `HEAD`.
**Method**: a script that matches requirement and criterion IDs to behaviors and behaviors to test titles, plus a read of each artifact against the code.
This report only reads.

## Summary

The artifacts agree with the code.
The analysis found no critical or high finding.
One medium finding (an untraced requirement) was fixed before this report was written.

| Check | Result |
| --- | --- |
| Functional requirements traced to a behavior | 12 of 12 (FR-701 traced after `[A718]`) |
| Acceptance scenarios traced to a behavior | 14 of 14 |
| Behaviors in the test list | 62 (18 `A`, 44 `U`), all `DONE`, each found as a test title |
| Tasks | all ticked, including the five remediation tasks |
| Constitution principles with a violation | none |
| Deviations recorded | D-062 to D-068 |

## Findings

| ID | Category | Severity | Location | Summary | Recommendation |
| --- | --- | --- | --- | --- | --- |
| F1 | Coverage | Medium (fixed) | `spec.md` FR-701 | The requirement that the resolver cannot call bb or read files had no test. | Fixed: `[A718]` reads the imports. |
| F2 | Constitution V | Low | git history | Tests and code for the inner loops landed in one commit, so history cannot show the order. The cycle log carries the red output, and the auditor re-derived the acceptance reds from the spec commit. | From milestone 8 on, commit the tests with their stubs (red) before the implementation. |
| F3 | Consistency | Low | `docs/DESIGN.md`, Dispatch profiles | The design says the config is a JSON file under `.bb/`, and the code reads `.bb/factoryman/dispatch.json`. | None: this is the layout in `CLAUDE.md`, and D-062 records it. |
| F4 | Risk | Low | D-062 | If the project's default source lives on a remote host, the server finds no file and applies the built-in default. | The result text names the profile source, and the live check confirms the path. |
| F5 | Assumption | Low | D-063 | The built-in default profile is the plugin author's choice. | The owner sets `default` in `dispatch.json`. |
| F6 | Audit | Info | `tdd/verification.md` | The verdict stays FAIL at the audited commit, and the remediation was not re-audited. | The no-mistakes pipeline reviews the final tree. |

## Drift between documents

None open.
`plan.md` no longer lists `builtin.ts`, `DECISIONS.md` cites cycle C5, and the criteria count is 14 everywhere.
