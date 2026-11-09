---
feature: 009-harness-independence
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 47
planned_at: b0ccb09
updated_at: b0ccb09
suite_baseline: green
---

# Test list: Agent-harness independence

The acceptance layer is an in-process integration test, which is weaker than a live bb.
It enters through the plugin factory (`loadWorld` with the real `createPlugin`), the registered tools (`factoryman_dispatch`), the registered CLI handler (`bb factoryman dispatch init` and `preflight`), the event handlers (`thread.failed`), and the agent configuration callback (`resolveAgentConfiguration`).
The fake host answers `system.providerStates`, `providers.models`, and `threads.events.list` from scripted data.
It cannot prove that bb's real answers have these shapes, that `providerStates` lists a custom ACP agent, or which model field a spawn resolves.
Those checks are the owner's live check (`quickstart.md`, part 2) and are not tests here.
No coverage tool and no mutation tool are installed (profile, "Missing capabilities").
The audit uses the deliberate mutants listed at the end of this file.
The suite baseline was 95 files and 1307 tests, all passing.

## Outer loop: acceptance behaviors

One per acceptance criterion in `spec.md`, plus A1349 for the build and A1350 for the queue.
A1301 to A1309 live in `test/acceptance/harness-readiness.test.ts`, A1310 to A1315 in `harness-configure.test.ts` (A1312 in `lint-isolation.test.ts`), A1316 to A1321 in `harness-admission.test.ts`, A1322 to A1329 in `harness-default.test.ts`, A1330 to A1338 and A1350 in `harness-models.test.ts`, A1339 to A1344 in `harness-failure.test.ts`, and A1345 to A1348 in `harness-docs.test.ts`.

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| A1301 | A dispatch whose provider is `unauthenticated` on the target host is blocked with `provider_unavailable`, names the provider, the host, and bb's login command, and leaves no task and no spawn | AC-1.1, FR-1312, FR-1313, FR-1314, SC-1301 | example | DONE | `test/acceptance/harness-readiness.test.ts` |
| A1302 | A dispatch whose provider is `not_installed` or `expired` is blocked the same way, and the message carries bb's status | AC-1.2, FR-1313, SC-1301 | example | DONE | `test/acceptance/harness-readiness.test.ts` |
| A1303 | A dispatch whose provider is `unsupported_version` is blocked and the message shows the installed and the minimum version | AC-1.3, FR-1313, SC-1301 | example | DONE | `test/acceptance/harness-readiness.test.ts` |
| A1304 | A provider with status `unknown`, a provider with no state, and a failed read of the states each block the dispatch and leave no task | AC-1.4, FR-1312, SC-1301 | example | DONE | `test/acceptance/harness-readiness.test.ts` |
| A1305 | A task pinned to a remote machine is judged by that machine's own states: ready on the server and not ready there blocks, and the reverse passes | AC-1.5, FR-1311, SC-1302 | example | DONE | `test/acceptance/harness-readiness.test.ts` |
| A1306 | `bb factoryman preflight` for a remote machine reports the same remedy text as dispatch does for the same provider state | AC-1.6, FR-1315 | example | DONE | `test/acceptance/harness-readiness.test.ts` |
| A1307 | A queued task whose provider is no longer ready stays queued and starts no worker, and starts once the provider is ready | AC-1.7, FR-1316 | example | DONE | `test/acceptance/harness-readiness.test.ts` |
| A1308 | With every state `ready`, dispatch proceeds as before and spawns the worker | AC-1.8 | example | DONE | `test/acceptance/harness-readiness.test.ts` |
| A1309 | A blocked dispatch uses no slot of the day cap: with `maxTasksPerDay` 1, a blocked dispatch followed by a ready one still dispatches | FR-1314, t01 finding 5.9 | example | DONE | `test/acceptance/harness-readiness.test.ts` |
| A1310 | The contract lookup returns the rows of `claude-code`, `codex`, `pi`, and `acp-omp` with the values in the data model | AC-2.1, FR-1301, FR-1302 | example | DONE | `test/acceptance/harness-configure.test.ts` |
| A1311 | The contract lookup returns the generic row for `acp-opencode`, for an ID the plugin has never heard of, and for the empty string | AC-2.2, FR-1303 | example | DONE | `test/acceptance/harness-configure.test.ts` |
| A1312 | Lint rejects any import in a non-test file under `src/harness/`, and accepts the same imports elsewhere | AC-2.3, FR-1301 | example | DONE | `test/acceptance/lint-isolation.test.ts::[A1312]` |
| A1313 | With the tool hint off (the plugin's default), `bb.agents.configure` returns for every role on every provider exactly the tools and skills it returned before, and no `instructions` | AC-2.4, FR-1305, FR-1307, SC-1307 | example | DONE | `test/acceptance/harness-configure.test.ts` |
| A1314 | With the hint on, a worker on `claude-code` and a worker on `acp-omp` each get the hint of their row in `instructions` | AC-2.5, FR-1306 | example | DONE | `test/acceptance/harness-configure.test.ts` |
| A1315 | With the hint on, a worker on `codex` or `pi`, a supervisor, and an unroled thread get no `instructions`, and the hint holds no metadata value | AC-2.6, FR-1306 | example | DONE | `test/acceptance/harness-configure.test.ts` |
| A1316 | A Pi profile in a `local-only` project, ship or scout, is blocked with the admission message and leaves no task and no spawn | AC-3.1, FR-1322, FR-1323, FR-1325, SC-1303 | example | DONE | `test/acceptance/harness-admission.test.ts` |
| A1317 | A ready Pi profile in `full` mode dispatches in a `direct-PR` project and in a `no-mistakes` project | AC-3.2, FR-1324, SC-1303 | example | DONE | `test/acceptance/harness-admission.test.ts` |
| A1318 | The `local-only` refusal is the same when the Pi profile comes from an explicit override, a matching rule, or the configured default | AC-3.3, FR-1325 | example | DONE | `test/acceptance/harness-admission.test.ts` |
| A1319 | A profile on `claude-code`, `codex`, `acp-omp`, or an unknown provider is never refused by the admission rule in any mode | AC-3.4, FR-1326 | example | DONE | `test/acceptance/harness-admission.test.ts` |
| A1320 | A queued Pi task in a `local-only` project fails with evidence when its slot frees and starts no worker | AC-3.5, FR-1325 | example | DONE | `test/acceptance/harness-admission.test.ts` |
| A1321 | A refused Pi dispatch spawns no worker on any other provider | AC-3.6, FR-1314 | example | DONE | `test/acceptance/harness-admission.test.ts` |
| A1322 | A project with no `dispatch.json` blocks a dispatch with the `dispatch init` hint and creates no task | AC-4.1, FR-1331, SC-1304 | example | PENDING | |
| A1323 | An explicit profile, a matching rule, and a configured default each resolve as before, in the same order | AC-4.2, FR-1331 | example | PENDING | |
| A1324 | `bb factoryman dispatch init --provider <id>` writes `.bb/factoryman/dispatch.json` with one profile built from what bb lists, sets it as the default, and prints the path and the profile | AC-4.3, FR-1334, FR-1335, FR-1336 | example | PENDING | |
| A1325 | The plugin's parser accepts the written file, and the next dispatch in that project resolves to the profile with the source "the configured default" | AC-4.4, FR-1335, SC-1304 | example | PENDING | |
| A1326 | Running the command when a `dispatch.json` exists, valid or not, writes nothing and leaves the file as it was | AC-4.5, FR-1334 | example | PENDING | |
| A1327 | The command exits with a clear message and writes nothing for an unknown provider, an unknown checkout, a provider with no model and no `--model`, and a missing flag | AC-4.6, FR-1333 | example | PENDING | |
| A1328 | `--model`, `--level`, and `--mode` replace the values taken from bb, and a value that bb would block stops the write | AC-4.7, FR-1336 | example | PENDING | |
| A1329 | The command calls no bb method that changes state and reads no credential | AC-4.8, FR-1337 | example | PENDING | |
| A1330 | A profile on omp with level `off` dispatches when the model lists `off` and the provider-wide list does not | AC-5.1, FR-1344, SC-1305 | example | PENDING | |
| A1331 | A level that the named model does not list is refused, and the message names the model and the levels it lists | AC-5.2, FR-1344, SC-1305 | example | PENDING | |
| A1332 | An unlisted model on Pi is refused with the list of models bb offers, or with "no models" and the load error | AC-5.3, FR-1345, SC-1305 | example | PENDING | |
| A1333 | An unlisted model on `claude-code` or `codex` is judged by the provider-wide level list | AC-5.4, FR-1345 | example | PENDING | |
| A1334 | A model whose levels are `unknown` is judged by the provider-wide level list | AC-5.5, FR-1344 | example | PENDING | |
| A1335 | A `reasoningLevels` array in `dispatch.json` behaves as it did, for every provider | AC-5.6, FR-1341 | example | PENDING | |
| A1336 | With a Codex ladder that ends in `ultra`, an explicit Codex profile at `ultra` clears against a baseline at `high`, and a lowered level blocks with `reasoning_lowered` | AC-5.7, FR-1342, SC-1305 | example | PENDING | |
| A1337 | A provider with no entry in a `reasoningLevels` record is ranked in the default ladder | AC-5.8, FR-1342 | example | PENDING | |
| A1338 | A failed read of the model list blocks the dispatch and leaves no task | AC-5.9, FR-1346 | example | PENDING | |
| A1339 | A worker that fails with a `provider/error` or `system/error` event in its log gets `fail` evidence that holds today's text and then the latest event's detail | AC-6.1, FR-1351, FR-1352 | example | PENDING | |
| A1340 | The four causes of the report (Claude Code login, omp no model, Pi model resolution, Codex 401 with a cause event) each appear verbatim in the evidence | AC-6.2, SC-1306 | example | PENDING | |
| A1341 | The wake message to the supervisor carries the cause and the remedy of a failed task whole | AC-6.3, FR-1353, SC-1306 | example | PENDING | |
| A1342 | A sign-in cause and a no-model cause each add a remedy line, and the cause stays in the evidence unchanged | AC-6.4, FR-1354 | example | PENDING | |
| A1343 | With no error event, or a failed read, the evidence is today's text, the task still fails, and the plugin logs the read failure | AC-6.5, FR-1356 | example | PENDING | |
| A1344 | A long cause with line breaks and control characters is flattened and bounded, and shown as text the provider reported | AC-6.6, FR-1355 | example | PENDING | |
| A1345 | `docs/DECISIONS.md` holds D-100 to D-107, and D-100 records the captain's five decisions with the tasks built and open | AC-7.1, FR-1361 | example | PENDING | |
| A1346 | D-063 keeps its text and carries an "Amended by" line | AC-7.2, FR-1361 | example | PENDING | |
| A1347 | D-064 carries an "Amended by" line that records the per-provider ladder | AC-7.3, FR-1361 | example | PENDING | |
| A1348 | No file under `docs/` or `skills/` says that the plugin has a built-in default profile, and `CLAUDE.md` is unchanged | AC-7.4, FR-1362 | example | PENDING | |
| A1349 | `pnpm run build` (`bb plugin build`) passes, and `pnpm run check` passes. This is a manual run at the final gate, logged in the cycle log | SC-1308 | example | PENDING | manual: task T1395 |
| A1350 | A queued task whose model bb no longer lists for a provider that refuses unlisted models stays queued and spawns no worker | FR-1347 | example | PENDING | |

## Inner loop: unit behaviors

### `src/harness/contracts.ts` (H5)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1301 | The `claude-code` row holds the data-model values: tested with 2.1.316 and 0.49.0, all three modes, sandbox available, no refused mode, unlisted models accepted, route `mcp-deferred`, skill `native-list`, role change `next-turn`, cause `provider/error`, latency `immediate`, steer `inject`, cost `null` | AC-2.1, FR-1302, FR-1304 | example | DONE | `src/harness/contracts.test.ts` |
| U1302 | The `codex` row holds the data-model values: 0.166.0, all three modes, unlisted accepted, route `function`, skill `native-list`, role change `clear`, causes `provider/error` and `turn.failed`, latency `retries`, steer `inject`, cost `unknown` | AC-2.1, FR-1302, FR-1304 | example | DONE | `src/harness/contracts.test.ts` |
| U1303 | The `pi` row holds the data-model values: 1.4.0, modes `full` only, sandbox `none`, refused mode `local-only` with its reason, unlisted refused, route `function`, skill `system-prompt-list`, role change `next-turn`, cause `system/error`, latency `immediate`, steer `inject`, cost `unknown` | AC-2.1, FR-1302, FR-1321, FR-1304 | example | DONE | `src/harness/contracts.test.ts` |
| U1304 | The `acp-omp` row holds the data-model values: 18.14.1, modes `accept-edits` and `full`, unlisted refused, route `xd-device`, skill `prompt-list`, role change `clear`, cause `provider/error`, latency `immediate`, steer `inject`, cost `unknown` | AC-2.1, FR-1302, FR-1304 | example | DONE | `src/harness/contracts.test.ts` |
| U1305 | The generic row has no tested versions, no known modes, sandbox `unknown`, no refused mode, unlisted refused, route `unknown`, no tool hint, skill `prompt-list`, role change `clear`, latency `unknown`, steer `unknown`, cost `unknown` | AC-2.2, FR-1302, FR-1304 | example | DONE | `src/harness/contracts.test.ts` |
| U1306 | For the four named rows, `sandbox` is `none` exactly when `workerModes` holds no mode other than `full` | FR-1321 (invariant, sampled over the rows) | example | DONE | `src/harness/contracts.test.ts` |
| U1307 | `refusedModes` is non-empty exactly when `refusalReason` is non-null, for every row | FR-1321 (invariant, sampled over the rows) | example | DONE | `src/harness/contracts.test.ts` |
| U1308 | `toolHint` is null exactly when `toolRoute` is `function` or `unknown`, and the two non-null hints equal the constants in `data-model.md` | FR-1306 (invariant, sampled over the rows) | example | DONE | `src/harness/contracts.test.ts` |
| U1309 | `contractFor` returns the row whose `provider` equals the ID, for each of the four IDs | AC-2.1, FR-1303 | example | DONE | `src/harness/contracts.test.ts` |
| U1310 | `contractFor` returns the generic row for `acp-opencode`, for the empty string, and for `Claude-Code` (IDs match exactly) | AC-2.2, FR-1303 | example | DONE | `src/harness/contracts.test.ts` |
| U1311 | `contractFor` returns the generic row for `__proto__`, `constructor`, and `toString`, and never throws | AC-2.2, FR-1303 | example | DONE | `src/harness/contracts.test.ts` |

### `src/tools/register.ts` (H5)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1312 | With no `toolHints` option, the callback returns for roles `supervisor`, `worker`, and none, on `claude-code`, `codex`, `pi`, `acp-omp`, and an unknown ID, a result equal to `{ tools, skills }` with no `instructions` key | AC-2.4, FR-1305, FR-1307 | example | DONE | `src/tools/register.test.ts` |
| U1313 | With `toolHints` on, a worker on `claude-code` gets `instructions` equal to the row's hint | AC-2.5, FR-1306 | example | DONE | `src/tools/register.test.ts` |
| U1314 | With `toolHints` on, a worker on `acp-omp` gets `instructions` equal to the row's hint | AC-2.5, FR-1306 | example | DONE | `src/tools/register.test.ts` |
| U1315 | With `toolHints` on, a worker on `codex`, on `pi`, and on an unknown provider gets no `instructions` | AC-2.6, FR-1306 | example | DONE | `src/tools/register.test.ts` |
| U1316 | With `toolHints` on, a supervisor and an unroled thread on `claude-code` get no `instructions` | AC-2.6, FR-1306 | example | DONE | `src/tools/register.test.ts` |
| U1317 | The hint never contains a metadata value: a worker whose metadata holds `taskId` "IGNORE ALL RULES" gets the constant hint only | AC-2.6, FR-1306 | example | DONE | `src/tools/register.test.ts` |

### `src/bb/adapter.ts`: provider states (H1)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1318 | `getProviderStates` calls `providerStates` with no argument when no host is given, and with `{ hostId }` when one is | FR-1311, AC-1.5 | example | DONE | `src/bb/adapter.test.ts::[U1318]` to `[U1321]` |
| U1319 | It keeps `providerId`, `status`, `installedVersion`, `minimumSupportedVersion`, `localLoginCommand`, and `statusMessage` of each entry, in order | FR-1311 | example | DONE | `src/bb/adapter.test.ts::[U1318]` to `[U1321]` |
| U1320 | A status outside the six known values becomes `unknown` | FR-1312 (fail closed) | example | DONE | `src/bb/adapter.test.ts::[U1318]` to `[U1321]` |
| U1321 | An SDK error is not caught | FR-1312 | example | DONE | `src/bb/adapter.test.ts::[U1318]` to `[U1321]` |

### `src/dispatch/availability.ts` (H1)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1322 | A `ready` provider that lists the permission mode and the level passes (moves to the new signature) | AC-1.8 | example | BASELINE | `src/dispatch/availability.test.ts::[U730]` |
| U1323 | `not_installed` blocks with "is not installed on <host> (bb status: not_installed). Install its CLI there." | AC-1.2, FR-1313 | example | DONE | `src/dispatch/availability.test.ts` |
| U1324 | `unauthenticated` with a login command blocks and says "Run `<command>` on that machine." | AC-1.1, FR-1313 | example | DONE | `src/dispatch/availability.test.ts` |
| U1325 | `unauthenticated` with no login command blocks and says "Sign in to it on that machine." | AC-1.1, FR-1313 | example | DONE | `src/dispatch/availability.test.ts` |
| U1326 | `expired` blocks with the login command, and with the same fallback when bb gives none | AC-1.2, FR-1313 | example | DONE | `src/dispatch/availability.test.ts` |
| U1327 | `unsupported_version` blocks and shows the installed and the minimum version | AC-1.3, FR-1313 | example | DONE | `src/dispatch/availability.test.ts` |
| U1328 | `unsupported_version` with no version data says "unknown" for each missing version | AC-1.3, FR-1313 | example | DONE | `src/dispatch/availability.test.ts` |
| U1329 | Status `unknown` blocks, appends bb's status message when it has one, and appends nothing when it has none | AC-1.4, FR-1312 | example | DONE | `src/dispatch/availability.test.ts` |
| U1330 | A provider with no state blocks, and the message lists the provider IDs that bb reports, or "none" | AC-1.4, FR-1312 | example | DONE | `src/dispatch/availability.test.ts` |
| U1331 | The state of the profile's provider decides, not the first state in the list: a not-ready state of another provider does not block | AC-1.5, FR-1312 | example | DONE | `src/dispatch/availability.test.ts` |
| U1332 | Readiness is checked before the listing: a provider that is both unlisted and not ready gets the readiness message | FR-1312 (order) | example | DONE | `src/dispatch/availability.test.ts` |
| U1333 | A provider that bb does not list blocks and names the providers it knows (moves to the new signature) | FR-1317 | example | BASELINE | `src/dispatch/availability.test.ts::[U731]` |
| U1334 | A listed provider with `available` false blocks (moves to the new signature) | FR-1317 | example | BASELINE | `src/dispatch/availability.test.ts::[U732]` |
| U1335 | A permission mode that the provider does not list blocks with today's message (moves to the new signature) | FR-1317 | example | BASELINE | `src/dispatch/availability.test.ts::[U733]` |
| U1336 | The permission mode is checked before the level: a profile with both wrong gets the mode message | FR-1312 (order) | example | DONE | `src/dispatch/availability.test.ts` |
| U1337 | With no model data, a level that the provider does not list blocks with today's message (moves to the new signature) | FR-1317 | example | BASELINE | `src/dispatch/availability.test.ts::[U734]` |
| U1338 | The level check is skipped when the provider lists no levels (moves to the new signature) | FR-1317 | example | BASELINE | `src/dispatch/availability.test.ts::[U735]` |

### `src/dispatch/gate.ts`: reads (H1, H2)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1339 | A ready profile returns `{ ok: true }` | AC-1.8 | example | DONE | `src/dispatch/gate.test.ts` |
| U1340 | The gate reads the providers, the states, and the models with the placed machine's ID | AC-1.5, FR-1311 | example | DONE | `src/dispatch/gate.test.ts` |
| U1341 | With no machine, the gate reads with no host ID | AC-1.8 | example | DONE | `src/dispatch/gate.test.ts` |
| U1342 | A throw from the providers read returns `read_failed` with "could not read bb's providers (<error>)" | AC-1.4, FR-1312 | example | DONE | `src/dispatch/gate.test.ts` |
| U1343 | A throw from the states read returns `read_failed` with "could not read bb's provider states (<error>)" | AC-1.4, FR-1312 | example | DONE | `src/dispatch/gate.test.ts` |
| U1344 | A throw from the models read returns `read_failed` with "could not read bb's models (<error>)" | AC-5.9, FR-1346 | example | PENDING | |
| U1345 | A not-ready provider returns code `provider_unavailable` with `permanent` false | FR-1312, FR-1316 | example | DONE | `src/dispatch/gate.test.ts` |

### `src/machines/preflight.ts` (H1)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1346 | A named provider that is ready on the host gives no `agent_cli` problem | AC-1.6, FR-1315 | example | DONE | `src/machines/preflight.test.ts` |
| U1347 | A named provider that is `unauthenticated` on the host gives an `agent_cli` problem with the readiness text and the login command | AC-1.6, FR-1315 | example | DONE | `src/machines/preflight.test.ts` |
| U1348 | With no named provider, one ready listed provider gives no problem | FR-1315 | example | DONE | `src/machines/preflight.test.ts` |
| U1349 | With no named provider and no ready listed provider, the problem says "No agent CLI is available on <host>" (today's text) | FR-1315 | example | BASELINE | `src/machines/preflight.test.ts::[U839]` |
| U1350 | The preflight reads the states with the host's own ID | AC-1.5, AC-1.6 | example | DONE | `src/machines/preflight.test.ts` |

### `src/limits/queue.ts`: readiness at queue start (H1)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1351 | A queued task whose provider is `unauthenticated` stays queued, spawns nothing, and the log names the message | AC-1.7, FR-1316 | example | DONE | `src/limits/queue.test.ts` |
| U1352 | A failed states read keeps the task queued | AC-1.7, FR-1316 | example | DONE | `src/limits/queue.test.ts` |
| U1353 | A queued task starts once the provider is ready (cap and order unchanged) | AC-1.7 | example | BASELINE | `src/limits/queue.test.ts::[U1007]` |
| U1354 | A queued task whose provider is unavailable stays queued and spawns nothing | FR-1316 | example | BASELINE | `src/limits/queue.test.ts::leaves a task queued, and does not spawn, when the provider is no longer available` |

### `src/tools/dispatch.ts` (H1)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1355 | A gate block prints "Dispatch blocked (<code>): <message> No task was created." | FR-1312 | example | DONE | `src/tools/dispatch.test.ts` |
| U1356 | A read failure prints "Dispatch failed: <message>. No task was created." | AC-1.4 | example | DONE | `src/tools/dispatch.test.ts` |
| U1357 | A task pinned to an offline machine blocks before any provider state is read (hard rule 5 first) | FR-1371, plan: machine placement comes first | example | DONE | `src/tools/dispatch.test.ts` |

### `src/dispatch/gate.ts`: admission (H11)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1358 | `admit` refuses `pi` in `local-only` | AC-3.1, FR-1322 | example | DONE | `src/dispatch/gate.test.ts` |
| U1359 | `admit` allows `pi` in `direct-PR` | AC-3.2, FR-1324 | example | DONE | `src/dispatch/gate.test.ts` |
| U1360 | `admit` allows `pi` in `no-mistakes` | AC-3.2, FR-1324 | example | DONE | `src/dispatch/gate.test.ts` |
| U1361 | `admit` never refuses `claude-code`, `codex`, or `acp-omp` in any of the three modes | AC-3.4, FR-1326 | example | DONE | `src/dispatch/gate.test.ts` |
| U1362 | `admit` never refuses `acp-opencode` or an unknown ID in any mode | AC-3.4, FR-1326 | example | DONE | `src/dispatch/gate.test.ts` |
| U1363 | A refusal has code `provider_not_admitted` and `permanent` true | FR-1322 | example | DONE | `src/dispatch/gate.test.ts` |
| U1364 | The refusal message names the provider and the mode, gives the row's reason, lists exactly the modes where the provider is allowed, and ends "No other provider was tried." | AC-3.1, FR-1323 | example | DONE | `src/dispatch/gate.test.ts` |
| U1365 | Admission runs before any bb read: a refusal records no `listProviders`, `getProviderStates`, or `listModels` call | plan: admission first | example | DONE | `src/dispatch/gate.test.ts` |
| U1366 | Admission runs before readiness: `pi` in `local-only` with an `unauthenticated` state gets the admission message | plan: admission first | example | DONE | `src/dispatch/gate.test.ts` |

### `src/limits/queue.ts`: admission at queue start (H11)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1367 | A queued `pi` task in `local-only` mode fails with the evidence "The queued task can no longer start: <message>" and spawns nothing | AC-3.5, FR-1325 | example | DONE | `src/limits/queue.test.ts` |
| U1368 | A queued task that fails readiness, which is transient, is not failed | FR-1325 (boundary) | example | DONE | `src/limits/queue.test.ts` |

### `src/bb/adapter.ts`: models (H2)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1369 | `listModels` passes `providerId`, and passes `hostId` only when one is given | FR-1343 | example | PENDING | |
| U1370 | Each model keeps `id`, `model`, `isDefault`, `defaultReasoningLevel` (from `defaultReasoningEffort`), and `reasoningLevels` (the `reasoningEffort` of each supported entry) | FR-1343 | example | PENDING | |
| U1371 | `reasoningKnown` is true for `reasoningDiscovery` "known" and false for "unknown" | FR-1343, FR-1344 | example | PENDING | |
| U1372 | `modelLoadError` becomes `loadError` with `code` and `detail`, and an absent one becomes null | FR-1345 | example | PENDING | |
| U1373 | An SDK error is not caught | FR-1346 | example | PENDING | |

### `src/dispatch/availability.ts`: model and level (H2)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1374 | A listed model with known levels passes a level that the provider-wide list lacks (omp `off`) | AC-5.1, FR-1344 | example | PENDING | |
| U1375 | A listed model with known levels refuses a level it does not list, and the message names the model, the provider, and the levels | AC-5.2, FR-1344 | example | PENDING | |
| U1376 | A listed model with known levels passes a level that is on both lists | AC-5.2 (boundary) | example | PENDING | |
| U1377 | A listed model with unknown levels uses the provider-wide list and refuses a level outside it | AC-5.5, FR-1344 | example | PENDING | |
| U1378 | A listed model with unknown levels passes a level on the provider-wide list | AC-5.5 (boundary) | example | PENDING | |
| U1379 | An unlisted model on `pi` is refused, and the message lists the model IDs | AC-5.3, FR-1345 | example | PENDING | |
| U1380 | An unlisted model when bb lists no models says "It lists: no models." | AC-5.3, FR-1345 | example | PENDING | |
| U1381 | An unlisted model with a load error adds "bb could not load the models (<code>: <detail>)" | AC-5.3, FR-1345 | example | PENDING | |
| U1382 | An unlisted model on `acp-omp` and on an unknown provider is refused | AC-5.3, FR-1345 | example | PENDING | |
| U1383 | An unlisted model on `claude-code` passes when the level is on the provider-wide list | AC-5.4, FR-1345 | example | PENDING | |
| U1384 | An unlisted model on `codex` is refused with today's level message when the level is off the provider-wide list | AC-5.4, FR-1345 | example | PENDING | |
| U1385 | An unlisted model on `claude-code` with a load error falls back to the provider-wide list | FR-1345, research: model list failures | example | PENDING | |
| U1386 | A profile's model matches a listed model by its `id` | FR-1343 | example | PENDING | |
| U1387 | A profile's model matches a listed model by its `model` field when that differs from `id` | FR-1343, research: model matching | example | PENDING | |
| U1388 | A listed model is used even when bb also reports a load error | research: model list failures | example | PENDING | |

### `src/dispatch/config.ts` (H2)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1389 | `reasoningLevels` as an array is accepted and kept | AC-5.6, FR-1341 | example | PENDING | |
| U1390 | `reasoningLevels` as a record from provider ID to array is accepted and kept | FR-1341 | example | PENDING | |
| U1391 | A record with a blank key is rejected | FR-1341 | example | PENDING | |
| U1392 | An empty array is rejected, at the top level and inside a record, and an array of one level is accepted | FR-1341 (boundary) | example | PENDING | |
| U1393 | A record entry with a repeated level is rejected | FR-1341 | example | PENDING | |
| U1394 | An array with a repeated level is rejected (today's rule) | FR-1341 | example | BASELINE | `src/dispatch/config.test.ts::[U707]` |
| U1395 | A value that is neither an array nor a record (a string, a number, null) is rejected | FR-1341 | example | PENDING | |
| U1396 | `ladderFor` returns the array for any provider when the setting is an array | AC-5.6, FR-1342 | example | PENDING | |
| U1397 | `ladderFor` returns the record's entry for a provider that has one | AC-5.7, FR-1342 | example | PENDING | |
| U1398 | `ladderFor` returns the default ladder for a provider that the record omits | AC-5.8, FR-1342 | example | PENDING | |
| U1399 | A config that sets nothing keeps the default array (today's rule) | AC-5.6 | example | BASELINE | `src/dispatch/config.test.ts::[U701]` |

### `src/dispatch/resolver.ts`: ladders (H2)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1400 | With a Codex ladder that ends in `ultra`, an explicit Codex profile at `ultra` clears against a Codex baseline at `high` | AC-5.7, FR-1342 | example | PENDING | |
| U1401 | An explicit Codex profile below the baseline blocks with `reasoning_lowered` and not "cannot be ranked" | AC-5.7, FR-1342 | example | PENDING | |
| U1402 | A provider with no record entry is ranked in the default ladder | AC-5.8, FR-1342 | example | PENDING | |
| U1403 | A baseline level that is not on the explicit profile's ladder blocks with "cannot be ranked", and standing permission lifts the block | FR-1342, D-064 | example | PENDING | |
| U1404 | With an array ladder the floor behaves as before: lowered blocks, equal or higher clears, off-ladder blocks | AC-5.6 | example | BASELINE | `src/dispatch/resolver.test.ts::[U722]`, `[U723]`, `[U724]`, `[U725]` |

### `src/files.ts` (H10)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1405 | `writeNew` creates the missing directory and the file and returns `written` | FR-1334 | example | PENDING | |
| U1406 | `writeNew` returns `exists` for an existing file and leaves its content unchanged | AC-4.5, FR-1334 | example | PENDING | |
| U1407 | `writeNew` rethrows a failure that is not "exists" (for example a path below a file) | FR-1334 | example | PENDING | |

### `src/dispatch/resolver.ts` and `src/tools/dispatch.ts`: no built-in default (H10)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1408 | With no override, no matching rule, and no default, the resolver returns `blocked` with code `no_default_profile` and the message that names `bb factoryman dispatch init --provider <id>` | AC-4.1, FR-1331 | example | PENDING | |
| U1409 | An explicit profile, a rule, and a configured default still resolve, in that order | AC-4.2 | example | BASELINE | `src/dispatch/resolver.test.ts::[U711]`, `[U716]`, `[U744]` |
| U1410 | The resolver module exports no `BUILTIN_PROFILE`, and no resolution has the source `builtin` | FR-1331, FR-1332 | example | PENDING | |
| U1411 | The dispatch success text for a configured default says "the configured default", and no source text names a built-in default | FR-1332 | example | PENDING | |

### `src/dispatch/init.ts` (H10)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1412 | A call with no `--provider` prints the usage and exits 2 | FR-1333, AC-4.6 | example | PENDING | |
| U1413 | A call with no `--project` and no project in the context prints the usage and exits 2 | FR-1333, AC-4.6 | example | PENDING | |
| U1414 | A flag with no value prints the usage and exits 2 | FR-1333 | example | PENDING | |
| U1415 | A flag with a blank value prints the usage and exits 2 | FR-1333 | example | PENDING | |
| U1416 | A repeated flag prints the usage and exits 2 | FR-1333 | example | PENDING | |
| U1417 | An unknown flag prints the usage and exits 2 | FR-1333 | example | PENDING | |
| U1418 | The project comes from the context when `--project` is absent, and `--project` wins when both are set | FR-1333 | example | PENDING | |
| U1419 | The default model is the one bb marks `isDefault` | FR-1336 | example | PENDING | |
| U1420 | With no default model marked, the first listed model is used | FR-1336 | example | PENDING | |
| U1421 | With no models and no `--model`, the command exits 1 with "bb lists no models for `<id>`. Pass --model <id>." and writes nothing | AC-4.6, FR-1336 | example | PENDING | |
| U1422 | The level is the model's default level when it is not empty | FR-1336 | example | PENDING | |
| U1423 | With no default level, the level is `medium` when the model lists it | FR-1336 | example | PENDING | |
| U1424 | With no default level and no `medium`, the level is the first level the model lists | FR-1336 | example | PENDING | |
| U1425 | With no levels at all and no `--level`, the command exits 1 with "Pass --level <id>." | AC-4.6, FR-1336 | example | PENDING | |
| U1426 | The mode is `auto` when the provider offers it | FR-1336 | example | PENDING | |
| U1427 | The mode is `accept-edits` when the provider offers no `auto` (omp) | FR-1336 | example | PENDING | |
| U1428 | The mode is `full` when the provider offers only that (Pi) | FR-1336 | example | PENDING | |
| U1429 | A provider that offers no mode makes the command exit 1 with "The provider offers no permission mode." | AC-4.6, FR-1336 | example | PENDING | |
| U1430 | `--model`, `--level`, and `--mode` each replace the matching value | AC-4.7 | example | PENDING | |
| U1431 | A profile that bb would block (an unlisted model on a refusing provider, a level the model lacks, a mode the provider lacks) exits 1 with the message that dispatch prints, and writes nothing | AC-4.7, FR-1336 | example | PENDING | |
| U1432 | A provider that bb does not list exits 1, names the listed provider IDs, and writes nothing | AC-4.6 | example | PENDING | |
| U1433 | A project with no local checkout exits 1 with "has no local checkout on the server" and writes nothing | AC-4.6 | example | PENDING | |
| U1434 | A throw from the models read exits 1 with "Could not read bb's models" and writes nothing | AC-4.6 | example | PENDING | |
| U1435 | An existing file, valid or invalid, exits 1 with "already exists, so nothing was written" and leaves the file unchanged | AC-4.5, FR-1334 | example | PENDING | |
| U1436 | A throw from the write exits 1 with "Could not write <path>" | FR-1334 | example | PENDING | |
| U1437 | The written text parses with `parseDispatchConfig`, holds `version` 1, one profile keyed by the provider ID, `default` set to it, and `rules` empty, uses two-space indentation, and ends with a newline | AC-4.3, AC-4.4, FR-1335 | example | PENDING | |
| U1438 | The success output is "Wrote <path>.", the profile line, and the note that readiness is checked at dispatch | AC-4.3 | example | PENDING | |
| U1439 | The command does not check readiness: a provider that is not ready still gets a file | plan: init skips readiness | example | PENDING | |
| U1440 | The command makes only read calls to bb | AC-4.8, FR-1337 | example | PENDING | |

### `src/tools/supervisor-command.ts` and `src/server.ts` (H10)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1441 | `dispatch init` is routed to the init command | FR-1333 | example | PENDING | |
| U1442 | `dispatch` with no subcommand or an unknown one prints the usage and exits 2 | FR-1333 | example | PENDING | |
| U1443 | The usage text lists the `dispatch init` line | FR-1338 | example | PENDING | |
| U1444 | The plugin registers a `dispatch` CLI entry with the usage line from the contract | FR-1333 | example | PENDING | |

### `src/wiring/failure-cause.ts` (H3)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1445 | `boundCause` leaves the four causes of the report unchanged | AC-6.2, FR-1355 | example | PENDING | |
| U1446 | `boundCause` replaces each run of control characters, line breaks, and tabs with one space, collapses repeated spaces, and trims | AC-6.6, FR-1355 | example | PENDING | |
| U1447 | `boundCause` leaves a text of exactly 300 characters unchanged | AC-6.6, FR-1355 (boundary) | example | PENDING | |
| U1448 | `boundCause` cuts a text of 301 characters to 300, ending with `...` | AC-6.6, FR-1355 (boundary) | example | PENDING | |
| U1449 | `remedyFor` gives the model remedy for "No model selected" | AC-6.4, FR-1354 | example | PENDING | |
| U1450 | `remedyFor` gives the model remedy for "Failed to resolve Pi model" | AC-6.4, FR-1354 | example | PENDING | |
| U1451 | `remedyFor` gives the model remedy, and not the sign-in remedy, for "No model selected. Use /login, set an API key" | AC-6.4, FR-1354 (precedence) | example | PENDING | |
| U1452 | `remedyFor` gives the sign-in remedy for "Not logged in · Please run /login" | AC-6.4, FR-1354 | example | PENDING | |
| U1453 | `remedyFor` gives the sign-in remedy for status 401 with unrelated text | AC-6.4, FR-1354 | example | PENDING | |
| U1454 | `remedyFor` gives the sign-in remedy for the category `unauthorized` | AC-6.4, FR-1354 | example | PENDING | |
| U1455 | `remedyFor` gives nothing for unrelated text with status 500 and another category | AC-6.4, FR-1354 (boundary) | example | PENDING | |

### `src/bb/adapter.ts`: failure cause (H3)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1456 | `getFailureCause` lists the types `provider/error` and `system/error` with order `desc` and limit `"1"` | FR-1351 | example | PENDING | |
| U1457 | It returns the event's `detail` when that is a non-blank string | FR-1351 | example | PENDING | |
| U1458 | It returns the event's `message` when `detail` is missing or blank | FR-1351 | example | PENDING | |
| U1459 | It returns null for an empty list and for an event with a blank `detail` and `message` | AC-6.5 | example | PENDING | |
| U1460 | An SDK error is not caught | AC-6.5 | example | PENDING | |

### `src/wiring/handlers.ts` (H3)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1461 | A cause follows an error-text evidence: `worker thread failed: <text>. Provider-reported cause: "<cause>"` | AC-6.1, FR-1352 | example | PENDING | |
| U1462 | A cause follows a turn-failure evidence (category and HTTP) | AC-6.1, FR-1352 | example | PENDING | |
| U1463 | A cause follows the fallback evidence "worker thread entered the error state" | AC-6.1, FR-1352 | example | PENDING | |
| U1464 | A remedy adds a second line "Remedy: ..." and the cause line is unchanged | AC-6.4, FR-1354 | example | PENDING | |
| U1465 | With no cause the evidence is today's text for the error-text, turn-failure, and fallback cases | AC-6.5, FR-1356 | example | BASELINE | `src/wiring/handlers.test.ts::[U135]`, `[U136]`, `[U137]` |
| U1466 | A throw from the cause read leaves today's evidence, still records the failure, and logs a warning | AC-6.5, FR-1356 | example | PENDING | |
| U1467 | The cause in the evidence is flattened and bounded | AC-6.6, FR-1355 | example | PENDING | |
| U1468 | The cause is read once, after the grace wait for an empty error text | plan: edge case, grace wait | example | PENDING | |
| U1469 | A failure in a state that the handler ignores does not read the cause | FR-1352 (boundary) | example | PENDING | |

### `src/wiring/wake.ts` (H3)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1470 | A `failed` task keeps evidence of exactly 1200 characters whole in the wake message | AC-6.3, FR-1353 (boundary) | example | PENDING | |
| U1471 | A `failed` task cuts evidence of 1201 characters to 1199 and an ellipsis | AC-6.3, FR-1353 (boundary) | example | PENDING | |
| U1472 | A task in any other state keeps 600 characters, and `needs_decision` keeps 8000 | FR-1353 (the limits stay) | example | BASELINE | `src/wiring/wake.test.ts::[U128]`, `[U214]` |

### `src/limits/queue.ts`: model checks at queue start (H2)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1473 | A queued task whose profile fails the model or level check stays queued, spawns nothing, and the log names the message | FR-1347, AC-5.3 | example | PENDING | |

## Invariants and edge cases still to place

- FR-1318 and SC-1309: the fixture defaults (every listed provider `ready`, a generous model list, no error events) keep every existing test meaning what it meant.
  The proof is that no existing test changes except the ones in the plan's "Test changes in order" table, and the cycle log records each change.
- FR-1371: the state machine, the store, the event log, the hard rules, the tools' authority checks, the merge and teardown gates, the placement rules, the validator, and the supervisor and validator role handling do not change.
  The proof is that the existing suites for those areas pass unchanged, and the audit checks the diff for any touched file outside the plan's layout.
- Scout tasks on Pi in a `local-only` project are refused (A1316 covers ship and scout).
- Principle V for guard tests: where a guard (a lint rule, a fixture default) can only follow its code, the cycle log records a revert-red, as D-099 did.

## Out of scope

- H4 (`supervisor start`), H6 to H9 (conformance suite, fake model server, offline lab, docs rewrite), H12 (the `roles` block), H13 (tier 2 runs), and H14 (a worker hint that is on): not in the captain's task.
- Any real-model run, any credential, and any change to the supervisor or validator role handling.
- The live check: `providerStates` coverage of the tier 1 stub agent, the model field a spawn resolves, and the shape of stored error events. They are the owner's steps (`quickstart.md`, part 2).
- A change to the state machine or to the hard rules.
- Reading `providerStates` for a project's validator agent: that is H12.

## Deliberate mutants for the audit

No mutation tool is installed, so `/speckit.tdd.verify` applies these by hand and records which tests killed each one.

| id | mutant | killed by |
| --- | --- | --- |
| M1 | Readiness passes any status except `not_installed` | U1324 to U1330, A1301 to A1304 |
| M2 | The listing check runs before the readiness check | U1332 |
| M3 | The Pi row refuses `direct-PR` and allows `local-only` | U1358 to U1360, A1316, A1317 |
| M4 | The queue start skips `admit` | U1367, A1320 |
| M5 | `ladderFor` returns the default ladder for a record | U1397, U1400, A1336 |
| M6 | `ladderFor` throws for a provider the record omits | U1398, U1402, A1337 |
| M7 | `remedyFor` tests the sign-in patterns before the model patterns | U1451 |
| M8 | `writeNew` opens the file with `w` and not `wx` | U1406, U1435, A1326 |
| M9 | The tool hint is on by default | U1312, A1313 |
| M10 | The hint is returned for a supervisor | U1316, A1315 |
| M11 | `contractFor` reads a plain object by key, so `constructor` returns a function | U1311 |
| M12 | `boundCause` cuts at 299 or at 301 | U1447, U1448 |
| M13 | The `failed` wake limit stays 600 | U1470, U1471, A1341 |
| M14 | The level check uses the provider-wide list even when the model's levels are known | U1374, A1330 |
| M15 | The Pi row accepts unlisted models | U1379, A1332 |
| M16 | The state lookup uses the first state and not the one with the profile's ID | U1331 |
| M17 | A failed read of the states, models, or providers counts as a pass | U1342 to U1344, A1304, A1338 |
| M18 | The cause read lists in ascending order, so it returns the oldest event | U1456, A1339 |
| M19 | The dispatch tool skips the gate for an explicit `profile` | A1318 |
| M20 | `admit` runs after the bb reads | U1365 |

## Verification commands

Copied from `.specify/memory/tdd-profile.md` at planning time:

- Single test: `pnpm vitest run {file} -t "{name}"`
- File: `pnpm vitest run {file}`
- Full suite: `pnpm test`
- Coverage: none installed
- Mutation: none installed (the audit uses the deliberate mutants above)
- Acceptance: `pnpm vitest run {file}`
- Whole gate: `pnpm run check`
