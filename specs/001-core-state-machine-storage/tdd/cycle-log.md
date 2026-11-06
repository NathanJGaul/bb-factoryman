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

## Cycle G2: A1 plugin loads in the fake host and registers nothing beyond its identity

- test: `test/acceptance/plugin.test.ts::loads in the fake host, registers nothing beyond its identity, and disposes cleanly` (new, A1)
- red: added a no-op stub `src/server.ts` so the import resolves, then `pnpm vitest run test/acceptance/plugin.test.ts`
  -> `AssertionError: expected [] to deeply equal [ { level: 'info', …(1) } ]` (1 failed)
- green: `src/server.ts:8` logs `bb-factoryman loaded` through `bb.log.info`. Suite `pnpm test` -> 3 files, 6 passed, 0 failed. Lint and type-check clean.
- refactor: none needed
- note: "identity" is the one load log line. The design does not define it, so the choice is recorded in `docs/DECISIONS.md`.
- commit: G2

## Cycle G3: U9 repository layout

- test: `test/acceptance/layout.test.ts::has the milestone 1 to 3 directories and none for later milestones` (new, U9)
- red: `pnpm vitest run test/acceptance/layout.test.ts`
  -> `AssertionError: src/machine should exist: expected false to be true` (1 failed)
- green: created `src/machine/.gitkeep` and `src/store/.gitkeep`. Suite `pnpm test` -> 4 files, 7 passed, 0 failed. Lint and type-check clean.
- refactor: none needed
- commit: G3

## Cycle G4: A3, A4, U1, U2, U3, U4 lint rule keeps bb imports out of src/machine

- tests: `test/acceptance/lint-isolation.test.ts` (new): `fails lint on an @get-bb import and names the restricted module` (A3), `passes lint on the same import outside src/machine` (A4), `fails lint on a type-only @get-bb import` (U1), `fails lint on an @get-bb subpath import` (U2), `fails lint on a dynamic import of an @get-bb module` (U3), `fails lint on a re-export from an @get-bb module` (U4)
- red: `pnpm vitest run test/acceptance/lint-isolation.test.ts`
  -> 5 failed, 1 passed. A3, U1, U2, U3, U4 each: `AssertionError: expected [] to have a length of 1 but got +0`
- A4 passed on first run (negative test). Deliberate mutant: widened the override from `src/machine/**/*.ts` to `src/**/*.ts`, ran
  `pnpm vitest run test/acceptance/lint-isolation.test.ts -t "passes lint on the same import outside"`
  -> `AssertionError: expected [ Array(1) ] to deeply equal []` (1 failed). Restored `eslint.config.js` exactly.
- green, step 1: added the `no-restricted-imports` override with the `@get-bb/*` pattern. Run -> only U3 still failed (`expected [] to have a length of 1 but got +0`), because ESLint 10's `no-restricted-imports` does not see `import()`.
- green, step 2: added `no-restricted-syntax` on `ImportExpression` for `src/machine/**`. Suite `pnpm test` -> 5 files, 13 passed, 0 failed. Lint and type-check clean.
- refactor: none needed
- note: the rule bans every dynamic import in `src/machine/`, not only `@get-bb` ones, so a computed specifier cannot hide a bb import. Recorded in `docs/DECISIONS.md`.
- commit: G4

## Cycle G5: U5, U6, U7, U8 lint rule keeps storage, Node built-ins, and src/store out of src/machine

- tests: `test/acceptance/lint-isolation.test.ts` (extended): `fails lint on an import of better-sqlite3` (U5), `fails lint on an import of a node built-in, with or without the node: prefix` (U6), `fails lint on an import from src/store` (U7), `passes lint on xstate, zod, and sibling machine imports` (U8)
- red: `pnpm vitest run test/acceptance/lint-isolation.test.ts`
  -> 3 failed, 7 passed. U5, U6, U7 each: `AssertionError: expected [] to have a length of 1 but got +0`
- U8 passed on first run (negative test). Deliberate mutant: added `"xstate"` to the `better-sqlite3` pattern group, ran
  `pnpm vitest run test/acceptance/lint-isolation.test.ts -t "passes lint on xstate"`
  -> `AssertionError: expected [ Array(1) ] to deeply equal []` (1 failed). Restored `eslint.config.js` exactly.
- green: `eslint.config.js` gained three pattern groups: `better-sqlite3`, `node:*` plus the names in `builtinModules`, and `**/store` plus `**/store/**`. Suite `pnpm test` -> 5 files, 17 passed, 0 failed. Lint and type-check clean.
- refactor: none needed
- commit: G5
