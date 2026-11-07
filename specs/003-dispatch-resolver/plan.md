# Implementation plan: Dispatch resolver

**Branch**: `fm/bb-factoryman-milestones-7-11` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

## Summary

Add `src/dispatch/` with a pure rules-table resolver, a `zod` config schema, a file loader, and a provider availability check.
Wire them into `factoryman_dispatch`, which now takes an optional profile, an optional `rule`, and optional `tags`.
`src/machine/` stays unchanged: the `start` event already carries a complete profile (D-017).

## Technical context

- Language: TypeScript 6, ESM, Node 26.
- Dependencies: `zod` only. No new package.
- Tests: `vitest`, the bb fake plugin host, and hand-written fakes under `test/fixtures/`.
- bb facts: spike item 29 (provider list shape).

## Constitution check

| Principle | How the plan complies |
| --- | --- |
| I. Gates fail closed | A bad config, an unlisted provider, or an unrankable reasoning level blocks. |
| II. Machine core is pure | No file under `src/machine/` changes. |
| III. Event log is the source | No log change. A blocker creates no task. |
| IV. Storage behind an interface | No storage change. |
| V. Test first | `tasks.md` puts a failing test before each behavior. |
| VI. Scope | Milestone 7 only. The `machine` column of the rules is milestone 8. |

## Source layout

```text
src/dispatch/
  types.ts         # Rule, DispatchConfig, TaskFacts, Resolution, DispatchResolver
  config.ts        # zod schema and parseDispatchConfig
  builtin.ts       # BUILTIN_PROFILE and the default reasoning ladder
  resolver.ts      # RulesTableResolver
  availability.ts  # checkProfile against ProviderInfo[]
  load.ts          # loadDispatchConfig(files, checkout)
src/files.ts       # the Files port: readText, with a node:fs implementation
src/bb/port.ts     # + listProviders
src/tools/dispatch.ts  # resolve, check, then spawn
```

## Design

**Resolution order.**
`resolve(facts, config, choice)` returns the first rung that applies:

1. `choice.profile` (explicit), after the lowering check.
2. The matching rules. One distinct profile gives `clear`. Several give `ambiguous`. `choice.rule` picks one of the matching rules.
3. `config.default`.
4. `BUILTIN_PROFILE`.

**Lowering check.**
The baseline is the matched rules' profiles, or else the configured default, or else none (the built-in default is not an owner declaration, so it sets no floor).
For each baseline profile, the explicit level must not rank below the baseline level on the ladder.
When the strings differ and either is off the ladder, the check blocks.
`standingPermission.lowerReasoning: true` turns the check off.

**Availability.**
`checkProfile(profile, providers)` returns a blocker unless the provider is listed and available, lists the permission mode, and lists the reasoning level.
An empty `reasoningLevels` list on the provider skips the level check, because bb reports no list for some providers.

**Loading.**
`loadDispatchConfig` reads `<checkout>/.bb/factoryman/dispatch.json` through the `Files` port.
A missing file or an unknown checkout returns an empty config.
Any other read error, bad JSON, or schema failure returns `blocked`.

**Tool flow.**
Parse arguments, refuse `profile` with `rule`, load config, resolve, check availability, then the existing create, spawn, and start steps.
The call result for `ambiguous` and `blocked` is an error result that names the next step.

## Decisions to record

- D-062: where the config lives and which checkout holds it.
- D-063: the built-in default profile.
- D-064: the lowering check, its baseline, and the ladder.
- D-065: `ambiguous` needs distinct profiles, and `rule` must match.
- D-066: blockers create no task, so they leave no log row.

## Complexity tracking

No constitution violation. The one new port (`Files`) exists because `Runtime` must stay testable without a disk.
