# Convergence: Apply a base branch

Assessment of the tree at `e596ce3` plus the checklist and analysis commits, against `spec.md`, `plan.md`, and `tasks.md`.

**Outcome: converged.** No task was appended and `tasks.md` is unchanged by this step.
The implementation satisfies the specification, the plan, and the task list.
Two items stay open for the owner (below).

## What was checked

| Source | Result | Evidence |
| --- | --- | --- |
| FR-001, FR-002 (flag needs `--apply --project`, usage errors) | Met | `[U1504]`, `[A1504]`; mutants V2, V11, V12 killed after cycle 4 |
| FR-003 (invalid name, exit 2, before the read) | Met | `[U1501]`, `[U1504]`, `[A1504]`; mutants V1, V7, V9 killed |
| FR-004, FR-005 (one write, idempotent) | Met | `[U1502]`, `[U1505]`, `[A1501]`, `[A1505]` |
| FR-006 (no flag, no change) | Met | `[U1503]`, `[A1503]`; the existing apply tests unchanged |
| FR-007 (warning on `local-only` with no base branch, also on a rerun) | Met | `[U1506]`, `[A1503]`, `[A1505]` |
| FR-008 (no event, approval, process, or `workflow.json` path) | Met | `[A1505]`, `[U1507]`; `src/workflow` and `src/store` untouched |
| FR-009 (usage and documents) | Met | `[A1506]`, `[A1507]`, `[A1109]`; D-150 in the log |
| SC-001 (the bug is gone for a stored base branch) | Met | `[A1502]` runs the real landed-work check and merge preflight on a real git repository: refused without the flag, passing with it |
| SC-002, SC-003 | Met | `[A1504]`, `[A1505]` |
| SC-004 | Met, with a note | no existing assertion was loosened; one existing test was edited, the allowed-flag list in `[A1109]` (analysis I1) |
| SC-005 | Met | 13 deliberate mutants, 2 survived, both killed after cycle 4 (`tdd/verification.md`, cycle log) |
| SC-006 | Met | `pnpm run check`: 164 files, 2417 tests, 0 failed, 46 s |
| Plan: pure check, command glue, docs | Met | `src/limits/registry-apply.ts`, `src/tools/supervisor-command.ts`, `src/server.ts`, the four documents |
| Constitution I to IV, VI | Met | no gate, machine, store, or scope change |
| Constitution V | Met, with a note | every behavior has a recorded red; two remediation cases (cycle 4) are test-after, proven by mutants |

Findings by gap type: missing 0, partial 0, contradicts 0, unrequested 0.
Small additions that the spec did not list, and why they stay: none beyond the `Invalid --base-branch` message line, which the spec's "says which rule the value breaks" calls for.

## Merge readiness

- **Risk**: low. The flag adds one owner-typed value to a command that the owner already runs.
  No gate changes. The landed-work check and merge preflight read the value as before.
  The one real exposure is the value itself: a base branch that equals the task's own branch would make unlanded work look landed (the reason D-078 keeps `baseBranch` away from `workflow.json`).
  The owner types it, as the SQL step did before, and the docs tell the owner to name the branch the checkout keeps.
- **Evidence**: `checklist.md` (quality gates), `tdd/verification.md` (audit, 13 mutants, and the resolution note), `analyze.md`, `tdd/cycle-log.md` (4 cycles), and D-150.
- **Open for the owner or reviewer**:
  1. The live check in a real bb: `import-registry --apply --project <lab> --base-branch main` on a `local-only` project, run twice, then a scout teardown (case E-01 of the manual test plan, `docs/LIVE-CHECK.md` "The import apply"). It was not run: this lane is offline by the task.
  2. The `tdd/verification.md` verdict still reads `FAIL`, as the audit's record at the time, for the two surviving mutants. Cycle 4 cleared both, and the audit was not re-run or independent. A reviewer who wants a clean verdict can run `/speckit.tdd.verify` again.
- **Not done, by scope**: the scout report file (finding 3), the other test plan findings, `defaultMachine` and forge writes, inferring a base branch, and checking that the branch exists.
- **Not exercised**: the command's output in a real terminal, and a real SQLite failure during the write (the failure test uses the memory store, as D-149 recorded for feature 014).
