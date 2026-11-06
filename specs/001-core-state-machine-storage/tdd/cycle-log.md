# Cycle Log: Core scaffold, task state machine, and event storage

Append only. Newest last. Every entry's `red` block is the evidence that the test existed and failed before the implementation.

Batching rule: behaviors on one function or file share a cycle, as the cycle plan in `test-list.md` lists.
Each behavior in a batch still has its own test, and each entry records the failing output per behavior id.

## Baseline

- suite: `pnpm test` -> 1 file, 3 passed, 0 failed
- commit: `d4a96f4`
- recorded: cycle 0, before any feature change

## Cycle G1: A2 manifest names the package and declares the server entry; A5 build script (baseline)

- test: `test/acceptance/manifest.test.ts::names the package, declares the server entry, and pins the SDK to one exact version` (new, A2)
- test: `test/acceptance/manifest.test.ts::builds through bb plugin build` (new, A5, characterization)
- red (A2): `pnpm vitest run test/acceptance/manifest.test.ts`
  -> `AssertionError: expected undefined to be './src/server.ts'` (1 failed, 1 passed)
- A5 passed on first run because the toolchain scaffold (T001) already set the script. Deliberate mutant: changed `"build"` to `"tsc"` in `package.json`, ran
  `pnpm vitest run test/acceptance/manifest.test.ts -t "builds through bb plugin build"`
  -> `AssertionError: expected 'tsc' to be 'bb plugin build'` (1 failed). Restored `package.json` exactly. A5 is `BASELINE`.
- green: `package.json` gained the `bb` block (`name`, `description`, `server`), `engines`, and the `bb-plugin` keyword. Suite `pnpm test` -> 2 files, 5 passed, 0 failed. `pnpm run lint` and `pnpm run typecheck` clean.
- refactor: none needed, one config block
- commit: G1
