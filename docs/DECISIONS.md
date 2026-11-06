# Decisions

This file records every deviation from `docs/DESIGN.md`, every gap the design leaves open, and every choice that the design does not settle.
Each entry names the reason.
The design stays authoritative until the owner changes it.

## Status key

- **Deviation**: the code differs from the design text.
- **Gap**: the design is silent, so the code picked a behavior.
- **Limit**: something could not be verified in the build environment.
- **Open**: the owner needs to decide.

## Milestone 1: scaffold

### D-001: `bb plugin build` runs, and a live install is still the owner's step (Resolved)

The `bb` command-line tool was missing when milestone 1 was built, so the build step was unverified.
The owner then installed bb 0.48.1, and `pnpm run build` now succeeds. It writes `dist/server.js`, `dist/server.js.map`, and `dist/server.meta.json`.
The first run failed with `invalid plugin package.json (bb.branding)`, so the manifest now declares `bb.branding.icon`, and the manifest test asserts it.
`dist/` is git-ignored.
The plugin has not been installed into a running bb with `bb plugin install`, because that changes the owner's bb state. Milestone 11 covers the live check.

### D-002: Manifest has no `bb.skills` key (Gap)

The design lists `bb.server` and `bb.skills` in the manifest.
The public example plugins in `get-bb/bb` declare `bb.server` only and call `skills/` "the conventional plugin skills directory".
Skills arrive in milestone 11, so the scaffold declares no skills key and no `skills/` directory.
Revisit when milestone 0 settles how bb finds skills.

### D-003: TypeScript 6 through an alias (Gap)

`typescript-eslint` rejects TypeScript 7.0, which is the current `typescript` release.
The `typescript` dev dependency is therefore `npm:@typescript/typescript6@^6.0.2`, the same alias the bb repository uses.
Switch back when `typescript-eslint` supports TypeScript 7.

### D-004: Toolchain choices (Gap)

The design names `vitest`, `zod`, `xstate`, and `better-sqlite3` and leaves the rest open.
The scaffold uses `pnpm` 12 (the bb repository's package manager), `eslint` 10, and `vitest` 5.
`@get-bb/plugin-sdk` is pinned to the exact version 0.6.104, the SDK that the installed bb 0.48.1 reports. The scaffold first pinned 0.6.125, the newest npm release, and `bb plugin build` warned about the mismatch.
`engines.bbPluginSdk` is `>=0.6.104`.
`hono` and `cron-parser` are dev dependencies because the SDK's fake host needs them as optional peers.
`pnpm-workspace.yaml` approves the `better-sqlite3` and `esbuild` build scripts.

### D-005: The lint rule is stricter than the design (Deviation)

`CLAUDE.md` asks for a `no-restricted-imports` rule for `@get-bb/*` in `src/machine/`.
The rule also bans `better-sqlite3`, Node built-ins, imports from `src/store`, and every dynamic `import()` in that directory.
The machine performs no input or output (FR-012), and ESLint's `no-restricted-imports` does not see `import()`.
The stricter rule only tightens the isolation promise.

### D-006: The plugin's identity is one log line (Gap)

The scaffold milestone asks that the empty plugin loads in the fake host.
The plugin factory logs `bb-factoryman loaded` and registers nothing else.
The log line gives the load test a real assertion to fail first.

### D-007: Spec-Kit sequencing and approvals (Gap)

`/speckit.tdd.plan` needs `.specify/memory/tdd-profile.md`, which `/speckit.tdd.setup` writes after the test stack exists.
The order was therefore specify, plan, tasks, toolchain files, `tdd.setup`, then `tdd.plan`.
The toolchain files hold configuration and one smoke test, and no feature code.
The captain's intent fixed the scope, so the specification, plan, and task list were approved by that intent and not by a separate review.
The constitution's test-first principle uses the exact wording of the Spec-Kit workflow.
**Open**: the owner may confirm or reword principle V in `.specify/memory/constitution.md`.

## Milestone 2: state machine

### D-008: `blocked` applies to scouts, and only from `working` (Gap)

The design draws `blocked` in the ship lane and says "a task pinned to an offline machine goes blocked".
The machine lets both kinds block, because the rule says "a task".
`block` is legal only from `working`, and `unblock` returns only to `working`.
A task that is offline at dispatch has no path from `queued` to `blocked`.
Milestone 8 decides how to represent that case. The likely answer is `start`, which binds the machine, followed by `block`.

### D-009: Hard rules 5, 6, and 7 are not enforced yet (Limit)

Rule 5 (an offline machine blocks, with no fallback) and rule 6 (`local-only` stays on the clone's machine) need machine data, which is milestone 8.
Rule 7 (extensions never remove a gate) needs the extension loader, which is milestone 9.
The machine provides the `blocked` state and events.
Its gate list is a closed constant, so no extension point exists to remove a gate today.
`CLAUDE.md` forbids placement code before the spike results confirm the assumptions.

### D-010: A denied approval has no rework path (Open)

The design has no arrow back from `awaiting_approval` or `review_ready` to `working`.
A denied approval is recorded and the task stays in `awaiting_approval`.
A later approved decision replaces the denial.
The only other exits are `fail` and, after that, `teardown`.
**Open**: the owner should decide whether a denial needs a `request_changes` arrow back to `working`.

### D-011: `failed` can still be torn down (Gap)

The design says any state before `torn_down` can move to `failed`, and it does not say how a failed worker's environment is removed.
`failed` is therefore not terminal: `teardown` leaves it, through the same landed-work check as every other teardown.
`torn_down` is the only terminal state.

### D-012: Every merge passes through `awaiting_approval` (Gap)

The `yolo` flag skips the approval form, not the state.
A `yolo` merge still goes `review_ready`, `request_approval`, `awaiting_approval`, `merge`.
The merge event carries the `yolo` flag that the caller read from the project config, so the log records which merges ran under `yolo`.

### D-013: Actor rules tighten the gates (Deviation)

The hard rules name approvals, evidence, and landed work.
The machine adds two actor rules, both of which only tighten:

- `record_approval` accepts only the `user` actor, so an agent cannot record the owner's approval.
- A `worker` actor is refused on `request_approval`, `merge`, `promote`, and `teardown`, because the design says workers cannot merge or tear down.

### D-014: Which transitions count as `done` (Gap)

Hard rule 3 says `done` and `failed` transitions need evidence.
The design does not list the `done` transitions.
The machine requires evidence on `handoff`, `ready`, `validated`, `report`, and `fail`: every transition into `validating`, `review_ready`, `report_ready`, or `failed`.

### D-015: Gate facts arrive in the event payload (Gap)

The machine cannot read git, GitHub, or project config.
The caller gathers the worktree report, the pull request URL, the landed-commit count, the pipeline result, and the `yolo` flag, and passes them in the event.
A missing fact fails schema validation and is a refusal.
The log stores the payload, so replay re-checks each gate with the original facts.

### D-016: Promotion resets the task's authority (Gap)

`promote` turns a scout into a queued ship task.
It keeps the task ID, project, mode, thread, branch, and machine.
It clears the profile, the approvals, and the pull request URL, so the new ship task needs its own profile and its own merge approval.

### D-017: The `start` gate takes a profile and not a resolver (Gap)

Hard rule: "profile resolved" gates `queued` to `working`.
The dispatch resolver is milestone 7.
The machine only checks that the `start` event carries a complete profile of provider, model, reasoning level, and permission mode.

### D-018: The `create` event is separate from `transition` (Gap)

A task has no snapshot before it exists, so `createTask` builds the first snapshot from a `create` event.
The log records `create` as the first row of every task.

## Milestone 3: storage

### D-019: The log and task tables gain columns (Deviation)

`task_event` keeps the design's columns (task ID, time, from state, to state, event, actor, evidence) and adds five:

- `seq` gives strict order across tasks.
- `payload` holds the event fields other than type, actor, and evidence. Without it, replay could not rebuild the worker thread, branch, machine, or pull request URL, and could not re-run the gates with their original facts.
- `outcome` is `applied` or `refused`.
- `reason_code` and `reason_message` name why a refused event was refused.

`task` gains `project_id` and `mode`. A task needs its project to find the project's `yolo` flag, and its delivery mode is fixed when the task is created, even if the project changes later.

### D-020: Refusals live in the same log (Gap)

The design says illegal transitions are refused and logged, and says the log is append-only.
A refused event is a row with outcome `refused`, with its from and to state both set to the task's current state.
Replay skips refused rows, so they never change state.
One stream keeps a single order for audit.

### D-021: The log is the only input to a decision (Gap)

`TaskLog.apply` replays the task's applied rows to get the snapshot, and never reads the cache row.
The cache is written through on every accepted event and is rebuildable at any time.
A stale or tampered cache row therefore cannot change a gate's answer, and the next accepted event overwrites it.

### D-022: Reconcile records and never repairs (Gap)

Reconcile writes a `reconcile` row for each task whose replayed state differs from the caller's observation.
It changes no task state, cache row, or approval.
If the last row of a task is already an identical `reconcile` row, it writes nothing, so a restart does not repeat the same alert.
The caller supplies the observations. Mapping bb thread state to task states is event wiring, which is milestone 5.

### D-023: Recovery repairs only the cache (Gap)

`recover` replays every task that is not `torn_down`, rewrites a cache row that is missing or differs, and reports every task it touched.
It never writes to the log and never guesses a row for a corrupt task.
`rebuildCache` rebuilds every task, including `torn_down` ones, and also writes no row for a corrupt task.

### D-024: A corrupt task refuses further events (Gap)

When an applied row no longer passes the machine, or records a state the machine does not reach, replay reports the task as corrupt.
`TaskLog.apply` then refuses every event for that task with `corrupt_log` and logs the refusal.
The owner has to look at the log. The plugin does not repair history.

### D-025: Append-only is enforced twice (Gap)

The `Store` interface has no method that updates or deletes a log row or an approval.
The SQLite schema adds triggers that abort `UPDATE` and `DELETE` on `task_event` and on `approval`, so a raw SQL statement cannot rewrite history either.
The design asks for an append-only event log. The approval table gets the same protection.

### D-026: Project config fields are nullable, with no invented defaults (Gap)

An unregistered project reads as `no-mistakes` with `yolo` off, as the design says.
The branch prefix, base branch, and default machine are null until someone sets them.
The design gives no default for them, so the store invents none.

### D-027: The SQLite store takes a path or an open database (Limit)

`openSqliteStore` accepts a file path, `:memory:`, or an open `better-sqlite3` database, and closes only what it opened.
How the plugin gets its per-plugin database from bb is unverified, so milestone 0 settles it.
Wiring the store into the plugin factory waits for those results, as `CLAUDE.md` requires.
