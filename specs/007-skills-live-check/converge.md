# Convergence: skills and live check

**Outcome**: `converged` for the specified scope. No unbuilt work remains, so no task was appended to `tasks.md`.
**Checked at**: the commit that adds this file, on branch `fm/bb-factoryman-milestones-7-11`.

## Merge readiness

**Ready to build on.**

| Gate | State | Evidence |
| --- | --- | --- |
| Type check, lint, tests | Pass | `pnpm run check`: 92 files, 1133 tests, 0 failed |
| Build | Pass | `pnpm run build` |
| Spec scenarios covered | 13 of 13 | `tdd/test-list.md`, all `DONE` |
| TDD verification | FAIL at `7bbd5c9`, answered by cycle R1, not re-audited | `tdd/verification.md` |
| Analysis | No critical or high finding | `analyze.md` |
| Quality gates | Pass, except the live items (CHK1106, CHK1115, CHK1116, CHK1133) | `checklist.md` |
| Scope | Held | No `factoryman_decide`, no live install into the owner's bb, no live check run |

## Evidence

| Done when (from `docs/DESIGN.md` and the brief) | Evidence |
| --- | --- |
| The supervisor and worker skills exist and each role gets its own | `[A1101]`, `[A1102]`, `[U1101]`, `[U1103]` |
| The skills agree with the code and do not loosen a gate | `[A1103]` to `[A1105]`, `[A1115]` to `[A1121]` |
| A live-check runbook based on the isolation report exists | `docs/LIVE-CHECK.md`, `[A1107]` to `[A1109]`, `[A1122]` to `[A1124]` |
| Tier 2 follows the captain's decision | `[A1111]` to `[A1114]` |
| The plugin builds and loads in a real bb | `pnpm run build`, and spike item 11 |

## Open items for the owner

1. D-093: build the tier 1 stub agent, or skip tier 1 with the recorded line. The runbook's gate allows both.
2. D-092: run the live check. The captain creates the token, runs the free tiers first, and revokes the token after tier 2.
3. D-078, D-088: decide how `yolo`, the base branch, and a looser delivery mode get set.
4. D-086: confirm that the queue drain does not check budgets again.
5. D-069: an offline pinned machine at dispatch refuses the dispatch (no task) and does not create a blocked task.
