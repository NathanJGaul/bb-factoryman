---
description: "Task list for the dispatch resolver"
---

# Tasks: Dispatch resolver

**Input**: `specs/003-dispatch-resolver/spec.md`, `plan.md`, `tdd/test-list.md`
**Tests**: Mandatory. Every test task precedes the implementation it drives, and each test is seen failing first (constitution V).

## Phase 1: Setup

- [ ] T701 Add `FakeFiles` in `test/fixtures/files.ts` and a `providers` list on `FakeBbPort` (no production code)

## Phase 2: Pure core (tests first)

- [ ] T710 [P] Config schema test `src/dispatch/config.test.ts` (valid config, unknown key, unknown profile name, empty `when`, bad ladder)
- [ ] T711 [P] Resolver test `src/dispatch/resolver.test.ts` (precedence table, ambiguity, `rule` choice, equal profiles, lowering check)
- [ ] T712 [P] Availability test `src/dispatch/availability.test.ts`
- [ ] T713 [P] Loader test `src/dispatch/load.test.ts`
- [ ] T720 Implement `types.ts`, `config.ts`, `builtin.ts`, `resolver.ts`, `availability.ts`, `load.ts`, `src/files.ts`

## Phase 3: Wire into the tool (tests first)

- [ ] T730 Port and adapter test for `listProviders` in `src/bb/adapter.test.ts`
- [ ] T731 Dispatch tool test in `src/tools/dispatch.test.ts` (resolver flow, blockers create nothing)
- [ ] T732 Acceptance tests `test/acceptance/dispatch-resolver.test.ts` (A-701 to A-709)
- [ ] T740 Implement `listProviders`, the `Files` dep, the factory `resolver` option, and the new `dispatch` flow

## Phase 4: Close-out

- [ ] T750 Record D-062 to D-066 in `docs/DECISIONS.md` and update `docs/DESIGN.md` references if any text becomes wrong
- [ ] T751 `/speckit.tdd.verify`, `/speckit.checklist`, `/speckit.analyze`, `/speckit.converge`
