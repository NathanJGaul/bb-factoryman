# Quality gates: skills and live check

**Purpose**: Record the quality gates for the finished implementation, with the evidence for each.
**Created**: 2026-11-07
**Feature**: [spec.md](spec.md)

A checked item has evidence that I ran or read in this worktree.
An unchecked item names what is missing and who owns it.

## Build and static checks

- [x] CHK1101 `pnpm run typecheck` passes. Evidence: `pnpm run check` after the last change.
- [x] CHK1102 `pnpm run lint` passes, and the `src/machine` isolation rule is active. Evidence: `pnpm run check`. This milestone changed nothing in `src/machine`.
- [x] CHK1103 `pnpm test` passes with no skipped test. Evidence: 92 files, 1133 tests.
- [x] CHK1104 `pnpm run build` passes with `skills/` in the tree. Evidence: `bb plugin build` wrote `dist/server.js`.
- [x] CHK1105 A real bb loads the plugin and lists both skills with scope `plugin`. Evidence: a path install into a throwaway bb 0.48.1 (spike item 11). The plugin was uninstalled afterwards.
- [ ] CHK1106 A real session resolves `configure` to the right skill and tools, and a worker reads its skill. Owner: the live check. The fake host rejects an unknown skill name and then returns no tools, and the real host is documented to do the same, so the live check confirms the supervisor still has its tools.

## Hard rules and the backstop

- [x] CHK1110 No skill or runbook line tells an agent or a person to get around a gate. Evidence: `[A1115]` and `[U1102]` (the lint, with 9 forbidden acts), `[A1118]`.
- [x] CHK1111 The skills agree with the code about tools, arguments, outcomes, states, and wake states. Evidence: `[A1116]` to `[A1119]`, against `reportSchema`, `dispatchSchema`, `statusSchema`, `mergeSchema`, `MERGEABLE_STATES`, `WAKE_STATES`, and `TABLES`.
- [x] CHK1112 The runbook does not install into the owner's bb or touch the shared no-mistakes daemon. Evidence: `[A1107]` (every `bb` command behind `bblab x`, no `~/.bb`, only `no-mistakes daemon status`).
- [x] CHK1113 The credential rule holds. Evidence: `[A1114]` (four fixed lines, no file, no pipe, exactly two variables, a fresh shell, `unset`, revoke), `[A1120]` (the skills say nothing about tokens), `[A1111]`.
- [x] CHK1114 Tier 2 follows the captain's decision: own account, the report's caps, and the free tiers first. Evidence: `[A1111]` to `[A1113]`. Mutants G04 to G09 and K05 to K23 fail them.
- [ ] CHK1115 Tier 1 runs. The stub agent does not exist (D-093). Owner: the captain, who decides whether to build it or to skip tier 1 with a recorded line.
- [ ] CHK1116 A lab process cannot read the token from the keeper's environment. Untested because `bblab` is not installed here (D-092). Owner: the captain, at the first tier 2 run.

## Spec coverage

- [x] CHK1120 Every acceptance scenario has a test. Evidence: `tdd/test-list.md`, 13 of 13.
- [x] CHK1121 Every functional requirement traces to a behavior (9 of 9).
- [x] CHK1122 Test strength was measured with deliberate mutants. Evidence: `tdd/verification.md` (140 mutants, 75 survived) and cycle R1 (86 re-run, all killed).

## Docs

- [x] CHK1130 Every deviation and gap has a `docs/DECISIONS.md` entry (D-090 to D-093).
- [x] CHK1131 `spike/RESULTS.md` records item 11.
- [x] CHK1132 Docs follow the Google developer documentation style, with one sentence per line.
- [ ] CHK1133 The runbook has not been run. The commands that I could check without a lab (flags, the database statement, the plugin loading) were checked. Owner: the captain.
