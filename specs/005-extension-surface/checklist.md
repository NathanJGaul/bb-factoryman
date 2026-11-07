# Quality gates: extension surface

**Purpose**: Record the quality gates for the finished implementation, with the evidence for each.
**Created**: 2026-11-07
**Feature**: [spec.md](spec.md)

A checked item has evidence that I ran or read in this worktree.
An unchecked item names what is missing and who owns it.

## Build and static checks

- [x] CHK901 `pnpm run typecheck` passes. Evidence: `pnpm run check` after the last change.
- [x] CHK902 `pnpm run lint` passes, and the `src/machine` isolation rule is active. Evidence: `pnpm run check`, `test/acceptance/lint-isolation.test.ts`, and `[A918]`. The machine core gained one event field, one guard, one reason code, and one table entry per move, and no import.
- [x] CHK903 `pnpm test` passes with no skipped test. Evidence: 80 files, 975 tests.
- [ ] CHK904 `pnpm run build` passes. Run at the end of milestone 11, with the final source.
- [ ] CHK905 A real sibling plugin reads the RPC in a real bb. The probe plugins in `spike/RESULTS.md` items 9 and 10 read a probe's RPC and metadata, and the Factory Man plugin itself ran only in the fake host. Owner: the live check.

## Hard rules

- [x] CHK910 Rule 7, extensions can add checks and never remove a gate. Evidence: `[U902]` (16 gate-like keys, at three depths), `[U936]`, `[U903]`, `[U904]`, `[A905]` to `[A907]`, the tighten-only mode ladder `[U911]`, `[U912]`, `[A904]`, and the guard `[U915]`, `[U918]` that can only add a refusal.
- [x] CHK911 Rule 8, nothing fails open. Evidence: `[A902]`, `[U937]`, `[U938]`, `[A922]` (a bad file, an unreadable project, or an unreadable worktree stops the report), `[A911]` (a check that cannot run fails).
- [x] CHK912 The other gates still apply when every check passes. Evidence: `[A910]`, `[U918]`.
- [x] CHK913 A sibling plugin cannot trigger a transition. Evidence: `[A916]`, `[A917]`, `[U933]`, `[U934]`.

## Spec coverage

- [x] CHK920 Every acceptance scenario has a test through the plugin factory or `callRpc`. Evidence: `tdd/test-list.md`, traced by script (17 of 17).
- [x] CHK921 Every functional requirement traces to a behavior (10 of 10, FR-910 through `[A918]`).
- [x] CHK922 Test strength was measured with deliberate mutants. Evidence: `tdd/verification.md` (105 mutants, 18 survived) and cycle R1 (every real survivor killed).

## Docs

- [x] CHK930 Every deviation and gap has a `docs/DECISIONS.md` entry (D-078 to D-083).
- [x] CHK931 `spike/RESULTS.md` records items 9 and 10 and the loading note.
- [x] CHK932 Docs follow the Google developer documentation style, with one sentence per line.
