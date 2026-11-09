# Research: Agent-harness independence

Each entry gives the decision, the reason, and what was rejected.
The bb facts come from the SDK 0.6.104 types in `node_modules/@get-bb/plugin-sdk/bundled-types/` and from the scout report `data/bb-factoryman-harness-independence/report.md`.
Nothing here ran against a live bb.
The quickstart lists the checks that the owner or a lab run must confirm.

## Build order

**Decision**: H5, H1, H11, H2, H10, H3, then the docs.

**Reason**: The report says H10 depends on H1 only, and H11 depends on H5.
`dispatch init` must pick a model, and the only source is bb's model list, which H2 adds to the port.
Building H2 before H10 keeps `dispatch init` from guessing a model.
H3 depends on nothing, so it goes last, and the docs follow the code they describe.

**Rejected**: H10 before H2 with a `--model` flag that is required.
It makes the command harder to use for no gain, because the port read is small.

## Readiness source

**Decision**: Judge readiness from `bb.sdk.system.providerStates` and require `ready`.
Treat `not_installed`, `unauthenticated`, `expired`, `unsupported_version`, `unknown`, a missing state, and a failed read as blocks.

**Reason**: The report observed `available: true` with `unauthenticated` for Codex, and the t01 live check saw `claude-code` available with no CLI.
Hard rule 8 says nothing fails open, so an answer that the plugin cannot read is a block.
`SystemProviderStatesArgs` extends `SystemProvidersQuery`, which carries `hostId`, so a remote host is checked with its own states.

**Rejected**: Keep `available` and add the states as a warning.
That leaves the original failure in place.

## Where the checks run

**Decision**: One function, `gateProfile`, applies admission, readiness, the permission mode, and the model and level checks.
`factoryman_dispatch` and the queue start both call it.

**Reason**: Today both call `checkProfile` separately.
Adding three checks to each call site would let them drift, and the queue start is a second path to a spawn.
The cost is one new module.

**Rejected**: Repeat the checks at each call site.

## Admission before the bb reads

**Decision**: `admit` runs first, from the contract table alone.

**Reason**: It needs no bb call, it is permanent (a `local-only` project does not change), and it gives the clearest message when both admission and readiness would fail.
The queue start treats it as permanent and fails the task, and it treats every other block as transient.

**Rejected**: Admission last.
A Pi dispatch in `local-only` mode would read bb for nothing.

## Unlisted models

**Decision**: A column `unlistedModels` in the contract row decides.
Claude Code and Codex accept unlisted IDs; Pi, omp, and the generic row refuse them.

**Reason**: The report's R4 says "the model is listed or the provider accepts unlisted ids" and observed that Claude and Codex accept unlisted IDs by design.
A provider that the plugin does not know is judged fail closed.
The refusal lists the choices, so it is a one-step fix for the owner.

**Rejected**: Refuse unlisted models everywhere.
It would block a working Claude alias.
**Rejected**: Accept them everywhere.
It leaves Pi's late `thread.start` failure in place.

## Model matching

**Decision**: A profile's model matches a listed model when it equals the entry's `id` or its `model`.

**Reason**: The SDK entry has both fields, and the report's table shows IDs of the form `provider/model` for Pi.
The scout did not run a spawn that settles which field a harness resolves.

**Rejected**: Match `id` only.
It may block a valid profile.

## Model list failures

**Decision**: A thrown read blocks.
A `modelLoadError` in a successful read counts as "bb lists no usable models": for a provider that refuses unlisted models it blocks and names the code; for a provider that accepts them it falls back to the provider-wide levels.

**Reason**: The response type has `modelLoadError` with codes such as `auth_required`, which is exactly the Pi-without-login case.

## Ladders across providers

**Decision**: Rank both levels in the ladder of the explicit profile's provider.
When the baseline's level is not on it, block with today's "cannot be ranked" message.

**Reason**: Level IDs belong to one provider (spike item 29).
Ranking Claude's `high` against Codex's `ultra` has no meaning, and the existing rule already blocks what it cannot rank.

**Rejected**: Rank each level in its own provider's ladder by position.
That invents a cross-provider order.

## The tool hint

**Decision**: The hint reaches the worker through the `instructions` field of the `bb.agents.configure` return value, only for the `worker` role, only when `toolHints` is on, and only for rows whose `toolHint` is not null.

**Reason**: The SDK allows dynamic `instructions` (4096 characters), so the shared skill and the worker prompt stay harness neutral.
The text is a constant in the table, so no untrusted metadata enters it.

**Rejected**: Edit the worker prompt.
It is built at spawn and would not follow a provider change on a resumed thread.

## `dispatch init` defaults

**Decision**: Model: bb's default model for the provider, else the first listed.
Level: that model's default level.
Mode: `auto`, then `accept-edits`, then `full`, whichever the provider offers first.

**Reason**: The report's example profiles use `auto` for Claude and Codex, `accept-edits` for omp (which has no `auto`), and `full` for Pi (which offers only that).
The order picks the middle privilege first and the least sandboxed last.

**Rejected**: Always `accept-edits`.
A worker that waits for approvals cannot run unattended.

## The write

**Decision**: `Files.writeNew` creates the directory and opens the file with the `wx` flag.

**Reason**: Exclusive create is atomic, so two runs cannot both write, and an existing file (valid or not) is never changed.

**Rejected**: Check, then write.
It has a race window.

## The cause of a failure

**Decision**: Read the latest `provider/error` or `system/error` event with `order: "desc"` and `limit: "1"`.
Use `detail`, or `message` when `detail` is empty.

**Reason**: The report found the cause in exactly those two event types for all four harnesses.
Codex's HTTP 401 stays in the existing turn-failure evidence, and the cause adds the text.

**Rejected**: Read the whole log and search it.
It costs more and could pick an older error.

## The wake limit

**Decision**: Raise the evidence limit for a `failed` task from 600 to 1200 characters.

**Reason**: The cause (up to 300 characters), the remedy (up to about 200), and today's evidence together can exceed 600, and the supervisor needs the cause more than the tail of a long error text.

**Rejected**: Put the cause first and keep 600.
It reorders today's evidence, and every existing assertion on it changes.

## Open points for the live check

- `providerStates` lists the tier 1 stub agent, or the gate blocks it.
- The model field a spawn resolves (`id` or `model`).
- The shape of `data` on a stored `provider/error` event (`detail` and `message` at the top level of `data`).
- Whether `providers.models` accepts `providerId` and `hostId` together.
