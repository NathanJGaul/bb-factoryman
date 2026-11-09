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
If it sits on a remote machine, the path will not exist on the server, the file reads as absent, and dispatch blocks with a `dispatch init` hint (D-112 removed the built-in default that once applied here).
The live check in milestone 11 confirms the path on a real project.

### D-063: The built-in default profile is `claude-code`, `claude-sonnet-5-5`, `high`, `auto` (Gap)

The design lists "the plugin's built-in default" as the last rung and does not name one.
The profile is the last resort and is not an owner declaration, so it sets no reasoning floor (D-064).
The owner replaces it with `default` in `dispatch.json`.
If the built-in provider is unavailable, dispatch blocks (FR-708).
It never falls back to another provider.

Amended by D-112: the built-in profile is removed, and a project that names no profile gets a block and a `dispatch init` hint.
The text above records the decision as it stood.

### D-064: The reasoning floor compares an explicit profile with the owner's declarations (Gap)

firstmate never lowers the reasoning level to save quota without standing permission.
The resolver has no quota data, so the only way it can lower a level is an explicit override that sits below what the owner declared.
The baseline is the profiles of the matching rules, or else the configured default.
A level below any baseline profile blocks with `reasoning_lowered`, unless `standingPermission.lowerReasoning` is true in the file.
Reasoning level IDs are provider-specific (spike item 29), so the ladder lives in the config and defaults to `none, low, medium, high, xhigh, max`.
When two levels differ and either one is off the ladder, the check blocks, because it cannot rank them.
Choosing a rule with `rule` takes the profile from the owner's file, so it needs no check.

Amended by D-113: the ladder can be one array for every provider or a record from provider ID to its own ladder.
The text above records the decision as it stood.

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

## Merge approval form

### D-094: The merge approval has a frontend renderer in the plugin (Decided by the captain)

The live check found that bb's web UI showed "The plugin form is unavailable. Cancel to continue." for the `factoryman-merge-approval` form, because the plugin shipped no frontend.
A person could only cancel the form, and the only way to approve was `bb thread interactions respond`.
The captain chose option 1 of the live check report: add a frontend renderer so the owner can approve and deny in the web UI.
The manifest declares `bb.app` as `./src/app.tsx`, and `bb plugin build` writes `dist/app.js` and `dist/app.css` beside the server bundle.
The entry registers one renderer with `app.slots.pendingInteraction`, under the id that `factoryman_merge` passes to bb.
The form shows the task, branch, pull request, and evidence, takes an optional comment, and offers Approve, Deny, and Cancel.
It answers with the value that `factoryman_merge` already reads, `{ "decision": "approved" | "denied", "comment"?: string }`.
The backend, the state machine, the tools, and the approval record did not change.
The isolated lab (bb 0.49.0) checked it with a browser tool: a click on Deny recorded a denial, a click on Cancel recorded nothing, and a click on Approve recorded an approval and merged.
bb draws the form's title and the requester line and no Cancel of its own, so the plugin's Cancel is the only one.

### D-095: D-030 stays partly open after the renderer (Open, the owner decides)

The renderer lets a person approve in the web UI.
It does not stop an agent from answering.
A worker with a shell can still run `bb thread interactions respond`, and bb records the answer as `plugin_submitted` with no submitter, so D-030 stays partly open.
In `local-only` mode there is no forge backstop either.
The owner-typed code (option 2 of the report), which only the renderer would show and the owner would type back, would close most of the gap in the app.
The captain deferred it, so the approval design is unchanged.
`factoryman_decide` stays out of scope (D-057).
D-058 still stands: the captain accepts the gap until branch protection is in place.

### D-096: The contract module has no imports and the browser bundle ships no `zod` (Gap)

The renderer and `factoryman_merge` agree on the request payload and the answer through `src/approval/contract.ts`.
The module has no imports, so it runs in the browser bundle and on the server without pulling a schema library or server code into the bundle.
The browser reads the payload with a plain function, and the server keeps its strict `zod` schema for the answer.
A contract test passes the payload that `factoryman_merge` builds through the reader, and passes every answer the builder makes through the schema, so the two sides cannot drift.
A lint rule keeps `src/app.tsx`, `src/app/`, and `src/approval/` free of Node built-ins, `zod`, `better-sqlite3`, the backend SDK, and the server layers.

### D-097: The form fails closed, and one `tsconfig.json` covers both sides (Gap)

The form fails closed in the view: a request that it cannot read (a missing field, a field of the wrong type, or an extra field) gets no Approve button, only Deny and Cancel.
A pull request value that is not an `http` or `https` URL shows as text and never as a link.
A rejected answer shows the error, re-enables the controls, and keeps the comment.
This is a second line only.
`factoryman_merge` still validates the answer and records the approval.
One `tsconfig.json` with the `DOM` library and the JSX transform type-checks both sides.
DOM globals therefore type-check in server code too, and the lint rule in D-096 is what keeps the browser side apart.

### D-098: The type check calls `tsc6` (Gap)

The pinned TypeScript is the alias `npm:@typescript/typescript6`, which installs the binary `tsc6` and no `tsc`.
The `typecheck` script called `tsc`, so `pnpm run check` passed only on a machine with a global `tsc` on the PATH.
The script now calls `tsc6`, and a test pins the script and the `check` script that runs it.
The first version of the test also checked that `node_modules/.bin/tsc6` exists.
The audit dropped that check, because it tests the install layout and not the feature.
`pnpm run check` fails without `tsc6` anyway.

### D-099: Seven guard tests came after their code (Deviation, accepted by the captain)

Constitution principle V says that every behavior change is driven by a test that failed first.
For seven behaviors the code existed before the test, so the TDD audit (`specs/008-merge-approval-form/tdd/verification.md`) classes them `TEST_AFTER`, and the rubric fails a feature for any `TEST_AFTER`.
They are `A1215` (the `tsconfig.json` change came with the tooling), `U1236`, `U1238`, `U1239`, and `A1212` (the markup that they guard came with the first version of the form), and `U1241` and `U1242` (the audit found two mutants that no test pinned).
All seven guard a property that the code already had.
None drove new code.
Each has a recorded revert-red in `tdd/cycle-log.md` (the property removed, the test failing with its failure line kept, the file restored) and at least one deliberate mutant that kills it.
The repository commits only on green, so the history cannot show a test before its code, and the order cannot be rewritten afterwards.
The audit's other checks are clean: no open `HIGH` smell, 45 of 45 hand-picked mutants killed, and every acceptance criterion covered.
The owner could accept the seven as a documented exception or ask for rework.
Reworking them would mean new history for tests that already fail when their property is removed, and the plan does not recommend it.
The captain accepted the seven as a recorded deviation, as for the earlier factoryman milestones, on 2026-11-08.
They are guard tests that fail against the code without the guard.
The note stays in `tdd/verification.md`.

### D-100: A harness is supported when it passes a conformance suite without a credential (Decided by the captain)

The captain accepted the five recommendations in section 8 of the harness-independence report, including D1 option A.
A harness is supported at a version when the real command-line tool, behind a scripted fake model and with no credential, passes the scenarios S1 to S9, S11, and S12 (tier 1.5).
Each funded harness also runs once with a real model (tier 2), which this feature does not do.
This feature builds the suite: the stub agent and the lab scripts under `tools/`, the runner (`pnpm run conformance`), the fake model server with three wire formats, one driver per harness, result files under `conformance/results/`, and the generated `docs/HARNESS-SUPPORT.md`.
`docs/CONFORMANCE.md` explains how to run it.
The plugin under `src/` did not change.

### D-101: A scenario check that waits for a report task is a known gap, and a known gap that passes fails the run (Deviation from the report)

The report's scenarios are written to the behavior that report tasks H1 to H5 will add: a readiness gate (S1), cause-bearing failure evidence (S7), and a supervisor start command with clear advice after a stamp (S9).
This feature builds none of H1 to H5, so those checks fail today, and the report's "passes S1 to S9, S11, and S12" cannot hold as written.
The suite keeps every scenario and gives each check an id.
`conformance/known-gaps.json` names a check, a harness or `*`, the report task that closes it, and the reason.
A failing check that the list names gives the verdict `known-gap` and does not fail the run.
A failing check that the list does not name fails the run.
A passing check that the list names fails the run, with the message to remove the entry, so a gap cannot outlive the work that closes it.
The generated support document shows a known gap as a gap with its task and never as a pass.
Today the list holds `S1.unready-blocks` and `S1.remedy` (H1), `S7.cause` (H3), `S9.start-command` (H4), and `S9.stamp-advice` for Codex and omp (H4).
The captain can ask for a different rule, for example to fail the run on a known gap, by editing the verdict function in `tools/conformance/verdict.ts`.

### D-102: The supervisor brain is the stub, and the harness is the supervisor only where that is the point (Gap)

Dispatching and reading state need a supervisor that never fails, so the stub supervisor (the "driver supervisor") calls `factoryman_dispatch` with an explicit profile, and the worker runs on the harness under test.
Three scenarios spawn a second supervisor on the harness: the supervisor half of S5, S9, and S12.
The stub and the fake model read the same directives from a prompt (`CALL <tool> <json>`, `SHELL <command>`, `SLEEP <ms>`) and the same behavior markers in a task description (`[brain:<flag>]`: `silent`, `empty-evidence`, `double-report`, `dirty`, `nocommit`, `blocked`, `hold`, `fail=<code>`, `pr=<url>`).
Assertions read the plugin's events and tasks, bb's thread log, the clone's git state, and the lab's process list.
One check reads a brain's own log: which plugin tools and skills a role was offered, because bb has no call for it.
No assertion reads model text.

### D-103: The lab builds the plugin with the network on and then runs offline (Finding, task H8)

bb 0.49.0 starts and serves its API with no network (`bblab up --offline`: the sandbox has its own network namespace with a loopback only; a connection to a public address failed with `ENETUNREACH`; the lab's bb answered on the loopback with HTTP 200).
It needs the network once, for one thing.
`bb plugin build` and `bb plugin install` install bb's build toolchain (`esbuild` and `tailwindcss`) with `npm install` into `<data dir>/plugins/toolchain-*` the first time.
Offline, that call retried for 4 minutes and failed with `EAI_AGAIN`.
The runner therefore copies the plugin (with `node_modules`) into the lab directory, builds it once with the pinned `bb` outside the sandbox with the network on and `BB_DATA_DIR` set to the lab's data directory, and then starts the lab offline.
After that, `bb plugin install` takes under two seconds offline.
The lab reset keeps the toolchain, so later runs do not need the network at all except to reinstall `bb-app` when the pin is missing.
Tier 1.5 runs offline by default, so a harness cannot reach a vendor by accident; `--no-offline` turns it off for debugging.
A `curl` inside the lab opens the canary `.ssh/known_hosts` and trips the tripwire, so the probes inside the lab use `node`.

### D-104: The tools run under Node's type stripping, with a second `tsconfig.json` (Gap)

The tools under `tools/` run directly with `node tools/conformance/cli.ts`, so there is no build step and no new dependency.
Node strips types, which needs `.ts` extensions in relative imports and no constructor parameter properties, enums, or namespaces.
`tools/tsconfig.json` extends the root config with `erasableSyntaxOnly`, and `pnpm run typecheck` runs both configs.
The root config cannot take `erasableSyntaxOnly`, because `src/` uses constructor parameter properties.
The tools import nothing from `src/` and nothing from `@get-bb/*`.
The stub agent and the fake model run inside the lab and import only Node modules.

### D-105: Five harness facts that the report's table did not show (Finding)

1. Claude Code sends the sandbox text, the deferred tool list, and the skill list as messages with the role `system` inside the `messages` array.
   A parser that reads only the `system` field sees no plugin tool and no skill.
   Claude Code also runs a tool call once per id and skips a repeated id.
2. Claude Code adds the user text `Tool loaded.` after a `ToolSearch` call, and a `<total_tokens>` reminder after every tool call.
3. Codex reports `unauthenticated` until `codex login status` succeeds, even with a custom model provider.
   The lab driver writes `~/.codex/auth.json` with the literal dummy key `mock-not-a-credential`, which makes it succeed.
   The key is a placeholder and not a credential.
4. omp in `accept-edits` asks for approval before a shell command (an `approval` interaction, `waiting_for_approval`), and a worker that cannot answer waits for ever.
   The driver uses `full`.
   A real omp worker in `accept-edits` stops at its first shell command, and the plugin then wakes the supervisor with the `interaction.pending` text.
5. omp never records a failed thread for a model error.
   For HTTP 401 and 404 it ends the turn normally after one request and shows the error as the assistant's text.
   For HTTP 500 and 429 it retries for about six minutes and then does the same.
   The plugin therefore sees a silent turn, and the supervisor learns of the error only by reading the worker's thread.
   The driver says `failure.mode: "ends-turn"`, and scenario S7 checks for the silent-turn wake on such a harness.

The drivers carry these facts.
A CLI upgrade that changes one fails a scenario, and the maintainer edits one driver.

### D-106: The isolation check ignores churn from other tools (Gap)

`bblab-evidence diff` compares the real machine before and after a run, and other agents work on the same machine at the same time.
The first Pi run reported `CHANGED: real-home file NAMES`, because another lane's `opencode` created `opencode.db-shm` and `opencode.db-wal`.
A check that fails on a busy machine is flaky.
`tools/conformance/isolation.ts` calls a run unclean for a `LEAK` line, a change to a credential or git config file, or a changed file name under the harness homes (`.pi`, `.omp`, `.codex`, `.claude`, `.ssh`, `.bb`), the bb machine homes (not their logs), `.config/{gh,git,systemd,bb,omp,pi}`, or any path with `bblab`.
It counts other changes and reports how many it ignored.
The tripwire report is printed and not judged: a harness opens its own credential file, which is a canary in the lab.

### D-107: Some tests came after their code, with a revert-red (Deviation, accepted by the captain)

Constitution principle V says that every behavior change is driven by a test that failed first.
The tier 1 and tier 1.5 live runs found defects that only a real lab shows, so several behaviors were first seen in a live run and then pinned with a test.
`specs/009-conformance-harness/tdd/cycle-log.md` lists them: the acceptance tests of the fake model server, the runner, and the document command (a revert-red was recorded for each), and U1422 (a recorded Claude Code request).
The real lab (`tools/conformance/real-lab.ts`) has no unit test. The live runs are its test, and the result files keep their output.
The captain accepted the 26 test-after behaviors as a recorded deviation on 2026-11-09, on the same precedent as D-099.
They are A1301 to A1306, A1308 to A1313, A1316 to A1321, A1324, A1326 to A1328, A1330, U1422, U1427, and U1428, each with a revert-red or a killing mutant in `tdd/cycle-log.md` and `tdd/verification.md`.

## Harness independence

### D-108: Harness independence: the scope and the captain's five decisions (Decided by the captain)

The scout report `data/bb-factoryman-harness-independence/report.md` of 2026-11-08 ran real Claude Code, Codex, Pi, and omp CLIs against a fake model in the isolated lab.
It found that the plugin already spawns on any bb provider.
The coupling to Claude Code sat in the plugin's assumptions: what "available" means, which harness is the silent default, how a model level is checked, and what a failure says.
The captain accepted all five recommendations of the report's section 8 on 2026-11-08:

- D1 A: a harness counts as supported when it passes tier 1.5 (S1 to S9, S11, S12) and, once, tier 2 (S3, S4, M1 to M4).
- D2 A: one dedicated OpenAI API key with a provider-side dollar cap funds tier 2 for Codex, Pi, and omp.
  The Claude run keeps the funding that D-092 records.
- D3 A: Pi workers are admitted in `direct-PR` and `no-mistakes` modes and refused in `local-only` until D-030 closes (D-111).
- D4 B: the plugin picks the worker's harness, a person picks the supervisor's, and the validator's agent is observed and readiness-checked and never written.
- D5 A: the built-in default profile is removed, and dispatch blocks with a `dispatch init` hint (D-112).

This release builds six tasks of the report's section 7: H5 (the contract table), H1 (the readiness gate), H11 (the permission floor), H10 (the default profile), H2 (model-aware checks), and H3 (cause-bearing failure evidence).
The tasks H4 (`supervisor start`), H6 to H9 (the conformance suite, the fake model server, the offline lab, and the docs rewrite), H12 (the `roles` block), H13 (the tier 2 runs), and H14 (a worker hint that is on) stay open.
D1, D2, and D4 are recorded here and not built, because they gate H4, H7, H9, H12, and H13.
No hard rule changes.
The constitution lists milestones 1 to 11 as its scope.
The captain's task extends that scope, as D-068 did, and this release leaves the constitution text as it is.
Amended by D-117: the captain ordered the constitution amended on 2026-11-09, so the sentence above no longer holds.

### D-109: Readiness comes from bb's provider states, and it fails closed (Gap)

`available` in `bb provider list` means that the CLI is installed.
It does not mean that the CLI is signed in.
The report saw Codex `available: true` and `unauthenticated`, and the live check (t01 finding 5.9) saw `claude-code` available with no CLI.
Dispatch, the queue start, and the remote preflight now pass a provider only when `bb.sdk.system.providerStates` reports `ready` on the host that runs the worker.
Every other status blocks: `not_installed`, `unauthenticated`, `expired`, `unsupported_version`, and `unknown`.
A provider with no state, a status that the plugin does not know, and a failed read block too.
The block message names the provider, the host, and bb's status, and it carries bb's login command or the installed and minimum versions.
One function, `gateProfile`, applies the check for dispatch and for the queue start, so no path to a spawn skips it.
The preflight reuses the same text for a remote machine.
A blocked dispatch creates no task and uses no slot of the day cap.
This closes t01 finding 5.9.
One point stays open for the live check: a custom ACP agent that `providerStates` omits is blocked, and the tier 1 stub agent may be one.
If bb omits ACP agents, the follow-up is an explicit opt-in in the contract table, and not a default that passes.

### D-110: The harness contract table is data, and it has five columns the report did not list (Deviation from the report, section 6.2)

`src/harness/contracts.ts` holds one row for `claude-code`, `codex`, `pi`, and `acp-omp`, and a generic row for every other provider.
The module imports nothing, and lint enforces that.
The lookup matches the provider ID exactly and returns the generic row for anything else, including inherited object keys such as `constructor`.
The values come from the report's table and were observed with bb 0.49.0.
The table adds five columns that the report did not list, each for a stated reason:

- `unlistedModels`: the report's rule R4 says "the model is listed or the provider accepts unlisted ids", and that fact needs a home.
  Claude Code and Codex accept, and every other row refuses.
- `sandbox`, `refusedModes`, and `refusalReason`: H11 records Pi's `full`-only policy as a contract rule, and the admission message needs the reason.
- `toolHint`: the one-line hint for a worker, for the two routes that are not a plain function.

`bb.agents.configure` now reads `context.provider.id`.
It returns the hint in `instructions` only for a worker thread on a provider whose row has one, and only when the plugin runs with `toolHints` on.
The option is off by default and sits on the composition root, not in the owner's config, because task H14 decides whether a real model needs the hint.
The hint is a constant of the table, so no thread metadata enters it.

### D-111: Pi is admitted in `direct-PR` and `no-mistakes` modes and refused in `local-only` (Decided by the captain, D3 A)

Pi offers only the `full` permission mode.
A Pi worker therefore has no sandbox, and it can run `bb thread interactions respond`, which answers the owner's merge form (D-030, D-095).
In `direct-PR` and `no-mistakes` modes, branch protection and scoped tokens are the backstop (`docs/BRANCH-PROTECTION.md`).
`local-only` mode has no such backstop.
Dispatch refuses a profile whose provider's row lists the project's effective delivery mode in `refusedModes`, with the code `provider_not_admitted`.
The check runs first, from the table alone, and it applies to every profile source and to the queue start.
At the queue start a refusal fails the task with evidence, because it cannot change, and every other block keeps the task queued.
The rule keys on the delivery mode, as the captain's decision words it, so a scout task on Pi in a `local-only` project is refused too.
The captain can relax that later.
Nothing falls back to another provider.
D-030 and D-095 stay open, and Pi returns to `local-only` mode when the approval-form work closes the agent-answer route.

The rule keys on the bb provider ID `pi`, because the captain's decision D3 names Pi only.
A harness that runs Pi behind another provider ID, such as an ACP registry entry, gets the generic row.
The generic row has `sandbox: "unknown"` and no refused mode, so that provider is admitted in `local-only` mode.
The captain kept the rule as built (2026-11-08): a harness behind another provider ID gets its own contract row, with its sandbox and refused modes, when someone admits it.
The readiness and model checks still judge such a provider until then.

### D-112: The built-in default profile is removed, and `dispatch init` writes a starter file (Decided by the captain, D5 A)

This amends D-063.
`BUILTIN_PROFILE` is gone, and so is the `builtin` profile source.
When no override, no matching rule, and no `default` apply, the resolver blocks with the code `no_default_profile`.
The message says to run `bb factoryman dispatch init --provider <id>`, to set `default` in `dispatch.json`, or to pass `profile`.
A project that relied on the built-in default now blocks until its owner does one of those.
`bb factoryman dispatch init --provider <id> [--project <id>] [--model <id>] [--level <id>] [--mode <mode>]` writes `.bb/factoryman/dispatch.json` with one profile and `default` set to it.
The model is bb's default model for the provider, the level is the model's default level (then `medium`, then the first listed), and the mode is `auto`, then `accept-edits`, then `full`.
A flag replaces a value, and the command checks the final profile against what bb lists before it writes.
It does not check readiness, because a starter file does not need a ready provider, and dispatch checks readiness each time.
This is the first time the plugin writes into a project checkout.
The write is an exclusive create, so the command never changes an existing file, valid or not.
The command is not a tool, so a supervisor agent cannot call it, and it reads and writes no credential.
`docs/DESIGN.md` and `docs/LIVE-CHECK.md` no longer name a built-in default.
The test world supplies the old built-in profile as a default `dispatch.json` where a checkout has none (see D-115), so tests of other behavior keep their meaning.

### D-113: Reasoning ladders are per provider (Gap)

This amends D-064.
Level IDs belong to one provider (spike item 29), so one ladder cannot rank Claude's `ultracode` and Codex's `ultra`.
`reasoningLevels` in `dispatch.json` accepts either an array, which applies to every provider as before, or a record from provider ID to its own array.
A key must not be blank, an array must not be empty, and no array may repeat a level.
The resolver ranks the explicit profile's level and the baseline's level in the ladder of the explicit profile's provider.
A provider that the record omits uses the default ladder.
A baseline level that is not on that ladder cannot be ranked, so it still blocks with `reasoning_lowered` unless the owner grants `standingPermission.lowerReasoning`.
That keeps the rule fail closed for a comparison across providers.
`ladderFor` and the default ladder sit in `src/dispatch/types.ts`, which has no imports, because test A718 keeps the resolver pure.

### D-114: Model checks read bb's per-model list, and an unlisted model follows the row (Gap)

bb lists reasoning levels for each model, and the provider-wide list is only a coarse ladder.
When bb lists the model and knows its levels, the model's levels decide.
That lets omp's `off` pass and refuses a level that the model lacks.
When bb does not know the model's levels, the provider-wide list decides, as before.
When bb does not list the model, the row decides: Claude Code and Codex accept it and use the provider-wide list, and every other provider refuses it and lists the models that bb offers.
If bb gives a load error, such as `auth_required` for Pi without a login, the message adds it.
A profile's model matches a listed model by its `id` or by its `model` name, because the scout did not settle which field a spawn resolves.
The live check settles it.
A failed read of the model list blocks the dispatch.

### D-115: Failure evidence quotes the provider's cause, and some existing tests changed (Gap)

When a worker thread fails, the plugin reads the latest `provider/error` or `system/error` event of its log through `bb.sdk.threads.events.list`.
The `detail` of that event, or its `message` when there is no detail, goes into the `fail` evidence after the text that the plugin already wrote.
The cause is the provider's own text, so the plugin removes control characters, collapses spaces, cuts it to 300 characters, and quotes it as reported text.
When the cause means "not signed in" or "no model", the evidence adds a `Remedy:` line.
The patterns are advisory and check the model family first, because an omp no-model message also says "/login".
A miss costs the hint and nothing else, and the remedy never replaces the cause.
A failed read leaves today's evidence and logs a warning.
The wake message for a `failed` task keeps 1200 characters of evidence instead of 600, so the cause and the remedy survive.
Existing tests changed only where a requirement changed what they assert (precedent: D-067):

- `src/dispatch/availability.test.ts`: the call moved to the facts object, with the assertions unchanged (group 3).
- `test/acceptance/dispatch-resolver.test.ts`: [A710] expects the readiness text for an unavailable or unlisted provider, and a model with unknown levels for the level case (groups 3 and 5); [A706] and [A713] expect the block instead of the built-in profile, and [A717] names a configured default (group 6).
- `src/dispatch/resolver.test.ts`: [U710] and [U726] changed their titles, [U717] was replaced by the opposite assertion U1408, and [U811] lost its `builtin` line (group 6).
- `test/acceptance/limits-queue.test.ts` [A1025] and [A1026]: the project's `dispatch.json` gained a `default` (group 6).
- `test/acceptance/machine-placement.test.ts` [A826]: the call names a profile (group 6).
- `src/dispatch/gate.test.ts` and `test/acceptance/harness-admission.test.ts`: Pi's model is listed in bb, because Pi refuses an unlisted model (group 5).

The suite relied on the built-in profile in many acceptance tests.
`loadWorld` now supplies that profile as a default `dispatch.json` (with `standingPermission.lowerReasoning` on, because the built-in set no floor) wherever a checkout has none.
A test that wants the real block passes `bareConfig: true`.

### D-116: 71 behaviors came after their code (Deviation, accepted by the captain)

Constitution principle V says that every behavior change is driven by a test that failed first.
The TDD audit of this feature (`specs/009-harness-independence/tdd/verification.md`) classes 71 of its 223 behaviors `TEST_AFTER`, because no red is recorded for them.
Two groups make up the 71.
Forty-two are acceptance tests written after the code they cover, and each passed on its first run: A1301 to A1311, A1313, A1316 to A1344, and A1350.
The playbook opens the outer loop first.
This feature wrote the unit tests and the code first, and wrote five of the seven acceptance files afterwards.
Twenty-nine are unit tests that passed on their first run: U1306, U1307, U1312, U1315, U1316, U1336, U1346, U1357, U1359 to U1362, U1368, U1376 to U1378, U1383 to U1385, U1389, U1391, U1395, U1396, U1407, U1445, U1447, U1455, U1469, and U1473.
Most of them pin a behavior that was already true against the stub or the old code (the hint stays off, a ready provider passes, Pi stays admitted in the other two modes).
The repository commits only on green (D-099), so the history cannot show a test before its code, and the order cannot be rewritten afterwards.
In place of a red, `tdd/cycle-log.md` holds a revert-red ledger: 58 deliberate mutants of the production code, each applied alone and restored byte for byte, and for every one of the 71 behaviors at least one mutant that makes its test fail.
No mutant survived, and no mutant sits inside a behavior that the audit marks `DONE`.
The audit's other blocking findings were repaired in tasks T1399 to T1401: a vacuous assertion in the docs test, two expectations computed by the code under test, and fifteen `BASELINE` behaviors that tasks had ticked.
The count here is about ten times the seven of D-099.
The captain accepted the 71 as a recorded deviation, as for the earlier factoryman milestones (D-099), on 2026-11-08.
Each is a guard that fails when its property is removed, and the ledger holds the killing mutant of each.
The audit did not recommend the rework, and the captain did not order it.
The pull request description names the ledger.
The audit's verdict stays `FAIL` as the rubric computes it, because an auditor does not accept an exception, and the note stays in `tdd/verification.md`.

### D-117: Constitution 1.3.0 adds harness independence to the scope (Decided by the captain)

Principle VI listed milestones 1 to 11 as the scope.
D-108 extended it by the captain's task and left the text as it was, as D-068 did.
The analysis of this feature raised the open question as finding C2, because Governance says that an amendment needs a written reason here and a version bump there.
The captain ordered the amendment on 2026-11-09 ("bump the rules").
Constitution version 1.3.0 adds one scope line to Principle VI.
The line names harness independence: the report tasks H5 (the contract table), H1 (the readiness gate), H11 (the permission floor), H2 (model-aware checks), H10 (no built-in default profile, and `dispatch init`), and H3 (cause-bearing failure evidence), and the captain's decisions D1 to D5 in section 8 of the harness-independence report.
It is a minor bump, because it materially expands the scope guidance and adds no principle.
The rest of Principle VI is unchanged, including the rule that features from the design's non-goals list need approval first, and so are the eight hard rules.
The "Current scope" text of `CLAUDE.md` is not part of this amendment.
D-108 keeps its text and carries an "Amended by D-117" line, as D-063 and D-064 do.
Finding C2 of `specs/009-harness-independence/analyze.md` is resolved.

About the number: this entry takes D-117, the next free number after D-116, on purpose.
The default branch already holds the entries 100 to 107 of another feature (the conformance harness).
When this branch was rebased onto it, the nine entries of the "Harness independence" section above were renumbered from the numbers 100 to 108 to the numbers 108 to 116, in order, with every reference to them in code comments, docs, and specs.
This entry kept D-117 so that it did not collide with that renumbering.

## Conformance follow-up

### D-118: A driver names the delivery mode of its lab project, and S4 follows it (Gap)

The live check of the two merged pull requests found that the Pi conformance run fails every scenario that needs a task.
The runner wrote every lab project as `local-only`, and the plugin refuses Pi there (D-111).
The report offered two repairs for S4: run the ship scenario in `direct-PR` for Pi, or assert Pi's refusal.
This follow-up takes the first.
The `Driver` interface in `tools/conformance/drivers/types.ts` gets an optional `deliveryMode`, and a driver that names none gets `local-only`, so Claude Code, Codex, omp, and the stub keep their projects.
The Pi driver names `direct-PR`, which needs only a pull request URL, where `no-mistakes` needs a validator run that the lab does not have.
A command-line option would have let a maintainer ask for a combination that the plugin refuses, so the mode is a property of the driver and not of the run.
S4 reads the mode.
In `direct-PR` the scripted worker reports a made-up pull request URL (the plugin checks that the URL is valid and calls no forge), S4 asserts the same three facts as before, and `S4.review-ready` carries a note that names the mode.
The support document shows the note, and the scenario is named "Ship", so no row claims `local-only` for a harness that ran in another mode.
S4 for a `no-mistakes` driver fails with a message, because no driver uses that mode and the lab has no validator.
Pi's refusal in `local-only` stays proven by the admission tests of the gate (`test/acceptance/harness-admission.test.ts`) and by the live check.
The fake lab in `test/fixtures/conformance-lab.ts` now reads the real contract table, so a driver that names a refused mode fails in the unit tests as it fails in a real lab.

### D-119: The omp driver asks for the reasoning level `auto` (Gap)

The plugin compares a profile's reasoning level with the model's own list (D-113, D-114).
bb lists `off` and `auto` for the omp lab model, and the omp driver asked for `low`, so every omp dispatch was refused.
The driver now asks for `auto`, the level that leaves the choice to omp.
`off` would also pass.
The unsupported profile of omp still differs from its profile in the permission mode only (`auto`, which omp does not offer), so S2 still tests the permission gate and not the level gate.
The fake lab lists the same two levels for omp and refuses any other.

### D-120: The decision numbers were already unique on master, so the follow-up adds a guard and renumbers nothing (Finding)

The live check merged the two pull requests in a scratch tree and found eight duplicate numbers, D-100 to D-107.
Pull request 6 landed first, and pull request 5 was rebased onto it and renumbered its entries (D-117 records this).
On master the log holds one heading for each number from D-001 to D-117, and every `D-nnn` in a tracked file names a heading.
The citations of D-100 to D-107 in `specs/009-conformance-harness/` fit their entries, and the citations of D-108 to D-117 in the code, the docs, and `specs/009-harness-independence/` fit theirs.
A renumbering would have broken the citations that are right.
`test/acceptance/decision-log.test.ts` now fails when a number has two headings or when a tracked file cites a number that has no heading, so a collision cannot return unseen.
The test checks that a number exists, not that its meaning fits, so the manual check above stays a review step.

### D-121: Each test file gets its own temporary directory and removes it (Gap)

The fake plugin host makes a directory named `bb-fake-plugin-host-*` for each host and removes it only in `dispose`.
Most test worlds never disposed their host, so one `pnpm run check` left about 394 directories, and lanes that share a user account filled the per-user quota of `/tmp` (about 52,000 directories at the time of the live check).
Every shell command of every worker on the machine then failed.
The options were: dispose each world in an `afterEach` (misses the tests that call `createFakePluginHost` directly, and every future one), wrap the SDK function with a module mock (covers all callers but hides the SDK behind a mock), or give each test file a private temporary directory.
This follow-up takes the third.
`test/setup/private-tmpdir.setup.ts` is a `vitest` setup file that calls `createPrivateTmpdir` (in `test/setup/private-tmpdir.ts`), which makes a directory under the current temporary directory and points `TMPDIR` at it before the test file loads.
The setup file removes the directory after the file, whether its tests pass, fail, or time out.
`os.tmpdir()` reads `TMPDIR` on each call, so the SDK's `mkdtempSync` lands inside it, for `loadWorld`, for a direct `createFakePluginHost`, and for any test that comes later.
It removes only the directory it made, and it does not delete directories that earlier runs leaked.
One full run of the suite left 394 `bb-fake-plugin-host-*` directories before the change and none after it.
`test/acceptance/tmpdir-leak.test.ts` proves it in a child `vitest` process with a private `TMPDIR`, because the cleanup runs after the test file and cannot be seen from inside it.

### D-122: Eleven behaviors came after their behavior, with killing mutants (Deviation, accepted by the captain)

Constitution principle V says that every behavior change is driven by a test that failed first.
The TDD audit of this feature (`specs/010-conformance-followup/tdd/verification.md`) classes four of its 43 behaviors `TEST_AFTER`, because no red is recorded for them.
Each passed on its first run, because the behavior was already true when the test was written.
The seven behaviors that the audit's remediation added (U1530 to U1535 and A1515) are in the same class: each describes code that already worked, passed on its first run, and has a mutant that fails it, so the count is eleven.
U1506 pins that the omp unsupported profile differs from its profile in the permission mode only, which the driver already had.
U1509 pins that S4 in `local-only` sends no pull request, which was the old path.
U1529 pins that every harness driver's mode is admitted by its contract, which was true once Pi named `direct-PR`.
A1509 pins that the decision log has no duplicate number, which was already true on master.
In place of a red, `tdd/cycle-log.md` records a killing mutant for each: the omp unsupported profile with a second differing key (U1506), the S4 scenario that always sends `pr=` (U1509, killed once the fake lab refused that report in `local-only`), Pi set to `local-only` (U1529), and a second heading with an existing number (A1509).
The repository commits only at green (D-099), so the history cannot show a test before its code in any case.
The audit's rule fails the feature for this, and the same position was taken for the earlier features (D-107 and D-116).
The seven of the remediation are pinned by the mutants that the audit found alive: the fake lab's `local-only` rule, the columns of the project row, the root config's setup file, the fake lab's wording of a blocked profile, the empty `TMPDIR`, the restore guard, and the heading pattern of the guard.
The captain accepted the eleven as a recorded deviation on 2026-11-09, on the same precedent as the earlier factoryman milestones (D-099, D-107, and D-116), with their killing mutants in `tdd/cycle-log.md` as the evidence.
The pull request description names the eleven behaviors.
