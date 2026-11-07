# Analysis: extension surface

**Run**: after `/speckit.tdd.run`, `/speckit.tdd.verify`, the audit remediation, `/speckit.implement` (every remaining task was already done), and `/speckit.checklist`.
**Inputs**: `spec.md`, `plan.md`, `tasks.md`, `tdd/*`, `checklist.md`, constitution 1.2.0, `docs/DECISIONS.md`, and the code at `HEAD`.
**Method**: a script that matches requirement and criterion IDs to behaviors and behaviors to test titles, plus a read of each artifact against the code.
This report only reads.

## Summary

The artifacts agree with the code.
No critical finding is open.
The audit's four high findings were test gaps on the rule 7 and rule 8 paths, and each is closed by a test that its mutant now fails.

| Check | Result |
| --- | --- |
| Functional requirements traced to a behavior | 10 of 10 |
| Acceptance scenarios traced to a behavior | 17 of 17 |
| Behaviors in the test list | 65 (22 `A`, 43 `U`), all `DONE`, each found as a test title |
| Tasks | all ticked, including the seven remediation tasks |
| Constitution principles with a violation | none |
| Deviations recorded | D-078 to D-083 |
| Suite | 80 files, 975 tests |

## Findings

| ID | Category | Severity | Location | Summary | Recommendation |
| --- | --- | --- | --- | --- | --- |
| F1 | Design | Medium | D-078 | The design lists "task kinds, delivery modes" as config. The file can select among the three modes and tighten, and it cannot define a kind or a mode. | The owner confirms. A new mode would add transitions and could loosen a gate. |
| F2 | Gap | Medium | D-078 | Nothing writes `yolo`, `baseBranch`, or a looser delivery mode into the stored project config, so `local-only` and `direct-PR` stay unreachable outside tests. | Milestone 10's registry import is a dry run. The owner decides on an apply path. |
| F3 | Risk | Low | D-079 | Checks run commands from a file in the server checkout, as the plugin's user. | The file changes only when the owner merges. The live check reads the file's path (D-062). |
| F4 | Risk | Low | spike item 10 | bb lets any plugin call any registered RPC method, so the surface is the guarantee. | None. The contract registers reads only. |
| F5 | Audit | Info | `tdd/verification.md` | The verdict stays FAIL at the audited commit, and the remediation was not re-audited. | The no-mistakes pipeline reviews the final tree. |

## Drift between documents

None open.
The cycle log matches the suite counts, the test list carries the audit's IDs, and the duplicate IDs are gone.
