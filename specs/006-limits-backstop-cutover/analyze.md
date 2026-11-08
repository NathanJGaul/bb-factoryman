# Analysis: limits, backstop, and cutover

**Run**: after `/speckit.tdd.run`, `/speckit.tdd.verify`, the audit remediation, and `/speckit.checklist`.
**Inputs**: `spec.md`, `plan.md`, `tasks.md`, `tdd/*`, `checklist.md`, constitution 1.2.0, `docs/DECISIONS.md`, and the code at `HEAD`.
**Method**: a read of each artifact against the code, and the counts in `tdd/test-list.md`.
This report only reads.

## Summary

The artifacts agree with the code.
No critical finding is open.
The audit found four product bugs and several test gaps, and each is closed by a test that its mutant now fails.

| Check | Result |
| --- | --- |
| Functional requirements traced to a behavior | 12 of 12 |
| Acceptance scenarios traced to a behavior | 23 of 23 |
| Behaviors in the test list | 31 acceptance (`A1001` to `A1031`) and 54 unit, all `DONE` |
| Tasks | all ticked, including the remediation task |
| Constitution principles with a violation | none |
| Deviations recorded | D-084 to D-089 |
| Suite | 90 files, 1107 tests |

## Findings

| ID | Category | Severity | Location | Summary | Recommendation |
| --- | --- | --- | --- | --- | --- |
| F1 | Design | Medium | D-086 | The drain does not check budgets again, so a task queued under budget can start after the budget is reached. | The owner confirms. A hard stop is a cap, lowered. |
| F2 | Gap | Medium | D-088, D-078 | The import is a dry run. Nothing writes `yolo`, `baseBranch`, or a looser delivery mode, so the apply path is open. | The owner decides on an apply path. |
| F3 | Risk | Low | D-087 | The webhook URL is in the plugin settings and the post goes to whatever host it names. | The owner chooses the URL. The log holds the host only. |
| F4 | Risk | Low | D-084 | The default for both caps is none. | None. A cap only delays work. |
| F5 | Design | Low | D-084 | The plugin queues the task in its own log and does not return `wait` from `message.dispatch`, which differs from the design text. | Recorded. Spike item 5 stays unchecked. |
| F6 | Audit | Info | `tdd/verification.md` | The verdict stays FAIL at the audited commit, and the remediation was not re-audited. | The no-mistakes pipeline reviews the final tree. |

## Drift between documents

None open.
The cycle log matches the suite counts, the test list carries the audit's IDs, the duplicate IDs are gone, and the criteria count is 23.
