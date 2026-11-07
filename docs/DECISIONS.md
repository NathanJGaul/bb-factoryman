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
The owner then installed bb 0.48.1, and `pnpm run build` now succeeds.
It writes `dist/server.js`, `dist/server.js.map`, and `dist/server.meta.json`.
The first run failed with `invalid plugin package.json (bb.branding)`, so the manifest now declares `bb.branding.icon`, and the manifest test asserts it.
`dist/` is git-ignored.
The plugin has not been installed into a running bb with `bb plugin install`, because that changes the owner's bb state.
Milestone 11 covers the live check.

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
`@get-bb/plugin-sdk` is pinned to the exact version 0.6.104, the SDK that the installed bb 0.48.1 reports.
The scaffold first pinned 0.6.125, the newest npm release, and `bb plugin build` warned about the mismatch.
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

### D-007: Spec-Kit sequencing and approvals (Resolved by the captain)

`/speckit.tdd.plan` needs `.specify/memory/tdd-profile.md`, which `/speckit.tdd.setup` writes after the test stack exists.
The order was therefore specify, plan, tasks, toolchain files, `tdd.setup`, then `tdd.plan`.
The toolchain files hold configuration and one smoke test, and no feature code.
The captain's intent fixed the scope, so the specification, plan, and task list were approved by that intent and not by a separate review.
The constitution's test-first principle uses the exact wording of the Spec-Kit workflow.
**Resolved**: on 2026-11-06 the captain decided to keep the standard principle V wording in `.specify/memory/constitution.md`.
The constitution is unchanged, and the entry is closed.

## Milestone 2: state machine

### D-008: `blocked` applies to scouts, and only from `working` (Gap)

The design draws `blocked` in the ship lane and says "a task pinned to an offline machine goes blocked".
The machine lets both kinds block, because the rule says "a task".
`block` is legal only from `working`, and `unblock` returns only to `working`.
A task that is offline at dispatch has no path from `queued` to `blocked`.
Milestone 8 decides how to represent that case.
The likely answer is `start`, which binds the machine, followed by `block`.

### D-009: Hard rules 5, 6, and 7 are not enforced yet (Limit)

Rule 5 (an offline machine blocks, with no fallback) and rule 6 (`local-only` stays on the clone's machine) need machine data, which is milestone 8.
Rule 7 (extensions never remove a gate) needs the extension loader, which is milestone 9.
The machine provides the `blocked` state and events.
Its gate list is a closed constant, so no extension point exists to remove a gate today.
`CLAUDE.md` forbids placement code before the spike results confirm the assumptions.

### D-010: A denied approval has no rework path (Resolved by the captain)

The design has no arrow back from `awaiting_approval` or `review_ready` to `working`.
The first build recorded a denied approval and left the task in `awaiting_approval`, with `fail` as the only other exit.
**Resolved**: on 2026-11-06 the captain decided to add a `request_changes` transition from `awaiting_approval` and from `review_ready` back to `working`.
D-028 records how it works.

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
- A `worker` actor is refused on `request_approval`, `request_changes`, `merge`, `promote`, and `teardown`, because the design says workers cannot merge or tear down, and a worker must not send its own work back or forward through review.

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
- `payload` holds the event fields other than type, actor, and evidence.
  Without it, replay could not rebuild the worker thread, branch, machine, or pull request URL, and could not re-run the gates with their original facts.
- `outcome` is `applied` or `refused`.
- `reason_code` and `reason_message` name why a refused event was refused.

`task` gains `project_id` and `mode`.
A task needs its project to find the project's `yolo` flag, and its delivery mode is fixed when the task is created, even if the project changes later.

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
The caller supplies the observations.
Mapping bb thread state to task states is event wiring, which is milestone 5.

### D-023: Recovery repairs only the cache (Gap)

`recover` replays every task that is not `torn_down`, rewrites a cache row that is missing or differs, and reports every task it touched.
It never writes to the log and never guesses a row for a corrupt task.
`rebuildCache` rebuilds every task, including `torn_down` ones, and also writes no row for a corrupt task.

### D-024: A corrupt task refuses further events (Gap)

When an applied row no longer passes the machine, or records a state the machine does not reach, replay reports the task as corrupt.
`TaskLog.apply` then refuses every event for that task with `corrupt_log` and logs the refusal.
The owner has to look at the log.
The plugin does not repair history.

### D-025: Append-only is enforced twice (Gap)

The `Store` interface has no method that updates or deletes a log row or an approval.
The SQLite schema adds triggers that abort `UPDATE` and `DELETE` on `task_event` and on `approval`, so a raw SQL statement cannot rewrite history either.
The design asks for an append-only event log.
The approval table gets the same protection.

### D-026: Project config fields are nullable, with no invented defaults (Gap)

An unregistered project reads as `no-mistakes` with `yolo` off, as the design says.
The branch prefix, base branch, and default machine are null until someone sets them.
The design gives no default for them, so the store invents none.

### D-027: The SQLite store takes a path or an open database (Limit)

`openSqliteStore` accepts a file path, `:memory:`, or an open `better-sqlite3` database, and closes only what it opened.
How the plugin gets its per-plugin database from bb is unverified, so milestone 0 settles it.
Wiring the store into the plugin factory waits for those results, as `CLAUDE.md` requires.
**Resolved**: spike item 23 in `spike/RESULTS.md` confirmed that `bb.storage.database()` returns a `better-sqlite3` handle on the plugin's own `data.db`.
Milestone 4 passes that handle to `openSqliteStore`.

## Captain decisions of 2026-11-06

### D-028: `request_changes` sends a task back to rework (Deviation, decided by the captain)

The design draws no arrow from `review_ready` or `awaiting_approval` back to `working`.
The captain added one, as the resolution of D-010.
The rules that carry it:

- `request_changes` moves a ship task from `review_ready` or from `awaiting_approval` to `working`.
  Scout tasks, and every other state, refuse it with `illegal_transition`.
- A `worker` actor is refused (`actor_forbidden`).
  The supervisor, the owner, and the system may send it.
- The event needs no evidence, but it can carry the owner's reason as evidence, and the log stores it.
- The event clears the task's current merge decision, whether that decision was a denial or an approval.
  A later merge therefore needs a new recorded approval from the owner, as hard rule 1 requires.
- Nothing in the log is rewritten.
  The `record_approval` row that denied the merge, its approval row, and the `request_changes` row all stay.
  Replay still reaches `working` with no merge decision, and a rebuilt cache matches.
- The worker, thread, branch, machine, and pull request URL stay, because the rework happens on the same branch.
  The worker then hands off again, and the delivery mode's review-ready check runs again.
- The `yolo` flag is untouched. `request_changes` is legal under `yolo` too.

## Milestones 4 to 6: spike

### D-029: The spike ran up front, on an isolated bb server (Deviation)

The task brief asks for the bb checks "before each milestone".
The checks for milestones 4, 5, and 6 ran together before the specification, and each is limited to the assumptions that its milestone needs.
The plan for milestone 5 depends on what milestone 4 learned about tool and thread identity, and a refutation found late would waste built work.
The checks ran against a bb 0.48.1 server that `bb-app` started on a throwaway data directory and non-default ports, so the owner's `~/.bb` and its plugins stayed untouched.
The results, with the bb and no-mistakes versions, are in `spike/RESULTS.md`.
No result refuted the architecture, so no `needs-decision` was needed.

### D-030: A submitted approval form is not proof of a human (Gap, owner should know)

`bb.ui.requestInput` returns `submitted` with whatever JSON reached `bb thread interactions respond`.
The interaction row does not record who submitted it.
An agent with a shell can therefore answer the owner's merge form.
The design already lists a worker with shell access as a known gap on the merge gate, and names branch protection and scoped tokens as the backstop.
The plugin validates the submitted value with a strict schema, treats everything except an exact approval as no approval, and says in its tool result that the approval came from a form.
The plugin cannot close this gap on its own.

## Milestones 4 to 6: plan

### D-031: No tool answers a pipeline finding (Open, the owner decides)

The design lists five tools, and none of them answers a no-mistakes finding.
The validator interface has an `answer` operation, and the driver exposes it, but no tool calls it.
A task in `needs_decision` therefore waits until someone answers in no-mistakes directly, which the driver observes, and then it returns to `validating`.
A run that finishes with an override, with skipped steps, or without a pull request also parks the task in `needs_decision` until someone starts a new run.
Adding a sixth tool, for example `factoryman_decide`, would give the supervisor a path.
It changes a design table, so the owner decides.
The firstmate rule that an `ask-user` finding belongs to the owner is a reason to route the answer through a form, as the merge approval does.

### D-032: The constitution's scope principle and the project scope text are amended (Deviation, resolved)

Principle VI limited the work to milestones 1 to 3.
The captain's intent for this task widens it to milestones 4 to 6 and asks for the spike checks that those milestones need.
Constitution version 1.1.0 now names milestones 1 to 6 as in scope and keeps milestones 7 to 11 out until their own spike results exist.
The "Current scope" text in `CLAUDE.md` and the `src/tools/` layout comment said the opposite, so they carry the same correction and nothing else.

### D-033: The dispatch description is the `start` event's evidence (Gap)

The machine's `create` and `start` events carry no description, and changing them edits the merged milestone 2 machine.
Every event may carry optional `evidence`, and the log stores it.
The plugin writes the description there, reads it back as the no-mistakes intent, and shows its first line in `factoryman_status`.
Evidence on `start` is not a gate, so this loosens nothing.

### D-034: The plugin plans the branch name (Gap)

bb names a worktree branch `bb/<slug>-<thread-id>` and a plugin cannot choose it (spike item 14).
`start` needs a branch, and D-026 left the prefix empty with no default.
Dispatch plans `<branchPrefix>` or `fm/`, followed by the task ID, records that name, and tells the worker to create the branch first.
If the worker uses another name, the record is wrong, and teardown still checks the worktree, which does not depend on the name.

### D-035: Authority comes from the store, not from plugin metadata (Gap)

Plugin metadata is writable by the thread's own agent.
It only decides which tools bb offers.
Each tool decides the caller from the store: a recorded worker thread is a worker, and every other thread is a supervisor, in its own project only.

### D-036: Every merge call asks the owner again (Gap)

A stored approval does not skip the form on a retry.
The worker keeps running during `awaiting_approval`, so the pull request can change after an approval, and a retry should not merge commits the owner never saw.

### D-037: Nothing writes a project config yet (Limit)

`.bb/factoryman/` config loading is milestone 9, and the design lists no tool or command that sets a project's mode or `yolo` flag.
Until then every project resolves to `no-mistakes` with `yolo` off, which is the safe default, and the other two modes are reachable only through tests.

### D-038: `@toon-format/toon` is a runtime dependency (Gap)

The no-mistakes CLI prints TOON.
A hand parser would have to get quoting and escaping right for finding text.
The library 4.4.0 decodes every recorded output, is MIT-licensed, and has no dependencies.
It is pinned to an exact version, as the SDK is.

### D-039: What a validator result does to a task (Gap)

The design says `needs_decision` holds when the pipeline stops on a finding that needs a human call, and `validating` ends when the pipeline has opened a pull request and CI is green.
The driver reads a gate as `needs_decision`, because a pipeline never passes a gate on its own.
It reads `checks-passed` with a pull request as `validated`, `failed` and `cancelled` as `fail`, and every other outcome as `needs_decision`.
Output it cannot read advances nothing, and five failures in a row park the task for a human.

### D-040: A failed worker thread fails the task at once (Limit)

bb's `provider-retry` plugin can retry a failed turn, so a worker thread can recover after `thread.failed`.
The plugin fails closed: it records `failed` and tells the supervisor.
A recovered thread's later events find a failed task and do nothing.
The supervisor can dispatch the work again.

### D-041: One command stamps the supervisor role (Gap)

Nothing in the design sets the supervisor role that makes bb offer the four supervisor tools.
`bb factoryman supervisor <thread-id>` does it, and it refuses a recorded worker thread.
The command grants visibility only, because authority comes from the store (D-035).

### D-042: The real merge and git commands are not run against a real forge (Limit)

The merge executors run `gh pr merge` for the pull request modes and `git merge` in the project checkout for `local-only`.
Tests cover the command lines with a fake runner and cover the git facts and the local merge with temporary repositories.
No test merges a real pull request, so the owner's live check in milestone 11 covers the `gh` path.
The merge method comes from a `mergeMethod` plugin setting (`squash`, `merge`, or `rebase`) that defaults to `squash`.

### D-043: Workers spawn with bb's parent notifications off (Deviation from bb's default)

Spike item 22 shows that bb wakes a parent after every child outcome unless notifications are off.
The design says the plugin, not the agent, wakes the supervisor.
Dispatch therefore spawns every worker with `parentNotifications: "off"` and a parent thread, and the plugin sends the only wake messages.

## Milestone 4: tools and approval

### D-044: Tool arguments are checked by the tool, not by bb (Gap)

`bb.agents.registerTool` can take a `zod` schema, and bb then rejects a bad call with its own error before the tool runs.
The plugin registers each tool with the JSON schema that `z.toJSONSchema` makes from the same schema, so bb advertises the shape to the model and the tool checks the arguments itself.
A bad call then gets the tool's refusal text, with a reason code, as a normal error result, and the tool's tests cover it.

### D-045: Two milestone 1 tests changed with the scope amendment (Deviation)

The layout test asserted that `src/tools` must not exist, and the plugin load test asserted that the factory registers nothing.
Both rules ended with the captain's widening of scope (D-032).
The layout test now forbids only `src/dispatch` and `skills`, and it still requires the milestone 1 to 3 directories.
The plugin test now asserts the five tools, the command, the store on the host database, and a clean dispose.
Neither change hides a failure: each follows a changed requirement, and the cycle log records both as their own steps.

### D-046: A default empty `git` output fails teardown closed (Gap)

The worktree report refuses an unreadable commit count.
A fake runner that returns an empty string for `git rev-list --count` therefore blocks teardown, which is the intended behavior.
Tests that want a landed worktree script the count as `0`.

## Milestone 5: event wiring

### D-047: A failure waits briefly for its cause, and a deleted thread keeps its parent (Gap)

The spike recorded `thread.failed` with `error: null`, and the cause arrives in `turn.failed` about twenty milliseconds later.
A handler that read the last turn failure at once would never see it.
When the error text is empty, the handler waits 500 ms through the injected `sleep`, then reads the remembered category and status code.
Without either, the evidence is the fixed text `worker thread entered the error state`.

`ThreadInfo` also carries `deleted`.
bb soft-deletes a thread and may still serve it, with its parent.
The notifier needs that parent to tell the supervisor, so `getThread` returns `null` only for a 404, and a deleted thread observes as `missing`.
If bb answers 404, the supervisor cannot be found, the plugin logs a warning, and it writes the `reconcile` row anyway.

### D-048: The start-up service waits for the abort signal (Gap)

`bb.background.service` expects `start` to resolve when the signal aborts.
The start-up service therefore runs the live-state comparison and then waits.
Milestone 6 resumes the validator driver in the same service.

## Milestone 6: validator

### D-049: The `checks-passed` outcome is a derived fixture, not a recording (Limit)

The spike had no forge, so no run ever reached `checks-passed`.
The acceptance test for the real adapter derives that output from the recorded status of a run that opened a pull request: it changes the outcome line from `cancelled` to the value the CLI's own documentation lists and drops the error line.
The test names the derivation.
The owner's live check in milestone 11 is the first time a real `checks-passed` output reaches the adapter.

### D-050: Findings travel as the evidence of the `finding` event (Gap)

The machine's `finding` event carries no payload.
The driver writes the gate's findings into the event's evidence, one line each, with the fields exactly as no-mistakes wrote them.
The wake message for a `needs_decision` task keeps that evidence whole, up to 8000 characters, and every other wake message cuts evidence to 600.

### D-051: The validator is injected at the composition root (Gap)

`createPlugin` takes an optional `validator` and `pollMs`.
The default is the no-mistakes adapter over the real command runner.
Tests inject a scripted fake.
Nothing else in the plugin chooses a validator, so a second implementation (for example a multi-model audit) needs one line in `server.ts`.

### D-052: The loop follows a run with `axi run`, and the run ID is not stored (Gap)

`axi run` reattaches to the run for the current commit, so the driver never needs a run ID.
A restart resumes every task in `validating` or `needs_decision`, asks again from the worktree, and starts no second run.
The run ID appears in the evidence of the events that the driver records.

