# Feature specification: Agent-harness independence

**Feature branch**: `fm/bb-factoryman-harness-contracts`

**Created**: 2026-11-08

**Status**: Approved (scope fixed by the captain's intent for this task)

**Input**: The scout report `data/bb-factoryman-harness-independence/report.md` in the firstmate home audited how tightly the plugin couples to Claude Code.
It ran real Claude Code, Codex, Pi, and omp CLIs against a fake model and found that the plugin spawns on any harness, but it trusts one signal ("available") that does not mean "signed in", it names Claude as the silent default, it drops the cause of a worker failure, and it ranks reasoning levels on one ladder for every harness.
The captain accepted all five recommendations of the report's section 8: D1 A, D2 A, D3 A (Pi is admitted only in `direct-PR` and `no-mistakes` modes, and `local-only` is refused until D-030 closes), D4 B, and D5 A (remove the built-in Claude default profile and block with a `dispatch init` hint).
This feature builds six of the report's tasks (section 7), in dependency order: H5 and H1 first, then H11, H10, H2, and H3.
Together they make the plugin harness independent for Claude Code, Pi, omp, and Codex.

## User scenarios and testing

The people who use this feature are the owner, who installs the plugin and decides which harness runs the work, and the supervisor agent, which dispatches tasks and reads the plugin's answers.
The feature has no screen.
Its real entry points are the `factoryman_dispatch` tool, the `bb factoryman` command line, the `bb.agents.configure` callback that bb calls for every thread, and the `thread.failed` event that bb sends to the plugin.
The bb facts it depends on are `bb.sdk.system.providerStates`, `bb.sdk.providers.models`, and `bb.sdk.threads.events.list` in `@get-bb/plugin-sdk` 0.6.104, and the `instructions` field that `bb.agents.configure` may return.
The tests drive these entry points through the fake plugin host and the fake bb port.
No test spends money, reads a credential, or starts a real model.

### User story 1 - A harness that cannot run is refused before a task exists (priority: P1)

The supervisor dispatches a task whose profile names a harness that is installed but signed out, missing, expired, or too old.
Today the task is created, the worker spawns, and it fails a moment later with a generic reason that burns one slot of the day cap.
After this feature, the dispatch is refused up front with bb's own remedy, and nothing is created.

**Why this priority**: This is the failure the owner hits first on any harness that is not Claude Code.
The live check (t01 finding 5.9) saw `claude-code` "available" with no CLI.
Hard rule 8 says nothing fails open.

**Independent test**: Script the fake bb so that each harness state is not `ready`, dispatch, and check the answer, the task count, and the spawn count.

**Acceptance scenarios**:

1. **Given** the profile's provider is `unauthenticated`, **When** the supervisor dispatches, **Then** the dispatch is blocked with code `provider_unavailable`, the message names the provider, the host, and bb's login command (for example `codex login`), and no task is created and no worker spawns.
   (AC-1.1)
2. **Given** the provider is `not_installed` or `expired`, **Then** the dispatch is blocked the same way, and the message says what bb reports.
   (AC-1.2)
3. **Given** the provider is `unsupported_version`, **Then** the dispatch is blocked and the message shows the installed version and the minimum supported version.
   (AC-1.3)
4. **Given** bb reports the status `unknown`, or reports no state for the provider, or the read of the states fails, **Then** the dispatch is blocked and no task is created.
   (AC-1.4)
5. **Given** the task is pinned to a remote machine, **Then** the readiness check uses that machine's own provider states, and a provider that is ready on the server but not ready on the machine is blocked.
   (AC-1.5)
6. **Given** a remote machine's preflight, **Then** its agent CLI check uses the same states and the same remedy text, so `bb factoryman preflight` and dispatch agree.
   (AC-1.6)
7. **Given** a queued task whose provider is no longer ready when a slot frees, **Then** the task stays queued and the plugin logs why, and it never starts the worker.
   (AC-1.7)
8. **Given** every state is `ready`, **Then** dispatch proceeds as before.
   (AC-1.8)

### User story 2 - The plugin knows each harness's facts in one pinned table (priority: P1)

A maintainer, or a later feature, needs to know how a harness behaves: which permission modes it offers, how the model sees the report tool, when a role change takes effect, and whether it can run without a sandbox.
Today those facts sit in a report and in the heads of the people who ran the labs.
After this feature, one data table holds them, tests pin it, and the plugin can read the provider of the thread it configures.

**Why this priority**: The Pi admission rule (story 3) and the model checks (story 5) read this table, so it comes first.
A CLI upgrade that changes a fact must fail a test and not a task.

**Independent test**: Read the table through its lookup function for the four harnesses and for an unknown provider, and call the registered `bb.agents.configure` callback for a worker, a supervisor, and an unroled thread on each provider.

**Acceptance scenarios**:

1. **Given** the provider IDs `claude-code`, `codex`, `pi`, and `acp-omp`, **When** the table is read, **Then** each returns its own row with the values in the report's section 6.2, and a test pins every value.
   (AC-2.1)
2. **Given** any other provider ID, including `acp-opencode` and an ID the plugin has never heard of, **Then** the lookup returns the generic row, never throws, and never returns another harness's row.
   (AC-2.2)
3. **Given** the table module, **Then** it imports nothing from bb, nothing from Node, and nothing from the rest of the plugin, and a lint rule keeps it that way.
   (AC-2.3)
4. **Given** the tool hint is off (the default), **When** bb calls `bb.agents.configure` for any role on any provider, **Then** the answer holds exactly the tools and skills it holds today and no `instructions`.
   (AC-2.4)
5. **Given** the tool hint is on, **When** bb configures a worker thread on a provider whose tool route is not a plain function (Claude Code, omp), **Then** the answer also holds a one-line hint built from the table.
   (AC-2.5)
6. **Given** the hint is on, **Then** a worker on a plain-function provider (Codex, Pi), a supervisor, and an unroled thread get no hint, and the hint text never contains a value from the thread's metadata.
   (AC-2.6)

### User story 3 - Pi runs only where branch protection is the backstop (priority: P1)

Pi offers only the `full` permission mode, so a Pi worker has no sandbox and can run any `bb` command, including the answer to the merge approval form (D-030).
The captain decided to allow Pi in `direct-PR` and `no-mistakes` modes, where branch protection and scoped tokens are the backstop (`docs/BRANCH-PROTECTION.md`), and to refuse it in `local-only` mode until D-030 closes.

**Why this priority**: Hard rule 1 says a merge needs a recorded approval.
In `local-only` mode there is no forge backstop, so a worker that can answer its own approval form defeats the gate.

**Independent test**: Dispatch a Pi profile in each of the three delivery modes and check the answer.

**Acceptance scenarios**:

1. **Given** a `local-only` project and a profile on `pi`, **When** the supervisor dispatches, **Then** the dispatch is blocked with a message that names Pi, the mode, the reason (no sandbox, the answer route of D-030), and the modes where Pi is allowed, and no task is created.
   (AC-3.1)
2. **Given** a `direct-PR` project or a `no-mistakes` project and a ready Pi profile in mode `full`, **Then** the dispatch proceeds.
   (AC-3.2)
3. **Given** the Pi profile comes from an explicit override, a matching rule, or the configured default, **Then** the refusal in `local-only` mode is the same.
   (AC-3.3)
4. **Given** a provider other than Pi, **Then** this refusal never applies, and a provider that is not in the table is judged by the readiness and mode checks alone.
   (AC-3.4)
5. **Given** a queued task, **Then** the same refusal applies when its slot frees, and a task that is refused there fails with evidence instead of waiting forever.
   (AC-3.5)
6. **Given** a Pi profile in `local-only` mode, **Then** the refusal does not fall back to another provider.
   (AC-3.6)

### User story 4 - No harness is chosen silently (priority: P1)

A project with no `dispatch.json`, or a file with no `default`, used to run on Claude Code (D-063).
On a machine without Claude it blocked, but the owner was never asked which harness they want, and the built-in `auto` mode does not exist on Pi or omp.
After this feature, the plugin has no built-in profile.
It blocks and tells the owner to run one command, which writes a starter file.

**Why this priority**: The default is the one choice that touches every project, and the captain wants no silent harness.

**Independent test**: Dispatch in a project with no config and check the block; run `bb factoryman dispatch init --provider <id>` against a temporary checkout; dispatch again.

**Acceptance scenarios**:

1. **Given** no override, no matching rule, and no configured `default`, **When** the supervisor dispatches, **Then** the dispatch is blocked, the message says no profile was chosen and says to run `bb factoryman dispatch init --provider <id>` or to set `default` in `dispatch.json`, and no task is created.
   (AC-4.1)
2. **Given** an explicit `profile`, a matching `rule`, or a configured `default`, **Then** the choice resolves exactly as before, in the same order.
   (AC-4.2)
3. **Given** a project checkout with no `dispatch.json`, **When** the owner runs `bb factoryman dispatch init --provider codex --project <id>`, **Then** the command writes `.bb/factoryman/dispatch.json` with one profile on that provider, built from what bb lists for it, sets that profile as the `default`, and prints the path and the profile.
   (AC-4.3)
4. **Given** the file the command wrote, **Then** the plugin's own parser accepts it, and the next dispatch in that project resolves to the profile (source: the configured default).
   (AC-4.4)
5. **Given** a `dispatch.json` already exists, valid or not, **When** the command runs, **Then** it writes nothing, leaves the file as it was, and says so.
   (AC-4.5)
6. **Given** the provider is unknown to bb, the checkout is unknown, bb lists no model for the provider and the owner passed no model, or a flag is missing, **Then** the command exits with a clear message and writes nothing.
   (AC-4.6)
7. **Given** `--model`, `--level`, or `--mode` flags, **Then** they replace the values taken from bb, and the file is checked against what bb lists before it is written.
   (AC-4.7)
8. **Given** the command, **Then** it reads and writes no credential and changes nothing in bb.
   (AC-4.8)

### User story 5 - A model and a reasoning level are checked against the model bb lists (priority: P2)

The plugin compares a profile's reasoning level with a list that bb gives per provider, but bb lists levels per model.
A level that the model does list (omp `off`) is blocked, and a level that the model does not list passes.
Claude Code's `ultracode` and Codex's `ultra` are off the default ladder, so ranking them blocks with "cannot be ranked".
A model id that the harness cannot resolve fails only after the spawn (Pi: "Failed to resolve Pi model").

**Why this priority**: These checks turn late, generic failures into early, specific ones.
They do not guard an authority gate, so they follow stories 1 to 4.

**Independent test**: Script the fake bb with the model lists from the report, dispatch the four cases, and check the answer.

**Acceptance scenarios**:

1. **Given** a profile on omp with level `off`, and a model whose supported levels include `off` while the provider-wide list does not, **Then** the dispatch passes the level check.
   (AC-5.1)
2. **Given** a level that the named model does not list, **Then** the dispatch is blocked and the message names the model and lists the levels it supports.
   (AC-5.2)
3. **Given** a model that bb does not list for the provider, and a provider whose contract refuses unlisted models (Pi, omp, and any other), **Then** the dispatch is blocked and the message lists the models bb offers, or says that bb lists none.
   (AC-5.3)
4. **Given** a model that bb does not list, and a provider whose contract accepts unlisted models (Claude Code, Codex), **Then** the level is checked against the provider-wide list, as it is today.
   (AC-5.4)
5. **Given** the model's level discovery is `unknown`, **Then** the level is checked against the provider-wide list.
   (AC-5.5)
6. **Given** `reasoningLevels` in `dispatch.json` is an array, **Then** it behaves as it does today for every provider.
   (AC-5.6)
7. **Given** `reasoningLevels` is a record keyed by provider ID, and the config holds a Codex ladder that ends in `ultra`, **When** an explicit Codex profile at `ultra` or below `ultra` is compared with a baseline at `high`, **Then** both levels are ranked in the Codex ladder, so `ultra` passes and a lowered level blocks with `reasoning_lowered` and not with "cannot be ranked".
   (AC-5.7)
8. **Given** a provider with no entry in the record, **Then** the default ladder applies.
   (AC-5.8)
9. **Given** bb cannot answer the model list, **Then** the dispatch is blocked and no task is created.
   (AC-5.9)

### User story 6 - A failed worker says why (priority: P2)

A worker's harness fails to start: Claude Code is "Not logged in", omp has "No model selected", Pi cannot "resolve Pi model", Codex gets HTTP 401.
bb's thread log holds the cause text, but the plugin reads only the `thread.failed` error and the `turn.failed` category.
The task fails with "provider error (category unknown, HTTP unknown)", and the supervisor cannot tell the owner what to fix.

**Why this priority**: It is the only thing the owner sees when a worker fails on a harness that is not Claude.

**Independent test**: Replay the four failure shapes from the report's section 5.1 through the event handlers, and read the task's `fail` evidence and the wake message.

**Acceptance scenarios**:

1. **Given** a worker task in `working` whose thread fails, **When** bb's thread log holds a `provider/error` or `system/error` event with a `detail`, **Then** the `fail` evidence contains the latest such detail, unchanged, after the evidence the plugin already wrote.
   (AC-6.1)
2. **Given** the four causes in the report ("Not logged in · Please run /login", "Internal error: No model selected. Use /login, set an API key ...", "Failed to resolve Pi model ...", and the Codex 401 with category `connection-failed`), **Then** each appears in the evidence verbatim.
   (AC-6.2)
3. **Given** the failure, **Then** the wake message to the supervisor carries the same cause, and it survives the wake message's length limit.
   (AC-6.3)
4. **Given** a cause that means "not signed in" (a login prompt, HTTP 401, or an unauthorized category) or "no model" (no model selected, cannot resolve the model), **Then** the evidence adds a remedy line that says what to do, and the remedy never replaces the cause.
   (AC-6.4)
5. **Given** the log holds no such event, or the read fails, **Then** the evidence is what it is today, the failure still records, and the plugin logs the read problem.
   (AC-6.5)
6. **Given** a very long detail, or a detail with control characters or line breaks, **Then** the plugin bounds it and strips the control characters, and quotes it as text that the provider reported.
   (AC-6.6)

### User story 7 - The decision record matches the code (priority: P2)

The owner reads `docs/DECISIONS.md` to learn why the plugin behaves as it does.
After this feature, it records the harness-independence decisions and the change to D-063.

**Why this priority**: Every deviation from the design is recorded with its reason (constitution, principle VI).

**Independent test**: Read `docs/DECISIONS.md` for the new entries and for the amended D-063 and D-064.

**Acceptance scenarios**:

1. **Given** `docs/DECISIONS.md`, **Then** it holds an entry for each of the captain's five decisions (D1 to D5), says which task each unlocks, and says which tasks this release builds and which stay open.
   (AC-7.1)
2. **Given** D-063, **Then** it says it is amended, says what replaced it, and keeps its original text.
   (AC-7.2)
3. **Given** D-064, **Then** it records the per-provider ladder.
   (AC-7.3)
4. **Given** the docs, **Then** no text still says that the plugin has a built-in default profile.
   (AC-7.4)

### Edge cases

- A machine pinned to an offline machine still blocks first (hard rule 5), before any provider check.
- A provider that bb lists as available but reports no state for blocks, and a provider with a ready state that bb does not list blocks.
- The queue start path runs the same checks as dispatch, so no path to a spawn skips a gate (hard rule 8).
- A project that relied on the built-in default now blocks on the last rung until the owner runs `dispatch init` or sets `default`.
  The block message says exactly that.
- The `dispatch init` flags are validated like the file fields: a blank value is refused.
- Two `dispatch init` runs race: the second finds the file and writes nothing (exclusive create).
- A `thread.failed` event arrives for a thread whose events are not yet written: the existing grace wait applies, and the plugin reads once after it.
- A provider error event carries a `message` and no `detail`: the evidence uses the `message`.
- The thread log holds many error events: only the latest `provider/error` or `system/error` event counts.
- A `workflow.json` can tighten the project's delivery mode (D-078): the Pi refusal reads the effective mode.
- A scout task in a `local-only` project on Pi is refused too.
  The rule keys on the delivery mode, as the captain's decision words it.

## Requirements

### Harness contract table (H5)

- **FR-1301**: The plugin MUST hold one row per harness in a data module at `src/harness/contracts.ts`, for `claude-code`, `codex`, `pi`, and `acp-omp`, plus a generic row for every other provider ID.
  The module MUST NOT import `@get-bb/*`, `node:*`, or any other plugin module.
- **FR-1302**: A row MUST record the provider ID, the CLI and bb versions it was tested with, the worker permission modes bb offered, the tool route, the skill delivery, when a role change takes effect, the sources of the failure cause, the failure latency, the steer strategy, the cost reporting, whether the harness accepts model IDs that bb does not list, and the sandbox floor (story 3).
  The values for the four named harnesses MUST equal the report's section 6.2.
- **FR-1303**: A lookup by provider ID MUST return the matching row, and the generic row for an unknown ID.
  It MUST NOT throw.
- **FR-1304**: A test MUST pin every value of every row, so a change to a fact is a deliberate edit.
- **FR-1305**: The `bb.agents.configure` callback MUST read `context.provider.id` and look up the row.
  With the tool hint off, it MUST return exactly the tools and skills it returns today and no `instructions`.
- **FR-1306**: With the tool hint on, a worker thread on a provider whose tool route is not `function` MUST receive a one-line hint in `instructions`, built only from the table.
  A worker on a `function` route, a supervisor, and an unroled thread MUST receive none.
- **FR-1307**: The tool hint switch MUST default to off and MUST be an option of the composition root, not a field of the owner's config files.
  The shared skill text and the worker prompt MUST stay harness neutral.

### Readiness gate (H1)

- **FR-1311**: `BbPort` MUST gain a read of the provider states of a host (the default host when no host is given).
  The real adapter MUST call `bb.sdk.system.providerStates` and cut each entry to the provider ID, the status, the installed and minimum versions, bb's local login command, and bb's status message.
- **FR-1312**: Dispatch MUST pass a profile only when the state of its provider on the target host is `ready`.
  Every other status, a missing state, and a failed read MUST block with the code `provider_unavailable` before any task or worker exists.
- **FR-1313**: The block message MUST name the provider, the host, and bb's status.
  For `unauthenticated` and `expired` it MUST include bb's local login command when bb gives one.
  For `unsupported_version` it MUST include the installed and the minimum version.
- **FR-1314**: A blocked dispatch MUST create no task, spawn no worker, use no slot of the day cap, and try no other provider.
- **FR-1315**: The remote machine preflight MUST judge the agent CLI by the same states for that machine, with the same remedy text.
- **FR-1316**: The queue start path MUST apply the same checks as dispatch, through one shared function.
  A task that fails a transient check (readiness, the model list) MUST stay queued, and the plugin MUST log why.
- **FR-1317**: The profile's provider MUST still appear in bb's provider list, because the permission-mode and level checks read it.
- **FR-1318**: The fake bb port and the fake plugin host MUST let a test script provider states per host.
  Their default MUST report `claude` and `claude-code` as `ready`, so existing tests keep their meaning.

### Permission floor (H11)

- **FR-1321**: A row MUST record whether the harness runs workers without a sandbox and the delivery modes in which the plugin refuses it.
  The Pi row MUST record no sandbox and refusal in `local-only`.
- **FR-1322**: After the profile and the machine are chosen and before any task exists, dispatch MUST refuse a profile whose provider's row refuses the project's effective delivery mode.
  The code MUST be new and distinct from `provider_unavailable`.
- **FR-1323**: The refusal message MUST name the provider and the mode, give the reason (no sandbox; the approval answer route of D-030), and list the modes where the harness is allowed.
- **FR-1324**: Pi MUST be allowed in `direct-PR` and `no-mistakes` modes, subject to the other checks.
- **FR-1325**: The refusal MUST apply to every profile source, to scout and ship tasks alike, and on the queue start path.
  At queue start, a refusal MUST fail the task with evidence and not leave it queued.
- **FR-1326**: A provider whose row has no refused modes, and a provider that is not in the table, MUST NOT be refused by this rule.

### No built-in default (H10)

- **FR-1331**: The plugin MUST NOT contain a built-in profile.
  The last rung of the precedence (override, rule, default) MUST block when it is reached, with a new code and a message that says to run `bb factoryman dispatch init --provider <id>` or to set `default` in `dispatch.json`.
- **FR-1332**: The profile sources MUST no longer include a built-in source, and no result text MUST name one.
- **FR-1333**: `bb factoryman dispatch init --provider <id>` MUST accept `--project <id>` (or the project from the command context), and the optional flags `--model <id>`, `--level <id>`, and `--mode <mode>`.
  An unknown flag, a missing value, or a blank value MUST print the usage text and exit with code 2.
- **FR-1334**: The command MUST write only `<checkout>/.bb/factoryman/dispatch.json`.
  It MUST create the file exclusively, so it never overwrites or changes an existing file, and it MUST create the directory when it is missing.
- **FR-1335**: The file MUST hold `version: 1`, one profile whose key is the provider ID, `default` set to that key, and no rules.
  The plugin's own parser MUST accept it.
- **FR-1336**: Without flags, the profile MUST take the provider's default model from bb, that model's default reasoning level, and the least-surprising permission mode that bb offers for the provider (`auto`, then `accept-edits`, then `full`).
  A flag MUST replace the matching value.
  The command MUST check the final profile against what bb lists for the provider and MUST refuse a profile that bb would block on the model, the level, or the mode.
- **FR-1337**: The command MUST read no credential, write no credential, and change nothing in bb.
- **FR-1338**: The usage text MUST list the new command.

### Model-aware checks (H2)

- **FR-1341**: `reasoningLevels` in `dispatch.json` MUST accept either an array (every provider) or a record from provider ID to array.
  Each array MUST be non-empty and free of duplicates.
- **FR-1342**: The resolver MUST rank levels in the ladder of the explicit profile's provider, and in the default ladder when the record has no entry for it.
  A level that is off the ladder MUST still block as "cannot be ranked", unless `standingPermission.lowerReasoning` is on.
- **FR-1343**: `BbPort` MUST gain a read of a provider's models on a host: the model ID, whether it is bb's default, its default level, its supported levels, and whether bb knows its levels (`known` or `unknown`).
- **FR-1344**: When the model is listed and its levels are `known`, the level MUST be one of the model's supported levels, and the provider-wide list MUST NOT block it.
  When the levels are `unknown`, the provider-wide list MUST apply.
- **FR-1345**: When the model is not listed, the dispatch MUST block and list the models bb offers (or say that bb lists none), unless the provider's row accepts unlisted models.
  For such a provider the provider-wide level list MUST apply.
  The rows for Claude Code and Codex MUST accept unlisted models, and every other row MUST refuse them.
- **FR-1346**: A failed read of the model list MUST block the dispatch and create no task.
- **FR-1347**: The model and level checks MUST run on the queue start path through the same shared function as FR-1316.

### Cause-bearing failure evidence (H3)

- **FR-1351**: `BbPort` MUST gain a read of the cause of a thread's failure: the latest `provider/error` or `system/error` event in the thread's log, as its `detail`, or its `message` when it has no `detail`.
  The real adapter MUST read it through `bb.sdk.threads.events.list`.
- **FR-1352**: On `thread.failed` for a recorded worker in `working` or `blocked`, the `fail` evidence MUST keep the text it has today and MUST add the cause, unchanged apart from the bounding in FR-1355.
- **FR-1353**: The wake message that follows the failure MUST include the cause, and the cause MUST survive the wake message's evidence limit.
- **FR-1354**: When the cause means "not signed in" or "no model", the evidence MUST add a remedy line.
  A Codex failure with HTTP 401 or an unauthorized category counts as "not signed in".
  The remedy MUST NOT replace or reword the cause.
- **FR-1355**: The plugin MUST remove control characters and line breaks from the cause, MUST bound its length, and MUST present it as text that the provider reported.
- **FR-1356**: When no error event exists or the read fails, the evidence MUST be what it is today, the evidence MUST stay non-empty (hard rule 3), and the plugin MUST log the read failure.

### Decision record (H10)

- **FR-1361**: `docs/DECISIONS.md` MUST record the captain's five decisions, the amendment of D-063, and the per-provider ladder as an amendment of D-064.
  It MUST record every deviation from the report's table of contracts (for example the added columns) with its reason.
- **FR-1362**: Text in `docs/` and `skills/` that states a built-in default profile MUST be corrected.
  `CLAUDE.md` MUST NOT change.

### Unchanged

- **FR-1371**: The state machine, the store, the event log, the hard rules, the tools' authority checks, the merge and teardown gates, the machine placement rules, the validator, and the supervisor and validator role handling MUST NOT change.
  No check added here MAY fall back to another provider, and config MAY only tighten.

## Key entities

- **Harness contract row**: The pinned facts about one bb provider: modes, tool route, skill delivery, role-change timing, failure sources, steer, cost, unlisted-model policy, and sandbox floor.
- **Provider state**: What bb says about a provider on one host: `ready`, `not_installed`, `unauthenticated`, `expired`, `unsupported_version`, or `unknown`, with versions, a login command, and a message.
- **Model entry**: What bb lists for one model of a provider: its ID, whether it is the default, and its supported reasoning levels.
- **Failure cause**: The detail of the latest `provider/error` or `system/error` event in a worker thread's log.
- **Starter config**: The `dispatch.json` that `dispatch init` writes: one profile on the chosen provider and a `default` that names it.

## Success criteria

- **SC-1301**: For each of `not_installed`, `unauthenticated`, `expired`, `unsupported_version`, `unknown`, a missing state, and a failed read, a dispatch creates zero tasks and zero workers, and the answer names the provider, the host, and the remedy bb gives.
- **SC-1302**: A remote machine whose provider is not ready blocks a dispatch that the server's own state would allow.
- **SC-1303**: Pi is refused in `local-only` mode and allowed in `direct-PR` and `no-mistakes` modes, for every profile source and for the queue start path.
- **SC-1304**: A project with no `dispatch.json` blocks with the `dispatch init` hint, and after the command the same dispatch passes the profile source check.
- **SC-1305**: The omp `off` level passes, the Codex `ultra` level ranks, a level that the model does not list is refused, and an unknown model on Pi lists the choices.
- **SC-1306**: The four causes in the report's section 5.1 appear verbatim in the `fail` evidence, and in the wake message.
- **SC-1307**: With the tool hint off, the answer of `bb.agents.configure` is identical to the answer before this feature, for every role and provider.
- **SC-1308**: `pnpm run check` passes, and `bb plugin build` passes.
- **SC-1309**: No existing test changes unless its behavior changed by a requirement above, and each such change is recorded in the cycle log and `docs/DECISIONS.md`.

## Assumptions

- The captain's five decisions are final for this work.
  Tasks H4 (supervisor start), H12 (roles block), H6 to H9 (conformance suite, fake model server, offline lab, docs rewrite), H13 (tier 2 runs), and H14 (worker hint) stay out.
  D1 (tier 1.5 plus tier 2 defines "supported") and D2 (a dedicated OpenAI key for tier 2) are recorded and not built here.
- `bb.sdk.system.providerStates` accepts a `hostId`, as `providers.list` does, and returns a record for each provider that bb knows.
  A custom ACP provider that the states omit is blocked, which fails closed.
  The live check settles whether this blocks the tier 1 stub agent.
- The model list of a provider comes from `bb.sdk.providers.models` with `providerId` and `hostId`, and its entries carry the fields in FR-1343.
- The tool hint switch is a code option because H14 decides later whether the hint is needed.
  No owner config field exposes it.
- The starter profile's permission mode rule (`auto`, then `accept-edits`, then `full`) follows the report's example profiles.
  Pi offers only `full`, so its starter profile uses `full`.
- A scout task in a `local-only` project on Pi is refused, because the captain's decision keys on the delivery mode.
  The captain can relax this later.
- The first write by the plugin into a project checkout is `dispatch init`.
  It writes only when the owner runs the command, and the command is not a tool, so a supervisor cannot call it.
  An agent with a shell could run it, as it could edit the file by hand.
- Reasoning-level IDs differ across providers, so a comparison between a profile on one provider and a baseline on another ranks both in the profile's ladder, and blocks when the baseline's level is not on it.
- A real model run on any harness is out of scope, and so is any credential.
  The tests run against the fake bb port, the fake plugin host, and recorded bb data.
- Existing tests that assert the built-in default (the resolver unit test and the dispatch acceptance test) change because FR-1331 changes the behavior.
  This follows the precedent of D-067.
