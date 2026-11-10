# Quality gates: the `factoryman_decide` tool

**Purpose**: Record the quality gates for the finished change, with the evidence for each.
**Created**: 2026-11-09
**Feature**: [spec.md](spec.md)

A checked item has evidence that I ran or read in this worktree, on the tree at `8a6e998` plus this file.
An unchecked item names what is missing and who owns it.
This file is the evidence record of the change, written by the session that built it, and the user asked for the items to be checked against evidence.
The requirements-quality checklist of the specification is a separate file, `checklists/requirements.md`.

## Build and static checks

- [x] CHK1801 `pnpm run typecheck` passes for `src/`, `test/`, and `tools/`.
      Evidence: `pnpm run check` exited 0 on the tree at `689ab24`. The tools project type-checks under `erasableSyntaxOnly`, which is why the shared wording sits in a module with no imports (D-145).
- [x] CHK1802 `pnpm run lint` passes, including the rule that keeps `src/machine/` free of bb imports.
      Evidence: `pnpm run check`; `git diff --stat 9f87647..HEAD -- src/machine` prints nothing.
- [x] CHK1803 `pnpm test` passes with no skipped test.
      Evidence: 159 files, 2260 tests, 0 failed, 46 s (152 files and 2076 tests at the baseline). `grep -E "\.(skip|only|todo)\b|xit\(|xdescribe"` over the seven new test files prints nothing.
- [x] CHK1804 The suite leaves no temporary directory behind.
      Evidence: `bb-fake-plugin-host-*` under `${TMPDIR}` was 3159 before and 3159 after a full `pnpm test`, and again around `pnpm run check`. The old 3159 are leftovers from before D-121.
- [x] CHK1805 No dependency was added.
      Evidence: `git diff --stat 9f87647..HEAD -- package.json pnpm-lock.yaml` prints nothing.

## Hard rules and scope (FR-014, FR-015, FR-025)

- [x] CHK1810 The state machine did not change: no event, no guard, no table entry.
      Evidence: `git diff --stat 9f87647..HEAD -- src/machine` prints nothing. The tool uses `resolve`, which the machine already allows from `needs_decision`.
- [x] CHK1811 Nothing in `src/` passes `--yes` or `-y`, and the answer path was run against the real adapter.
      Evidence: `grep -rn -- "--yes" src` finds only a comment in `no-mistakes.ts`; `[A1804]` runs the real `NoMistakesValidator` over the recorded gate output and checks every command of the run; `[U180]` still passes; mutant V2 (add `--yes`) fails `[A1804]`.
- [x] CHK1812 The tool never reads `yolo`, and a project with `yolo` on still gets the form.
      Evidence: `decide.ts` mentions `yolo` only in a comment; `[A1806]` (two tests); mutant V1 (skip the form under `yolo`) fails `[A1806]`.
- [x] CHK1813 The loop still never answers a gate, and the answer is sent only after a strict approval and two matching reads of the live view.
      Evidence: `[U194]` (existing) and mutant V16 (the loop answers on its own) fail `[U192]`; `[A1807]` (denial, cancel, timeout, four unreadable replies); `[A1808]` (two tests) and `[U1823]` for the second read; mutants M1 to M13 all killed (cycle log).
- [x] CHK1814 How the validator runs did not change.
      Evidence: `git diff 9f87647..HEAD -- src/validator/no-mistakes.ts` prints nothing. The driver gained a key line in the parking evidence, a read, a send path, and an optional argument, and its loop is as it was.
- [x] CHK1815 Out of scope stayed out: no tier 2 run, no credential, no branch protection work, no machine event.
      Evidence: the five conformance runs are offline with the literal mock key; `git diff --stat 9f87647..HEAD` lists no workflow, no protection file, and no machine file.

## Behavior (FR-001 to FR-013, FR-016 to FR-019)

- [x] CHK1820 A supervisor can answer a gate with `approve`, `skip`, or `fix`, and the answer reaches the validator only after the owner approves.
      Evidence: `[A1801]`, `[A1802]` (two answers), `[A1803]`; the `resolve` row names the exact answer, the key, the approval, and the comment.
- [x] CHK1821 Every wrong call is refused before a form opens and sends nothing.
      Evidence: `[A1805]` (eleven table rows, a worker, another project, a working task, a scout), `[A1810]`; mutants M1 to M3, M6, M7, M9b, M10 killed.
- [x] CHK1822 A stale key, or a gate that moves while the form is open, sends nothing.
      Evidence: `[A1808]` (the gate changes key; the task leaves `needs_decision`), mutants M4 and M5 killed; the key changes when a fix round keeps the run and step (`[U1803]`, mutant V5).
- [x] CHK1823 One form is open per task.
      Evidence: `[A1809]`; mutants M12 and M13 killed.
- [x] CHK1824 A finished run that parked a task takes `rerun` only, and the machine's `resolve` is the whole effect.
      Evidence: `[A1811]`, `[A1812]`, `[U1818]`, `[U1848]`; mutants R1 to R4 killed. Accepting an override is a gap (D-141).
- [x] CHK1825 The tool is offered to supervisors only, on a flat schema.
      Evidence: `[A1816]`, `[U1824]`, `[U1825]`; mutants V4 and V18 killed.
- [x] CHK1826 The form shows the findings and the exact answer, fails closed on a payload it cannot read, and shows validator text as text.
      Evidence: `src/app/decision-approval-form.test.tsx` (26 tests), `[A1814]`, `[A1821]` through the registered renderer; mutants V3, V6, V7, V8, V23 killed. The merge renderer is unchanged (`[A1815]`, `[A1201]`, mutant V22).

## Harness suite (FR-020, FR-021)

- [x] CHK1830 S5, S8, and S9 expect or probe the fifth tool, and no new scenario, tier, or known gap was needed.
      Evidence: `conformance/known-gaps.json` is unchanged and empty; `[U1837]`, `[U1838]`, `[U1847]`, `[A1817]`.
- [x] CHK1831 The five offline runs pass on the final code.
      Evidence: tier 1 and tier 1.5 on Claude Code 2.1.316, Codex 0.166.0, Pi 1.4.0, and omp 18.18.3 all exited 0 on `8a6e998` (the last code commit; D-145 and D-147 explain the earlier runs), `dirty: false`, isolation clean, S1 to S12 `pass` (S10 `skipped` at tier 1.5), `S8.decide-wrong-state` and the five tools in S5 and S9 in every result file. `docs/HARNESS-SUPPORT.md` lists no known gap.
- [x] CHK1832 The live run found a defect that the offline tests could not, and it was fixed test first.
      Evidence: D-145 and cycle 13. The first run on `15de3f2` failed `S8.decide-wrong-state` (the probe was a scout task); the fake lab now models task kinds, and S8 probes with a ship task.

## Documents (FR-022 to FR-024)

- [x] CHK1840 The design lists the tool, says five tools and a sixth, and has a row in the authority gates table.
      Evidence: `[U1840]`, `[A1710]`.
- [x] CHK1841 The decision log starts at D-136, renumbers nothing, and the older decisions point to it.
      Evidence: D-136 to D-146 have one heading each (`[A1509]`, `[A1510]`); D-031, D-057, D-068, and D-095 carry `Amended by D-136` (`[U1841]`).
- [x] CHK1842 The constitution no longer says the tool stays out, and its version is bumped.
      Evidence: version 1.5.0, Principle VI (`[U1841]`, `[A1618]`, `[A1819]`).
- [x] CHK1843 The supervisor skill tells the supervisor how to answer a finding and that the owner approves.
      Evidence: `[U1836]`, `[A1103]`, `[A1105]`, `[A1116]`.
- [x] CHK1844 No document says the supervisor has four tools.
      Evidence: `[U1842]` and `[U1840]` over the design, the conformance runbook, the live-check runbook, and the skill.
- [x] CHK1845 No `CHANGELOG.md` was edited.
      Evidence: `git diff --stat 9f87647..HEAD | grep -ci changelog` prints 0.

## TDD evidence

- [x] CHK1850 Every behavior is on the list with a state, and the red of each cycle is in the log.
      Evidence: `tdd/test-list.md` (66 rows: 63 `DONE`, 1 `BASELINE`, 1 `DROPPED`, and the live check `A1818` now `DONE`); `tdd/cycle-log.md` (13 cycles, a correction, and the remediation).
- [x] CHK1851 The verification found its HIGH smells and they were fixed.
      Evidence: `tdd/verification.md`, findings 2 to 5 and the addendum; T039 to T045.
- [ ] CHK1852 Eleven behaviors are test-after, and the owner has not yet answered whether to waive them.
      Owner: the captain, through Firstmate (task T047, D-144). Each was proved able to fail by deliberate mutants (41 in all, none survived).

## Not checked, with the reason

- [ ] CHK1860 The decision form has not been opened in a real bb, so its look (both themes, a narrow width, a long list of findings) is unseen.
      Owner: the owner, in the isolated lab, before the first real decision (D-146, task T032).
- [ ] CHK1861 What `no-mistakes axi run` does after a finished run, and a real decision against a real pipeline, are unverified.
      Owner: the owner, at the live check (D-141, D-134).
- [ ] CHK1862 A tier 2 run with a real model.
      Owner: shelved by the captain; out of scope.
