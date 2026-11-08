# Convergence: extension surface

**Outcome**: `converged` for the specified scope. No unbuilt work remains, so no task was appended to `tasks.md`.
**Checked at**: the commit that adds this file, on branch `fm/bb-factoryman-milestones-7-11`.

## Merge readiness

**Ready to build on.**

| Gate | State | Evidence |
| --- | --- | --- |
| Type check, lint, tests | Pass | `pnpm run check`: 80 files, 975 tests, 0 failed |
| Spec scenarios covered | 17 of 17 | `tdd/test-list.md`, all `DONE` |
| TDD verification | FAIL at `4bad48e`, answered by cycle R1, not re-audited | `tdd/verification.md` |
| Analysis | No critical or high finding | `analyze.md` |
| Quality gates | Pass, except the live items (CHK904, CHK905) | `checklist.md` |
| Scope | Held | No limits, webhook, cutover, or skills code |

## Evidence

| Done when (from `docs/DESIGN.md`) | Evidence |
| --- | --- |
| A test plugin reads tasks and events through `callRpc` and can't trigger a transition | `[A915]`, `[A916]`, `[A917]`, `[U929]` to `[U935]`, `[U940]` |
| A config that tries to remove a gate is rejected | `[A905]` to `[A907]`, `[U902]` (16 keys), `[U903]`, `[U904]`, `[U936]` |
| Workflow config loads from `.bb/factoryman/` | `[A901]` to `[A904]`, `[U907]` to `[U913]` |
| Thread metadata is stamped | `[A913]`, `[A914]`, `[U925]` to `[U928]` |

## Open items for the owner

1. D-078: confirm that config selects among the three modes and cannot define a kind or a mode, and decide how `yolo` and the base branch get set.
2. D-079: confirm that checks run as the plugin's user, from a file in the server checkout.
3. The live check confirms the workflow path and the RPC in a real bb.
