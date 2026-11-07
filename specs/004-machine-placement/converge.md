# Convergence: machine placement

**Outcome**: `converged` for the specified scope. No unbuilt work remains, so no task was appended to `tasks.md`.
**Checked at**: the commit that adds this file, on branch `fm/bb-factoryman-milestones-7-11`.

## Merge readiness

**Ready to build on.**

| Gate | State | Evidence |
| --- | --- | --- |
| Type check, lint, tests | Pass | `pnpm run check`: 72 files, 873 tests, 0 failed |
| Spec scenarios covered | 24 of 24 | `tdd/test-list.md`, all `DONE` |
| TDD verification | FAIL at `9e765f8`, answered by cycle R1, not re-audited | `tdd/verification.md` |
| Analysis | No critical or high finding | `analyze.md` |
| Quality gates | Pass, except the live items (CHK804, CHK805) | `checklist.md` |
| Scope | Held | No config loading beyond `dispatch.json`, no limits, no skills |

## Evidence

| Done when (from `docs/DESIGN.md`) | Evidence |
| --- | --- |
| A task pinned to an offline machine goes blocked and wakes the supervisor | `[A809]` (a running task goes `blocked` and the supervisor gets one message), `[A808]` (a dispatch to an offline machine is blocked, D-069) |
| A `local-only` task refuses any machine but the one with the clone | `[A814]` to `[A816]`, `[A826]`, `[U814]` to `[U818]` |
| The preflight reports a missing gate install | `[A818]`, `[U840]`, `[U841]`, `[A820]` |

## Open items for the owner

1. D-069: confirm that a refused dispatch is acceptable where the design says "goes blocked".
2. D-071: the remote runner needs a real second machine in the live check.
3. D-076: the default machine has no writer until milestone 9.
