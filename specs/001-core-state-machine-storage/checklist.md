# Quality gates: core scaffold, task state machine, and event storage

**Purpose**: Record the quality gates for the finished implementation, with the evidence for each.
**Created**: 2026-11-05
**Feature**: [spec.md](spec.md)

A checked item has evidence that I ran or read in this worktree.
An unchecked item names what is missing and who owns it.

## Build and static checks

- [x] CHK001 `pnpm run typecheck` passes with zero errors. Evidence: `pnpm run check`, run twice after the last code change.
- [x] CHK002 `pnpm run lint` passes with zero errors, and the `src/machine` isolation rule is active. Evidence: `test/acceptance/lint-isolation.test.ts` (11 cases) and a hand-made `src/machine/probe.ts` that failed lint.
- [x] CHK003 `pnpm test` passes. Evidence: 19 files, 336 tests, 12 to 21 seconds (43 seconds for the whole `check` under machine load, below the 60 second target in SC-005).
- [x] CHK004 `pnpm run build` (`bb plugin build`) passes on bb 0.48.1 without a warning. Evidence: D-001, and `dist/server.js` written.
- [ ] CHK005 `bb plugin install` into a running bb loads the plugin. Not run, because it changes the owner's bb state. Owner: milestone 11.

## Hard rules (docs/DESIGN.md and CLAUDE.md)

- [x] CHK010 Rule 1, merge needs a recorded approval, and `yolo` skips only the form. Evidence: A6, A7, U23, U41, mutants M01, M02, M08.
- [x] CHK011 Rule 2, teardown is refused with uncommitted or unpushed work. Evidence: A8, U25, U45, mutants M03, M04.
- [x] CHK012 Rule 3, `done` and `failed` need non-empty evidence. Evidence: A9, U16, mutant M05.
- [x] CHK013 Rule 4, promotion needs a recorded approval event. Evidence: A10, U24, U42, mutants M06, M09.
- [ ] CHK014 Rule 5, an offline machine goes `blocked` and never falls back. Not in scope: needs machine placement (milestone 8). The `blocked` state and events exist (D-008, D-009).
- [ ] CHK015 Rule 6, `local-only` work stays on the machine that holds the clone. Not in scope: milestone 8 (D-009).
- [ ] CHK016 Rule 7, extensions can add checks and never remove a gate. Not in scope: milestone 9. The gate list is a closed constant today (D-009).
- [x] CHK017 Rule 8, illegal transitions are refused and logged, and nothing fails open. Evidence: A11 (330 pairs), A19, U46, U70, M14, M20.

## Requirements quality

- [x] CHK020 Every functional requirement in the spec maps to a test. Evidence: the traceability table in `tdd/verification.md`.
- [x] CHK021 Every acceptance scenario has a test through a real entry point. Evidence: 26 of 26 in `tdd/verification.md`.
- [x] CHK022 Every success criterion has a check. Evidence: SC-001 to SC-006 in `tdd/verification.md`.
- [x] CHK023 No `[NEEDS CLARIFICATION]` marker remains in the spec. Evidence: `checklists/requirements.md`.
- [x] CHK024 Every deviation and gap is in `docs/DECISIONS.md` with a reason. Evidence: D-001 to D-027.

## Architecture

- [x] CHK030 `src/machine/` has no bb, storage, or Node built-in import. Evidence: the lint rule, and `grep -rn "@get-bb" src/machine` returns nothing.
- [x] CHK031 The store sits behind one interface with two implementations that pass the same suite. Evidence: A24, `test/store-contract.ts`.
- [x] CHK032 The event log is append-only in the interface and in SQLite. Evidence: A20, U56, U57, mutant M17.
- [x] CHK033 The task cache rebuilds identical rows from the log. Evidence: A21, U76, U80 (400 seeded sequences).
- [x] CHK034 A mismatch with live state becomes a `reconcile` row and never a silent fix. Evidence: A23, U81 to U86.
- [x] CHK035 No code beyond the scope: no tools, event wiring, machine placement, validator, dispatch, or skills. Evidence: U9 (`src/tools`, `src/dispatch`, and `skills` do not exist), and `src/server.ts` registers nothing.

## Process

- [x] CHK040 Every behavior has a recorded red, or a recorded deliberate-mutant or retro-red record. Evidence: `tdd/cycle-log.md`, `tdd/verification.md` (103 proven, 8 likely, 1 baseline).
- [x] CHK041 No test was weakened, skipped, deleted, or filtered to reach green. Evidence: the history diff in `tdd/verification.md`. Two outer test files were excluded from the gate script while they were red, and the cycle log says so.
- [x] CHK042 Commits are small, one concern each, and carry no agent co-author line. Evidence: `git log` has 0 co-author lines.
- [x] CHK043 No generated file or `CHANGELOG.md` was edited by hand. Evidence: no `CHANGELOG.md` exists, and the lockfile came from `pnpm install`.
- [x] CHK044 Prose docs put each sentence on its own line, and no em dash appears in files I wrote. Evidence: `sentences.py` pass over the docs, and a grep for the em dash character.
- [ ] CHK045 The captain approved the spec, plan, task list, and constitution principle V. The captain's intent fixed the scope, and I did not wait for a separate review (D-007). Owner: the captain.

## Notes

- Coverage is unmeasured: `@vitest/coverage-v8` is not installed, and setup may not add dependencies.
- The unchecked items are either out of scope by `CLAUDE.md` or need the owner.
