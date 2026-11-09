# Quality gates: supervisor start command, role advice, and the dispatch roles block

**Purpose**: Record the quality gates for the finished implementation, with the evidence for each.
**Created**: 2026-11-09
**Feature**: [spec.md](spec.md)

A checked item has evidence that I ran or read in this worktree, on the tree at `a869b33` plus this file.
An unchecked item names what is missing and who owns it.
This file is the evidence record of the implementation.
The reviewer-owned requirements-quality checklist is a separate file, `checklists/safety-and-observation.md`, and its boxes stay unchecked until a reviewer decides.

## Build and static checks

- [x] CHK1601 `pnpm run typecheck` passes for `src/`, `test/`, and `tools/`.
      Evidence: `pnpm run check` exited 0 on this tree.
- [x] CHK1602 `pnpm run lint` passes, including the rule that `src/harness/` imports nothing and `src/machine/` imports no bb.
      Evidence: `pnpm run check`. The rule fired once during the feature (the advice module first imported a type from `contracts.ts`) and the module now takes a structural type (`tdd/cycle-log.md`, group 4).
- [x] CHK1603 `pnpm test` passes with no skipped test.
      Evidence: 151 files, 2067 tests, 0 failed, 25 s (1842 tests before the feature). The audit's cold smell pass found no `skip`, `only`, `todo`, snapshot, or `vi.mock` in the added tests.
- [x] CHK1604 The plugin builds.
      Evidence: `bb plugin build` ran inside the lab in all five live runs ("Copying and building the plugin"). `pnpm run build` was not run on its own, and it needs the `bb` command-line tool of the host.
- [x] CHK1605 A full run of the suite leaves no temporary directory behind (SC-009).
      Evidence: the matching directories in the temporary directory were 3216 before and 3216 after a full `pnpm test`, and the new test that makes directories (`src/validator/agent.shell.test.ts`) left no `agent-shell-*` directory. The 3216 are leaks from before D-121, which the fix leaves alone.

## The hard rules and the constraints of the design

- [x] CHK1610 The plugin writes no no-mistakes configuration, on the server or on a remote machine (FR-015, T051).
      Evidence: `grep -rn "config.yaml\|\.no-mistakes\|NM_HOME" src --include=*.ts` outside tests finds one line, the `READ_SCRIPT` constant (`src/validator/agent.ts:45`), whose body is `if [ -f "$f" ]; then cat "$f"; else exit 3; fi`. The only file writer in `src/` is `files.writeNew`, and its only caller is `dispatch init`, which writes the plugin's own `.bb/factoryman/dispatch.json` (`src/dispatch/init.ts:97`). Under a real `sh` the script changes nothing in the home or the no-mistakes directory (`[U1726]`), and the recorded commands of every observation are the one script (`[A1613]`). Five mutants of the script, including one that adds a `touch`, fail the shell tests.
- [x] CHK1611 `src/machine/` and `src/harness/` import nothing from `@get-bb/*` (FR-029, T051).
      Evidence: `grep -rn "@get-bb" src/machine src/harness --include=*.ts` is empty, and the ESLint rule that enforces it passes.
- [x] CHK1612 Nothing fails open (hard rule 8).
      Evidence: `supervisor start` spawns nothing after any refusal, and a mutant that ignores the gate result fails four tests (`M4`); an agent with no known provider, an unobserved result, and a missing provider state are never reported ready (`[U1689]`, and mutant `M12` fails `[U1671]` and `[U1673]`); a hand-off is never refused by the observation, and blank evidence is still refused (`[U1719]`, `[U58]`, and a mutant that removes the blank-evidence condition fails both).
- [x] CHK1613 No gate was added to the state machine or removed from it.
      Evidence: `git diff 8578209..HEAD --stat -- src/machine` is empty. The preflight check and the command's refusals sit outside the machine, and the hand-off adds a line to evidence and nothing else.
- [x] CHK1614 No dependency was added.
      Evidence: `git diff 8578209..HEAD -- package.json pnpm-lock.yaml` is empty. The reader of the `agent` key is a small function in `src/validator/agent.ts` (D-126).

## The suite, in a real lab (quickstart step 4)

All five runs used `--lab-dir /var/tmp/bblab-supervisor-start`, bb 0.49.0, no credential, and the harness command-line tools of this machine bound read-only.

- [x] CHK1620 Tier 1 exits 0 with S9 `pass` and no known gap.
      Evidence: `conformance/results/1-stub.json` (plugin commit `5042e16`, isolation clean, tripwire with no event). S1 to S12 all pass.
- [x] CHK1621 Tier 1.5 exits 0 for Claude Code, Codex, Pi, and omp, offline, with S9 `pass` and all five S9 checks true.
      Evidence: `conformance/results/1.5-*.json`. Claude Code 2.1.316, Codex 0.166.0, and omp 18.18.3 on the commit `5042e16`; Pi 1.4.0 from the rerun on `53eeae8`. S10 is skipped at this tier on all four. The verdicts are in `data/bb-factoryman-supervisor-profile-validator-observe/pr-verdicts.md` in the firstmate home, for the pull request description.
- [x] CHK1622 A supervisor that `supervisor start` made was offered its four tools and its skill on its first request on every harness, including Codex and omp.
      Evidence: the `S9.start-tools` evidence of each result file, and D-130.
- [x] CHK1623 The stamp text matches the harness: Codex and omp are told to clear, Claude Code and Pi are told "next turn".
      Evidence: the `S9.stamp-advice` evidence of each result file, and `[U1644]`, `[U1645]`, `[A1607]` against the real contract table.
- [x] CHK1624 No credential was read, written, created, or passed.
      Evidence: the runner copies only the lab variables and `PATH` and `HOME` into the lab, and the drivers write only the literal `mock-not-a-credential` (earlier features `[U1371]` and `[U1333]` still pass). The tripwire of every run recorded no event.
- [x] CHK1625 The isolation check was clean on every final run.
      Evidence: `isolation.clean` is true in all five result files.
- [x] CHK1626 The one live failure is explained and fixed.
      Evidence: the first Pi run failed S2 to S12 with "It lists: no models", a second run passed, and the lab now waits for bb's model catalog (D-132, `[U1720]`, `[U1721]`). The failed result file was overwritten by the rerun.

## The quickstart, in order (T052)

- [x] CHK1630 Step 1, the unit and acceptance tests.
      Evidence: `src/tools/supervisor-start.test.ts` and `supervisor-command.test.ts`: 66 passed. `src/dispatch/config.test.ts`, `src/validator/agent.test.ts`, `src/harness/advice.test.ts`: 112 passed. `test/acceptance/supervisor-start.test.ts` and `validator-observe.test.ts`: 27 passed. `pnpm run check` exited 0 (151 files, 2067 tests).
- [x] CHK1631 Step 2, the command against the fake bb: one spawn call with `{ role: "supervisor" }`, the refusals, and the stamp advice.
      Evidence: `[A1601]` to `[A1605]`, `[A1621]`, `[A1622]`, `[A1607]` (in the files of step 1).
- [x] CHK1632 Step 3, the validator line and the single read command.
      Evidence: `[A1608]` to `[A1613]` (in `validator-observe.test.ts`).
- [x] CHK1633 Step 4, the five live runs: see CHK1620 to CHK1626.
- [x] CHK1634 Step 5, the records.
      Evidence: `docs/DECISIONS.md` holds D-123 to D-134 with no duplicate number and no dangling citation (`[A1509]`, `[A1510]`, `[A1618]`); `.specify/memory/constitution.md` is at 1.4.0 and its Principle VI names H4 and H12 (D-129); `docs/HARNESS-SUPPORT.md` shows S9 as `pass` for all five runs and no known gap (`[A1619]`).

## Decision log and documents

- [x] CHK1640 `docs/DECISIONS.md` records every decision, finding, deviation, and limit of this feature: D-123 to D-134.
- [x] CHK1641 The text that this change made wrong is corrected: the S9 row and the gap paragraph of `docs/CONFORMANCE.md`, the sentence about "the thread's next session" in `docs/LIVE-CHECK.md`, and step 5 of `docs/CUTOVER.md`. The docs rewrite (H9) stays out of scope.
- [x] CHK1642 `docs/HARNESS-SUPPORT.md` is generated from the result files and matches them.
      Evidence: `[A1329]` and `[A1619]` regenerate and compare it, and passed on this tree.
- [x] CHK1643 `CLAUDE.md` and `docs/DESIGN.md` needed no change.
      Evidence: the "Current scope" text of `CLAUDE.md` is not part of the constitution amendment (D-117, D-129), and `DESIGN.md` is the subject of report task H9.

## Not done, and who owns it

- [x] CHK1650 The captain accepted D-133 on 2026-11-09 as a recorded test-after waiver for the thirteen behaviors that passed on their first run (seven from the audit, six added by the remediation), each with a killing mutant, on the precedent of D-099, D-107, D-116, and D-122. Evidence: `docs/DECISIONS.md` D-133 and `tdd/cycle-log.md` ("Decision"). The five `LIKELY` behaviors are not part of the waiver. The audit verdict stays `FAIL` as of the audited commit.
- [ ] CHK1651 A fresh TDD audit to confirm the remediation (findings 1 and 3 to 14 of `tdd/verification.md`). The re-check in that file was written by the session that did the fixes. Owner: the next reviewer.
- [ ] CHK1652 The reviewer-owned checklist `checklists/safety-and-observation.md` (30 items, all unchecked). Item CHK013 raises a real question: a supervisor in permission mode `full` can answer the owner's approval form (D-030). That exposure exists today for any supervisor with a shell, and this feature allows Pi as a supervisor on the report's decision D3. Owner: the reviewer, and the captain for CHK013.
- [ ] CHK1653 The validator observation has not met a real no-mistakes install (D-134). The first no-mistakes project that the owner dispatches will show the line. Owner: the owner, at the cutover.
- [ ] CHK1654 Tier 2 (a real model) for each harness. Owner: the captain, who holds the credentials. Out of scope here.
- [ ] CHK1655 `tools/conformance/real-lab.ts` has no unit test; its pure parts do. The five live runs are its test, as in D-107. Owner: the maintainer.
- [ ] CHK1656 Directories that earlier runs leaked in the temporary directory are still there (3216 matching). Owner: the person who owns that machine.
