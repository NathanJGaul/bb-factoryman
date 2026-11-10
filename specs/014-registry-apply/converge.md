# Convergence: Registry apply

Assessment of the tree at `16f776e` plus the data-model fix in this commit, against `spec.md`, `plan.md`, and `tasks.md`.

**Outcome: converged.** No task was appended and `tasks.md` is unchanged by this step.
The implementation satisfies the specification, the plan, and the task list.
Two items stay open for the owner (below).

## What was checked

| Source | Result | Evidence |
| --- | --- | --- |
| FR-001, FR-002 (explicit apply, `--project` required) | Met | `[U1904]` (eight malformed calls), `[A1907]`, `[U1909]`, `[A1023]` |
| FR-003 to FR-005 (one project, ambiguity, unknown project, list failure) | Met | `[U1902]`, `[U1907]`, `[A1906]`, `[A1907]` (including a name inside a longer name) |
| FR-006, FR-007 (flagged refused, fields written, bare `yolo` never on) | Met | `[U1901]`, `[U1902]`, `[A1901]`, `[A1902]`, `[A1903]` |
| FR-008, FR-009 (conditional policy, base branch and machine untouched) | Met | `[A1903]`, `[A1904]`, `[U1901]` |
| FR-010 (idempotent) | Met | `[U1903]`, `[U1906]`, `[A1905]` |
| FR-011, FR-012 (one transaction, no event, no file or process, no bb write) | Met | `[U1908]`, `[A1908]`, `[U1905]` |
| FR-013, FR-014 (output, failed write) | Met | `[U1905]`, `[A1901]`, `[U1908]` |
| FR-015, FR-016 (help and documents) | Met | `[U1910]`, `[U1904]`, `[A1109]`, `[A1910]`; D-148 and D-149 in the log |
| SC-001 to SC-003 | Met | `[A1906]`, `[A1908]`, `[A1905]` |
| SC-004 | Met, with a note | no existing assertion was loosened; four existing tests were edited (analysis I2) |
| SC-005 | Met | 19 deliberate mutants, none survives (cycle log, verification addendum) |
| SC-006 | Met | `pnpm run check`: 162 files, 2340 tests, 0 failed, about 114 s |
| Plan: pure plan, command glue, docs | Met | `src/limits/registry-apply.ts`, `src/tools/supervisor-command.ts`, the four documents |
| Constitution I to IV, VI | Met | no gate, machine, store, or scope change; `src/machine` and `src/store` are untouched |
| Constitution V | One exception | nine test-after acceptance behaviors (D-149, verification finding 1) |

Findings by gap type: missing 0, partial 0, contradicts 0, unrequested 0.
Small additions that the spec did not list, and why they stay: one `log.info` line on a write (the only record of who applied what, D-148 gap), and a `projectListError` option in the plugin host fixture (the refusal test needs a failing `projects.list`).

## Merge readiness

- **Risk**: medium-low. The command writes `yolo` and the delivery mode, which decide whether a merge needs the owner's approval form. The guards are: explicit `--apply --project`, one project found by exact name, refusal on any flag, ambiguity, or list failure, no copy of a bare `yolo`, one transaction, and a no-op on a rerun. The one new power is that a `+yolo` registry token can store `yolo: true`; the owner reads the `yolo` column of the dry run first (analysis C1).
- **Evidence**: `checklist.md` (quality gates), `tdd/verification.md` (audit, 19 mutants, and the addendum), `analyze.md`, `tdd/cycle-log.md` (8 cycles), and the decision log D-148 and D-149.
- **Open for the owner**:
  1. The nine test-after acceptance behaviors (D-149, verification finding 1). The rubric fails the feature for them. Each stands on deliberate mutants that fail it, as in D-099, D-122, D-133, and D-144.
  2. The live check in a real bb (`docs/LIVE-CHECK.md`, "The import apply"). It was not run: this lane is offline by the task.
- **Not done, by scope**: task import, a cancel-queued-task tool, tool hints, and real-model runs.
- **Not exercised**: a real SQLite failure during the write (D-149), and the command's output in a real terminal.
- **No hosted CI**: the repository has none. The pipeline runs `pnpm run check`.
