# Convergence: harness documentation catch-up

Assessment of the tree at `32c1517` plus the specification artifacts against `spec.md`, `plan.md`, and `tasks.md`.

**Outcome: converged.** The documents satisfy the specification, the plan, and the task list.
`tasks.md` is unchanged by this step.
One decision stays open and belongs to the captain (below).

## What was checked

| Source | Result | Evidence |
| --- | --- | --- |
| FR-001 to FR-006 (runbook) | Met | `[A1701]` to `[A1705]`, `[A1114]`, `[A1107]`, `[A1112]` pass; 14 of 16 runbook tests failed against the old runbook |
| FR-007 (design) | Met | `[A1709]`, `[A1710]`; each name is read from the code |
| FR-008 (decision log) | Met | `[A1711]`; D-063, D-064, D-092, D-093 carry "Amended by", D-135 exists |
| FR-009 (Claude-only wording) | Met | `[A1708]`; `grep -i claude` finds only the `--harness claude-code` example in `docs/CONFORMANCE.md`, which is the harness id |
| FR-010 (claims checked) | Met | `research.md` R1 to R33 |
| FR-011 (no code change) | Met | `git diff --stat 2b0bac6 -- src tools skills conformance docs/HARNESS-SUPPORT.md CLAUDE.md .specify/memory` prints nothing |
| FR-012 (`pnpm run check`, style) | Met | 152 files, 2076 tests passed; no em dash; sentence per line in the added prose |
| SC-001 to SC-005 | Met | as above |
| Plan: LIVE-CHECK, DESIGN, DECISIONS changes and the guard changes | Met | commits `f02c7c3`, `df1907a`, `9a7e9d0`, `284443c`, `32c1517` |
| Constitution I to IV, VI | Met | no gate, machine, store, or scope change |
| Constitution V | One exception | `[A1109]` is `TEST_AFTER` (audit finding 1) |

Findings by gap type: missing 0, partial 0, contradicts 0, unrequested 0.
The one `unrequested` candidate is the new guard `design-profiles.test.ts`: the plan names it (T005), and FR-011 now says so.

## Merge readiness

- **Risk**: low. Documents and their guards only. A wrong sentence in the runbook would mislead the owner during the live check, which has not run. The guards check that every command, flag, tool, and provider the runbook names exists.
- **Evidence**: `checklist.md` (quality gates), `tdd/verification.md` (audit and mutants), `analyze.md`, and the cycle log.
- **Open for the captain**:
  1. Accept or reject the `TEST_AFTER` behavior `[A1109]` (D-135). It fails when its property is removed (mutants M17, M18).
  2. Confirm the reading of "docs lint" and "no code changes": the two guard files changed with their documents (D-135).
- **Not done, by decision**: tier 2 runs (report task H13, shelved).
- **Not exercised**: how a key reaches Codex, Pi, and omp inside the lab. The runbook says so.
- **No hosted CI**: the repository has none. The pipeline runs `pnpm run check`.
