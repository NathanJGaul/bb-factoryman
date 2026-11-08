# Convergence: merge approval form in the web UI

**Run**: after `/speckit.analyze`, at `df0121b` plus the D-098 correction.
**Inputs**: `spec.md`, `plan.md`, and `tasks.md` as the only source of intent, the constitution, and the code in the worktree.
**Method**: for each requirement, acceptance scenario, plan decision, and constitution principle, a read of the code and of the test that covers it.

## Result

The implementation satisfies the specification, the plan, and the tasks, with one open decision that is not the code's to make.
`/speckit.converge` appended two tasks under `## Phase 12: Convergence`.
`T1296` (correct D-098) is done.
`T1295` (the owner decides D-099) stays open on purpose.

## Merge readiness

| Question | Answer |
| --- | --- |
| Does the feature do what the captain asked? | Yes. The merge approval form shows in the bb web UI, and a click on Approve, Deny, or Cancel works. A real bb 0.49.0 in the isolated lab showed it, with 20 screenshots. |
| Are the two smaller findings fixed? | Yes. `typecheck` calls `tsc6`, so `pnpm run check` passes with no global `tsc`. The runbook reads the machine name. |
| Is the approval design unchanged? | Yes. The backend gate, the state machine, the tools, and the approval record did not change. The one edit in `src/tools/merge.ts` takes the renderer id and the payload type from a shared module. No owner-typed code, no `factoryman_decide`. |
| Is D-030 still open, and recorded? | Yes: D-095. A worker with a shell can still answer through `bb thread interactions respond`. |
| Does the gate pass? | Yes. `pnpm run check` exits 0 with 95 files and 1310 tests, and `pnpm run build` writes the frontend bundle. |
| Does the TDD audit pass? | No. The verdict is `FAIL` for one reason: seven guard tests came after their code (D-099). |

## Evidence

- `tdd/test-list.md`: 56 of 57 behaviors `DONE`, and `U1213` is a baseline.
- `tdd/verification.md`: 45 of 45 hand-picked mutants killed, no open `HIGH` smell, and every acceptance criterion covered.
- `checklist.md`: the quality gates, with the evidence.
- `analyze.md`: one critical finding (constitution V, D-099) and no other drift.
- The lab: `data/bb-factoryman-approval-form/lab-check.md` in the firstmate home, with the screenshots and the evidence diff.

## Risk

- **D-099 (constitution V).** Seven guard tests have a recorded revert-red and a killing mutant, but the order cannot be shown in the history. The owner accepts or rejects this exception. The pull request should say so.
- **No person has clicked the form.** A browser tool did, in the lab. Tier 2 of the live check holds a person's click, and `docs/LIVE-CHECK.md` section 9 says so.
- **The new runbook line did not run against a real bb.** `MACHINE=$(bblab x bb machine list --json | jq -r '.[0].name')` and the preflight call with `"$MACHINE"` follow the earlier live check, which ran `preflight` with the real name. The next tier 0 run checks the new shell form (checklist CHK1244).
- **An unreadable request and a rejected answer** appear only in process tests. The backend never sends the first, and bb gives no way to reject a submit.
- **Report findings 5.5, 5.6, and 5.7 to 5.15 stay out of scope.** The supervisor still gets no message when the owner denies or cancels, and a worker-reported `blocked` still cannot resume. These are separate tasks.

## Remaining work

- `T1295`: the owner decides D-099 and records it in `docs/DECISIONS.md`. Not an implementation task.
- The no-mistakes pipeline: review, tests, docs, lint, push, and the pull request. Firstmate starts it.

## Update: the owner's decision

The captain accepted D-099 as a recorded deviation on 2026-11-08, so `T1295` is closed and the only remaining work is the no-mistakes pipeline.
The TDD audit verdict stays `FAIL` as computed, with the accepted exception noted in `tdd/verification.md`.

