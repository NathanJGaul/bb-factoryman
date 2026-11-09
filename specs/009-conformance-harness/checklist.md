# Quality gates: conformance harness for agent harnesses

**Purpose**: Record the quality gates for the finished implementation, with the evidence for each.
**Created**: 2026-11-09
**Feature**: [spec.md](spec.md)

A checked item has evidence that I ran or read in this worktree.
An unchecked item names what is missing and who owns it.

## Build and static checks

- [x] CHK1301 `pnpm run typecheck` passes for `src/`, `test/`, and `tools/`, and the tools config has `erasableSyntaxOnly`.
      Evidence: `pnpm run check` (exit 0). The script still starts with `tsc6` (`[A1214]`).
- [x] CHK1302 `pnpm run lint` passes.
      Evidence: `pnpm run check`. `src/machine/` and the browser-side rules are unchanged.
- [x] CHK1303 `pnpm test` passes with no skipped test.
      Evidence: 125 files, 1471 tests, 0 failed. The cold audit found no `skip`, `only`, or `todo`.
- [x] CHK1304 `pnpm run build` (`bb plugin build`) still builds the plugin, and `src/` did not change.
      Evidence: the build wrote `dist/server.js` and `dist/app.js`; `git diff 8148863..HEAD -- src` is empty. `dist/` is git-ignored and I removed it.

## The suite, in a real lab

- [x] CHK1310 `pnpm run conformance -- --tier 1` exits 0 in a clean lab and prints twelve verdicts.
      Evidence: run at the end of the session, 2 min 37 s. S2 to S6, S8, S10 to S12 pass. S1, S7, S9 are known gaps. Isolation clean.
- [x] CHK1311 `pnpm run conformance -- --tier 1.5 --harness <id>` exits 0 for Claude Code, Codex, Pi, and omp.
      Evidence: `conformance/results/1.5-*.json`. Each run used the real CLI behind the fake model, offline, and the isolation was clean.
      Versions: Claude Code 2.1.316, Codex 0.166.0, Pi 1.4.0, omp 18.14.1, all on bb 0.49.0.
- [x] CHK1312 The ship flow ran through each harness's own shell tool.
      Evidence: S4 `pass` for all four (`Bash`, `exec_command`, `bash`, `bash`), the branch holds one commit, and the task is `review_ready`.
- [x] CHK1313 The lab is offline at tier 1.5 and bb 0.49.0 starts and serves in it.
      Evidence: every tier 1.5 run printed `A public connection failed (ENETUNREACH) and the loopback answered with HTTP 200`. D-103 records the one thing bb needs the network for (its build toolchain).
- [x] CHK1314 No credential was read, written, created, or passed.
      Evidence: the lab environment copies only the lab variables and the `PATH` and `HOME` (`[U1371]`), the drivers write only the literal `mock-not-a-credential` under the lab home (`[U1333]`), and `bblab-evidence` reported no change to the real home in every run.
- [x] CHK1315 The isolation check was clean on every final run.
      Evidence: each result file has `isolation.clean: true`. The omp run ignored two unrelated file-name changes from other tools (D-106).

## Documents

- [x] CHK1320 `docs/HARNESS-SUPPORT.md` is generated from the result files and matches them.
      Evidence: `[A1329]` regenerates it from `conformance/results/` and compares.
- [x] CHK1321 `docs/CONFORMANCE.md` explains the tiers, the commands, the verdicts, and how to add a harness.
- [x] CHK1322 `docs/DECISIONS.md` records every deviation: D-100 to D-107.
- [x] CHK1323 The one wrong sentence that this change made in `docs/LIVE-CHECK.md` (save the lab scripts outside the repository) is corrected. `CLAUDE.md` needed no change.

## Not done, and who owns it

- [ ] CHK1330 The captain accepts or rejects the `TEST_AFTER` exception (D-107). Owner: the captain.
- [ ] CHK1331 Tier 2 (a real model) for each harness, and the model-behavior checks M1 to M4. Owner: the captain, who holds the credentials (report task H13).
- [ ] CHK1332 The open `MED` audit findings (tasks T1392 to T1396). Owner: the next maintainer; none blocks the suite.
- [ ] CHK1333 Report tasks H1, H3, and H4 close the known gaps in `conformance/known-gaps.json`. Each run fails once a gap closes, until its entry is removed.
