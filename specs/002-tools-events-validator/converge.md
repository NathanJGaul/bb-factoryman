# Convergence: tools and approval, event wiring, and the validator

**Outcome**: `converged` for the specified scope. No unbuilt work remains, so no task was appended to `tasks.md`.
One constitution finding is open, and it needs the owner (F1 in `analyze.md`). It is a waiver decision and not unbuilt work, so it is listed here and not as a task.
**Checked at**: the commit that adds this file, on branch `fm/bb-factoryman-milestones-4-6`.

## Merge readiness

**Ready for the no-mistakes pipeline, with one owner decision open.**
The three milestones are built and committed, the full gate passes, and the worktree is clean.
The open items below need the owner, and none of them blocks a pull request.

| Gate | State | Evidence |
| --- | --- | --- |
| Type-check, lint, tests | Pass | `pnpm run check`: 57 files, 615 tests, 0 failed, 13 seconds |
| `bb plugin build` | Pass | bb 0.48.1, `dist/server.js` written, `better-sqlite3` external |
| Built plugin in a real bb | Pass | `spike/RESULTS.md` item 27, on a throwaway bb 0.48.1 server |
| Spec scenarios covered | 38 of 38 | `tdd/test-list.md`, all `DONE` |
| TDD verification | FAIL before the remediation, answered after it, not re-audited | `tdd/verification.md`, cycle R1 |
| Analysis | One critical finding (F1), one high (F8), four medium | `analyze.md` |
| Quality gates | see `checklist.md`; the unchecked items are out of scope, need the owner, or need a forge | `checklist.md` |
| Scope | Held | No resolver, placement, extension surface, limits, or skills code |

## Evidence by milestone

| Milestone | Done when (from `docs/DESIGN.md`) | Evidence |
| --- | --- | --- |
| 4. Tools and approval | Tests cover submitted, cancelled, and timed-out approvals. | A8, A9, A10 (cancelled and timed out), A11, A12, A13, and U89 to U106 |
| 5. Event wiring | A replayed event sequence produces the expected messages and no others. | A25 (13 events, 6 messages), A28 (real recorded payloads), A27, and U125 to U160 |
| 6. Validator | A fake validator and a recorded no-mistakes run each drive a task from handoff to review ready, and a finding pauses the task. | A30 to A36 and A37, U161 to U207; the review-ready output is derived from a recorded run (D-049) |

## Assessment against the plan

| Plan item | State |
| --- | --- |
| Layout (`src/bb`, `src/git`, `src/tools`, `src/wiring`, `src/validator`, none for milestones 7 to 11) | Matches. `src/exec.ts` and `src/runtime.ts` are at the root as planned. |
| Design decisions 1 to 11 in `plan.md` | All implemented. Decision 3 gained a clause for JSON schemas (D-044). |
| Contracts | `contracts/tools.md`, `events.md`, and `validator.md` match the code. The drifts in `analyze.md` F2, F3, F4, and F11 are fixed. |
| Milestone commits | Milestones 4, 5, and 6 each have a closing acceptance commit, and every TDD cycle has its own commit. |
| Deviations recorded | D-029 to D-055 |

## Findings of this run

| ID | Gap type | Severity | Source | Evidence | Disposition |
| --- | --- | --- | --- | --- | --- |
| C1 | contradicts | CRITICAL | Constitution V | Six behaviors (U40, U120 to U124) were written after the code. Cycle R1 re-derived a red for each with a mutant, which is weaker than the original red. | Needs the owner: waive, or rewrite test first. Not unbuilt work. |
| C2 | partial | LOW | AC-2.9, FR-213 | When bb answers 404 for a worker thread, the parent is unknown, so the plugin writes the `reconcile` row and warns but cannot message the supervisor. | Accepted limit, now stated in the spec (D-047). |
| C3 | unrequested | LOW | `src/exec.ts` | `ExecOptions.timeoutMs` and `signal` are accepted and passed to `spawn`, and no caller uses them. | Left in place: two lines, covered by no test. Remove if the owner prefers. |

Metrics: 55 requirements and 9 success criteria checked, 11 plan decisions checked, 6 constitution principles checked.
Findings by gap type: 1 contradicts, 1 partial, 1 unrequested, 0 missing.

## Remaining work

None in scope.
These items stay open on purpose:

| Item | Owner | Where |
| --- | --- | --- |
| Waive or redo the six test-after behaviors (C1) | The owner | `analyze.md` F1, `tdd/verification.md` |
| A second audit of the remediation | The owner or a later `/speckit.tdd.verify` | `checklist.md` CHK046 |

### Captain decisions of 2026-11-07

- The waiver for the six test-after behaviors is accepted (D-056).
- D-031 and D-030 are accepted for this PR (D-057, D-058).
- A pull request must belong to the project's repository (D-059), and a deleted thread leaves a merged task alone (D-060).
| A tool or another path to answer a pipeline finding, and what an override means (F9) | The owner | D-031 |
| An approval form is not proof of a human (F8) | The owner, with branch protection and scoped tokens | D-030 |
| The real `gh pr merge` path, teardown, and the merge form in a live bb, and a recorded `checks-passed` output | Milestone 11 | D-042, D-049, `spike/RESULTS.md` item 27 |
| `bb plugin install` into the owner's bb, and the supervisor and worker skills | Milestone 11 | D-041 |
| Nothing writes a project config, so every project runs `no-mistakes` with `yolo` off | Milestone 9 | D-037 |
| Dispatch resolver, machine placement, extension surface, limits, and cutover | Milestones 7 to 10 | `docs/DESIGN.md` |
| Hard rules 5, 6, and 7 | Milestones 8 and 9 | D-009 |
| Coverage and automated mutation testing | The owner | `tdd/verification.md` |

## Risk

| Risk | Level | Why |
| --- | --- | --- |
| A gate fails open | Low | Every gate is a machine guard, the tools only build events, and the mutants on the merge, teardown, report, handler, and driver gates were each caught (cycles C9 to C23 and R1). |
| A submitted form is forged by an agent with a shell | Medium | bb records no submitter (D-030). The plugin validates strictly, and the design already names branch protection and scoped tokens as the backstop. |
| A merge or git command misbehaves on a real forge | Medium | `gh pr merge` and the local merge never ran against a real pull request (D-042). The command lines and the git facts are tested, and milestone 11 is the live check. |
| A bb contract differs from the fake host | Medium | The live smoke test found one such difference (D-053). The fake host does not check the rule, so a second one could exist. |
| The six test-after behaviors hide a weak test | Low | Each has a mutant that fails its test (cycle R1). The random walk was rebuilt after the audit showed it was too shallow (D-055). |
| `thread.failed` races bb's own provider retry | Low | The task fails closed and the supervisor is told (D-040). |
| A pipeline run ends in an override and parks the task | Low | The task waits in `needs_decision` and the supervisor escalates, as the smoke test showed (D-031). |

## Next step

Run the no-mistakes pipeline on the branch, then read the pull request back from the forge.
Report C1, F8, and F9 to the owner in the summary.
