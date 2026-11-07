# Cycle log: Dispatch resolver

Append only.
Newest last.
Every entry's `red` block is the evidence that the test existed and failed before the implementation.

## Baseline

- suite: `pnpm test` -> 57 files, 624 passed, 0 failed
- commit: `bf5f79b`
- recorded: cycle 0, before any feature change

## Cycle L0: acceptance layout rule follows the scope amendment (test change, taken first)

- reason: the milestone 4 to 6 test `[U208]` forbade `src/dispatch`. The captain's intent puts milestone 7 in scope (D-068), so the rule is outdated.
  The test now requires `src/dispatch` and still forbids `skills` (milestone 11). It is not weakened to hide a failure.
- tests: `test/acceptance/layout.test.ts` `[U208]` (changed), `[A714]` (new)
- red: `pnpm vitest run test/acceptance/layout.test.ts`
  -> `[U208] AssertionError: src/dispatch should exist: expected false to be true`
- green: passes once `src/dispatch/` exists (cycle C1).
- `[A714]` passed at once, because no machine file imports `src/dispatch`. Deliberate mutant: add `import type { Rule } from "../dispatch/types";` to `src/machine/types.ts`
  -> `[A714] keeps src/machine free of any import from src/dispatch` failed (1 failed, 1 passed). Reverted.
- commit: see git log, message `feat: add the dispatch resolver (milestone 7)`

## Cycle A0: acceptance tests A701 to A713 first (all behaviors, outer loop)

- tests: `test/acceptance/dispatch-resolver.test.ts` `[A701]` to `[A713]` (new), fixtures `test/fixtures/checkout.ts`, and the `providers`, `checkout`, and `resolver` options of `test/fixtures/plugin-host.ts`
- red: `pnpm vitest run test/acceptance/layout.test.ts test/acceptance/dispatch-resolver.test.ts`
  -> `[A702] AssertionError: expected true to be false` (the tool still demanded a profile)
  -> `[A703] AssertionError: expected 'Refused (invalid_event): Invalid disp…' to contain 'ambiguous'`
  -> `[A704]`, `[A705]`, `[A712]`, `[A713]` `AssertionError: expected true to be false`
  -> `[A706] TypeError: undefined is not iterable`
  -> `[A708] AssertionError: expected false to be true`
  -> `[A709] AssertionError: expected 'Refused (invalid_event): Invalid disp…' to contain 'dispatch.json'`
  -> `[A710] AssertionError: expected false to be true` (11 failed, 4 passed)
- `[A701]`, `[A707]`, and `[A711]` passed at once: an explicit profile was already honored, and the old tool already refused the unknown `rule` key and created nothing without a profile.
  Deliberate mutants after the implementation:
  - `[A701]`: make the resolver return the built-in default for an explicit profile -> `[A701]`, `[U710]`, `[A708]`, `[A710]` failed (4 failed). Reverted.
  - `[A707]`: remove the schema `.refine`. The test survived, because the resolver also blocks both fields and the call is still an error.
    The test was strengthened to assert that `projects.get` and `providers.list` were never called and that the text says "not both".
    With the strengthened test, the same mutant -> `[A707]` failed (1 failed, 12 passed). Reverted.
  - `[A711]`: make the ambiguous branch create a task -> `[A703]` and `[A711]` failed (2 failed). Reverted.

## Cycle C1: U701 to U709 config schema (`src/dispatch/config.ts`)

- tests: `src/dispatch/config.test.ts` `[U701]` to `[U709]` (new), types-only `src/dispatch/types.ts` (no behavior)
- red: a stub whose `parseDispatchConfig` returns `{ ok: false, message: "not implemented" }`, then `pnpm vitest run src/dispatch/config.test.ts`
  -> `U701 AssertionError: expected { ok: false, …(1) } to deeply equal { ok: true, …(1) }`
  -> `U702 AssertionError: expected 'not implemented' to match /surprise/`, and the same shape for U703 to U709 (9 failed)
- green: `config.ts` with a `zod` strict schema and a `superRefine` for names, IDs, and the ladder. `pnpm vitest run src/dispatch/config.test.ts` -> 9 passed.
- refactor: none needed

## Cycle C2: U710 to U729 resolver (`src/dispatch/resolver.ts`)

- tests: `src/dispatch/resolver.test.ts` `[U710]` to `[U729]` (new), plus one test for the all-conditions rule
- red: a stub resolver that always returns `blocked invalid_choice`, then `pnpm vitest run src/dispatch/resolver.test.ts`
  -> 20 failed, 1 passed. `U710` to `U728` and the all-conditions test failed on their `toEqual` or `toMatchObject` assertions.
- `[U729]` passed against the stub, because the stub returns `invalid_choice` for everything. Deliberate mutant after the implementation:
  replace the both-fields check with `if (false)` -> `[U729]` failed (1 failed, 20 passed). Reverted.
- green: `resolver.ts`. `pnpm vitest run src/dispatch/resolver.test.ts` -> 21 passed.
- refactor: none needed

## Cycle C3: U730 to U735 availability (`src/dispatch/availability.ts`)

- tests: `src/dispatch/availability.test.ts` `[U730]` to `[U735]` (new), and the `ProviderAvailability` type and `listProviders` method on `BbPort` (types only)
- red: a stub `checkProfile` that returns null, then `pnpm vitest run src/dispatch/availability.test.ts`
  -> `[U731]`, `[U732]`, `[U733]`, `[U734]` failed (4 failed, 2 passed)
- `[U730]` and `[U735]` passed against the stub. Deliberate mutants after the implementation:
  - always return a reason -> `[U730]` and `[U735]` failed (2 failed). Reverted.
  - drop the `reasoningLevels.length > 0` guard -> `[U735]` failed (1 failed). Reverted.
- green: `availability.ts` -> 6 passed.
- refactor: none needed

## Cycle C4: U736 to U741 and U743 files and loader (`src/files.ts`, `src/dispatch/load.ts`)

- tests: `src/dispatch/load.test.ts` `[U736]` to `[U741]`, `src/files.test.ts` `[U743]` (new), fixture `test/fixtures/files.ts`
- red: stubs (`readText` returns `""`, `loadDispatchConfig` returns a "not implemented" failure), then `pnpm vitest run src/dispatch/load.test.ts src/files.test.ts`
  -> 7 failed (every test, each on its first assertion)
- green: `files.ts` reads with `node:fs/promises` and maps `ENOENT` and `ENOTDIR` to null. `load.ts` joins the path, parses, validates, and turns each failure into a message. 7 passed.
- refactor: none needed

## Cycle C5: U742, the tool, the runtime, and the factory

- tests: `src/bb/adapter.test.ts` `[U742]` (new); the acceptance file from cycle A0 now drives the tool
- red: `pnpm vitest run src/bb/adapter.test.ts` -> `[U742] TypeError: port.listProviders is not a function` (1 failed, 14 passed)
- green: `listProviders` in the adapter, `files` and `resolver` on `RuntimeDeps`, the `files` and `resolver` factory options, `FakeBbPort.listProviders`, and the new `dispatch` flow.
  `pnpm run typecheck` flagged `provider.reasoningLevels` as possibly undefined (the SDK type marks it optional), so the adapter defaults it to an empty list.
- one existing test failed: `src/tools/register.test.ts` `[U37]` asserted `required` equals `["kind", "description", "profile"]`.
  That is a requirement change (D-067): the profile is optional now. The assertion changed to `["kind", "description"]` plus the three optional properties. It is not weakened to hide a failure.
- suite: `pnpm run check` -> 63 files, 682 passed, 0 failed. Type check and lint clean.
- refactor: none needed
