# Tasks: Harness documentation catch-up

**Input**: `specs/012-harness-docs-catch-up/` (spec.md, plan.md, research.md, quickstart.md)

**Tests**: Required (constitution principle V). Behavior ids are in `tdd/test-list.md`. Each test task comes first and fails against the old document before the document task makes it pass.

**Format**: `- [ ] [ID] [P?] [Story] Description with file path`

## Phase 1: Setup

- [x] T001 Run `pnpm run check` on the clean branch and record the baseline result in `specs/012-harness-docs-catch-up/tdd/cycle-log.md`

## Phase 2: Foundational

- [x] T002 Record in `specs/012-harness-docs-catch-up/research.md` that no claim is left unchecked (R1 to R33 done, see the table)

## Phase 3: User story 1 - Run the live check on any harness (P1)

**Goal**: One runbook for tiers 0, 1, 1.5, and 2 with per-harness credentials.

**Independent test**: `pnpm vitest run test/acceptance/live-check.test.ts`.

- [ ] T003 [US1] [A1701] [A1702] [A1703] [A1704] [A1705] [A1706] [A1707] [A1708] Rewrite `test/acceptance/live-check.test.ts` to pin the new runbook (section list with the renamed sections 6 and 7, four tiers with tier 2 not run, per-harness credential table naming all four harnesses, no "stub agent does not exist", `dispatch.json` in section 5, `supervisor start` in the tier 2 spawn, generalised credential handling). Run it and record the red.
- [ ] T004 [US1] [A1701] [A1702] [A1703] [A1704] [A1705] [A1706] [A1707] [A1708] Rewrite `docs/LIVE-CHECK.md` per plan.md until `test/acceptance/live-check.test.ts` passes

## Phase 4: User story 2 - Read the design and see harness independence (P1)

**Goal**: The dispatch profiles section states what the code does.

**Independent test**: `pnpm vitest run test/acceptance/design-profiles.test.ts`.

- [ ] T005 [US2] [A1709] [A1710] Add `test/acceptance/design-profiles.test.ts`: the dispatch profiles section names the readiness statuses, `provider_not_admitted`, `roles.supervisor.profile`, `bb factoryman supervisor start`, `bb thread clear`, and the validator observation; the section "Supervisor thread" says four tools; no "unavailable provider" wording. Run it and record the red.
- [ ] T006 [US2] [A1709] [A1710] Edit the "Dispatch profiles", "Supervisor thread", and "Machines and domain leads" sections of `docs/DESIGN.md` until `test/acceptance/design-profiles.test.ts` passes

## Phase 5: User story 3 - Trace every decision (P2)

**Goal**: D-092 and D-093 point to their replacements, and this change has an entry.

**Independent test**: `pnpm vitest run test/acceptance/decision-log.test.ts`.

- [ ] T007 [US3] [A1711] Add a test to `test/acceptance/decision-log.test.ts`: D-135 exists; D-063, D-064, D-092, and D-093 each carry an "Amended by" line that names a decision with a heading. Run it and record the red.
- [ ] T008 [US3] [A1711] Add the "Amended by" lines to D-092 and D-093 and the entry D-135 in `docs/DECISIONS.md` until the test passes

## Phase 6: Polish

- [ ] T009 Run `pnpm run check` and record the result in `specs/012-harness-docs-catch-up/tdd/cycle-log.md`
- [ ] T010 [A1712] Confirm `git diff --stat -- src tools skills conformance docs/HARNESS-SUPPORT.md CLAUDE.md .specify/memory` prints nothing
- [ ] T011 Grep the three documents for the em dash and for one-paragraph multi-sentence lines in the added text

- [ ] T012 [US1] Outer-loop gate: every A1701 to A1708 test green in `test/acceptance/live-check.test.ts`
- [ ] T013 [US2] Outer-loop gate: A1709 and A1710 green
- [ ] T014 [US3] Outer-loop gate: A1711 green

## Dependencies

T001 before all. T003 before T004. T005 before T006. T007 before T008. US1, US2, and US3 are independent of each other.
T009 to T011 last.

## Implementation strategy

US1 first (the largest gap), then US2, then US3.
Commit after each green phase.
