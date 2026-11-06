# Research: Core scaffold, task state machine, and event storage

No `NEEDS CLARIFICATION` markers remain in the technical context.
This file records the choices that the design left open.

## R1. Manifest and layout of a bb plugin

- **Decision**: `package.json` declares `bb.server` as `./src/server.ts`, plus `bb.name`, `bb.description`, `bb.branding.icon`, `engines`, and the `bb-plugin` keyword. Skills use the conventional `skills/` directory later. The scaffold adds no `bb.skills` key.
- **Rationale**: The public example plugins in `get-bb/bb` (`examples/plugins/slack-bot`, `agent-enrichment`) use exactly these keys. Their README calls `skills/` "the conventional plugin skills directory". The design's `bb.skills` key is unverified, and no skills exist before milestone 11.
- **Alternatives**: Declare `bb.skills` now. Rejected because the key is unconfirmed and guessing it risks a manifest that bb rejects.

## R2. Pin and testing surface of the plugin SDK

- **Decision**: Pin `@get-bb/plugin-sdk` to `0.6.104` (exact), the version the installed bb 0.48.1 reports. Use `createFakePluginHost({ pluginId })`, `await plugin(host.bb)`, `host.harness.inspection.registrations`, and `host.harness.lifecycle.dispose()`.
- **Rationale**: The SDK README documents this shape for external plugins. The SDK's `hono` and `cron-parser` peers are optional, but the fake host needs `hono`, so we install it as a dev dependency.
- **Alternatives**: A caret range. Rejected because the design asks for a pinned SDK and several APIs carry an `experimental_` prefix.

## R3. Package manager

- **Decision**: `pnpm` (v12 on this machine).
- **Rationale**: The bb repository and its examples use pnpm. `allowBuilds` in `pnpm-workspace.yaml` approves `better-sqlite3` and `esbuild` builds. A probe install on Node 26 built `better-sqlite3` and opened an in-memory database.
- **Alternatives**: npm. Works, but the bb ecosystem standard is pnpm.

## R4. How xstate fits a refusal-first design

- **Decision**: Keep a declarative transition table. Generate the xstate machines from it. A facade diagnoses refusals from the table and uses xstate to compute the next snapshot.
- **Rationale**: xstate v5 silently ignores an event that no transition accepts, and it gives no reason when a guard fails. The design needs "refused and logged" with a reason. One table feeds the machine, the facade, and the table-driven tests, so they cannot drift apart. The facade also asserts that xstate and the table agree, which fails closed on any generator bug.
- **Alternatives**: (a) Inspect xstate internals for failed guards. Rejected as brittle. (b) Skip xstate and hand-roll the machine. Rejected because `CLAUDE.md` names xstate.

## R5. One machine per kind, and promotion

- **Decision**: Two xstate machines, `ship` and `scout`, built from shared state fragments. The facade picks the machine from `context.kind`. The scout machine's `promote` transition targets `queued` and sets `kind` to `ship`. The next event routes to the ship machine.
- **Rationale**: The design says the lanes share `queued`, `working`, and `torn_down`. Promotion changes the kind and keeps the task ID, branch, and thread.
- **Alternatives**: One machine with kind guards on every transition. Rejected because it hides the lane structure that the design's diagram shows.

## R6. Where gate facts come from

- **Decision**: Facts arrive in the event payload (worktree report, pull request URL, landed commits, pipeline result, `yolo`). The log stores the payload.
- **Rationale**: The machine cannot read git, GitHub, or project config. Storing the facts lets replay re-run each gate with the original inputs. A missing fact fails schema validation, which is a refusal.
- **Alternatives**: Pass live facts at replay time. Rejected because replay would not be deterministic.

## R7. The log is the decision input

- **Decision**: `TaskLog.apply` folds the task's applied events to get the snapshot. The cache row is never an input to a decision.
- **Rationale**: Constitution principle III. A corrupt or stale cache can never change a gate result. Per-task logs stay short, so replay cost is small.
- **Alternatives**: Read the snapshot from the cache row. Rejected because the row lacks the profile and approvals, and because a stale row would fail open.

## R8. Event log schema additions

- **Decision**: `task_event` gains `seq`, `payload`, `outcome`, `reason_code`, and `reason_message` next to the columns in the design. `task` gains `project_id` and `mode`.
- **Rationale**: `seq` gives strict order. `payload` lets replay rebuild thread, branch, machine, and pull request URL, which no state name can carry. `outcome` and the reason columns log refusals in the same append-only stream. A task needs its project to find the `yolo` flag, and it needs its mode fixed at creation.
- **Alternatives**: A separate refusal table. Rejected because one stream keeps a single ordering for audit. Both additions go to `docs/DECISIONS.md`.

## R9. Append-only enforcement

- **Decision**: The `Store` interface has `appendEvent` and read methods only. The SQLite schema adds `BEFORE UPDATE` and `BEFORE DELETE` triggers that abort. The in-memory store freezes the rows it returns.
- **Rationale**: Defense in depth. The interface blocks honest callers. The triggers block raw SQL.
- **Alternatives**: Interface only. Rejected because a stray SQL statement could rewrite history.

## R10. Transactions

- **Decision**: `Store.transaction(fn)` is synchronous. SQLite uses `db.transaction`. The in-memory store snapshots its state and restores it on throw.
- **Rationale**: `better-sqlite3` is synchronous. The task log needs atomic append plus cache plus approval writes (FR-033).
- **Alternatives**: Async store API. Rejected because it adds ceremony with no benefit for local SQLite.

## R11. Lint rule for machine isolation

- **Decision**: ESLint flat config with `no-restricted-imports` scoped to `src/machine/**`. Patterns: `@get-bb/*`, `better-sqlite3`, `node:*`, and `**/store/**`. The rule test runs `ESLint.lintText` on fixture strings with a `filePath` inside `src/machine/`.
- **Rationale**: `CLAUDE.md` requires the `@get-bb/*` rule. The other patterns keep the machine free of input and output, which FR-012 requires. Testing with `lintText` proves the rule fires without leaving a failing file in the repository.
- **Alternatives**: A custom script. Rejected because `CLAUDE.md` names `no-restricted-imports`.

## R12. Mutation testing

- **Decision**: Verify test strength with deliberate mutants that `/speckit.tdd.verify` applies by hand and records.
- **Rationale**: The setup step may not add dependencies, and the constitution accepts deliberate mutants. A mutation tool stays a later decision for the owner.
- **Alternatives**: Add StrykerJS. Rejected for now. It is a new dependency and its support for Node 26 and `vitest` 5 is unverified.

## R13. What this feature leaves for later

- Hard rule 5 (offline machine) and rule 6 (`local-only` machine) need machine data. Milestone 8 owns them. The machine provides `blocked` only.
- Hard rule 7 (extensions never remove a gate) needs the extension loader. Milestone 9 owns it. The guard list in the table is a closed constant today.
- Offline-at-dispatch needs a path from `queued` to `blocked`. Milestone 8 decides whether `start` then `block` is enough.
