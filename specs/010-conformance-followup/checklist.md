# Quality gates: conformance follow-up after the harness contracts landed

**Purpose**: Record the quality gates for the finished implementation, with the evidence for each.
**Created**: 2026-11-09
**Feature**: [spec.md](spec.md)

A checked item has evidence that I ran or read in this worktree.
An unchecked item names what is missing and who owns it.

## Build and static checks

- [x] CHK1501 `pnpm run typecheck` passes for `src/`, `test/`, and `tools/`.
      Evidence: `pnpm run check` (exit 0) after the last code change (`5555706`).
- [x] CHK1502 `pnpm run lint` passes.
      Evidence: `pnpm run check`.
- [x] CHK1503 `pnpm test` passes with no skipped test.
      Evidence: 143 files, 1842 tests, 0 failed. The cold smell pass found no `skip`, `only`, or `todo` and no weakened test.
- [x] CHK1504 No file under `src/` changed.
      Evidence: `git diff 3b827b8..HEAD --stat -- src` is empty (FR-013). The plugin built in all five lab runs (`bb plugin build` inside the runner), so `pnpm run build` is covered.
- [x] CHK1505 A full run of the suite leaves no `bb-fake-plugin-host-*` directory behind.
      Evidence: with a fresh `TMPDIR`, 394 directories without the setup file and 0 with it, and an empty `TMPDIR` afterwards (`tdd/cycle-log.md`, group 5). `[U1532]` fails if the root config stops wiring the setup file.

## The suite, in a real lab

- [x] CHK1510 `pnpm run conformance -- --tier 1 --offline` exits 0 and prints twelve verdicts.
      Evidence: `conformance/results/1-stub.json`. S1 to S8 and S10 to S12 pass, S9 is a known gap, isolation clean, and the lab proved it was offline (`ENETUNREACH`, loopback HTTP 200). A first tier 1 run with the network shared (the default) also exited 0.
- [x] CHK1511 `pnpm run conformance -- --tier 1.5 --harness <id>` exits 0 for Claude Code, Codex, Pi, and omp.
      Evidence: `conformance/results/1.5-*.json`, offline, each with S1 to S8, S11, and S12 passing, S9 a known gap, S10 skipped, and isolation clean.
      Versions: Claude Code 2.1.316, Codex 0.166.0, Pi 1.4.0, omp 18.18.3, all on bb 0.49.0. The plugin commit in every result is `1e7be3e`.
- [x] CHK1512 Pi passes the ship scenario in a `direct-PR` project, and the support document says so.
      Evidence: `docs/HARNESS-SUPPORT.md`, row S4 of Pi: `pass | Ship | This harness ran in direct-PR mode, because the plugin does not admit it in local-only mode.` Before the change the Pi run failed S2 to S8, S11, and S12.
- [x] CHK1513 omp passes with the reasoning level `auto`, and its unsupported profile is still refused.
      Evidence: the omp result file (S2 passes both checks, `S2.unsupported-blocks` included). Before the change the omp run failed S2 to S8, S11, and S12.
- [x] CHK1514 No known gap is stale, and the S9 gaps stay.
      Evidence: no run printed `stale gap`. `conformance/known-gaps.json` holds the three S9 entries (`[U1520]`, `[A1507]`, `[A1508]`).
- [x] CHK1515 No credential was read, written, created, or passed.
      Evidence: the runner copies only the lab variables and the `PATH` and `HOME` into the lab, and the drivers write only the literal `mock-not-a-credential` (earlier feature `[U1371]` and `[U1333]` still pass). The tripwire of each run recorded no event.
- [x] CHK1516 The isolation check was clean on every final run and no lab process was left.
      Evidence: `isolation.clean` is true in all five result files. After the last run no process mentioned the lab directory and nothing listened on the lab ports. `bblab down` ran after each run.

## Decision log and documents

- [x] CHK1520 The decision log holds one heading for each number, and every citation names a heading.
      Evidence: `[A1509]`, `[A1510]`, `[A1515]`, and the mutants that break each (`tdd/cycle-log.md`, groups 4 and the remediation).
- [x] CHK1521 The citations of D-100 to D-117 outside `docs/DECISIONS.md` name the entry that the author meant (task T023).
      Evidence: read in planning. The citations of D-100 to D-107 sit in `specs/009-conformance-harness/` and match their entries (D-100 the gap scope, D-101 known gaps, D-103 offline, D-105 the five harness facts, D-106 the isolation check, D-107 the test-after exception). The citations of D-108 to D-117 sit in `src/`, `docs/`, `.specify/memory/constitution.md`, and `specs/009-harness-independence/`, and match theirs (D-112 `dispatch init`, D-113 reasoning ladders, D-115 failure evidence, D-117 the constitution). D-120 records that nothing needed renumbering.
- [x] CHK1522 `docs/DECISIONS.md` records every decision and deviation of this feature: D-118 to D-122.
- [x] CHK1523 `docs/CONFORMANCE.md` names the `deliveryMode` field, says that S4 follows it, and drops the gaps that closed.
- [x] CHK1524 `docs/HARNESS-SUPPORT.md` is generated from the result files and matches them.
      Evidence: `[A1329]` regenerates it from `conformance/results/` and compares, and it passed on the final tree.
- [x] CHK1525 `CLAUDE.md` and `docs/DESIGN.md` needed no change.

## Not done, and who owns it

- [ ] CHK1530 The captain accepts or rejects D-122 (four behaviors that passed on their first run, each with a killing mutant). Owner: the captain. The audit verdict stays `FAIL` by the rubric until then.
- [ ] CHK1531 Tier 2 (a real model) for each harness. Owner: the captain, who holds the credentials. Out of scope here.
- [ ] CHK1532 `bb factoryman supervisor start` (report task H4) and the validator readiness check. Owner: the next feature. The three S9 gap entries wait for H4, and each run fails once the command exists until its entry is removed.
- [ ] CHK1533 `tools/conformance/real-lab.ts` and the lab scripts have no unit test. Owner: the maintainer, as in D-107. The five live runs are their test.
- [ ] CHK1534 Directories that earlier runs leaked in `/tmp` are still there. Owner: the person who owns that machine. The fix stops new leaks and deletes nothing it did not make.
