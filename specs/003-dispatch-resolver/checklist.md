# Quality gates: dispatch resolver

**Purpose**: Record the quality gates for the finished implementation, with the evidence for each.
**Created**: 2026-11-07
**Feature**: [spec.md](spec.md)

A checked item has evidence that I ran or read in this worktree.
An unchecked item names what is missing and who owns it.

## Build and static checks

- [x] CHK701 `pnpm run typecheck` passes. Evidence: `pnpm run check` after the last code change.
- [x] CHK702 `pnpm run lint` passes, and the `src/machine` isolation rule is active. Evidence: `pnpm run check`, `test/acceptance/lint-isolation.test.ts`.
- [x] CHK703 `pnpm test` passes with no skipped test. Evidence: 63 files, 708 tests. A search for `.skip`, `.only`, `.todo`, and `xit` finds none.
- [ ] CHK704 `pnpm run build` passes on bb 0.48.1. Run at the end of milestone 11, with the final source.
- [ ] CHK705 A real bb runs the resolver against a real project. Owner: the live check (milestone 11), because D-062 depends on it.

## Hard rules

- [x] CHK710 Rule 8, nothing fails open. Evidence: `[A709]` (bad config), `[A710]` (provider), `[A715]` and `[A716]` (bb or resolver errors), `[A711]` (no task and no log row for any blocker).
- [x] CHK711 The constraint "never lower reasoning without standing permission". Evidence: `[A708]`, `[U722]` to `[U728]`, `[U744]`.
- [x] CHK712 The constraint "a missing profile or unavailable provider is a blocker, not a fallback". Evidence: `[A709]`, `[A710]`, `[U731]` to `[U734]`.
- [x] CHK713 `src/machine/` has no change and no import from `src/dispatch/`. Evidence: `[A714]`, and `git diff bf5f79b..HEAD -- src/machine` is empty.
- [ ] CHK714 Rules 5, 6, and 7. Not in scope here: milestones 8 and 9.

## Spec coverage

- [x] CHK720 Every acceptance scenario has a test through the plugin factory. Evidence: `tdd/test-list.md`, traced by script (14 of 14).
- [x] CHK721 Every functional requirement traces to a behavior. Evidence: 12 of 12 after `[A718]`.
- [x] CHK722 Test strength was measured with deliberate mutants. Evidence: `tdd/verification.md` (49 mutants, 17 survived) and cycle R1 (every real survivor killed; two equivalents accepted).

## Docs

- [x] CHK730 Every deviation and gap has a `docs/DECISIONS.md` entry (D-062 to D-068).
- [x] CHK731 `spike/RESULTS.md` records item 29 for the bb facts this milestone uses.
- [x] CHK732 Docs follow the Google developer documentation style, with one sentence per line.
