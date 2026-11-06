# Implementation plan: Core scaffold, task state machine, and event storage

**Branch**: `fm/bb-factoryman-milestones-1-3` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-core-state-machine-storage/spec.md`

## Summary

Build milestones 1 to 3 of `docs/DESIGN.md`: the plugin scaffold, the pure task state machine, and the event-sourced storage layer.
The machine is a declarative transition table that drives two xstate machines (ship and scout) and a diagnosing facade.
The facade returns a refusal with a reason code for every illegal move.
The store sits behind one interface with an in-memory and a `better-sqlite3` implementation.
A task log joins the two: it runs the machine, appends the event row, and updates the cache in one transaction.
Replay folds the log through the same machine, so a destroyed cache rebuilds identically.

## Technical context

**Language/Version**: TypeScript 6 through the `@typescript/typescript6` alias (the same alias the bb repository uses, because `typescript-eslint` does not support TypeScript 7.0), ESM, Node 26.

**Primary dependencies**: `xstate` 5 (machines), `zod` 4 (event and config schemas), `better-sqlite3` 12.10.0 (SQLite store), `@get-bb/plugin-sdk` 0.6.104 (pinned, exact, the SDK of the installed bb 0.48.1).

**Storage**: SQLite through `better-sqlite3`, plus an in-memory implementation for tests.

**Testing**: `vitest` 5, `createFakePluginHost` from `@get-bb/plugin-sdk/testing`, ESLint's `ESLint` class for the lint-rule test.

**Target platform**: bb plugin server runtime on Linux or macOS.

**Project type**: Library that ships as a bb plugin.

**Performance goals**: The full suite finishes in under 60 seconds (SC-005).

**Constraints**: `src/machine/` has no bb, Node built-in, SQLite, or store imports.
Gates fail closed.
No dependency beyond the stack in `CLAUDE.md` plus its direct tooling (`typescript`, `eslint`, `typescript-eslint`, `@types/*`, and the SDK's optional peers `hono` and `cron-parser` that the fake host needs).

**Scale/Scope**: Hundreds of tasks per project and thousands of events.
Replay cost per task is linear in its events.

## Constitution check

*Gate: must pass before research.
Re-checked after design.*

| Principle | Status | Evidence |
| --- | --- | --- |
| I. Gates live in code and fail closed | Pass | Every gate is a named guard in `src/machine/guards.ts`. Unknown or invalid input is a refusal. |
| II. The machine core is pure | Pass | ESLint `no-restricted-imports` covers `src/machine/`. A test lints fixtures to prove it. |
| III. The event log is the source of truth | Pass | The task log decides from a log replay. The cache is write-through and rebuildable. |
| IV. Storage sits behind an interface | Pass | One `Store` interface, one shared contract suite, two implementations. |
| V. Test first | Pass | `/speckit.tdd.plan` orders test tasks first. `/speckit.tdd.run` records every red. |
| VI. Scope discipline | Pass | No tools, wiring, placement, validator, or dispatch code. Deviations go to `docs/DECISIONS.md`. |

No violations, so the complexity table is empty.

## Design decisions

The full reasoning sits in [research.md](research.md).
The decisions that shape the code:

1. **One declarative transition table is the single source of truth.**
   `src/machine/table.ts` lists, per kind, each state's events, targets, and ordered guard names.
   The xstate machines are generated from the table.
   The facade reads the same table to name the first failing guard.
   xstate would otherwise drop an unmatched or blocked event without a reason.
2. **The facade is the public entry point.**
   `transition(snapshot, rawEvent)` validates the payload with `zod`, looks up the table, runs the guards, and then asks xstate to compute the next snapshot.
   It cross-checks that xstate's target equals the table's target and refuses on any disagreement.
3. **Events carry the facts that gates need.**
   The worktree report, the pull request URL, the landed-commit count, the pipeline result, and the `yolo` flag all arrive in the payload.
   The log stores the payload, so replay re-evaluates every gate with the original facts.
4. **Approvals are events.**
   `record_approval` is a self-transition that stores the decision in the machine context.
   The `merge` and `promote` guards read the context.
   Only the owner actor may send it.
5. **The log is the only input to a decision.**
   `TaskLog.apply` replays the task's applied events to get the snapshot, runs the transition, and then appends the row and updates the cache in one transaction.
   The task row is a read-optimized cache.
6. **Refusals are log rows.**
   A refused event becomes a row with outcome `refused` and a reason.
   Replay skips refused rows.
7. **Reconcile records and never repairs.**
   `reconcile` compares replayed state with caller-supplied observations and appends `reconcile` rows.
   It changes no task state.

## Project structure

### Documentation (this feature)

```text
specs/001-core-state-machine-storage/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── transition.md
│   └── store.md
├── checklists/requirements.md
├── tasks.md
├── tdd/
│   ├── test-list.md
│   ├── cycle-log.md
│   └── verification.md
├── checklist.md
├── analyze.md
└── converge.md
```

### Source code (repository root)

```text
package.json              # bb manifest, scripts, pinned SDK
pnpm-workspace.yaml       # pnpm build approvals
tsconfig.json
vitest.config.ts
eslint.config.js          # no-restricted-imports for src/machine
.gitignore
src/
├── server.ts             # plugin factory (empty until milestone 4)
├── machine/              # no bb imports
│   ├── types.ts          # kinds, modes, states, actors, context, snapshot
│   ├── events.ts         # zod schemas for every event
│   ├── refusal.ts        # reason codes and the Refusal type
│   ├── guards.ts         # named guard functions, one per gate
│   ├── table.ts          # declarative ship and scout transition tables
│   ├── effects.ts        # pure context updates for each accepted event
│   ├── machines.ts       # xstate machines generated from the tables
│   └── transition.ts     # createTask and transition facade
└── store/
    ├── types.ts          # row types
    ├── store.ts          # the Store interface
    ├── memory.ts         # in-memory implementation
    ├── sqlite.ts         # better-sqlite3 implementation and schema
    ├── rows.ts           # snapshot to task row, log row to raw event
    ├── task-log.ts       # apply, create, approval handling
    ├── replay.ts         # replay, rebuild cache, recovery
    └── reconcile.ts      # reconcile against live observations
test/
├── acceptance/           # real-entry-point tests per acceptance scenario
├── fixtures/             # event, snapshot, legal-set, history, and store builders
├── store-contract.ts     # shared suite for both stores
└── toolchain.test.ts     # dependency smoke test
docs/
├── DESIGN.md
└── DECISIONS.md
```

**Structure decision**: Single project that follows the layout in `CLAUDE.md`.
Unit tests sit next to their module as `*.test.ts`.
Acceptance tests that enter through the public API sit in `test/acceptance/`.
`src/tools/`, `src/dispatch/`, and `skills/` do not exist yet (FR-006).

## Milestone commits

| Milestone | Commit scope |
| --- | --- |
| 1. Scaffold | Tooling, manifest, empty plugin factory, lint rule, plugin and lint tests. |
| 2. State machine | `src/machine/` and its tests, plus `docs/DECISIONS.md` entries. |
| 3. Storage | `src/store/` and its tests. |

Each TDD cycle also gets its own focused commit, as the workflow requires.

## Risks

| Risk | Mitigation |
| --- | --- |
| `bb plugin build` could not run at first. | The owner installed bb 0.48.1 mid-task. The build now runs and passes. See D-001. |
| `typescript-eslint` rejects TypeScript 7.0. | Use the `@typescript/typescript6` alias, as bb does. Verified by running lint. |
| The fake host's registration inspection API differs from the README. | Read the bundled types before writing the plugin test. |
| `better-sqlite3` needs a native build. | `pnpm-workspace.yaml` approves its build script. Verified on Node 26. |
