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

## Cycle G6 (opened): A6 to A17 written red first

- tests: `test/acceptance/machine-gates.test.ts` and `test/acceptance/machine-matrix.test.ts`, with `test/fixtures/machine.ts` (new). They enter through `transition` from `src/machine/transition`.
- red: `pnpm vitest run test/acceptance/machine-gates.test.ts test/acceptance/machine-matrix.test.ts`
  -> `Error: Cannot find module '../../src/machine/transition'` (2 files failed, no tests ran). This is the expected outer-loop red: the entry point does not exist yet.
- The two files stay uncommitted and red while the inner loop (G7 to G17) builds the units. During those cycles the suite run excludes them with `--exclude`, which narrows nothing for the unit under test. Entry closes when they go green.

## Cycle G7: U10 to U15 event parsing

- tests: `src/machine/events.test.ts` (new): `parses a valid %s event` x15 (U10), `refuses an unknown event type as unknown_event` (U11), `refuses an event with an unknown extra key` (U12), `refuses %s without %s as invalid_event` x9 (U13), `refuses %s with a bad value %j as invalid_event` x16 (U14), `refuses non-object input %j as invalid_event` x6 (U15)
- red: declared `src/machine/types.ts` and `src/machine/refusal.ts` (data only) and a stub `parseEvent` that throws, then `pnpm vitest run src/machine/events.test.ts`
  -> `Error: not implemented` (49 failed, 1 passed). The one pass is `covers all 15 event types`, a fixture sanity check.
- green: `src/machine/events.ts` defines a strict `zod` schema per event type, a discriminated union, and `parseEvent`, which maps failures to `unknown_event` or `invalid_event`. `pnpm vitest run src/machine/events.test.ts` -> 50 passed. Suite without the two open outer files -> 6 files, 67 passed, 0 failed. Lint clean. Type-check fails only on the two open outer files, which import `transition` before it exists.
- refactor: none needed
- commit: G7

## Cycle G5b: U8 follow-up, a Node built-in name must not block a sibling module

- found by: linting `src/machine/events.test.ts` in G7 reported `'./events' import is restricted ... Node built-ins`. The G7 commit (`feat: parse and validate machine events [G7]`) was made with that lint error present, because the lint output and the commit ran in one command. This cycle fixes it.
- test: `test/acceptance/lint-isolation.test.ts::passes lint on a sibling module whose name matches a Node built-in` (new, extends U8)
- red: `pnpm vitest run test/acceptance/lint-isolation.test.ts`
  -> `AssertionError: expected [ …(3) ] to deeply equal []` (1 failed, 10 passed)
- green: `eslint.config.js` now restricts built-ins through exact-name `paths` entries (plus the `node:*` pattern), so `./events`, `./path`, and `../machine/util` pass. Lint-isolation file -> 11 passed. Suite without the two open outer files -> 6 files, 68 passed, 0 failed. `pnpm eslint .` clean.
- refactor: none needed
- commit: G5b

## Cycle G8: U16, U17, U18 evidence, profile, and actor guards

- tests: `src/machine/guards.test.ts` (new): `evidenceProvided refuses evidence %j` x4 and `accepts evidence %j` x3 (U16), `profileResolved refuses a start event with profile %j` x2 and `accepts a start event with a complete profile` (U17), `notWorker refuses only the worker actor` and `ownerOnly accepts only the user actor` (U18)
- red: declared `GUARDS` as an empty registry, then `pnpm vitest run src/machine/guards.test.ts`
  -> `TypeError: GUARDS.evidenceProvided is not a function` (12 failed, 0 passed)
- green: `src/machine/guards.ts` implements `evidenceProvided` (trimmed, non-empty), `profileResolved`, `notWorker`, and `ownerOnly`. The other nine guards are placeholders that refuse with `internal_mismatch`, so an unwritten gate fails closed. `pnpm vitest run src/machine/guards.test.ts` -> 12 passed. Gate script (lint, type-check, suite without the two open outer files) -> 7 files, 80 passed, 0 failed.
- refactor: none needed
- commit: G8

## Cycle G9: U19, U20, U21, U22 mode, ready, pipeline, and scope guards

- tests: `src/machine/guards.test.ts` (extended, 13 new): `modeIsNoMistakes accepts only the no-mistakes mode` and `modeIsNotNoMistakes accepts direct-PR and local-only and refuses no-mistakes` (U19); `direct-PR needs a pull request URL`, `direct-PR does not need landed commits`, `local-only needs one or more landed commits, so 0 and a missing count fail and 1 passes`, `local-only does not need a pull request URL`, `refuses for the no-mistakes mode ...`, `refuses an event that is not a ready event` (U20); `refuses an unfinished pipeline and accepts a finished one`, `refuses an event that is not a validated event` (U21); `approvalScopeIsMerge accepts only the merge scope`, `approvalScopeIsPromote accepts only the promote scope`, `refuse an event that is not an approval event` (U22)
- red: `pnpm vitest run src/machine/guards.test.ts`
  -> 13 failed, 12 passed. Decisive lines: `AssertionError: expected 'internal_mismatch' to be 'mode_check_failed'` (x5), `expected { code: 'internal_mismatch', …(1) } to be null` (x5), `expected 'internal_mismatch' to be 'mode_mismatch'` (x2). The placeholders from G8 refuse, so the accepting and the coded-refusal cases both fail.
- green: `src/machine/guards.ts` implements the two mode guards, `readyModeCheck`, `pipelineFinishedWithPr`, and the two scope guards. Guards file -> 25 passed. Gate script -> 7 files, 93 passed, 0 failed.
- refactor: none needed
- commit: G9

## Cycle G10: U23, U24, U25 merge, promotion, and worktree guards

- tests: `src/machine/guards.test.ts` (extended, 10 new): `mergeAuthorized` accepts yolo, accepts an approved decision, refuses a denied, missing, or other-scope decision, and refuses a non-merge event (U23); `promotionAuthorized` accepts an approved promote decision and refuses denied, missing, or other-scope decisions (U24); `worktreeLanded` accepts clean with zero unpushed, refuses uncommitted changes, refuses a single unpushed commit, refuses a non-teardown event (U25)
- red: `pnpm vitest run src/machine/guards.test.ts`
  -> 10 failed, 25 passed. Decisive lines: `AssertionError: expected { code: 'internal_mismatch', …(1) } to be null` (x4), `expected 'internal_mismatch' to be 'unlanded_work'` (x3). The placeholders still refuse.
- green: `src/machine/guards.ts` implements `mergeAuthorized`, `promotionAuthorized`, and `worktreeLanded`. Guards file -> 35 passed. Gate script -> 7 files, 103 passed, 0 failed.
- refactor: removed the now-unused `pending` placeholder helper, and simplified the test helper type to `TaskContext["approvals"]`. Gate re-run green.
- commit: G10
