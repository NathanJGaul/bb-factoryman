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

## Group 2: thread metadata and the read RPC

Red commit: the commit before this group's implementation (`test: add thread metadata and read RPC tests with stubs, group 2 (red)`). It holds the tests, a stamper stub that registers nothing, an RPC stub that registers nothing, and the fixtures `FakeBbPort.setMetadataError` and `world.failMetadata`.

- red: `pnpm vitest run src/wiring/stamp.test.ts src/rpc test/acceptance/extension-surface.test.ts` -> 13 failed
  - `[U925]`, `[U927]`, `[A913]`, `[A914]`: no metadata write
  - `[U929]` to `[U933]`, `[A915]`: `experimental_PluginRpcCallError: plugin "factoryman" has no rpc method ...`
  - `[U934]`: no call reached the store
  - `[A916]`: the `rejects` half passes against the stub because no method exists. The assertion that the log is unchanged holds either way. The test proves its point through `[A917]` and through the mutants below.
  - `[A917]`: `expected [] to deeply equal [ 'apiVersion', 'getTask', ... ]`
- Passed against the stubs: `[U926]`, `[U928]`, `[U935]` (a missing method rejects every call). Deliberate mutants after the implementation:
  - `[U926]`, `[U928]`: the stamper writes `role` -> `[U925]`, `[U928]` failed
  - `[U935]`: input schemas not strict -> `[U935]` failed
- Mutants on the new behavior, all killed:
  - skip `machine` in the stamp -> `[U925]`, `[A913]`; throw on a failed write -> `[U927]`, `[A914]`
  - not discoverable -> `[U933]`, `[A917]`; `since` ignored -> `[U931]`, `[A915]`; `limit` ignored -> `[U931]`; project filter ignored -> `[U929]`
  - version 2 -> `[U930]`, `[U932]`, `[A915]`
  - the payload leaks into an event row -> survived while the output schemas were `z.object`, because the host strips unknown keys. The output schemas are `strictObject` now, and the mutant then failed five tests.
  - `registerReadRpc` or `registerStamper` removed from `server.ts` -> `[A915]` to `[A917]`, `[A913]`, `[A914]`
- Existing tests that changed with the requirement: `[A17]` expects the four RPC methods, `[A18]` expects the stamped metadata, and `[A908]` (remote) counts only the `pnpm` runs, because the validator also runs on the machine.
- green: `src/wiring/stamp.ts`, `src/rpc/read.ts`, and their registration in `server.ts`.
  `pnpm run check` -> 80 files, 960 passed, 0 failed. Type check and lint clean.
