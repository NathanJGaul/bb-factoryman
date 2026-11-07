# Quality gates: limits, backstop, and cutover

**Purpose**: Record the quality gates for the finished implementation, with the evidence for each.
**Created**: 2026-11-07
**Feature**: [spec.md](spec.md)

A checked item has evidence that I ran or read in this worktree.
An unchecked item names what is missing and who owns it.

## Build and static checks

- [x] CHK1001 `pnpm run typecheck` passes. Evidence: `pnpm run check` after the last change.
- [x] CHK1002 `pnpm run lint` passes, and the `src/machine` isolation rule is active. Evidence: `pnpm run check`, `test/acceptance/lint-isolation.test.ts`. The machine core gained one optional event field (`create.request`, FR-1012, `[U1045]`) and no import.
- [x] CHK1003 `pnpm test` passes with no skipped test. Evidence: 90 files, 1107 tests.
- [ ] CHK1004 `pnpm run build` passes. Run at the end of milestone 11, with the final source.
- [ ] CHK1005 A real bb reports a thread's `usage.cost` in the shape the budget reads, and a real webhook receiver accepts the post. Spike items 12 and 13 read the SDK types and a probe. The plugin itself ran only in the fake host. Owner: the live check.

## Hard rules and the backstop

- [x] CHK1010 A queued task keeps its pinned machine, and an offline machine leaves it queued (rule 5). Evidence: `[A1025]`, `[A1026]`, `[U1008]`, `[U1057]`.
- [x] CHK1011 A refused dispatch creates no task, including at a cap. Evidence: `[A1012]`, `[A1028]`.
- [x] CHK1012 Nothing fails open. A bad `limits` section blocks dispatch, an unreadable queued request fails with evidence, and a cost that cannot be read is said to be unknown. Evidence: `[A1024]`, `[A1007]`, `[U1063]`, `[A1011]`.
- [x] CHK1013 The merge gate is untouched. The plugin adds no way to approve, merge, or skip a gate, and the printed protection steps name the approval form gap. Evidence: `[A1017]`, `[A1018]`, the unchanged `src/machine` tables.
- [x] CHK1014 The protection command and the registry import change nothing. Evidence: `[A1017]` (runs nothing), `[U1056]` (the printed commands run against a stub `gh`), `[A1022]` (raw table rows compared before and after), `[A1023]` (`--apply` refused).
- [x] CHK1015 The webhook URL is a secret and stays out of logs. Evidence: `[A1015]`, `[U1019]`, `[U1048]` (credentials in the error text).
- [x] CHK1016 Shell input in the printed commands is limited to a strict allowlist. Evidence: `[U1021]`, `[U1054]` (16 characters in four places), `[U1055]`.

## Spec coverage

- [x] CHK1020 Every acceptance scenario has a test through the plugin factory or `runCli`. Evidence: `tdd/test-list.md`, traced by script (23 of 23).
- [x] CHK1021 Every functional requirement traces to a behavior (12 of 12).
- [x] CHK1022 Test strength was measured with deliberate mutants. Evidence: `tdd/verification.md` (133 mutants, 46 survived) and cycle R1 (every real survivor killed).

## Docs

- [x] CHK1030 Every deviation and gap has a `docs/DECISIONS.md` entry (D-084 to D-089).
- [x] CHK1031 `spike/RESULTS.md` records items 12, 13, 18, and 19.
- [x] CHK1032 `docs/BRANCH-PROTECTION.md` and `docs/CUTOVER.md` hold the steps, and a test reads the first.
- [x] CHK1033 Docs follow the Google developer documentation style, with one sentence per line.
- [ ] CHK1034 Nothing pins the rest of `docs/CUTOVER.md`. The live check and the owner read it. Owner: the owner at the cutover.
