# Implementation plan: Agent-harness independence

**Branch**: `fm/bb-factoryman-harness-contracts` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)

## Summary

Make the plugin judge a harness by what bb says about it and not by what the plugin assumes.
Six small changes, each behind its own tests, in this order: H5 (a pinned contract table and the provider-aware `bb.agents.configure`), H1 (a readiness gate from bb's provider states), H11 (the Pi admission rule), H2 (model-aware checks and per-provider ladders), H10 (no built-in default, plus `dispatch init`), and H3 (the cause of a worker failure).
H2 comes before H10 because `dispatch init` reads bb's model list, and H2 adds that read.
The state machine, the store, the hard rules, the validator, and the supervisor and validator role handling do not change.
One shared function, `gateProfile`, applies every profile check, and both `factoryman_dispatch` and the queue start call it, so no path to a spawn skips a gate.

## Technical context

- Language and tooling: TypeScript 6 (binary `tsc6`), ESM, Node 26, `pnpm` 12, `vitest` 5, `zod` 4.
  No dependency is added.
- bb facts (SDK 0.6.104, read from `bundled-types/bb-plugin-sdk.d.ts`; the live check confirms them against bb 0.49.0):
  - `bb.sdk.system.providerStates(args?: { hostId?, environmentId?, capability? })` returns `{ providers: [{ providerId, status, installedVersion, minimumSupportedVersion, localLoginCommand, loginCommand, statusMessage, ... }] }`.
    `status` is one of `ready`, `not_installed`, `unauthenticated`, `expired`, `unsupported_version`, `unknown`.
  - `bb.sdk.providers.models({ providerId?, hostId?, projectId? })` returns `{ models: [...], modelLoadError: { code, detail, providerId } | null, ... }`.
    A model has `id`, `model`, `isDefault`, `defaultReasoningEffort`, `supportedReasoningEfforts: [{ reasoningEffort }]`, and `reasoningDiscovery: "known" | "unknown"`.
  - `bb.sdk.threads.events.list({ threadId, types?, order?: "asc" | "desc", limit?: string })` returns rows `{ type, seq, data }`.
    The `provider/error` and `system/error` events carry `message` and an optional `detail`.
  - `bb.agents.configure` may return `instructions` (at most 4096 characters), and its context carries `provider: { id, model, capabilities }`.
  - `makePluginAgentConfigurationContext(overrides)` in `@get-bb/plugin-sdk/testing` builds a context for tests, and `host.harness.behavior.resolveAgentConfiguration` runs the callback.
- Storage: none.
- Test doubles: `FakeBbPort` and the `loadWorld` fake plugin host gain the three reads.
  Their defaults keep every existing test meaning what it meant (see "Test changes in order").
- Constraint: `src/harness/contracts.ts` imports nothing, so it can run anywhere and no bb change can reach it.

## Constitution check

| Principle | How the plan complies |
| --- | --- |
| I. Gates live in code and fail closed | Every new check is a refusal before a task exists. A missing state, a failed read, an unknown status, and an unlisted model all block. The Pi admission lives in dispatch and the queue start, not in a prompt. No check falls back to another provider. The eight hard rules do not change. |
| II. Machine core is pure | No change to `src/machine/`. The gate and the contract table sit outside it. |
| III. Event log is the source of truth | No change. The failure cause enters the `fail` event as evidence, which the log already stores. |
| IV. Storage behind an interface | No change. |
| V. Test first | Each behavior gets a failing test before code, recorded in `tdd/cycle-log.md`. Acceptance tests enter through the plugin factory, the registered tools, the CLI command, and the event handlers. |
| VI. Scope | The captain's intent fixes this work (D-100 will record it). It adds one CLI command that writes a file (`dispatch init`) and no tool. H4, H6 to H9, and H12 to H14 stay out. The live install stays the owner's step. `factoryman_decide` stays out (D-057). |

Result: no violation, so no complexity tracking.
The scope text of principle VI lists milestones 1 to 11, and this work extends them by the captain's word.
D-068 is the precedent: the constitution follows the captain's intent, and D-100 records it.
The plan does not edit the constitution.

## Source layout

```text
src/harness/contracts.ts            # new: HarnessContract rows, contractFor(), no imports
src/harness/contracts.test.ts       # new: pins every value
src/bb/port.ts                      # + ProviderState, ModelList, getProviderStates, listModels, getFailureCause
src/bb/adapter.ts, adapter.test.ts  # + the three reads
src/dispatch/availability.ts        # rewritten: pure checks on facts (R1 to R4)
src/dispatch/gate.ts                # new: admit() and gateProfile(), the one shared gate
src/dispatch/gate.test.ts
src/dispatch/config.ts, types.ts    # per-provider ladders; new block codes; no "builtin" source
src/dispatch/resolver.ts            # no BUILTIN_PROFILE; last rung blocks; ranks in the provider's ladder
src/dispatch/init.ts                # new: the `dispatch init` command
src/files.ts                        # + writeNew (exclusive create)
src/machines/preflight.ts           # agent CLI check from provider states
src/tools/dispatch.ts               # calls gateProfile; no "built-in" source text
src/tools/register.ts               # reads context.provider; returns the hint when it is on
src/tools/supervisor-command.ts     # routes `dispatch init`; usage text
src/limits/queue.ts                 # calls gateProfile at queue start
src/wiring/failure-cause.ts         # new: bound the cause, pick the remedy (pure)
src/wiring/handlers.ts, wake.ts     # add the cause to the evidence; the wake limit for failed tasks
src/server.ts                       # toolHints option; the `dispatch` CLI entry
test/fixtures/bb-port.ts            # + states, models, failure causes
test/fixtures/plugin-host.ts        # + system.providerStates, providers.models, threads.events.list
test/fixtures/files.ts              # + writeNew
test/acceptance/harness-*.test.ts   # new: one file per story (see "Tests")
eslint.config.js                    # src/harness may import nothing
docs/DECISIONS.md                   # D-100 onward; D-063 and D-064 amended
docs/DESIGN.md                      # rung 4 of the profile precedence
docs/LIVE-CHECK.md                  # the "built-in default" line
.specify/memory/tdd-profile.md      # the new fixtures
```

## Design

### H5: the contract table and `bb.agents.configure`

`src/harness/contracts.ts` exports `HarnessContract`, `CONTRACTS` (the four rows), `GENERIC_CONTRACT`, and `contractFor(providerId)`.
The data model is in [data-model.md](data-model.md).
`contractFor` returns the row whose `provider` equals the ID, and the generic row otherwise.
It never throws and never maps an ID to another harness's row.
The generic row is a frozen object with the safe values: no tested versions, no known modes, unlisted models refused, no refused delivery modes.

`registerTools(bb, rt, executor, options?)` takes `options.toolHints` (default `false`).
The callback becomes:

```text
configure(context):
  base = { tools: toolsForMetadata(meta), skills: skillsForMetadata(meta) }
  if not options.toolHints or meta.role !== "worker": return base
  hint = contractFor(context.provider.id).toolHint
  return hint === null ? base : { ...base, instructions: hint }
```

The hint is a constant from the table.
No metadata value enters it, which satisfies bb's rule to quote or escape untrusted values.
`createPlugin({ toolHints })` passes the option through and defaults to off.
Nothing in `dispatch.json` or the settings exposes it, because H14 decides later whether it is needed.
The lint config bans all imports in `src/harness/**` (non-test files).

### H1: the readiness gate

**Port.**
`BbPort.getProviderStates(hostId?)` returns `ProviderState[]`.
The adapter maps `bb.sdk.system.providerStates(hostId === undefined ? undefined : { hostId })`, keeps the six fields in the data model, and maps an unrecognized status to `unknown` so a future bb status fails closed.
See [contracts/bb-port.md](contracts/bb-port.md).

**Pure checks (`src/dispatch/availability.ts`).**
`checkProfile(profile, facts)` replaces the two-argument form, where `facts` is `{ host: string, providers, states, models }` (the host label is "the default host" or the machine's name).
The order is fixed:

1. Readiness (R1, R2) from `states`: only `ready` passes; every other status and a missing state produce the messages in [contracts/dispatch-gate.md](contracts/dispatch-gate.md).
2. The provider must appear in `providers` (the permission mode and the coarse levels come from there).
3. The permission mode (R3).
4. The model and the level (R4, written under H2).

Each step returns the first problem as one message string, or `null`.
The function is pure and takes no I/O.

**The shared gate (`src/dispatch/gate.ts`).**
`gateProfile(bb, profile, mode, host)` is the one function that reads bb and applies the checks:

1. `admit(profile.provider, mode)` (H11) runs first and needs no bb call.
2. `listProviders(host)`, `getProviderStates(host)`, and `listModels(provider, host)` run together.
3. `checkProfile` judges the facts.

It returns `{ ok: true }`, `{ ok: false, code, message, permanent }`, or `{ ok: false, code: "read_failed", message }`.
`permanent` is true only for the admission refusal.
Dispatch prints `Dispatch blocked (<code>): <message> No task was created.` for a block, and `Dispatch failed: <message>. No task was created.` for a read failure.
The read failure texts keep today's `could not read bb's providers (...)` and add `provider states` and `models` variants.

**Callers.**

- `src/tools/dispatch.ts` replaces its `checkProfile(profile, await bb.listProviders(...))` block with `gateProfile`.
  The machine placement still comes first (hard rule 5), and the remote preflight still follows.
- `src/limits/queue.ts` `startOne` replaces its `checkProfile` call.
  A `permanent` block fails the task with evidence (`The queued task can no longer start: <message>`); any other block keeps it queued and logs the message, as today.
- `src/machines/preflight.ts` `runPreflight` takes `Pick<BbPort, "listProviders" | "getProviderStates">`.
  The `agent_cli` check uses the shared readiness function for the host, with the same remedy text.
  A provider-less preflight passes when at least one listed provider is `ready`.
  `preflightOnce` still caches only passes, and dispatch's own gate still runs on every call, so a later sign-out cannot hide behind the cache.

### H11: the permission floor

`admit(providerId, mode)` reads `contractFor(providerId)`.
It refuses when `refusedModes` includes `mode`, with the code `provider_not_admitted`, and the message from the row's `refusalReason` plus the list of allowed modes.
The Pi row: `sandbox: "none"`, `refusedModes: ["local-only"]`.
`mode` is the project's effective delivery mode (after `workflow.json` tightening), the same value dispatch already passes to the resolver and the queue stores in the task.
The rule keys on the mode alone, so scouts are refused too.
Because `admit` runs inside `gateProfile`, the refusal applies to every profile source and to the queue start.

### H2: model-aware checks and ladders

**Port.**
`BbPort.listModels(providerId, hostId?)` returns `ModelList = { models: ModelEntry[], loadError }`.
The adapter maps `bb.sdk.providers.models({ providerId, hostId? })`.
A model matches a profile when `profile.model` equals the entry's `id` or its `model`, because the live check has not settled which field a spawn expects.

**Checks (R4).**

- Model listed, levels known: the level must be in the model's `reasoningLevels`; the provider-wide list does not apply.
- Model listed, levels unknown: the provider-wide list applies (today's check).
- Model not listed: block with the list of model IDs (or "bb lists no models", plus the `loadError` code and detail when bb gives one), unless the row's `unlistedModels` is `accepted`.
  For an accepting row, the provider-wide list applies.
- A failed read of the model list blocks as a read failure.

**Ladders.**
`DispatchConfig.reasoningLevels` becomes `readonly string[] | Readonly<Record<string, readonly string[]>>`.
`config.ts` adds `ladderFor(levels, providerId)`: the array itself, the record's entry, or `DEFAULT_REASONING_LEVELS`.
The zod schema accepts either shape, rejects a blank key, an empty array, and a duplicate level in any array.
The resolver ranks in `ladderFor(config.reasoningLevels, choice.profile.provider)`.
A baseline level that is not on that ladder still produces the "cannot be ranked" message, so a comparison across providers fails closed unless the owner grants `standingPermission.lowerReasoning`.

### H10: no built-in default and `dispatch init`

**Resolver.**
`BUILTIN_PROFILE` and the `"builtin"` source are removed.
The last rung returns `blocked("no_default_profile", message)` with the text in [contracts/dispatch-gate.md](contracts/dispatch-gate.md).
`SOURCE_TEXT` in `src/tools/dispatch.ts` loses its `builtin` entry.

**Command (`src/dispatch/init.ts`).**
`bb factoryman dispatch init --provider <id> [--project <id>] [--model <id>] [--level <id>] [--mode <mode>]`.
[contracts/cli-dispatch-init.md](contracts/cli-dispatch-init.md) holds the exact behavior.
In short: read the project's checkout and the provider's listing and models; build one profile; check it with the same pure `checkProfile` minus readiness (`gateProfile` is not used, because init writes a file and does not start a worker); parse the whole file with `parseDispatchConfig`; write it with `Files.writeNew`.
`Files` gains `writeNew(path, text): Promise<"written" | "exists">`, which creates the directory and the file exclusively (`flag: "wx"`).
The command is not a tool, so a supervisor cannot call it.

### H3: the cause of a failure

`BbPort.getFailureCause(threadId)` returns the `detail` (or `message`) of the latest `provider/error` or `system/error` event, or `null`.
`src/wiring/failure-cause.ts` is pure: `boundCause(text)` strips control characters, collapses white space, and cuts to 300 characters; `remedyFor({ cause, category, status })` returns a remedy line or `null`.
The remedy rules run in this order, so "No model selected. Use /login" is a model problem and not a sign-in problem:

1. The cause matches `no model selected` or `failed to resolve ... model`: the model remedy.
2. The cause matches `not logged in`, `please run /login`, `unauthenticated`, or `unauthorized`, or the status is 401, or the category is `unauthorized`: the sign-in remedy.

`EventHandlers.threadFailed` builds today's evidence first, then reads the cause.
A cause appends `. Provider-reported cause: "<bounded>"`, and a remedy appends a second line.
A read failure or an empty log leaves the evidence as it is and logs a warning.
The wake limit for a `failed` task rises from 600 to 1200 characters, so the cause and the remedy survive the clip (`wake.ts`).

### Docs

`docs/DECISIONS.md` gets a section "Harness independence" with D-100 to D-107 and the amendments to D-063 and D-064 (see "Decisions to record").
`docs/DESIGN.md` rung 4 and `docs/LIVE-CHECK.md` line 176 lose the built-in default.
`CLAUDE.md` does not change.
The `LIVE-CHECK.md` rewrite, `HARNESS-SUPPORT.md`, and the tier plans are task H9 and stay out.

## Tests

Entry points and layers:

- Unit tests sit next to the code (`contracts`, `availability`, `gate`, `config`, `resolver`, `init`, `failure-cause`, `adapter`, `preflight`, `handlers`, `wake`, `register`, `files`).
- Acceptance tests (`test/acceptance/harness-*.test.ts`) load the real plugin factory into the fake host through `loadWorld`, call `factoryman_dispatch` and `bb factoryman` through the registered handlers, emit `thread.failed`, and call `resolveAgentConfiguration`.
  They are in-process and weaker than a live bb, so the quickstart names the live check that the owner runs.
- Mutation: the deliberate-mutant list in `tdd/test-list.md` covers the gate order, the `ready` comparison, the admission list, the ladder lookup, the cause precedence, and the exclusive write.

### Test changes in order

An existing test changes only when a requirement changes the behavior it asserts (SC-1309).
Each change gets a line in the cycle log and in D-107.

| Order | Task | Existing tests that change | Why |
| --- | --- | --- | --- |
| 1 | H5 | none | Additive. `registerTools` keeps its three-argument form. |
| 2 | H1 | `availability.test.ts` (new `checkProfile` signature and the `available: false` message), `preflight.test.ts` (the fake port needs states), `dispatch.test.ts` and `test/acceptance/tools-dispatch.test.ts` where a test scripts an unavailable provider (the fixture derives the state from `available`), the queue tests that script providers | R1 and R2 replace the `available` test. |
| 3 | H11 | none | Additive. |
| 4 | H2 | `availability.test.ts` (levels), `config.test.ts` (`reasoningLevels` shapes), `resolver.test.ts` (ladder), `adapter.test.ts` (additive) | Level checks move to the model; the ladder gains a record. |
| 5 | H10 | `resolver.test.ts` lines 60 and 92 to 93, `test/acceptance/dispatch-resolver.test.ts` lines 88 to 90, `supervisor-command.test.ts` and `test/acceptance/limits-cutover.test.ts` if they assert the usage text, `test/acceptance/live-check.test.ts` if it asserts the doc line | The built-in default is gone (precedent: D-067). |
| 6 | H3 | `handlers.test.ts` and `test/acceptance/wiring-events.test.ts` only if an expectation includes the full evidence and a cause is now scripted by default (the fixture default is "no cause event") | The cause adds to the evidence. |

Fixture defaults:

- `FakeBbPort.states` default: every listed provider is `ready` (or `not_installed` when `available` is false).
  `models` default: a generous list for every provider (`opus`, `sonnet`, `haiku`, `claude-sonnet-5-5`, `stub-model`, `m`, `b`, `other`, `opus-strict`) with levels low to max, all `known`.
  `failureCauses` default: none.
- `loadWorld` derives `system.providerStates` from the `providers.list` fixture the same way, `providers.models` from the same generous list, and `threads.events.list` from a per-thread map that is empty by default.
  Each has an `...Error` option and a per-host override, like the existing provider options.

## Decisions to record

- D-100: Harness independence: scope and the captain's five decisions (D1 A to D5 A).
  Records what this release builds (H1, H2, H3, H5, H10, H11) and what stays open (H4, H6 to H9, H12 to H14, tier 2).
- D-101: Readiness comes from bb's provider states and fails closed.
  Closes t01 finding 5.9.
  Notes the open point that a custom ACP provider must appear in the states.
- D-102: The harness contract table is data, and it has five columns the report did not list (`unlistedModels`, `sandbox`, `refusedModes`, `refusalReason`, `toolHint`) (Deviation from the report's section 6.2, with the reason).
- D-103: Pi is admitted in `direct-PR` and `no-mistakes` modes and refused in `local-only` (Decided by the captain, D3 A).
  Scouts are included, the queue start fails a refused task, and D-030 and D-095 stay open.
- D-104: The built-in default profile is removed (Decided by the captain, D5 A).
  Amends D-063, adds the `no_default_profile` block and `dispatch init`, the first plugin write into a checkout.
- D-105: Reasoning ladders are per provider (Gap).
  Amends D-064.
- D-106: Model checks read bb's per-model list, and unlisted models follow the row (Gap).
- D-107: Failure evidence quotes the provider's cause, with a bound and an advisory remedy (Gap).
  Lists the existing tests that changed.

D-063 and D-064 keep their text and gain an "Amended by" line.

## Risks

- **`providerStates` coverage.** A custom ACP agent (the tier 1 stub) may be absent from the states, and the gate blocks it.
  The live check settles it.
  If bb omits ACP agents, the follow-up is a contract-row opt-in and not a fail-open default.
- **Model ID field.** A spawn may expect `id` or `model`.
  The matcher accepts both; the live check confirms which one the harness resolves.
- **Pi with no credentials.** bb lists no models, so every Pi dispatch blocks until Pi has a login or the owner's models load.
  That is the intended fail-closed outcome, and the message says bb lists none.
- **Heuristic remedies.** The remedy text matches strings that a CLI may change.
  It only adds a line and never replaces the cause, so a miss costs a hint and no more.
- **A longer wake limit for failed tasks.** The 1200-character limit changes the wake text only for `failed` tasks that carry long evidence.
  A wake test pins both limits.
- **Principle V.** Where a guard test can only follow its code (for example a lint rule), the cycle log records a revert-red, as D-099 did.
