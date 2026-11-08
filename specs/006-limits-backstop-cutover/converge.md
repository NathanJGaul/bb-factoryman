# Convergence: limits, backstop, and cutover

**Outcome**: `converged` for the specified scope. No unbuilt work remains, so no task was appended to `tasks.md`.
**Checked at**: the commit that adds this file, on branch `fm/bb-factoryman-milestones-7-11`.

## Merge readiness

**Ready to build on.**

| Gate | State | Evidence |
| --- | --- | --- |
| Type check, lint, tests | Pass | `pnpm run check`: 90 files, 1107 tests, 0 failed |
| Spec scenarios covered | 23 of 23 | `tdd/test-list.md`, all `DONE` |
| TDD verification | FAIL at `8e2ecb0`, answered by cycle R1, not re-audited | `tdd/verification.md` |
| Analysis | No critical or high finding | `analyze.md` |
| Quality gates | Pass, except the live items (CHK1004, CHK1005, CHK1034) | `checklist.md` |
| Scope | Held | No `factoryman_decide`, no skills, no change to a GitHub setting, no write to firstmate |

## Evidence

| Done when (from `docs/DESIGN.md`) | Evidence |
| --- | --- |
| A project over its cap queues the next task and starts it when a slot frees | `[A1001]` to `[A1003]`, `[A1025]`, `[A1026]`, `[U1005]` to `[U1010]` |
| A task over budget is refused with the reason, and no task exists | `[A1008]` to `[A1012]`, `[A1028]`, `[A1029]` |
| A transition into an attention state posts to a webhook | `[A1013]` to `[A1016]`, `[U1046]` to `[U1049]` |
| The branch-protection steps print and change nothing | `[A1017]`, `[A1018]`, `[U1020]`, `[U1021]`, `[U1054]` to `[U1056]` |
| The registry import is a dry run | `[A1019]` to `[A1023]`, `[U1022]` to `[U1030]`, `[U1050]` to `[U1053]`, `[U1065]`, `[U1066]` |

## Open items for the owner

1. D-086: confirm that the drain does not check budgets again.
2. D-078, D-088: decide how `yolo` and the base branch get set, and whether `--apply` ever ships.
3. The live check confirms the cost shape and the webhook against a real bb and a real receiver.
