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
Resolved by D-090: no manifest key is needed.

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
- The `yolo` flag is untouched.
  `request_changes` is legal under `yolo` too.

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

## Live smoke test on the throwaway bb server

### D-053: The fake plugin host accepted a spawn that real bb rejects (Gap, fixed)

The first live dispatch failed with `HTTP 400: hostId is required unless workspace.type is personal`.
The adapter now sends the project's default host ID and refuses to spawn when bb reports none (`spike/RESULTS.md` item 26).
The fake host does not check this rule, so the fix is covered by an adapter test that asserts the host ID.
The live smoke test stays part of the close-out, because it finds contract differences that the fake host cannot.

## Audit remediation

### D-054: The dispose wiring has an equivalent mutant under the fake host (Limit)

`bb.onDispose(() => driver.dispose())` stops the validation loops when the plugin unloads.
Under the fake host, `dispose` poisons the plugin's handle, so a loop stops by itself on its first bb call.
A mutant that removes the wiring therefore survives U217, and no fake-host test can tell the two apart.
Real bb unloads the plugin the same way, so the line matters in practice only when a plugin's handle stays usable after unload.
The loops also stop when the task leaves its two states, and a stopped loop never cancels a run.

### D-055: The cold-context audit found that the first random walk was too shallow (Gap, fixed)

The first walk stayed in `working` and `blocked`, so it could not catch a cache that skips `fail` or `teardown` events.
The walk now picks a mostly legal action for each task's state, reaches every state the tools can reach, and asserts that it applied `merge`, `teardown`, `block`, `fail`, and `ready` rows.

## Captain decisions of 2026-11-07

### D-056: The test-after waiver for six behaviors is accepted (Decided)

The captain accepts the test-after waiver for U40, U120, U121, U122, U123, and U124 (`analyze.md` F1).
Cycle R1 re-derived a red for each with a deliberate mutant.

### D-057: D-031 is accepted for this PR, and `factoryman_decide` is a follow-up (Decided)

No tool answers a pipeline finding in this PR.
A sixth tool, `factoryman_decide`, comes in a follow-up PR.

### D-058: D-030 is a known gap until milestone 10 (Decided)

An approval form is not proof of a human.
The captain accepts this gap until the branch protection work in milestone 10.

### D-059: A pull request must belong to the project's own repository (Decided)

A worker reports the pull request URL, so the URL is not trusted.
The pull request executor refuses at preflight unless the URL is `https://<host>/<owner>/<repo>/pull/<number>` in the project's own repository.
Host, owner, and repo compare case-insensitively.
The project's remote comes from `bb.sdk.projects.get` through `BbPort.getProjectRemote`, in the forms `git@host:owner/repo(.git)` and `https://host/owner/repo(.git)`.
A remote that is missing or unreadable also refuses, so the check fails closed.
The check runs before the approval form and before `request_approval`, and it runs when `yolo` is on.
`local-only` mode is not affected.

### D-060: A deleted worker thread leaves a merged task alone (Decided)

`thread.deleted` fails a task in any state before `merged`.
A task that is `merged`, `torn_down`, or `failed` gets no `fail` event and no wake message, so the merged record stays true until teardown.

### D-061: Live validation of the review fixes: two scenarios stay inconclusive in part (Decided)

The captain chose Fix for finding test-1, and the fix is to record live evidence only (spike item 28).
Three scenarios were confirmed live: a pull request URL outside the project's repository, a merged task that survives thread deletion, and the wiring and validator parts of the fourth.
Two could not be driven live.
The first is the exact race window of the concurrent merge guard, which two model-driven threads cannot hit on demand.
The second is the reconcile message for a deleted worker thread, because bb answers 404, so the parent is unknown.
No production code was added to make them drivable.
Unit and acceptance tests cover both.

## Milestones 7 to 11: scope

### D-068: Constitution principle VI and the scope text follow the captain's intent (Deviation, resolved)

The captain's intent for this task asks for milestones 7 to 11.
Constitution 1.1.0 and the "Current scope" text in `CLAUDE.md` kept those milestones out until their own spike results exist.
Constitution 1.2.0 puts milestones 1 to 11 in scope and keeps the rule that each milestone's bb-dependent code waits for the spike results it needs, which `spike/RESULTS.md` now records milestone by milestone.
The `CLAUDE.md` scope text and the layout comments carry the same correction and nothing else.
`factoryman_decide` stays out (D-057), and the live install stays the owner's step.

## Milestone 7: dispatch resolver

### D-062: The dispatch config lives at `<checkout>/.bb/factoryman/dispatch.json` on the server (Gap, Limit)

The design says "a JSON file under the project's `.bb/` directory" and `CLAUDE.md` names `.bb/factoryman/` as the config directory.
Milestone 7 reads only `dispatch.json` there.
Milestone 9 adds the rest of the workflow config and reuses the same directory.
The checkout is the project's default `local_path` source (`BbPort.getProjectCheckout`).
bb does not say whether that source sits on the server machine.
If it sits on a remote machine, the path will not exist on the server, the file reads as absent, and the built-in default applies.
That fallback is silent for the owner, so the dispatch result names the profile source ("from the built-in default").
The live check in milestone 11 confirms the path on a real project.

### D-063: The built-in default profile is `claude-code`, `claude-sonnet-5-5`, `high`, `auto` (Gap)

The design lists "the plugin's built-in default" as the last rung and does not name one.
The profile is the last resort and is not an owner declaration, so it sets no reasoning floor (D-064).
The owner replaces it with `default` in `dispatch.json`.
If the built-in provider is unavailable, dispatch blocks (FR-708).
It never falls back to another provider.

### D-064: The reasoning floor compares an explicit profile with the owner's declarations (Gap)

firstmate never lowers the reasoning level to save quota without standing permission.
The resolver has no quota data, so the only way it can lower a level is an explicit override that sits below what the owner declared.
The baseline is the profiles of the matching rules, or else the configured default.
The built-in default sets none.
A level below any baseline profile blocks with `reasoning_lowered`, unless `standingPermission.lowerReasoning` is true in the file.
Reasoning level IDs are provider-specific (spike item 29), so the ladder lives in the config and defaults to `none, low, medium, high, xhigh, max`.
When two levels differ and either one is off the ladder, the check blocks, because it cannot rank them.
Choosing a rule with `rule` takes the profile from the owner's file, so it needs no check.

### D-065: Ambiguity needs distinct profiles, and conditions are exact (Gap)

The design says the resolver returns `ambiguous` "when several rules fit".
The code returns `ambiguous` only when the matching rules name profiles that differ in at least one of the four fields.
Matching rules with equal profiles resolve clear, because the supervisor has nothing to choose.
A rule's `when` supports `kind`, `mode`, `tags` (all required, case-insensitive), and `keywords` (any, whole word, case-insensitive).
A rule needs at least one condition, so no rule matches everything: the owner uses `default` for that.
The supervisor chooses by calling again with `rule` set to a matching rule ID, or with an explicit `profile`.

### D-066: A blocker or an ambiguous result creates no task (Gap)

Hard rule 8 says illegal transitions are refused and logged.
A dispatch blocker is not a transition, because no task exists yet.
The tool returns an error result that names the reason and logs nothing to the event log.
Creating a task only to fail it would clutter the log and would give the state machine a `queued` to `failed` path for a configuration problem.

### D-067: `factoryman_dispatch` takes an optional profile, `rule`, and `tags` (Deviation from milestone 4)

The milestone 4 tool required a complete profile.
The resolver makes it optional, and adds `rule` and `tags`.
Test U37 asserted the old `required` list, so it changed with this requirement (cycle C5 in the cycle log).
The success text gains a `Profile: ...` line only when the resolver chose the profile, so the milestone 4 text for an explicit profile is unchanged.
The `start` event does not record the profile source, because the machine's event is closed and changing it edits the merged milestone 2 machine.
The result text and the plugin log name the source.

## Milestone 8: machine placement

### D-069: A pinned machine that is offline at dispatch blocks the dispatch and creates no task (Gap, resolves D-008)

D-008 left open how a task that is offline at dispatch can go `blocked`, because `block` is legal only from `working`.
A task has no worker before `start`, and `unblock` returns to `working`, so a blocked-before-start task would skip the `start` gates.
The dispatch tool therefore blocks with `machine_offline`, creates no task, spawns nothing, and tries no other machine.
That keeps hard rule 5: the work never falls back.
A task that is already running when its machine goes offline does go `blocked` (D-072).
The owner may prefer a visible `blocked` task at dispatch time, which needs a change to the state machine.

### D-070: The clone host is the project's default source host (Gap)

The design says "the machine that holds the clone".
bb's project has sources, each on a host, and one is the default (`BbPort.getProjectSources`).
The default source's host is the clone host.
The `start` event records `machine` (the chosen host ID, or null for the default host) and `cloneMachine` (the default source's host ID).
A machine given by name is stored as its host ID, also when it is the clone host.

### D-071: Remote commands run in host terminals with a framed result (Gap)

The design says "the gate runs where the worktree lives" and does not say how the plugin runs a command on another machine.
bb offers no command API for plugins, so the plugin starts a `host_path` terminal in `argv` mode (spike item 8).
A terminal is a PTY, so the command runs inside a small `sh` wrapper that prints `FMX1 <exit code> <stdout base64> <stderr base64>`.
Any other result (no frame, truncated output, a disconnected terminal, a timeout, a terminal that cannot start) is a failed command, so teardown and the preflight fail closed.
The wrapper needs `sh`, `mktemp`, `base64`, and `tr` on the remote machine.
The tests use a fake terminal, and the one real check ran on the local host of a throwaway server (spike item 8).
A real remote machine is the owner's live check.

### D-072: The monitor blocks only working tasks and unblocks only its own blocks (Gap)

`block` is legal only from `working`.
A task in `validating`, `needs_decision`, `review_ready`, or `awaiting_approval` on an offline machine gets one warning in the plugin log and no event.
The monitor marks its own blocks with the evidence prefix `machine offline: `, and it unblocks a task only when the latest applied row is a system `block` with that prefix.
A block that the worker reported stays until a person acts.
A removed machine (`experimental_host.deleted`) blocks its working tasks at once.
The monitor remembers the removed host ID until the process restarts, and bb answers 404 for the host after that, so the tasks never return.
bb sends no disconnect event (spike item 7), so the monitor reads `hosts.list()` every `machinePollSeconds` seconds (default 30, at least 1).

### D-073: The `start` event carries `cloneMachine`, and a guard enforces hard rule 6 (Deviation from milestone 2)

Hard rule 6 needs two facts the machine cannot read: the task's machine and the clone host.
The caller gathers both and passes them in the `start` event (D-015).
The new guard `localOnlyStaysOnClone` runs on `start` in both lanes.
It refuses a `local-only` start whose `machine` is set and is not equal to `cloneMachine`, with the new reason code `machine_mismatch`.
A `local-only` start with no machine passes, because the worker then runs on the default host.
The dispatch tool previews the `start` event with the pure machine before it creates a task or spawns a worker, so a refused start leaves nothing behind.
`test/fixtures/legal-set.ts` lists the new guard.

### D-074: The remote preflight checks six things and runs before the first dispatch to a machine (Gap)

The design says the preflight reports "what's missing".
It checks: the agent CLI (a provider is available on that host), `git`, for `no-mistakes` mode the `no-mistakes` command and a `no-mistakes` git remote in the project's source on that host, and for the two pull request modes `gh auth status`.
`gh auth status` shows that credentials exist and not that they are scoped, so the scope stays the owner's check.
Dispatch runs it for a remote machine and caches a pass per host, project, mode, and provider until restart.
The host that holds the clone skips it.
`bb factoryman preflight <machine> --project <id> [--provider <id>]` runs it on demand, never caches, and changes nothing.

### D-075: Rules differ by machine as well as by profile (Gap)

D-065 made `ambiguous` depend on distinct profiles.
A rule now also names an optional `machine`, so two matching rules with the same profile and different machines are ambiguous too.

### D-076: The project's default machine has no writer until milestone 9 (Limit)

`project_config.defaultMachine` already exists in the store.
Nothing sets it yet (D-037), and milestone 9 loads the workflow config that can.
Until then only tests set it, and a call or a rule names the machine.

### D-077: Two existing tests changed with the new registrations (Deviation)

`[U123]` now expects the `factoryman-machines` service and the `experimental_host.deleted` handler.
`[U186]` and `[U192]` expect `host: null` in the validator input.
`[U45]` expects `machine` and `cloneMachine` in the `start` payload, and `[U710]` to `[U717]` expect `machine: null`.
Each change follows a changed requirement and none hides a failure.

## Milestone 9: extension surface

### D-078: `workflow.json` can only tighten, and it cannot set `yolo` or `baseBranch` (Gap, limit)

The design says config can add checks and never remove a gate, and it lists "task kinds, delivery modes, dispatch rules, and per-project overrides" as config.
The plugin reads `<checkout>/.bb/factoryman/workflow.json` with a strict schema.
It can set:

- `project.deliveryMode`, which applies only if it is at least as strict as the stored mode (`no-mistakes`, then `direct-PR`, then `local-only`). A looser mode blocks the call.
- `project.branchPrefix` and `project.defaultMachine`, which fill a blank stored value. A stored value wins.
- `checks`, a list per delivery mode (D-079).

A scan rejects the keys `yolo`, `gates`, `gate`, `skip`, `skipGates`, `skipChecks`, `approval`, `approvals`, `requireApproval`, `disable`, `disabled`, `teardown`, `evidence`, `merge`, `bypass`, and `override` at any depth, with a message that names hard rule 7.
It rejects `baseBranch` too, because the base branch decides the landed-work check at teardown: a file that an agent wrote could set it to the task's own branch and make unlanded work look landed.
Every other unknown key fails the strict schema.
So `yolo` and `baseBranch` come from the stored project config only, and nothing writes them yet (D-037; the registry import in milestone 10 is a dry run).
Config cannot define new task kinds or delivery modes, because a new mode would add transitions and could loosen a gate.
It selects among the three modes only.

### D-079: Custom checks run with the plugin's privileges, in the worktree, with no shell (Gap, risk)

A check is an `argv` list that the plugin runs with `exec`, in the worker's worktree, on the machine of the task, with an optional timeout of 1 to 3600 seconds.
A check passes on exit code 0 only. A timeout, a missing command, or a failed terminal counts as failed.
A check with no `timeoutSeconds` gets a default of 600 seconds, so a hung command cannot hang a report.
Every check runs, so the worker sees all the failures.
The commands come from a file in the server's checkout, so whoever can change that file can run commands as the plugin's user in worktrees.
The worker already has a shell there, and a remote worktree runs the command through a host terminal as the daemon's user, so the plugin adds no new reach on that machine.
The file lives in the server checkout, and a worker's branch changes it only after the owner merges.

### D-080: Check results travel in the `handoff` and `ready` events (Gap, caller-supplied fact)

Following D-015, the report tool runs the checks and passes `checks: [{ name, passed }]` in the event.
The new guard `customChecksPassed` refuses the event with `check_failed` when any entry has `passed: false`.
The guard runs after the existing gates, so a passing check never replaces evidence or a mode check.
A caller that leaves `checks` out skips the gate.
The report tool is the only caller that sends these two events, and `[A908]` to `[A912]` pin that it always runs the configured checks.
The log stores the results, so replay re-checks them.
Log rows from before this milestone have no `checks` field and still replay.

### D-081: The plugin stamps task facts on the worker thread (Gap)

After each applied event, the plugin writes `taskId`, `kind`, `mode`, `state`, and `machine` to the worker thread's plugin metadata.
It never writes `role`, so tool visibility is unchanged.
A failed write logs a warning and does not undo the event.
bb lets any plugin read and write another plugin's metadata (spike item 9), so these values are hints for other plugins and the plugin never trusts them.

### D-082: The read contract has four methods and a version number (Gap)

`apiVersion`, `listTasks`, `getTask`, and `listEvents` are registered as one contract, marked discoverable, with no method that writes.
Every answer carries `apiVersion: 1`, and a change that breaks a reader bumps it.
`listEvents` takes `since` (a sequence number), `taskId`, and a `limit` of 1 to 1000 (default 200), and it leaves out the event payload.
The output schemas are strict, so a field cannot leak by accident.
bb lets any plugin call any registered method (spike item 10), so the surface itself is the guarantee that a sibling plugin cannot trigger a transition.
The design's idea of a version in the contract is carried by this field and not by method names.

### D-083: The workflow file is read on every call (Gap)

Dispatch and report read `workflow.json` each time and do not cache it.
The cost is one small file read, and an edited file takes effect at once, which is what an agent that writes config expects.

## Milestone 10: limits, backstop, and cutover

### D-084: A worker counts as running in four states, and the caps default to none (Gap)

The design says each project config sets "a cap on running workers" and the plugin sets "a global cap".
A task counts against a cap in `working`, `blocked`, `validating`, and `needs_decision`, because its worker thread is alive and may be waiting on a person.
A task also counts while its worker is starting, so two dispatches in a row cannot both pass a cap.
`review_ready` and every later state free the slot, because the worker has handed off.
The project cap is `limits.maxWorkers` in `workflow.json`, and the global cap is the `maxWorkers` setting.
`0`, or no value, means no cap.
The default is no cap, because a cap is a resource limit and not an authority gate: it can only delay work, and an owner who installs the plugin with defaults gets today's behavior.
The design also says the plugin returns `wait` from bb's `message.dispatch` hook.
The plugin queues the task in its own log instead, so the cap does not depend on bb's concurrency-limit plugin or on how the two hooks order themselves (spike item 5 stays unchecked).
bb's own `concurrency-limit` plugin still applies to every worker's turns, with its automatic limit of one thread per processor, whatever this plugin does.

### D-085: The queued request lives in the `create` event (Gap)

A queued task needs its description, profile, machine, and parent thread later.
The `create` event gains an optional `request` object, validated by the machine only as an object, and the plugin reads it back with a strict schema.
The log is the source of truth, so a restart keeps the queue without a new table, and replay never reads the field.
A request that fails the strict schema fails its task with evidence.
No tool cancels a queued task in this release (AC-1.4), so a follow-up such as `factoryman_decide` would add that.

### D-086: Budgets refuse and never stop work, and unknown cost is not guessed (Gap)

`limits.maxTasksPerDay` counts tasks created on the UTC date of the injected clock.
`limits.perDayBudget` refuses when the cost of today's tasks reaches the budget.
`limits.perTaskBudget` refuses while a running task has cost more than it.
The cost comes from `bb.sdk.threads.context().usage.cost` (spike item 12).
A cost that is missing, in another currency than `budgetCurrency` (default `USD`), or unreadable is unknown, and the budget is not enforced on it.
The dispatch result then says which budgets could not be checked, and `maxTasksPerDay` stays the one spend limit in force.
A refusal creates no task (D-066).
The plugin never stops or fails a running worker for cost.
The budget check runs before the cap check, so a dispatch that is over budget is refused even when the project is at a cap, and it never becomes a queued task.
The drain does not check budgets again.
A task that was accepted under budget and queued starts when a slot frees, even if the day's spend has reached the budget since.
That is deliberate: the budget decides whether the plugin accepts new work, and the owner already accepted this task.
An owner who wants a hard stop sets a cap and lowers it.
The day count and the day spend cover only the project's own tasks created today.
The per-task budget reads every running task of the project, whatever day it started.

### D-087: The webhook posts attention states as JSON (Gap)

The `webhookUrl` setting holds a URL, and the plugin posts `{ event: "task.attention", at, task, evidence }` to it when a task enters `needs_decision`, `review_ready`, `report_ready`, `blocked`, or `failed`.
Only `http` and `https` URLs post, the call times out after five seconds, and evidence is cut to 600 characters.
The URL is a secret, so a failure logs the host and never the URL.
The log text also strips the URL, its parts, and any `scheme://` text from the error message, because the real `fetch` repeats a URL with credentials in its error.
A 4xx or 5xx answer logs a warning with the host and the status.
A failure never undoes a transition.
The supervisor wake goes first and the post second, so a slow hook never delays the wake.
Spike item 13: bb's push-notifications plugin has a command but the plugin calls no other plugin, so the webhook is the design's fallback.

### D-088: The registry import is a dry run that only reads (Decided in the task brief)

`bb factoryman import-registry --file <path>` reads one file through the `Files` port and prints each project's registered mode, the mode this plugin would use, `yolo`, branch prefix, forge, and the bb project with the same name (case-insensitive).
It follows the format in the header of firstmate's `bin/fm-project-mode.sh`: the name ends at the first ` [` or ` - `, the bracket tokens come in any order, a line with no bracket is `no-mistakes` with `yolo` off, and `no-mistakes-prod-only` maps to `no-mistakes` with a note.
An unknown mode or token is flagged and not guessed.
A bare `yolo` token, without the `+`, is an unknown mode or an unexpected token and never turns the bypass on.
A line with an unclosed bracket is reported as an entry with `unreadable` as its registered mode and a flag, and not skipped.
An unknown flag prints the usage and reads nothing.
If bb cannot list its projects, the report says so in a note and still prints every entry.
`--apply` is refused.
Nothing writes the stored project config, so a project stays in `no-mistakes` mode with `yolo` off until the owner decides on an apply path.
That decision is open (D-078).

### D-089: The branch-protection command prints and never runs (Decided in the task brief)

`bb factoryman protection <owner/repo>` builds text from strictly checked inputs and runs nothing.
It cannot run anything: the function takes no runtime.
The steps name the required `no-mistakes` check, `enforce_admins`, scoped tokens, and a verification.
`docs/BRANCH-PROTECTION.md` and `docs/CUTOVER.md` hold the same steps as prose.
No GitHub setting changed, and no forge was reached.

### D-090: Plugin skills sit in `skills/` and are selected by name, per thread role (Resolves D-002)

The plugin ships `skills/factoryman-supervisor/SKILL.md` and `skills/factoryman-worker/SKILL.md`.
The manifest needs no key.
A throwaway bb 0.48.1 listed both with scope `plugin` after a path install (spike item 11).
`bb.agents.configure` returns the skill name that matches the thread's `role` metadata, and no skill for any other thread, like `toolsForMetadata`.
The selection is a hint and not a gate, because the metadata is writable (spike item 2).
A wrong or unknown name rejects the plugin's whole selection, tools included.
The tests read the names from the skill files, so a rename that misses one place fails (`[A1102]`).
The worker's first message names the `factoryman-worker` skill, and a test dispatches through the fake host to prove the prompt reaches the spawn.
`MERGEABLE_STATES` in `merge.ts` lists the states that `factoryman_merge` accepts, and the supervisor skill is tested against it, against `WAKE_STATES`, and against the teardown arrows of `TABLES`, so a skill that disagrees with the code fails a test.

### D-091: The skills are advice, and a project may add skills of its own (Gap)

Both skills say that the plugin enforces every gate in code, and a test pins the sentence.
The supervisor skill tells the supervisor never to retry with a weaker setting to get past a block, to leave findings to the owner, and to report refusals.
The worker skill carries the rules that the prompt also states, so a worker that never reads the skill still gets the rules that matter.
A project skill with the same name appears beside the plugin skill in the listing, and which one a session loads is not known (spike item 11).
The live check records it.

### D-092: The live check runs in the throwaway bb, and the captain funds tier 2 from their own account (Decided by the captain)

`docs/LIVE-CHECK.md` follows the live-isolation report: the `bblab` sandbox, the tiers, and the undisturbed checklist.
The runbook says not to install into the owner's bb and never to touch the shared no-mistakes daemon.
The captain decided that tier 2 uses the captain's own Claude account (option B of the report), and accepted that this competes with firstmate for quota.
The runbook carries the report's caps: the cheapest model, a low reasoning level, one worker at a time, a tiny repository, a 30 minute watchdog, and `bblab down` as the hard stop.
It adds the plugin's own limits (`maxWorkers` 1 and `maxTasksPerDay` 2 in the project's `workflow.json`).
The captain runs `claude setup-token` and passes the token through `BBLAB_PASS_ENV` into a second bring-up of the lab, started from a fresh `env -i` shell so that no other secret of the captain rides into the lab's keeper process.
No agent creates, reads, or handles the token while the captain sets it up, and the runbook writes it nowhere.
The runbook says plainly that the Claude CLI in the lab holds the token and that an agent session may be able to read it, so the captain revokes it after the run.
Whether a lab process can read the keeper's environment is untested, because `bblab` is not installed here.
Tiers 0 and 1 run first and tier 2 waits for them.

### D-093: Tier 1 has no stub agent yet, so the runbook says what the gate is (Gap)

The report suggests a stub ACP agent so that the scout and ship flows run with no credential.
No such agent exists, and the shape of `customAgents` is undocumented.
This release does not build it (milestone 11 is skills and a runbook).
Until it exists, the tier 2 gate is every tier 0 check plus the captain's recorded decision to go on without tier 1, and the runbook says what that skip costs.

