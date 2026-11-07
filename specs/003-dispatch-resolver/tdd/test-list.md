---
feature: 003-dispatch-resolver
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 13
planned_at: bf5f79b
updated_at: bf5f79b
suite_baseline: green
---

# Test list: Dispatch resolver

The acceptance layer is an in-process integration test through the bb fake plugin host and the public factory.
No process-level runner drives a real bb, so every `A` behavior is weaker than an end-to-end test.
Spike item 29 pins the real provider list shape, and the live check in milestone 11 is the first time a real bb meets the resolver.
The suite baseline was 57 files and 624 tests, all passing.

## Outer loop: acceptance behaviors

Each stays red until the feature works through the plugin factory.

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| A701 | An explicit complete profile spawns the worker with exactly that profile, whatever the rules and default say | AC-1.1, FR-702 | example | TODO | `test/acceptance/dispatch-resolver.test.ts::[A701]` |
| A702 | With no explicit profile, the one matching rule supplies the profile | AC-1.2, FR-702, FR-703 | example | TODO | `test/acceptance/dispatch-resolver.test.ts::[A702]` |
| A703 | Two matching rules with different profiles return `ambiguous` with both candidates and create no task and no thread | AC-1.3, AC-2.5, FR-704, FR-709 | example | TODO | `test/acceptance/dispatch-resolver.test.ts::[A703]` |
| A704 | `rule` picks one matching candidate, and a rule that does not match the task is refused | AC-1.4, FR-705 | example | TODO | `test/acceptance/dispatch-resolver.test.ts::[A704]` |
| A705 | Matching rules that name the same profile resolve clear | AC-1.5, FR-704 | example | TODO | `test/acceptance/dispatch-resolver.test.ts::[A705]` |
| A706 | With no matching rule the configured default applies, and with none the built-in default applies | AC-1.6, FR-702 | example | TODO | `test/acceptance/dispatch-resolver.test.ts::[A706]` |
| A707 | A call with both `profile` and `rule` is refused before anything is read or spawned | AC-1.7 | example | TODO | `test/acceptance/dispatch-resolver.test.ts::[A707]` |
| A708 | An explicit profile with a lower reasoning level than the matched rule or default is blocked, and standing permission lifts the block | AC-2.1, FR-706 | example | TODO | `test/acceptance/dispatch-resolver.test.ts::[A708]` |
| A709 | A config with bad JSON, an unknown key, or an undefined profile blocks dispatch and no default replaces it | AC-2.2, FR-707 | example | TODO | `test/acceptance/dispatch-resolver.test.ts::[A709]` |
| A710 | A provider that bb reports unavailable or does not list, or a permission mode or reasoning level it does not list, blocks dispatch | AC-2.3, AC-2.4, FR-708 | example | TODO | `test/acceptance/dispatch-resolver.test.ts::[A710]` |
| A711 | Every blocked or ambiguous result leaves the event log and the spawn calls unchanged | AC-2.5, SC-702, FR-709 | example | TODO | `test/acceptance/dispatch-resolver.test.ts::[A711]` |
| A712 | A resolver injected into the factory replaces the rules table | AC-3.1, FR-710 | example | TODO | `test/acceptance/dispatch-resolver.test.ts::[A712]` |
| A713 | An absent `dispatch.json` gives the built-in default | AC-4.1, FR-707 | example | TODO | `test/acceptance/dispatch-resolver.test.ts::[A713]` |
| A714 | No file in `src/machine/` imports from `src/dispatch/` | FR-711, SC-703 | example | TODO | `test/acceptance/layout.test.ts::[A714]` |

## Inner loop: unit behaviors

### `src/dispatch/config.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U701 | A minimal valid config parses and fills the default ladder | FR-712 | example | TODO | `src/dispatch/config.test.ts::[U701]` |
| U702 | An unknown top-level key is rejected | FR-707 | example | TODO | `src/dispatch/config.test.ts::[U702]` |
| U703 | A rule that names an undefined profile is rejected | FR-707 | example | TODO | `src/dispatch/config.test.ts::[U703]` |
| U704 | A `default` that names an undefined profile is rejected | FR-707 | example | TODO | `src/dispatch/config.test.ts::[U704]` |
| U705 | A rule with an empty `when` is rejected | FR-703 | boundary | TODO | `src/dispatch/config.test.ts::[U705]` |
| U706 | Two rules with the same ID are rejected | FR-703 | example | TODO | `src/dispatch/config.test.ts::[U706]` |
| U707 | A ladder with a repeated level is rejected | FR-706 | example | TODO | `src/dispatch/config.test.ts::[U707]` |
| U708 | A profile missing a field is rejected | FR-707 | example | TODO | `src/dispatch/config.test.ts::[U708]` |
| U709 | A version other than 1 is rejected | FR-712 | example | TODO | `src/dispatch/config.test.ts::[U709]` |

### `src/dispatch/resolver.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U710 | An explicit profile wins over a matching rule, the default, and the built-in default | FR-702 | example | TODO | `src/dispatch/resolver.test.ts::[U710]` |
| U711 | One matching rule is clear with source `rule` and its ID | FR-702 | example | TODO | `src/dispatch/resolver.test.ts::[U711]` |
| U712 | Two matching rules with different profiles are `ambiguous` with both candidates in config order | FR-704 | example | TODO | `src/dispatch/resolver.test.ts::[U712]` |
| U713 | Two matching rules with equal profiles are clear | FR-704 | example | TODO | `src/dispatch/resolver.test.ts::[U713]` |
| U714 | `rule` picks one of the matching rules | FR-705 | example | TODO | `src/dispatch/resolver.test.ts::[U714]` |
| U715 | `rule` that names an unknown or non-matching rule is blocked with `rule_not_applicable` | FR-705 | example | TODO | `src/dispatch/resolver.test.ts::[U715]` |
| U716 | With no matching rule the configured default applies | FR-702 | example | TODO | `src/dispatch/resolver.test.ts::[U716]` |
| U717 | With no rule and no default the built-in default applies | FR-702 | example | TODO | `src/dispatch/resolver.test.ts::[U717]` |
| U718 | A `kind` condition matches only that kind | FR-703 | example | TODO | `src/dispatch/resolver.test.ts::[U718]` |
| U719 | A `mode` condition matches only that delivery mode | FR-703 | example | TODO | `src/dispatch/resolver.test.ts::[U719]` |
| U720 | A `tags` condition needs every tag, and a task with no tags matches none | FR-703 | boundary | TODO | `src/dispatch/resolver.test.ts::[U720]` |
| U721 | A `keywords` condition matches a whole word in any case and not a substring | FR-703 | boundary | TODO | `src/dispatch/resolver.test.ts::[U721]` |
| U722 | An explicit level below the matched rule's level is blocked with `reasoning_lowered` | FR-706 | example | TODO | `src/dispatch/resolver.test.ts::[U722]` |
| U723 | An explicit level equal to, or above, the baseline is clear | FR-706 | boundary | TODO | `src/dispatch/resolver.test.ts::[U723]` |
| U724 | `standingPermission.lowerReasoning` lifts the block | FR-706 | example | TODO | `src/dispatch/resolver.test.ts::[U724]` |
| U725 | A differing level that is off the ladder is blocked | FR-706 | boundary | TODO | `src/dispatch/resolver.test.ts::[U725]` |
| U726 | With only the built-in default there is no baseline, so a low explicit level is clear | FR-706 | example | TODO | `src/dispatch/resolver.test.ts::[U726]` |
| U727 | With an ambiguous baseline, a level below any candidate is blocked | FR-706 | example | TODO | `src/dispatch/resolver.test.ts::[U727]` |
| U728 | The configured default sets the baseline when no rule matches | FR-706 | example | TODO | `src/dispatch/resolver.test.ts::[U728]` |
| U729 | `profile` with `rule` is blocked by the resolver as well | AC-1.7 | example | TODO | `src/dispatch/resolver.test.ts::[U729]` |

### `src/dispatch/availability.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U730 | An available provider that lists the mode and level passes | FR-708 | example | TODO | `src/dispatch/availability.test.ts::[U730]` |
| U731 | A provider missing from the list is blocked | FR-708 | example | TODO | `src/dispatch/availability.test.ts::[U731]` |
| U732 | A provider with `available: false` is blocked | FR-708 | example | TODO | `src/dispatch/availability.test.ts::[U732]` |
| U733 | A permission mode the provider does not list is blocked | FR-708 | example | TODO | `src/dispatch/availability.test.ts::[U733]` |
| U734 | A reasoning level the provider does not list is blocked | FR-708 | example | TODO | `src/dispatch/availability.test.ts::[U734]` |
| U735 | A provider that lists no reasoning levels skips the level check | FR-708 | boundary | TODO | `src/dispatch/availability.test.ts::[U735]` |

### `src/dispatch/load.ts` and `src/files.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U736 | An absent file gives an empty config | FR-707 | example | TODO | `src/dispatch/load.test.ts::[U736]` |
| U737 | An unknown checkout gives an empty config and reads nothing | FR-707 | example | TODO | `src/dispatch/load.test.ts::[U737]` |
| U738 | Invalid JSON is blocked with the parse error | FR-707 | example | TODO | `src/dispatch/load.test.ts::[U738]` |
| U739 | A schema failure is blocked with the first issue and its path | FR-707 | example | TODO | `src/dispatch/load.test.ts::[U739]` |
| U740 | A read error that is not "missing" is blocked | FR-707 | error | TODO | `src/dispatch/load.test.ts::[U740]` |
| U741 | The loader reads `<checkout>/.bb/factoryman/dispatch.json` | FR-712 | example | TODO | `src/dispatch/load.test.ts::[U741]` |
| U743 | `readText` returns the content, returns null for a missing file, and throws for another failure | FR-707 | example | TODO | `src/files.test.ts::[U743]` |

### `src/bb/adapter.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U742 | `listProviders` maps ID, availability, permission modes, and reasoning level IDs | FR-708 | example | TODO | `src/bb/adapter.test.ts::[U742]` |

## Cycle plan

L0 changes the layout rule (`src/dispatch` is now allowed).
The acceptance file A701 to A713 is written first and stays red.
C1 config (U701 to U709), C2 resolver (U710 to U729), C3 availability (U730 to U735), C4 files and loader (U736 to U741, U743), C5 port, tool, and factory (U742 and the acceptance file).

## Property and mutation notes

No property tool is installed (profile).
The precedence table in U710 to U717 and the boundary cases in U720, U721, and U723 stand in for properties.
`/speckit.tdd.verify` runs deliberate mutants on the resolver's precedence, the lowering comparison, and the availability check.
