# Convergence: core scaffold, task state machine, and event storage

**Outcome**: `converged`. No unbuilt work in scope remains, so no task was appended to `tasks.md`.
**Checked at**: the commit that adds this file, on branch `fm/bb-factoryman-milestones-1-3`.

## Merge readiness

**Ready for the no-mistakes pipeline.**
The three milestones are built and committed, the full gate passes, and the worktree is clean.
The open items below need the owner, and none of them blocks a pull request.

| Gate | State | Evidence |
| --- | --- | --- |
| Type-check, lint, tests | Pass | `pnpm run check`: 19 files, 350 tests, 0 failed |
| `bb plugin build` | Pass | bb 0.48.1, no warning, `dist/server.js` written (D-001) |
| Spec scenarios covered | 27 of 27 | `tdd/verification.md` traceability |
| TDD verification | PASS_WITH_GAPS | 109 proven, 8 likely (retro-red), 1 baseline, 0 high smells |
| Analysis | No critical or high finding | `analyze.md` |
| Quality gates | see `checklist.md`; the unchecked items are out of scope or need the owner | `checklist.md` |
| Scope | Held | No tools, wiring, placement, validator, dispatch, or skills code |

## Evidence by milestone

| Milestone | Done when (from `docs/DESIGN.md`) | Evidence |
| --- | --- | --- |
| 1. Scaffold | The empty plugin loads in the fake host and builds with `bb plugin build`. | A1, A5, `pnpm run build` |
| 2. State machine | Table-driven tests show every illegal transition is refused, including merge without approval and teardown with unlanded work. | A11 (352 pairs), A6, A8, A27 |
| 3. Storage | A test destroys the cache and rebuilds identical state from events. | A21, U80 (400 seeded sequences on two stores) |

## Assessment against the plan

| Plan item | State |
| --- | --- |
| Layout (`src/machine`, `src/store`, `spike`, `docs`, none for later milestones) | Matches. The tree in `plan.md` now lists `effects.ts` and `rows.ts`. |
| Design decisions 1 to 7 in `plan.md` | All implemented as written. |
| Milestone commits | Milestones 1, 2, and 3 each have a closing commit, and each TDD cycle has its own commit. |
| Deviations recorded | D-001 to D-028 |

## Captain decisions applied (2026-11-06)

- **D-010**: a `request_changes` transition now returns a ship task from `review_ready` or `awaiting_approval` to `working`. It clears the merge decision, keeps the denial in the log, and leaves the hard rules intact (A27, D-028).
- **D-007**: principle V keeps its standard wording. The constitution did not change.

## Remaining work

None in scope.
These items stay open on purpose:

| Item | Owner | Where |
| --- | --- | --- |
| Hard rules 5, 6, and 7 (offline machine, `local-only` machine, extensions never remove a gate) | Milestones 8 and 9 | D-009 |
| `bb plugin install` into a running bb | Milestone 11 | D-001 |
| Wire the store into the plugin factory, and call `recover` at start | Milestones 4 and 5, after `spike/RESULTS.md` | D-027 |
| Coverage and automated mutation testing | The captain | `tdd/verification.md` |

## Risk

| Risk | Level | Why |
| --- | --- | --- |
| A gate fails open | Low | Every gate is a guard in the table, the facade refuses on any disagreement or throw, and 22 independent mutants of the gate code were each caught. |
| The log schema changes before real data exists | Low | There is no data yet. The first change needs a migration step (`analyze.md`). |
| A bb behavior contradicts an assumption | Low for this feature | The feature calls no bb API besides `bb.log.info`. The spike will test the rest. |
| The eight retro-red behaviors hide a weak test | Low | Each one has a mutant that fails its test. |

## Next step

Run the no-mistakes pipeline on the branch, then read the pull request back from the forge.
