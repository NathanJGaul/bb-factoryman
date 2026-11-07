# Convergence: dispatch resolver

**Outcome**: `converged` for the specified scope. No unbuilt work remains, so no task was appended to `tasks.md`.
**Checked at**: the commit that adds this file, on branch `fm/bb-factoryman-milestones-7-11`.

## Merge readiness

**Ready to build on.**
Milestone 7 is built and committed, and the full gate passes.

| Gate | State | Evidence |
| --- | --- | --- |
| Type check, lint, tests | Pass | `pnpm run check`: 63 files, 708 tests, 0 failed |
| Spec scenarios covered | 14 of 14 | `tdd/test-list.md`, all `DONE` |
| TDD verification | FAIL at `8ec714b`, answered by cycle R1, not re-audited | `tdd/verification.md` |
| Analysis | No critical or high finding | `analyze.md` |
| Quality gates | Pass, except the live items (CHK704, CHK705) | `checklist.md` |
| Scope | Held | No machine column, no config beyond `dispatch.json`, no limits |

## Evidence

| Done when (from `docs/DESIGN.md`) | Evidence |
| --- | --- |
| "Done when precedence tests pass." | `[U710]` to `[U717]` (one test per rung), `[A701]` to `[A706]`, `[A712]`, `[A713]` |
| The `ambiguous` result | `[U712]` (four fields), `[U713]`, `[A703]`, `[A704]`, `[A705]` |
| Never lower reasoning without permission | `[U722]` to `[U728]`, `[U744]`, `[A708]` |
| A missing profile or unavailable provider is a blocker | `[A709]`, `[A710]`, `[A715]`, `[A716]`, `[A711]` |

## Open items for the owner

1. D-063: confirm or replace the built-in default profile.
2. D-062: the live check (milestone 11) confirms that the project's default source is on the server.
3. The factory `resolver` option lets a faster classifier replace the rules table with no change to the machine.
