# Cycle log: Agent-harness independence

Append only.
Newest last.
Every entry's `red` block is the evidence that the test existed and failed before the implementation.
Tests are committed with stubs first where the module is new, so git history shows the order.

## Baseline

- suite: `pnpm test` -> 95 files, 1307 passed, 0 failed (17.6 s)
- type check and lint: `pnpm run check` -> exit 0
- commit: `b0ccb09` (the specification, plan, and task list are committed; no code has changed since `b4e462a`)
- recorded: cycle 0, before any change

## Group 1: the contract table and the provider-aware configuration (tasks T1310 to T1317, H5)

Behaviors: U1301 to U1317, A1310 to A1315.
The group follows the earlier features: the tests are written against a stub, run red, and then the code follows.
The repository commits only on green (D-099), so one commit holds the tests, the code, and this entry.
Its subject is "feat: pin the harness contract table and read the provider in configure (H5)".

- test: `src/harness/contracts.test.ts` (new, 18 tests) against a stub `src/harness/contracts.ts` whose `contractFor` throws and whose `CONTRACTS` is empty.
- red: `pnpm vitest run src/harness/contracts.test.ts` -> `16 failed | 2 passed`; the decisive lines are `Error: not implemented` for U1301 to U1305, U1309 to U1311, and `AssertionError` on `holds exactly the four named rows` and U1308.
  U1306 and U1307 passed against the empty table because their loop has no row to check.
  The deliberate-mutant check, run after the green: Pi `sandbox: "available"` -> U1303 and U1306 fail; Pi `refusalReason: null` -> U1303 and U1307 fail; Claude `toolHint: null` -> U1301 and U1308 fail.
  Each mutant was reverted and the file compared with a saved copy.
- green: `src/harness/contracts.ts` holds the four rows, the generic row, and `contractFor` over a `Map`, so inherited keys (`__proto__`, `constructor`, `toString`) return the generic row.
  A mutant that reads a plain object by key fails the four U1311 cases (M11 killed).
  `pnpm vitest run src/harness/contracts.test.ts` -> 18 passed.
- test: `test/acceptance/lint-isolation.test.ts` gained 19 cases (A1312).
- red: `pnpm vitest run test/acceptance/lint-isolation.test.ts -t "harness table isolation"` -> `9 failed | 10 passed | 65 skipped`; the nine "fails lint on src/harness importing ..." cases fail with `expected 0 to be greater than 0`.
  The ten "passes" cases passed before the rule existed, as they should: they guard the other layers.
- green: `eslint.config.js` has a `src/harness/**/*.ts` block (all imports and `import()` forbidden, test files ignored).
  `pnpm vitest run test/acceptance/lint-isolation.test.ts` -> 84 passed.
- test: `src/tools/register.test.ts` gained seven tests (U1312 to U1317).
- correction before the green: the first version of U1312, U1315, and U1316 asserted that the `instructions` key is absent.
  The fake host's `resolveAgentConfiguration` always reports `instructions: null` for "none", so those assertions failed for a reason that was not the missing feature.
  I changed them to assert `instructions` is null, as a step of its own and before any code change.
  The assertion is not weaker for the behavior: a hint of any text makes it fail.
- red: `pnpm vitest run src/tools/register.test.ts` -> `3 failed | 13 passed`; `AssertionError: expected null to be 'In this harness the tool factoryman_r…'` for U1313 and U1317, and `... 'In this harness factoryman_report has…'` for U1314.
  U1312, U1315, and U1316 pass against today's code by design: they pin that the hint stays off.
  Their mutants: hint on by default (`options.toolHints === false`) -> U1312 fails (M9 killed); the hint for every role -> U1316 and A1315 fail (M10 killed); a metadata value appended to the hint -> U1313, U1314, U1317, A1314, and A1315 fail.
- test: `test/acceptance/harness-configure.test.ts` (new, 5 tests; A1310, A1311, A1313 to A1315) and the `toolHints` option of `loadWorld` in `test/fixtures/plugin-host.ts`.
- red: `pnpm vitest run test/acceptance/harness-configure.test.ts` -> `2 failed | 3 passed`; `expected null to be 'In this harness the tool factoryman_r…'` (A1314) and `the given combination of arguments (null and string) is invalid` (A1315, which reads the hint of a worker that has none yet).
- green: `registerTools` takes `options.toolHints` (default off) and returns `instructions` from `contractFor(context.provider.id).toolHint` for the `worker` role only; `createPlugin` passes the option through.
  `pnpm run check` -> 97 files, 1356 passed, 0 failed.
- refactor: none needed. The change is nine lines in an existing callback.
- notes: A1313 passes against the old code and is a guard: it fails if the hint turns on by default.
  The helper that ticks `tasks.md` also ticks a task whose behaviors are all `DONE` or `BASELINE`.
  A task that names a `BASELINE` behavior (T1324 names U1322) would otherwise never tick, and `/speckit.implement` would redo it.

## Group 2: the provider states read and its fixtures (tasks T1320 to T1323, H1 part 1)

Behaviors: U1318 to U1321.
Commit subject: "feat: read bb's provider states through the port (H1)".

- test: `src/bb/adapter.test.ts` gained a `getProviderStates` block (10 cases) against a stub `getProviderStates` in `src/bb/adapter.ts` that throws "not implemented".
- red: `pnpm vitest run src/bb/adapter.test.ts -t "getProviderStates"` -> `10 failed`; every case fails with `Error: not implemented` (U1318, U1319, U1320 for each status, U1321).
- green: the adapter calls `bb.sdk.system.providerStates` with no argument or `{ hostId }`, keeps the six fields, and maps a status outside the six known values to `unknown` (fail closed).
  `pnpm vitest run src/bb/adapter.test.ts` -> 32 passed.
- fixtures (tasks T1322, T1323, no behavior id): `FakeBbPort` gained `states`, `statesByHost`, `statesError`, and a default that derives one state per listed provider (`ready` when available, `not_installed` otherwise); `loadWorld` gained `providerStates`, `providerStatesByHost`, `providerStatesError`, a `system.providerStates` fake with the same default, and the exported `stateFixture` and `providerState` builders.
  The fixtures change no test. `pnpm run check` -> 97 files, 1366 passed, 0 failed.
- refactor: none needed.
