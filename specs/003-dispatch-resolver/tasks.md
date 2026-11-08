---
description: "Task list for the dispatch resolver"
---

# Tasks: Dispatch resolver

**Input**: `specs/003-dispatch-resolver/spec.md`, `plan.md`, `tdd/test-list.md`
**Tests**: Mandatory. Every test task precedes the implementation it drives, and each test is seen failing first (constitution V).

## Phase 1: Setup

- [X] T701 Add `FakeFiles` in `test/fixtures/files.ts` and a `providers` list on `FakeBbPort` (no production code)

## Phase 2: Pure core (tests first)

- [X] T710 [P] Config schema test `src/dispatch/config.test.ts` (valid config, unknown key, unknown profile name, empty `when`, bad ladder)
- [X] T711 [P] Resolver test `src/dispatch/resolver.test.ts` (precedence table, ambiguity, `rule` choice, equal profiles, lowering check)
- [X] T712 [P] Availability test `src/dispatch/availability.test.ts`
- [X] T713 [P] Loader test `src/dispatch/load.test.ts`
- [X] T720 Implement `types.ts`, `config.ts`, `builtin.ts`, `resolver.ts`, `availability.ts`, `load.ts`, `src/files.ts`

## Phase 3: Wire into the tool (tests first)

- [X] T730 Port and adapter test for `listProviders` in `src/bb/adapter.test.ts`
- [X] T731 Covered by the acceptance file (A701 to A717), which drives the tool through the factory; `[A711]` proves that no blocker creates a task
- [X] T732 Acceptance tests `test/acceptance/dispatch-resolver.test.ts` (A701 to A717)
- [X] T740 Implement `listProviders`, the `Files` dep, the factory `resolver` option, and the new `dispatch` flow

## Phase 4: Close-out

- [X] T750 Record D-062 to D-066 in `docs/DECISIONS.md` and update `docs/DESIGN.md` references if any text becomes wrong
- [ ] T751 `/speckit.tdd.verify`, `/speckit.checklist`, `/speckit.analyze`, `/speckit.converge`

## Phase 5: Audit remediation (from `tdd/verification.md`)

- [X] R1 `[A715]`: a provider list that cannot be read blocks dispatch
- [X] R2 `[A711]`: all five blockers leave the log, the tasks, and the spawns unchanged
- [X] R3 `[A717]`: kind, mode, and tags reach the rules through the tool
- [X] R4 `[U744]`: the matched rule sets the reasoning floor before the default
- [X] R5 `[U712]`: ambiguity for each profile field alone
- [X] R6 `[U702]`: nested strict keys
- [X] R7 `[U721]` and `[A716]`: keyword boundaries, and a project read that throws
- [X] R8 `it.each` conversions and the bookkeeping fixes
