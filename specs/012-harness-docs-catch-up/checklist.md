# Quality gates: harness documentation catch-up

**Purpose**: Record the quality gates for the finished change, with the evidence for each.
**Created**: 2026-11-09
**Feature**: [spec.md](spec.md)

A checked item has evidence that I ran or read in this worktree, on the tree at `32c1517` plus this file.
An unchecked item names what is missing and who owns it.
This file is the evidence record of the change.
The reviewer-owned requirements-quality checklist is a separate file, `checklists/documentation-quality.md`, and its boxes stay unchecked until a reviewer decides.

## Build and static checks

- [x] CHK1701 `pnpm run typecheck` passes for `src/`, `test/`, and `tools/`.
      Evidence: `pnpm run check` exited 0 on this tree.
- [x] CHK1702 `pnpm run lint` passes.
      Evidence: `pnpm run check`. ESLint ignores `docs/` and `specs/`, so the documents themselves are checked by the guards below.
- [x] CHK1703 `pnpm test` passes with no skipped test.
      Evidence: 152 files, 2076 tests, 0 failed, 46 s (151 files and 2067 tests at the baseline). The added tests hold no `skip`, `only`, or `todo`.
- [x] CHK1704 The three guards pass: `live-check.test.ts` (16 tests), `design-profiles.test.ts` (2), and `decision-log.test.ts` (5).
      Evidence: `pnpm vitest run` on the three files, 23 passed.

## Scope (FR-011)

- [x] CHK1710 Nothing under `src/`, `tools/`, `skills/`, or `conformance/` changed, and neither did the generated `docs/HARNESS-SUPPORT.md`, `CLAUDE.md`, or `.specify/memory/`.
      Evidence: `git diff --stat 2b0bac6 -- src tools skills conformance docs/HARNESS-SUPPORT.md CLAUDE.md .specify/memory` prints nothing.
- [x] CHK1711 The only test files that changed are the two guards that pin the documents, and the new design guard.
      Evidence: `git diff --stat 2b0bac6 -- test` lists `live-check.test.ts`, `decision-log.test.ts`, and `design-profiles.test.ts`.
- [x] CHK1712 No `CHANGELOG.md` was edited.
      Evidence: `git diff --stat 2b0bac6` lists no changelog.

## Content (FR-001 to FR-010)

- [x] CHK1720 The runbook lists tiers 0, 1, 1.5, and 2 and says that no tier 2 run has been done (FR-001, FR-002).
      Evidence: `[A1701]` passes and fails when the status sentence is removed (mutant M2).
- [x] CHK1721 The runbook gives one credential row for each of the four harnesses and has only the captain create a credential (FR-003).
      Evidence: `[A1703]`; mutant M1 fails it.
- [x] CHK1722 No credential reaches a command line, a file, or an agent in the runbook (FR-005).
      Evidence: `[A1114]` pins seven fixed lines and rejects `sk-` literals; mutants M6 and M14 fail it.
- [x] CHK1723 The design states what the code does for profiles, readiness, admission, the contract table, roles, `supervisor start`, and the validator observation (FR-007).
      Evidence: `[A1709]` reads the code for each name; mutants M8, M16, M20 fail it.
- [x] CHK1724 D-063, D-064, D-092, and D-093 each carry an "Amended by" line, and D-135 exists (FR-008).
      Evidence: `[A1711]`; mutant M10 fails it.
- [x] CHK1725 Each claim of the new text has a source in `research.md` (FR-010, SC-005).
      Evidence: R1 to R33 in `research.md`, each with a file and a result.
- [x] CHK1726 The new text has no em dash, and each sentence of the added prose is on its own line (FR-012).
      Evidence: `grep -cP "\x{2014}"` prints 0 for the three documents. The line splitter ran over the runbook and the added lines of the design.

## Items that are not closed

- [ ] CHK1730 The captain accepts or rejects the `TEST_AFTER` behavior `[A1109]` (audit finding 1, D-135).
      Owner: the captain.
- [ ] CHK1731 Hosted CI. There is none. The no-mistakes pipeline runs the repository's own checks.
      Owner: not applicable.
- [ ] CHK1732 A tier 2 run on any harness. Shelved by the captain.
      Owner: the captain (report task H13).
