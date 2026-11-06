# Analysis: core scaffold, task state machine, and event storage

**Run**: after `/speckit.tdd.verify`, `/speckit.implement`, and `/speckit.checklist`.
**Inputs**: `spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`, `contracts/`, `tdd/*`, `checklist.md`, the constitution, and the code at `HEAD`.
**Method**: a mechanical cross-check (a script that counts and matches IDs), plus a read of each artifact against the code.
This report only reads. The doc fixes it names were made afterwards, in the commit that follows it.

## Summary

The artifacts agree with each other and with the code.
The analysis found no critical or high finding.
It found four small drifts, all fixed, and three items that need the owner.

| Check | Result |
| --- | --- |
| Functional requirements traced to a behavior | 30 of 30 |
| Acceptance scenarios traced to a behavior | 26 of 26 |
| Success criteria traced | 6 of 6 (SC-002 was missing from the traces and is added; SC-005 is a measurement) |
| Behaviors in the test list | 112 (111 `DONE`, 1 `BASELINE`) |
| Behaviors without a task marker | 0 |
| Open tasks | T092 and T093 (this lifecycle) |
| Constitution principles with a violation | 0 |

## Coverage: requirement to task to test

| Requirement group | Tasks | Behaviors | Notes |
| --- | --- | --- | --- |
| FR-001 to FR-006 scaffold | T010 to T021 | A1 to A5, U1 to U9 | A5 is a baseline: the `build` script predates the profile. |
| FR-010 to FR-023 machine | T030 to T054 | A6 to A17, U10 to U46 | FR-011 through U33 and U46, FR-013 through U34. |
| FR-030 to FR-039 storage | T060 to T078 | A18 to A26, U47 to U86 | FR-039 is implemented by `recover` but not yet called at plugin start (event wiring is later). |

## Findings

| ID | Category | Severity | Location | Summary | Status |
| --- | --- | --- | --- | --- | --- |
| A1 | Inconsistency | MED | `quickstart.md` steps 2 and 3 | `pnpm test -- src/machine ...` ran all 19 files, because the arguments after `--` did not select files. The commands now use `pnpm vitest run <paths>`. | Fixed |
| A2 | Drift | LOW | `plan.md` source tree | The tree omitted `src/machine/effects.ts`, `src/store/rows.ts`, the extra fixtures, and `toolchain.test.ts`. | Fixed |
| A3 | Drift | LOW | `contracts/store.md` replay section | The contract omitted the `not_found` result of `replayTask` and the `skipped` field of `recover`. | Fixed |
| A4 | Stale metadata | LOW | `.specify/memory/tdd-profile.md` | The profile still named no acceptance exemplar and no helpers, and said `bb plugin build` could not run. | Fixed |
| A5 | Coverage gap | LOW | `tdd/test-list.md` | SC-002 was not in any `traces` cell. Rows A6 to A10 now cite it. SC-005 is a timing and has no behavior line, and the list says so. | Fixed |
| A6 | Open decision | MED | `docs/DECISIONS.md` D-007 | The captain has not confirmed principle V's wording or the self-approved spec, plan, and tasks. | Owner |
| A7 | Open decision | MED | `docs/DECISIONS.md` D-010 | A denied approval has no rework path. | Owner |
| A8 | Out of scope | INFO | D-009 | Hard rules 5, 6, and 7 are not enforced yet. They need milestones 8 and 9. | Planned |

## Constitution alignment

| Principle | Result |
| --- | --- |
| I. Gates live in code and fail closed | Pass. Rules 1 to 4 and 8 are guards, each with a refusal test and a permitted-path test. Unknown input, unreadable snapshots, and cross-check disagreement all refuse. Rules 5 to 7 are deferred in D-009, not silently dropped. |
| II. The machine core is pure | Pass. The lint rule bans bb, storage, Node built-ins, and dynamic imports, and a test lints fixtures to prove it. |
| III. The event log is the source of truth | Pass. `TaskLog.apply` decides from a replay, and the cache is rebuilt in `rebuildCache`. |
| IV. Storage sits behind an interface | Pass. One `Store`, two implementations, one contract suite. |
| V. Test first | Pass with gaps. 103 behaviors have a recorded red, 8 have retro-red records, and 1 is a baseline. See `tdd/verification.md`. |
| VI. Scope discipline | Pass. No tools, wiring, placement, validator, or dispatch code exists. Every deviation is in `docs/DECISIONS.md`. |

## Terminology and consistency

- `prUrl` in the machine context is `pullRequestUrl` in the task row. The mapping sits in `src/store/rows.ts` and `data-model.md`.
- The spec says "completion" events, and the data model names them `handoff`, `ready`, `validated`, and `report`. D-014 lists them.
- The design says `review ready`, and the code uses `review_ready`. The vocabulary table in `data-model.md` is the reference.
- Task IDs, project IDs, and thread IDs are opaque strings everywhere.

## Risks that remain

1. **Event shapes may move.** The `ready`, `validated`, and `teardown` payloads follow the design's gate descriptions. The tools milestone may find a better shape, and the log would then hold old shapes. Replay validates against today's schema, so a schema change needs a migration plan before real data exists.
2. **No real data yet.** The SQLite schema is at version 1, with a refusal on newer versions and no migration step. That is right for now and must change with the first schema change.
3. **Single process.** The store assumes one writer process.
4. **Spike results.** `spike/RESULTS.md` does not exist. Nothing here depends on an unconfirmed bb behavior, but the store wiring (D-027) will.
