---
description: "Task list for agent-harness independence"
---

# Tasks: Agent-harness independence

**Input**: `specs/009-harness-independence/spec.md`, `plan.md`, `data-model.md`, `research.md`, `contracts/`, `quickstart.md`
**Tests**: Mandatory. Every behavior has its test task before its code task, and the test is observed failing first (constitution principle V).
`/speckit.tdd.plan` ties each task to a behavior in `tdd/test-list.md` with a bracketed id, and `/speckit.tdd.run` ticks the task when the behavior is done.
The cycle log records the red evidence. Tests are never weakened, skipped, or deleted to reach green.
A fixture change is not a behavior. It sits first in the phase that needs it, and the tests that use it prove it.

**Build order**: H5 (story 2), H1 (story 1), H11 (story 3), H2 (story 5), H10 (story 4), H3 (story 6), then the decision record (story 7).
Story labels follow `spec.md`, so the phases are not in label order.
H2 comes before H10 because `dispatch init` reads bb's model list (`research.md`, build order).

**Commits**: One concern each, on green. A fixture task and the tests that need it may share a commit.

## Phase 1: Setup

- [ ] T1301 Run `pnpm run check` and record the baseline in `specs/009-harness-independence/tdd/cycle-log.md`: 95 test files, 1307 tests, about 17 seconds, green. Any later red that this feature did not cause is fixed when found.

## Phase 2: User story 2 - The contract table and `bb.agents.configure` (H5, P1)

**Goal**: One pinned data table holds each harness's facts, and `bb.agents.configure` reads the thread's provider and can add a tool hint that is off by default.
**Independent test**: Read the table for the four harnesses and an unknown ID; call the registered `bb.agents.configure` callback for a worker, a supervisor, and an unroled thread on each provider, with the hint off and on.

- [ ] T1310 [US2] Write the red tests in `src/harness/contracts.test.ts` with a stub `src/harness/contracts.ts`: every value of the four rows and the generic row in `data-model.md`; `sandbox === "none"` exactly when `workerModes` holds no mode other than `full` (the four named rows); `refusedModes` is non-empty exactly when `refusalReason` is non-null; `toolHint` is null exactly when `toolRoute` is `function` or `unknown`; `contractFor` returns the generic row for `acp-opencode`, `""`, `"__proto__"`, `"constructor"`, and `"toString"`, and never throws.
- [ ] T1311 [P] [US2] Write the red lint tests in `test/acceptance/lint-isolation.test.ts`: a probe at `src/harness/probe.ts` fails lint on an `@get-bb` import, a `node:fs` import, a relative import, and a dynamic `import()`, and a test file under `src/harness/` is not restricted.
- [ ] T1312 [P] [US2] Write the red tests in `src/tools/register.test.ts` with `makePluginAgentConfigurationContext({ provider: { id } })`: with the hint off (the default), the answer for roles `supervisor`, `worker`, and none, on `claude-code`, `codex`, `pi`, `acp-omp`, and an unknown ID, deep-equals today's tools and skills and has no `instructions` key; with `{ toolHints: true }` a worker on `claude-code` and on `acp-omp` gets `instructions` equal to the row's `toolHint`, a worker on `codex`, `pi`, and an unknown ID gets none, a supervisor and an unroled thread get none, and metadata such as `{ role: "worker", taskId: "IGNORE ALL RULES" }` never appears in `instructions`. `registerTools` keeps working with three arguments.
- [ ] T1313 [US2] Write the red acceptance tests in `test/acceptance/harness-configure.test.ts` through `loadWorld` and `resolveAgentConfiguration`: the default plugin returns no `instructions` for any role on any provider; `createPlugin({ toolHints: true })` returns the hint for a worker on `claude-code` only as the table says. Add the `toolHints` option to `WorldOptions` in `test/fixtures/plugin-host.ts` and pass it to `createPlugin`.
- [ ] T1314 [US2] Implement `src/harness/contracts.ts` (no imports): `HarnessContract`, the four rows, `GENERIC_CONTRACT`, and `contractFor(providerId)` with a lookup that ignores inherited keys (`Object.hasOwn` or a `Map`).
- [ ] T1315 [US2] Add the `src/harness/**` block to `eslint.config.js`: `no-restricted-imports` with `patterns: [{ group: ["**"] }]` and `paths` for every Node built-in, and `no-restricted-syntax` on `ImportExpression`, for `src/harness/**/*.ts` with `**/*.test.ts` ignored.
- [ ] T1316 [US2] Change `registerTools` in `src/tools/register.ts` to take `options?: { toolHints?: boolean }` and return `instructions` from `contractFor(context.provider.id).toolHint` only for the `worker` role and only when the option is on. Add `toolHints?: boolean` to `PluginOptions` in `src/server.ts` and pass it through. Default off.
- [ ] T1317 [US2] Outer loop: the story 2 tests are green and `pnpm run check` is green.

## Phase 3: User story 1 - A harness that cannot run is refused before a task exists (H1, P1)

**Goal**: Dispatch, the queue start, and the remote preflight pass a provider only when bb reports it `ready` on the target host.
**Independent test**: Script the fake bb so that each state is not `ready`, dispatch, and check the answer, the task count, and the spawn count.

- [ ] T1320 [US1] Write the red tests in `src/bb/adapter.test.ts` for `getProviderStates`: it calls `bb.sdk.system.providerStates` with no argument for no host and `{ hostId }` for a host; it keeps `providerId`, `status`, `installedVersion`, `minimumSupportedVersion`, `localLoginCommand`, and `statusMessage`; a status outside `ready`, `not_installed`, `unauthenticated`, `expired`, `unsupported_version`, and `unknown` becomes `unknown`; an SDK error is not caught.
- [ ] T1321 [US1] Add `ProviderState` and `getProviderStates(hostId?)` to `src/bb/port.ts` and implement them in `src/bb/adapter.ts`.
- [ ] T1322 [P] [US1] Fixture: give `FakeBbPort` in `test/fixtures/bb-port.ts` the fields `states`, `statesByHost`, and `statesError`, and a default that derives one state per listed provider (`ready` when `available`, `not_installed` otherwise), so every existing test keeps its meaning.
- [ ] T1323 [P] [US1] Fixture: give `loadWorld` in `test/fixtures/plugin-host.ts` the options `providerStates`, `providerStatesByHost`, and `providerStatesError`, a `system.providerStates` fake with the same derived default, and a `world` field that records the host IDs it was asked for.
- [ ] T1324 [US1] Write the red tests in `src/dispatch/availability.test.ts` for the new `checkProfile(profile, facts)` with `facts = { host, providers, states, models }`: `ready` passes; `not_installed`, `unauthenticated` (with and without a login command), `expired`, `unsupported_version` (with and without versions), `unknown` (with and without a status message), and a missing state each return the message in `contracts/dispatch-gate.md`; readiness comes before the provider listing, the listing before the permission mode, and the mode before the coarse level; today's three messages stay word for word. Existing cases move to the new signature.
- [ ] T1325 [US1] Write the red tests in `src/dispatch/gate.test.ts` for `gateProfile(bb, profile, mode, host)` over `FakeBbPort`: a ready profile returns `{ ok: true }`; the three reads use the placed host's ID (a remote host's own states decide); a throw from the providers read, the states read, or the models read returns `read_failed` with the text in `contracts/dispatch-gate.md`; a block returns `provider_unavailable` with `permanent: false`.
- [ ] T1326 [P] [US1] Write the red tests in `src/machines/preflight.test.ts`: the `agent_cli` problem for a named provider uses the host's states and the readiness text; a provider-less preflight fails when no listed provider is `ready`; a listed provider whose state is `unauthenticated` fails; a pass is still cached and a failure is not.
- [ ] T1327 [P] [US1] Write the red tests in `src/limits/queue.test.ts`: a queued task whose provider is not `ready` stays queued and the log holds the message; a read failure keeps it queued; a ready provider starts it.
- [ ] T1328 [US1] Write the red acceptance tests in `test/acceptance/harness-readiness.test.ts` through `loadWorld`: for each of `not_installed`, `unauthenticated`, `expired`, `unsupported_version`, `unknown`, a missing state, and a failed read, `factoryman_dispatch` is an error that names the provider, the host, and the remedy, `world.store` holds no task, and `threads.spawn` has no call; with `maxTasksPerDay: 1` in `workflow.json`, a blocked dispatch followed by a ready one still dispatches (no slot used); a task pinned to a machine uses that machine's states; `bb factoryman preflight` for a remote machine prints the same remedy; with all states `ready`, dispatch behaves as before.
- [ ] T1329 [US1] Update the existing tests that the new gate changes, each recorded in the cycle log: `src/tools/dispatch.test.ts` and `test/acceptance/tools-dispatch.test.ts` where a test scripts an unavailable provider (the message now comes from the state), `src/machines/preflight.test.ts` and `test/acceptance/machine-remote.test.ts` where the fake lists providers, and the queue tests in `test/acceptance/limits-queue.test.ts`.
- [ ] T1330 [US1] Implement the new `checkProfile(profile, facts)` in `src/dispatch/availability.ts`: readiness (R1, R2) first, then the listing, then the mode, then the coarse level check. Export the readiness function for the preflight.
- [ ] T1331 [US1] Create `src/dispatch/gate.ts` with `gateProfile(bb, profile, mode, host)`: read providers, states, and models together, call `checkProfile`, and return `GateResult` from `data-model.md`. The models read is added in T1360, so this task reads providers and states and passes an empty `ModelList` that T1360 replaces.
- [ ] T1332 [US1] Change `src/tools/dispatch.ts` to call `gateProfile` where it called `checkProfile`, and print `Dispatch blocked (<code>): <message> No task was created.` or `Dispatch failed: <message>. No task was created.`
- [ ] T1333 [US1] Change `startOne` in `src/limits/queue.ts` to call `gateProfile`: a block keeps the task queued and logs `Task <id> stays queued: <message>`.
- [ ] T1334 [US1] Change `runPreflight` in `src/machines/preflight.ts` to take `Pick<BbPort, "listProviders" | "getProviderStates">` and judge the `agent_cli` check with the shared readiness function. Update `src/tools/supervisor-command.ts` and `src/tools/dispatch.ts` call sites that build the deps.
- [ ] T1335 [US1] Outer loop: the story 1 tests are green and `pnpm run check` is green.

## Phase 4: User story 3 - Pi runs only where branch protection is the backstop (H11, P1)

**Goal**: A profile whose provider's row refuses the project's delivery mode is blocked before any task exists, on every path to a spawn.
**Independent test**: Dispatch a Pi profile in each of the three modes.

- [ ] T1340 [US3] Write the red tests in `src/dispatch/gate.test.ts` for `admit(providerId, mode)` and for `gateProfile` with admission: Pi is refused in `local-only` and allowed in `direct-PR` and `no-mistakes`; `claude-code`, `codex`, `acp-omp`, `acp-opencode`, and an unknown ID are never refused; the refusal returns `provider_not_admitted` with `permanent: true` and the message in `contracts/dispatch-gate.md` (provider, mode, reason, allowed modes, "No other provider was tried."); admission runs before any bb read (the fake records zero calls on a refusal).
- [ ] T1341 [P] [US3] Write the red tests in `src/limits/queue.test.ts`: a queued Pi task in `local-only` mode fails with the evidence `The queued task can no longer start: <message>` and starts no worker; a queued task that fails a readiness check still stays queued.
- [ ] T1342 [US3] Write the red acceptance tests in `test/acceptance/harness-admission.test.ts` through `loadWorld` and `world.setProject`: a Pi profile from an explicit override, from a matching rule, and from the configured default is refused in `local-only` (ship and scout) and dispatches in `direct-PR` and `no-mistakes` (permission mode `full`); a refused dispatch creates no task and spawns no worker; the answer lists the allowed modes; no other provider is tried.
- [ ] T1343 [US3] Add `provider_not_admitted` to `BlockCode` in `src/dispatch/types.ts`, implement `admit` in `src/dispatch/gate.ts` from `contractFor`, and call it first in `gateProfile`. Make `src/limits/queue.ts` fail the task with evidence when `permanent` is true.
- [ ] T1344 [US3] Outer loop: the story 3 tests are green and `pnpm run check` is green.

## Phase 5: User story 5 - A model and a level are checked against the model bb lists (H2, P2)

**Goal**: The level check reads the model's own levels, an unknown model is refused with the choices, and the reasoning floor ranks in the provider's ladder.
**Independent test**: Script the fake bb with the model lists from the report and dispatch the four cases.

- [ ] T1350 [US5] Write the red tests in `src/bb/adapter.test.ts` for `listModels`: it passes `providerId` and, when given, `hostId`; each model keeps `id`, `model`, `isDefault`, `defaultReasoningLevel` (from `defaultReasoningEffort`), `reasoningLevels` (the `reasoningEffort` of each `supportedReasoningEfforts` entry), and `reasoningKnown` (`reasoningDiscovery === "known"`); `modelLoadError` becomes `loadError` with `code` and `detail`, or `null`; an SDK error is not caught.
- [ ] T1351 [US5] Add `ModelEntry`, `ModelList`, and `listModels(providerId, hostId?)` to `src/bb/port.ts` and implement them in `src/bb/adapter.ts`.
- [ ] T1352 [P] [US5] Fixture: give `FakeBbPort` in `test/fixtures/bb-port.ts` the fields `models`, `modelsByHost`, and `modelsError`, with the default list in the plan (`opus`, `sonnet`, `haiku`, `claude-sonnet-5-5`, `stub-model`, `m`, `b`, `other`, `opus-strict`; levels low to max; all `known`) for every provider. Give `loadWorld` in `test/fixtures/plugin-host.ts` the options `models`, `modelsByHost`, and `modelsError`, a `providers.models` fake, and the same default.
- [ ] T1353 [US5] Write the red tests in `src/dispatch/config.test.ts`: `reasoningLevels` accepts an array and a record keyed by provider ID; rejects a blank key, an empty array, and a duplicate level in any array ("a key is non-blank; an array is non-empty and has no duplicate"); `ladderFor` returns the array for any provider, the record's entry, and `DEFAULT_REASONING_LEVELS` for a provider with no entry; the empty config keeps the default array.
- [ ] T1354 [P] [US5] Write the red tests in `src/dispatch/resolver.test.ts`: with a record that gives Codex a ladder ending in `ultra`, an explicit Codex profile at `ultra` against a Codex baseline at `high` passes, and one below the baseline blocks with `reasoning_lowered` and not "cannot be ranked"; a provider with no entry ranks in the default ladder; a baseline level that is not on the explicit profile's ladder blocks with "cannot be ranked" unless `standingPermission.lowerReasoning` is on; the array form behaves as before.
- [ ] T1355 [US5] Write the red tests in `src/dispatch/availability.test.ts` for the model checks: a listed model with `known` levels passes a level that the provider-wide list lacks (omp `off`); a level that the model does not list is refused with the message in `contracts/dispatch-gate.md`; a listed model with `unknown` levels uses the provider-wide list; an unlisted model on `pi`, `acp-omp`, and an unknown provider is refused with the list of model IDs or "no models", plus the load error when bb gives one; an unlisted model on `claude-code` and `codex` falls back to the provider-wide list; a profile matches a model by `id` or by `model`.
- [ ] T1356 [P] [US5] Write the red tests in `src/dispatch/gate.test.ts`: the gate reads the models of the profile's provider on the placed host; a models read that throws returns `read_failed` with `could not read bb's models (<error>)`.
- [ ] T1357 [US5] Write the red acceptance tests in `test/acceptance/harness-models.test.ts` through `loadWorld`: omp `off` passes; Codex `ultra` ranks with a record ladder and a lowered level blocks; a level that the model does not list is refused; an unknown model on Pi lists the choices; Pi with no models says bb lists none and names the load error; a queued task repeats the check.
- [ ] T1358 [US5] Update the existing tests that the model checks change, each recorded in the cycle log: the level cases in `src/dispatch/availability.test.ts`, and any `src/tools/dispatch.test.ts` or acceptance case that dispatches a model the default list does not name.
- [ ] T1359 [US5] Change `DispatchConfig.reasoningLevels` in `src/dispatch/types.ts` and `src/dispatch/config.ts` to the array-or-record form, add `ladderFor`, and rank in `ladderFor(config.reasoningLevels, choice.profile.provider)` in `src/dispatch/resolver.ts`.
- [ ] T1360 [US5] Implement R4 in `src/dispatch/availability.ts` (the model and level checks, with `contractFor(profile.provider).unlistedModels`) and make `src/dispatch/gate.ts` read the models in place of the empty list from T1331.
- [ ] T1361 [US5] Outer loop: the story 5 tests are green and `pnpm run check` is green.

## Phase 6: User story 4 - No harness is chosen silently (H10, P1)

**Goal**: The plugin has no built-in profile, the last rung blocks with a hint, and `dispatch init` writes a starter file.
**Independent test**: Dispatch in a project with no config and read the block; run `bb factoryman dispatch init --provider <id>` against a temporary checkout; dispatch again.

- [ ] T1370 [US4] Write the red tests in `src/files.test.ts` for `writeNew`: it creates the missing directory and the file and returns `written`; it returns `exists` for an existing file and leaves that file unchanged; it rethrows any other error.
- [ ] T1371 [US4] Add `writeNew(path, text): Promise<"written" | "exists">` to `Files` and `nodeFiles` in `src/files.ts` (`mkdir` with `recursive`, then `writeFile` with `flag: "wx"`, mapping `EEXIST` to `exists`), and to `FakeFiles` in `test/fixtures/files.ts` (a `writes` list and the same exclusive behavior).
- [ ] T1372 [US4] Write the red tests in `src/dispatch/resolver.test.ts`: with no override, rule, or default the resolver returns `blocked` with `no_default_profile` and the message in `contracts/dispatch-gate.md`; `BUILTIN_PROFILE` is no longer exported; an explicit profile, a rule, and a configured default resolve as before.
- [ ] T1373 [US4] Write the red tests in `src/dispatch/init.test.ts` for the command in `contracts/cli-dispatch-init.md`: argument parsing (missing `--provider`, missing project, a flag without a value, a blank value, a repeated flag, an unknown flag all give code 2 and the usage); the default model, level, and mode rules; each flag override; each exit-1 case with its message; `exists` writes nothing and says so; the written text parses with `parseDispatchConfig`, holds `version: 1`, one profile keyed by the provider ID, `default` set to it, and `rules: []`, and ends with a newline; the command makes no call that changes bb and reads no credential.
- [ ] T1374 [P] [US4] Write the red tests in `src/tools/supervisor-command.test.ts`: `dispatch init` is routed to the new command, `dispatch` with any other subcommand prints the usage with code 2, and the usage lists the new line.
- [ ] T1375 [US4] Write the red acceptance tests in `test/acceptance/harness-default.test.ts` through `loadWorld` with a temporary checkout: a project with no `dispatch.json` blocks with the init hint and no task; the registered command writes the file; the next dispatch passes the profile source check and says `from the configured default`; a second run writes nothing; a project with a `dispatch.json` that has no `default` and no matching rule blocks with the same hint.
- [ ] T1376 [US4] Update the existing tests that the removal changes, each recorded in the cycle log: `src/dispatch/resolver.test.ts` lines 60 and 92 to 93, `test/acceptance/dispatch-resolver.test.ts` lines 88 to 90, `test/acceptance/live-check.test.ts` where it asserts the "built-in default" line, and the usage assertions in `test/acceptance/limits-cutover.test.ts` and `src/tools/dispatch.test.ts` if they pin the usage text.
- [ ] T1377 [US4] Remove `BUILTIN_PROFILE` and the `"builtin"` source from `src/dispatch/resolver.ts` and `src/dispatch/types.ts`, add `no_default_profile` to `BlockCode`, return the block on the last rung, and drop the `builtin` entry of `SOURCE_TEXT` in `src/tools/dispatch.ts`.
- [ ] T1378 [US4] Create `src/dispatch/init.ts` with the command and route `dispatch init` from `src/tools/supervisor-command.ts` (usage text included). Register the `dispatch` entry in `bb.cli.register` in `src/server.ts` with the usage line from `contracts/cli-dispatch-init.md`.
- [ ] T1379 [US4] Outer loop: the story 4 tests are green and `pnpm run check` is green.

## Phase 7: User story 6 - A failed worker says why (H3, P2)

**Goal**: The `fail` evidence and the wake text carry the provider's reported cause, bounded, with an advisory remedy.
**Independent test**: Replay the four failure shapes from the report through the event handlers and read the evidence and the wake message.

- [ ] T1380 [US6] Write the red tests in `src/wiring/failure-cause.test.ts` with a stub module: `boundCause` replaces each run of control characters (line breaks and tabs included) with one space, collapses repeated spaces, trims, and cuts to 300 characters with `...` at the end when cut, and leaves the four report causes unchanged; `remedyFor` returns the model remedy for "No model selected" and "Failed to resolve Pi model" (checked before sign-in, so "No model selected. Use /login, set an API key" is a model problem), the sign-in remedy for "Not logged in · Please run /login", for status 401, and for category `unauthorized`, and null otherwise.
- [ ] T1381 [P] [US6] Write the red tests in `src/bb/adapter.test.ts` for `getFailureCause`: it lists `types` `provider/error` and `system/error` with `order: "desc"` and `limit: "1"`; it returns `data.detail` when non-blank, else `data.message` when non-blank, else `null`; an empty list is `null`; an SDK error is not caught.
- [ ] T1382 [US6] Add `getFailureCause(threadId)` to `src/bb/port.ts` and `src/bb/adapter.ts`. Fixture: give `FakeBbPort` the fields `failureCauses` and `failureCauseError`, and give `loadWorld` a `threads.events.list` fake over `world.threadEvents` (it applies `types`, `order`, and `limit`) and an `eventsError` option.
- [ ] T1383 [US6] Write the red tests in `src/wiring/handlers.test.ts`: a `thread.failed` with a cause appends `. Provider-reported cause: "<cause>"` after today's evidence for the error-text, turn-failure, and bare cases; a remedy adds a second line; no cause, a null cause, and a read failure leave today's evidence and log a warning; evidence stays non-empty. Write the red tests in `src/wiring/wake.test.ts`: a `failed` task keeps 1200 characters of evidence and every other state keeps 600 (and `needs_decision` keeps 8000).
- [ ] T1384 [US6] Write the red acceptance tests in `test/acceptance/harness-failure.test.ts` through `loadWorld`: the four causes from the report's section 5.1 (Claude Code "Not logged in · Please run /login", omp "Internal error: No model selected. Use /login, set an API key ...", Pi "Failed to resolve Pi model ...", Codex category `connection-failed` with HTTP 401 and a cause event) each appear verbatim in the `fail` evidence and in the text sent to the supervisor; a long cause with line breaks is bounded and flattened.
- [ ] T1385 [US6] Create `src/wiring/failure-cause.ts` (`boundCause`, `remedyFor`), read the cause in `threadFailed` in `src/wiring/handlers.ts` after today's evidence is built, and raise the `failed` evidence limit to 1200 in `src/wiring/wake.ts`. Update the existing handler and wake expectations that the new behavior changes, each recorded in the cycle log.
- [ ] T1386 [US6] Outer loop: the story 6 tests are green and `pnpm run check` is green.

## Phase 8: User story 7 - The decision record matches the code (P2)

**Goal**: `docs/DECISIONS.md`, `docs/DESIGN.md`, and `docs/LIVE-CHECK.md` agree with the code.
**Independent test**: `test/acceptance/harness-docs.test.ts` passes.

- [ ] T1390 [US7] Write the red tests in `test/acceptance/harness-docs.test.ts`: `docs/DECISIONS.md` holds D-100 to D-107 in order with a heading and a status each; D-100 names D1 to D5 and the tasks built and open; D-063 and D-064 keep their text and carry an "Amended by" line; no file under `docs/` or `skills/` says that the plugin has a built-in default profile; `docs/DESIGN.md` rung 4 and `docs/LIVE-CHECK.md` no longer name it; `CLAUDE.md` is byte for byte unchanged (compare with `git show HEAD:CLAUDE.md`).
- [ ] T1391 [US7] Write D-100 to D-107 and the "Amended by" lines for D-063 and D-064 in `docs/DECISIONS.md` (one sentence per line, sentence case headings, active voice). D-107 lists every existing test that changed with its cycle number.
- [ ] T1392 [P] [US7] Change rung 4 of the precedence list in `docs/DESIGN.md` to say that dispatch blocks and names `bb factoryman dispatch init`, and change the "built-in default" line of `docs/LIVE-CHECK.md` (section 3, the dispatch config row) to match.
- [ ] T1393 [P] [US7] Add a note to `.specify/memory/tdd-profile.md` for the new fixtures and options (`providerStates`, `models`, `threadEvents`, `toolHints`, `FakeFiles.writeNew`) and for the 009 test files.
- [ ] T1394 [US7] Outer loop: the story 7 tests are green and `pnpm run check` is green.

## Phase 9: Polish and the final gate

- [ ] T1395 Run `pnpm run check`, then `pnpm run build` (it needs the `bb` CLI). Record the counts and the result in `tdd/cycle-log.md`, and fix any red that is found, whatever caused it.
- [ ] T1396 Review the diff size. If the diff is too large to review in one pull request, split it at the end of Phase 6 (stories 2, 1, 3, 5, 4 in one, story 6 and the docs in the other) and record the split in the final status line.
- [ ] T1397 Confirm that `git status` is clean, that `CLAUDE.md` and `CHANGELOG.md` are unchanged, that no commit carries a co-author line, and that no file outside the worktree changed except the task's data directory and the status file.

## Owner steps (not built here)

These are the live-check items from `quickstart.md`, part 2.
They need a bb 0.49.0 lab and are the owner's step.
No task above does them, and no task claims them.

- Confirm that `providerStates` returns a record for each provider, including the tier 1 stub agent (`research.md`, open point 1).
- Dispatch to a signed-out provider and confirm the block and the absence of a task.
- Run `dispatch init` in a lab project and dispatch from the starter file.
- Confirm the Pi admission block in a `local-only` lab project.
- Confirm the model field that a spawn resolves (`id` or `model`) and record it in `spike/RESULTS.md`.
- Confirm that a failed worker's evidence holds the harness's cause text.
- Tier 2 runs, credentials, H4, H6 to H9, and H12 to H14 stay out of scope.

## Dependencies and execution order

- Phase 1 first, then Phase 2 (story 2), because the Pi row in the table feeds story 3 and the `unlistedModels` column feeds story 5.
- Phase 3 (story 1) needs Phase 2 only for `contractFor`, which `checkProfile` reads in Phase 5, so Phase 3 can start once T1314 is done.
- Phase 4 (story 3) needs Phase 3 (`gateProfile`) and Phase 2 (the Pi row).
- Phase 5 (story 5) needs Phase 3 (the gate and the `checkProfile` signature).
- Phase 6 (story 4) needs Phase 5 (`listModels`) for the starter's model.
- Phase 7 (story 6) is independent of Phases 3 to 6. It follows them in this plan, because the build order puts it last.
- Phase 8 needs Phases 2 to 7. Phase 9 runs last.
- Inside a phase: tests, then fixtures they need, then code, then the outer loop.

## Parallel opportunities

- T1311 and T1312 (different files) after T1310.
- T1322 and T1323 (two fixtures), and T1326 and T1327 (two test files), after T1321.
- T1341 beside T1340, and T1352 beside T1350.
- T1354, T1356 beside T1353 and T1355.
- T1374 beside T1373, and T1392 and T1393 beside T1391.
- Phase 7 can run beside Phase 5 or 6 if a second pair of hands exists. This plan runs it last.

## Implementation strategy

- The smallest useful increment is Phases 1 to 3 (story 2, then story 1): the readiness gate turns the most common non-Claude failure into an early, specific block.
- Each later phase leaves `pnpm run check` green, so the work can stop or split after any outer-loop task.
- The shared `gateProfile` is the spine. Stories 3 and 5 add a check to it, and story 4 reuses its pure checks, so none of them adds a second path to a spawn.
