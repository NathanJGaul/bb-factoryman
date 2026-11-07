# Quality gates: machine placement

**Purpose**: Record the quality gates for the finished implementation, with the evidence for each.
**Created**: 2026-11-07
**Feature**: [spec.md](spec.md)

A checked item has evidence that I ran or read in this worktree.
An unchecked item names what is missing and who owns it.

## Build and static checks

- [x] CHK801 `pnpm run typecheck` passes. Evidence: `pnpm run check` after the last change.
- [x] CHK802 `pnpm run lint` passes, and the `src/machine` isolation rule is active. Evidence: `pnpm run check`, `test/acceptance/lint-isolation.test.ts`. `git diff 5028c96..HEAD -- src/machine` adds one event field, one guard, one table entry per lane, and one reason code, and no import.
- [x] CHK803 `pnpm test` passes with no skipped test. Evidence: 72 files, 873 tests.
- [ ] CHK804 `pnpm run build` passes. Run at the end of milestone 11, with the final source.
- [ ] CHK805 A second enrolled machine runs a worker, goes offline, and comes back. Owner: the live check (milestone 11).

## Hard rules

- [x] CHK810 Rule 5, an offline machine blocks and never falls back. Evidence: `[A808]`, `[U805]`, `[U806]`, `[U808]`, `[A809]`, `[A810]`, `[A811]`, `[A812]` (33 moves, none changes the machine), and the fail-closed placement tests `[U857]`, `[A827]`.
- [x] CHK811 Rule 6, `local-only` stays on the machine with the clone. Evidence: `[A814]`, `[A815]`, `[A816]`, `[A826]`, `[U814]` to `[U818]`, and the preview that spawns no worker for a refused start.
- [x] CHK812 Rule 2 still holds on a remote machine. Evidence: `[A822]`, `[A823]`, `[U861]`, `[U837]`.
- [x] CHK813 Rule 8, nothing fails open. Evidence: `[U827]` to `[U830]` (a terminal that fails, hangs, or truncates is a failed command), `[U857]` to `[U861]`, and the real-shell tests `[U878]`.
- [ ] CHK814 Rule 7 is milestone 9.

## Spec coverage

- [x] CHK820 Every acceptance scenario has a test through the plugin factory or the `bb factoryman` command. Evidence: `tdd/test-list.md`, traced by script (24 of 24).
- [x] CHK821 Every functional requirement traces to a behavior (12 of 12).
- [x] CHK822 Test strength was measured with deliberate mutants. Evidence: `tdd/verification.md` (91 mutants, 22 survived) and cycle R1 (every real survivor killed; N4 and N5 are equivalent).

## Docs

- [x] CHK830 Every deviation and gap has a `docs/DECISIONS.md` entry (D-069 to D-077).
- [x] CHK831 `spike/RESULTS.md` records items 6, 7, and 8.
- [x] CHK832 Docs follow the Google developer documentation style, with one sentence per line.
