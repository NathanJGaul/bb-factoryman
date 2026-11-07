# Analysis: machine placement

**Run**: after `/speckit.tdd.run`, `/speckit.tdd.verify`, the audit remediation, `/speckit.implement` (every remaining task was already done), and `/speckit.checklist`.
**Inputs**: `spec.md`, `plan.md`, `tasks.md`, `tdd/*`, `checklist.md`, constitution 1.2.0, `docs/DECISIONS.md`, and the code at `HEAD`.
**Method**: a script that matches requirement and criterion IDs to behaviors and behaviors to test titles, plus a read of each artifact against the code.
This report only reads.

## Summary

The artifacts agree with the code.
No critical finding is open.
The audit's four high findings were fail-open paths, and each is closed by a test that its mutant now fails.

| Check | Result |
| --- | --- |
| Functional requirements traced to a behavior | 12 of 12 |
| Acceptance scenarios traced to a behavior | 24 of 24 |
| Behaviors in the test list | 111 (27 `A`, 84 `U`), all `DONE`, each found as a test title |
| Tasks | all ticked, including the eleven remediation tasks |
| Constitution principles with a violation | none |
| Deviations recorded | D-069 to D-077 |
| Test-first evidence in git | a red commit before each of the three groups |

## Findings

| ID | Category | Severity | Location | Summary | Recommendation |
| --- | --- | --- | --- | --- | --- |
| F1 | Design | Medium | D-069 | An offline machine at dispatch refuses the dispatch and creates no task. The design says the task "goes blocked". The state machine cannot represent a blocked task that has no worker. | The owner decides whether a visible blocked task is worth a machine change. |
| F2 | Risk | Medium | D-071 | The remote command runner is tested with a fake terminal and a real shell for the wrapper. No real remote machine ran it, and the PTY behavior was checked once on the local host. | The live check runs it on a second machine. |
| F3 | Risk | Low | D-074 | `gh auth status` shows that credentials exist and not their scope. | The owner follows `docs/BRANCH-PROTECTION.md` for scoped tokens (milestone 10). |
| F4 | Gap | Low | D-076 | Nothing sets a project's default machine until milestone 9. | Milestone 9 loads it from `workflow.json`. |
| F5 | Process | Low | git | The `fix` commits for the audit remediation are in one commit with the closeout. | None. |
| F6 | Audit | Info | `tdd/verification.md` | The verdict stays FAIL at the audited commit, and the remediation was not re-audited. | The no-mistakes pipeline reviews the final tree. |

## Drift between documents

None open.
`tasks.md` cites D-069 to D-077, `test-list.md` carries the audit's IDs, and the six formerly untagged tests have IDs.
