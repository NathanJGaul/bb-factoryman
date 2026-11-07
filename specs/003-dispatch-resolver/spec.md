# Feature specification: Dispatch resolver

**Feature branch**: `fm/bb-factoryman-milestones-7-11`

**Created**: 2026-11-07

**Status**: Approved (scope fixed by the captain's intent for this task)

**Input**: Milestone 7 of `docs/DESIGN.md`: "Build the rules table, precedence, and the `ambiguous` result. Done when precedence tests pass."
The captain's intent covers milestones 7 to 11 and says: write tests first, keep `src/machine/` free of bb imports, record every deviation in `docs/DECISIONS.md`, and do not add `factoryman_decide`.

## User scenarios and testing

The people who use this feature are the supervisor agent, which dispatches workers, and the owner, who writes the dispatch rules.
The feature has no screen.
Its real entry points are the `factoryman_dispatch` agent tool, loaded through the bb fake plugin host, and the `.bb/factoryman/dispatch.json` file that the owner edits.
The bb facts it depends on are spike item 29 in `spike/RESULTS.md`.

### User story 1 - Resolve a profile by precedence (priority P1)

A supervisor dispatches a task without a full profile.
The plugin picks the profile in firstmate's order: an explicit override, then the one rule that fits, then the configured default, then the built-in default.
When several rules with different profiles fit, the plugin returns `ambiguous`, creates nothing, and lets the supervisor choose.

**Why this priority**: `docs/DESIGN.md` makes the profile a gate on `queued` to `working`, and this story is the only way to produce one without the supervisor spelling out four fields.

**Independent test**: Write a `dispatch.json` in a temporary checkout, call `factoryman_dispatch` through the fake host, and read the spawn arguments and the event log.

**Acceptance scenarios**:

1. **Given** a complete explicit `profile` on the call, **When** the supervisor dispatches, **Then** the worker spawns with exactly that profile, and rules, default, and built-in default do not change it. (AC-1.1)
2. **Given** no explicit profile and exactly one rule that matches the task, **When** the supervisor dispatches, **Then** the worker spawns with that rule's profile. (AC-1.2)
3. **Given** no explicit profile and two rules with different profiles that both match, **When** the supervisor dispatches, **Then** the call returns `ambiguous` with each candidate rule ID and profile, no task exists, and no thread spawned. (AC-1.3)
4. **Given** that ambiguous result, **When** the supervisor dispatches again with `rule` set to one candidate, **Then** the worker spawns with that rule's profile.
   A `rule` that does not match the task is refused. (AC-1.4)
5. **Given** several matching rules that all name the same profile, **When** the supervisor dispatches, **Then** the result is clear and uses that profile. (AC-1.5)
6. **Given** no rule matches, **When** the supervisor dispatches, **Then** the configured default applies, and with no configured default the built-in default applies. (AC-1.6)
7. **Given** a call that sets both `profile` and `rule`, **When** the supervisor dispatches, **Then** the call is refused before anything is read or spawned. (AC-1.7)

### User story 2 - Fail closed on the carried-over constraints (priority P1)

firstmate never lowers reasoning to save quota without standing permission, and it never falls back silently to another provider.
The plugin enforces both in code and shows the supervisor a blocker.

**Why this priority**: These are the two constraints that the design names for the resolver, and hard rule 8 says nothing fails open.

**Independent test**: Dispatch with an explicit profile below a configured rule, with a broken config file, and with a provider that bb reports unavailable.

**Acceptance scenarios**:

1. **Given** a matched rule or a configured default, **When** an explicit profile has a lower reasoning level, **Then** the call is blocked with `reasoning_lowered` unless the config grants `standingPermission.lowerReasoning`.
   A level that the ladder cannot rank against the baseline also blocks. (AC-2.1)
2. **Given** a `dispatch.json` that is not valid JSON, has an unknown key, or names a profile that it does not define, **When** the supervisor dispatches, **Then** the call is blocked with the reason, and no default is used in its place. (AC-2.2)
3. **Given** a resolved profile whose provider bb reports as unavailable or does not list, **When** the supervisor dispatches, **Then** the call is blocked, and no other provider is tried. (AC-2.3)
4. **Given** a resolved profile whose permission mode or reasoning level the provider does not list, **When** the supervisor dispatches, **Then** the call is blocked. (AC-2.4)
5. **Given** any blocked or ambiguous result, **Then** the event log gains no row, because no task was created. (AC-2.5)

### User story 3 - Replace the resolver without touching the machine (priority P2)

A faster classifier can replace the rules table later.

**Independent test**: Inject a stub resolver through the plugin factory and dispatch.

**Acceptance scenarios**:

1. **Given** a stub resolver that returns a fixed profile, **When** the supervisor dispatches, **Then** the worker spawns with that profile, and no file under `src/machine/` imports from `src/dispatch/`. (AC-3.1)

### Edge cases

- The checkout path is unknown to bb, or `dispatch.json` is absent: the config is empty, so the built-in default applies. (AC-4.1)
- A rule with no condition is refused when the config loads.
- A keyword matches whole words only, ignoring case.
- A task with no tags matches no `tags` rule.

## Requirements

### Functional requirements

- **FR-701**: The resolver MUST take the task facts and the parsed config and return `clear`, `ambiguous`, or `blocked`. It MUST NOT call bb or read files.
- **FR-702**: Precedence MUST be the explicit override, the one matching rule, the configured default, the built-in default.
- **FR-703**: A rule's `when` MUST support `kind`, `mode`, `tags` (all must be present), and `keywords` (any appears as a whole word in the description). A rule MUST have at least one condition.
- **FR-704**: Two or more matching rules with different profiles MUST return `ambiguous` with every candidate. Matching rules with equal profiles MUST be clear.
- **FR-705**: The `rule` argument MUST pick a candidate that matches the task, and any other value MUST be refused.
- **FR-706**: An explicit profile MUST be blocked when its reasoning level ranks below the profile of a matched rule or the configured default, unless `standingPermission.lowerReasoning` is true. A level the ladder cannot rank MUST also block when the strings differ.
- **FR-707**: A config that fails the schema MUST block dispatch. An absent file MUST yield an empty config.
- **FR-708**: Before spawning, the dispatch tool MUST check the resolved profile against `bb.sdk.providers.list()`: provider available, permission mode listed, reasoning level listed. A missing provider MUST block.
- **FR-709**: A blocked or ambiguous result MUST create no task and spawn no thread.
- **FR-710**: The dispatch tool MUST depend on the `DispatchResolver` interface, and the factory MUST accept a replacement.
- **FR-711**: `src/machine/` MUST NOT change, and MUST NOT import `src/dispatch/`.
- **FR-712**: The config file MUST be `<checkout>/.bb/factoryman/dispatch.json`, checked with `zod`.

### Key entities

- **Dispatch config**: `version`, named `profiles`, optional `default` profile name, `rules`, optional `reasoningLevels` ladder, optional `standingPermission`.
- **Rule**: `id`, `when`, and a profile name.
- **Resolution**: `clear` with profile, source and rule ID, `ambiguous` with candidates, or `blocked` with a code and a message.

## Success criteria

- **SC-701**: A precedence table of at least twelve cases passes, one per rung and per tie.
- **SC-702**: Every blocker leaves the event log and the spawn calls unchanged.
- **SC-703**: The suite, type check, and lint pass, and `src/machine/` has no diff.

## Assumptions

- The built-in default is `claude-code`, `claude-sonnet-5-5`, `high`, `auto`. The owner overrides it with `default`.
- The checkout that holds `.bb/factoryman/` is the project's default `local_path` source on the server machine (D-062).
