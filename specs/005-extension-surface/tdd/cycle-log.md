# Cycle log: Extension surface

Append only.
Newest last.
Every entry's `red` block is the evidence that the test existed and failed before the implementation.
Each group commits its tests with stubs first, so git history shows the order.

## Baseline

- suite: `pnpm test` -> 72 files, 873 passed, 0 failed
- commit: `6ce8bfc`

## Group 1: the workflow config and the check gate

Red commit: the commit before this group's implementation (`test: add workflow config and custom check tests with stubs, group 1 (red)`). It holds the tests, stubs for `src/workflow/*` that return "not implemented", and a `customChecksPassed` guard stub that returns null.

- red: `pnpm vitest run src/workflow src/machine test/acceptance/extension-workflow.test.ts` -> 48 failed
  - `[U901]` to `[U909]`: `AssertionError` on the stub's "not implemented" result (the empty config, the parse, the loader)
  - `[U910]` to `[U913]`: the stub returned the stored config unchanged
  - `[U914]`: `expected false to be true` (`checks` was an unknown key)
  - `[U915]`, `[U916]`: the guard stub returned null for a failing check
  - `[U917]`, `[U918]`, and the table-order test: the table lacked the guard
  - `[U919]` to `[U923]`: the stub ran nothing
  - `[A902]` to `[A911]`: the tools ignored the file
- Passed against the stubs: `[A901]`, `[A912]`, the `[U905]` timeout half, and `[U924]`. They describe behavior that already held (no file, a scout, no checks). Deliberate mutants after the implementation:
  - a scout runs the checks -> `[A912]` failed
- Mutants on the new gates, all killed:
  - the guard always passes -> `[U915]`, `[A909]`, `[A911]`
  - the report skips the checks -> `[A908]`, `[A909]`, `[A911]`
  - `ready` loses the guard in the table -> the table-order test, `[U917]`, `[U918]`
  - the `baseBranch` scan removed -> `[U903]`, `[A906]`
  - the key scan stops at the top level -> 18 failed (every `[U902]` case and the `baseBranch` tests)
  - the file beats a stored prefix -> `[U910]`, `[A903]`
  - the mode ladder reversed -> `[U911]`, `[U912]`, `[A904]`
  - checks stop at the first failure -> `[U922]`, `[U923]`
  - a check passes on any code -> `[U920]`, `[U922]`, `[U923]`, `[A909]`
  - dispatch ignores the effective config -> `[A903]`, `[A904]`
  - the report ignores a bad workflow file -> both `[A902]` cases
- Existing tests that changed with the requirement: `test/fixtures/legal-set.ts` lists the new guard on `handoff` and `ready`.
- green: `config.ts` (strict schema, the key scan, `GATE_KEYS`), `load.ts`, `effective.ts`, `checks.ts`, the `checks` event field, the `customChecksPassed` guard and `check_failed` code, the report tool's check step, and the dispatch tool's workflow step.
  `pnpm run check` -> 77 files, 943 passed, 0 failed. Type check and lint clean.
