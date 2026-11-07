# Quality gates: tools and approval, event wiring, and the validator

**Purpose**: Record the quality gates for the finished implementation, with the evidence for each.
**Created**: 2026-11-06
**Feature**: [spec.md](spec.md)

A checked item has evidence that I ran or read in this worktree.
An unchecked item names what is missing and who owns it.
This is the implementer's evidence list.
The reviewer-owned requirements-quality list is `checklists/requirements.md`.

## Build and static checks

- [x] CHK001 `pnpm run typecheck` passes with zero errors. Evidence: `pnpm run check`, run after the last code change.
- [x] CHK002 `pnpm run lint` passes with zero errors, and the `src/machine` isolation rule is still active. Evidence: `pnpm run check`, `test/acceptance/lint-isolation.test.ts`, and `git diff cd761f4..HEAD -- src/machine` is empty.
- [x] CHK003 `pnpm test` passes with no skipped test. Evidence: 57 files, 615 tests, 13 seconds for the whole `check` (below the 90 second target in SC-007). A grep for `.skip`, `.only`, `.todo`, and `xit` in `src` and `test` finds none.
- [x] CHK004 `pnpm run build` (`bb plugin build`) passes on bb 0.48.1. Evidence: `dist/server.js` (324 KB), `dist/server.meta.json` naming bb 0.48.1 and SDK 0.6.104, and `better-sqlite3` left as the one external import.
- [x] CHK005 The built plugin loads in a real bb server. Evidence: `spike/RESULTS.md` items 24 and 27, a smoke test on a throwaway bb 0.48.1 data directory.
- [ ] CHK006 The plugin is installed in the owner's own bb. Not run, because it changes the owner's bb state. Owner: milestone 11.

## Hard rules (docs/DESIGN.md and CLAUDE.md)

- [x] CHK010 Rule 1, merge needs a recorded approval, and `yolo` skips only the form. Evidence: A8 to A14, U89 to U106, U211, U213, and the mutants in cycles C12 and R1 (a denial falling through, no open-form guard, the form always asked, `yolo` always false, the merge method fixed).
- [x] CHK011 Rule 2, teardown is refused with uncommitted or unpushed work, and the facts come from git. Evidence: A15, A16, U107 to U116, U209, U210, U216 (a real temporary repository), and the mutants in cycles C7, C13, and R1.
- [x] CHK012 Rule 3, `done` and `failed` need non-empty evidence. Evidence: A6, U58 (blank and whitespace evidence leaves a refused row), A34, U198.
- [ ] CHK013 Rule 4, promoting a scout needs a recorded approval event. The machine gate is unchanged from milestone 2 (A10 of feature 001). The design lists no tool that sends `promote`, so milestones 4 to 6 add no path to it. Owner: the owner decides whether a tool is wanted (D-031 names the same kind of gap).
- [ ] CHK014 Rule 5, an offline machine goes `blocked` and never falls back. Not in scope: milestone 8 (D-009).
- [ ] CHK015 Rule 6, `local-only` work stays on the machine that holds the clone. Not in scope: milestone 8 (D-009). The local merge does refuse a dirty checkout or a checkout off the base branch (U84, U85).
- [ ] CHK016 Rule 7, extensions can add checks and never remove a gate. Not in scope: milestone 9 (D-009).
- [x] CHK017 Rule 8, illegal transitions are refused and logged, and nothing fails open. Evidence: A6 and U58 (the refusal is a logged row), A24 and U139 (a late event changes nothing), U124 (a seeded walk of 400 steps leaves no corrupt task and no repaired cache row), U100 (the machine refusal stops the merge before the executor).

## Requirements quality

- [x] CHK020 Every functional requirement in the spec maps to a test. Evidence: 54 of the 55 requirements appear in a `traces` column of `tdd/test-list.md`. FR-403 is the process rule that every behavior has a recorded red, and `tdd/cycle-log.md` and `tdd/verification.md` cover it. The audit also lists the traceability of the acceptance criteria.
- [x] CHK021 Every acceptance scenario has a test through the plugin factory. Evidence: A1 to A38, all `DONE` in `tdd/test-list.md`.
- [x] CHK022 Every success criterion has a check. Evidence: SC-001 by the tool tests (A1 to A18, U41 to U116), SC-002 by A8, A9, A10 (cancelled and timed out) and U91 to U94, SC-003 by CHK010 to CHK017, SC-004 by A25, SC-005 by A33, A36 and A31, SC-006 by U164 to U169, A28 and A36, SC-007 by CHK003, SC-008 by CHK004, and SC-009 by the mutant records in `tdd/cycle-log.md`.
- [x] CHK023 No `[NEEDS CLARIFICATION]` marker remains in the spec. Evidence: `checklists/requirements.md`.
- [x] CHK024 Every deviation and gap is in `docs/DECISIONS.md` with a reason. Evidence: D-029 to D-055.
- [ ] CHK025 The real `gh pr merge` path and a real `checks-passed` output are proven live. Not run: no forge was available, and a live merge would change real state. The command line is covered with a fake runner (U78 to U81) and the output is a derived fixture (D-042, D-049). Owner: milestone 11.

## Architecture

- [x] CHK030 `src/machine/` is unchanged. Evidence: `git diff cd761f4..HEAD -- src/machine` is empty, and `grep -rn "@get-bb" src/machine` returns nothing.
- [x] CHK031 Every bb call goes through one port. Evidence: `grep -rln "bb\.sdk\|bb\.ui" src --include=*.ts` lists `src/bb/adapter.ts` and `src/server.ts`, and `server.ts` mentions `bb.sdk` only in a comment. The tools, handlers, and driver call the port.
- [x] CHK032 Authority comes from the store, and plugin metadata only chooses which tools bb offers. Evidence: A2, U19 to U22, U33 to U35, D-035.
- [x] CHK033 The plugin calls no other plugin. Evidence: U40 (no `bb.sdk.plugins` call in a full flow, and an injected call fails it).
- [x] CHK034 The five-tool list is closed. Evidence: U36, A17. The one gap this leaves is D-031.
- [x] CHK035 A merge runs only after the machine would accept it and records its event only after the command succeeds. Evidence: U99, U100, U106.
- [x] CHK036 The validator sits behind an interface, the plugin never answers a finding, and a run outlives the plugin. Evidence: A29, A32, U194, U204, U217, M3 and M4 in cycle C23.
- [x] CHK037 A mismatch with live state becomes a `reconcile` row and never a silent fix. Evidence: A27, U153 to U160.
- [x] CHK038 No code beyond the scope: no resolver, placement, extension surface, limits, or skills. Evidence: U208 (`src/dispatch` and `skills` do not exist), and the tool, event, and validator lists in the spec.

## Process

- [x] CHK040 Every behavior has a recorded red, a recorded deliberate-mutant red, or an admitted test-after record. Evidence: `tdd/cycle-log.md` (27 cycles) and `tdd/verification.md`.
- [x] CHK041 No test was weakened, skipped, deleted, or filtered to reach green. Evidence: the audit in `tdd/verification.md`. Two milestone 1 tests changed because a requirement changed (D-045), each as its own step.
- [x] CHK042 Commits are small, one concern each, and carry no agent co-author line. Evidence: 32 commits since the merge base, and `git log cd761f4..HEAD --format=%B | grep -ci co-authored` prints 0.
- [x] CHK043 No generated file or `CHANGELOG.md` was edited by hand. Evidence: no `CHANGELOG.md` exists, and `pnpm-lock.yaml` came from `pnpm add`.
- [x] CHK044 Prose docs put each sentence on its own line, and no em dash appears in files I wrote. Evidence: a splitter pass over the 002 docs (text unchanged, line breaks only), and a grep for the em dash character in the changed files. The append-only cycle log and the audit report keep their original line breaks.
- [x] CHK045 A cold-context audit ran, its findings were answered, and the answers are recorded. Evidence: `tdd/verification.md` (verdict FAIL for commit `495c1cb`, then the remediation section) and cycle R1.
- [ ] CHK046 A second audit confirms the remediation. Not run. Owner: the owner or a later `/speckit.tdd.verify`.
- [x] CHK047 The live smoke test found a contract difference that the fake host hid, and it is fixed and recorded. Evidence: D-053, `spike/RESULTS.md` item 26, cycle L1.

## Notes

- Coverage is unmeasured: `@vitest/coverage-v8` is not installed, and setup may not add dependencies.
- The unchecked items are either out of scope by `CLAUDE.md`, need the owner's live bb or a forge, or need a second audit.
- The audit's verdict was FAIL for the tree before the remediation. This list reflects the tree after it.
