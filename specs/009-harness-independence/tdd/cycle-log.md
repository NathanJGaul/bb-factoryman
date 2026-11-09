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

## Group 3: the readiness gate (tasks T1324 to T1335, H1 part 2)

Behaviors: U1323 to U1332, U1336, U1339 to U1343, U1345 to U1348, U1350 to U1352, U1355 to U1357, A1301 to A1309.
BASELINE behaviors carried by this group: U1322, U1333 to U1335, U1337, U1338 (the old `checkProfile` tests, now on the new signature), U1349, U1353, U1354.
Commit subject: "feat: pass a provider only when bb reports it ready (H1)".

- structural step first, on green: `checkProfile(profile, providers)` became `checkProfile(profile, facts)` with `facts = { host, providers, states }`, and `src/dispatch/availability.test.ts` moved to the new call shape with its assertion lines unchanged (U730 to U735).
  The suite stayed green at that point.
- test: `src/dispatch/availability.test.ts` gained 12 cases (U1323 to U1332, U1336, and a `readinessProblem` case).
- red: `pnpm vitest run src/dispatch/availability.test.ts` -> `11 failed | 8 passed`; U1323 to U1332 and the `readinessProblem` case fail with `- Expected / + Received` on the readiness text (the stub returns null and `checkProfile` reads no state).
  U1336 and U1322 passed against the stub by design.
- green: `readinessProblem` returns the message for each status and null only for `ready`; `checkProfile` puts it first and appends "No other provider was tried."
  `pnpm vitest run src/dispatch/availability.test.ts` -> 19 passed.
- test: `src/dispatch/gate.test.ts` (new, 6 tests) against a stub `gateProfile` that throws "not implemented".
- red: `pnpm vitest run src/dispatch/gate.test.ts` -> `6 failed`; `Error: not implemented`.
- green: `gateProfile` reads the providers and the states together with the placed machine's ID (none for the default host) and maps a throw to `read_failed` with the text of the contract.
  `pnpm vitest run src/dispatch/gate.test.ts src/dispatch/availability.test.ts` -> 25 passed.
- test: `src/machines/preflight.test.ts` (5 new cases), `src/limits/queue.test.ts` (2 new cases), `src/tools/dispatch.test.ts` (3 new cases) were written while the call sites still used the old two-argument `checkProfile`.
- red: `pnpm vitest run src/machines/preflight.test.ts src/limits/queue.test.ts src/tools/dispatch.test.ts` -> `28 failed`.
  Twenty-three of those are existing tests that failed because the old call sites passed an array where `checkProfile` now wants a facts object, and the suite was red until the call sites moved.
  The five that name new behavior fail on the assertion: U1347 and U1348 (the preflight message), U1350 (`getProviderStates` was never called), U1351 and U1352 (the queue started the task), U1355 and U1356 (no readiness text).
  I did not commit on this red.
- green: `src/tools/dispatch.ts` and `src/limits/queue.ts` call `gateProfile`, and `runPreflight` reads the host's states and reuses `readinessProblem`.
  `pnpm vitest run src/machines/preflight.test.ts src/limits/queue.test.ts src/tools/dispatch.test.ts src/dispatch` -> 137 passed.
- test: `test/acceptance/harness-readiness.test.ts` (new, 13 cases) and `setProviderStates` in the `loadWorld` fixture.
  The file was written after the call sites were wired, so it passed on its first run.
  The deliberate-mutant check, one mutant at a time on the code, with the file restored each time: an `unauthenticated` state that passes -> 12 tests fail, among them A1301, A1305, A1306, A1307 (M1 killed); a failed states read that passes -> U1343, U1352, U1356, A1304 fail (M17 killed); states read without the placed machine's ID -> A1305 and U1340 fail; a queue start that ignores the gate -> A1307, U1351, U1352 fail; a preflight that ignores readiness -> U1347 and A1306 fail; the first state instead of the profile's state -> U1330, U1331, A1304 fail (M16 killed); readiness skipped for an unlisted provider -> U1332 fails (M2 killed).
- existing tests that changed, forced by the requirement (D-107): `test/acceptance/dispatch-resolver.test.ts` [A710], two cases.
  "unavailable" now expects "is not installed" and "not listed" expects "bb reports no state for the provider `claude`", because readiness comes before the listing.
  The behavior is the same (the dispatch blocks and spawns nothing), and only the message that explains it changed.
  No assertion was loosened: both still require an error and zero spawns.
- suite: `pnpm run check` -> 99 files, 1408 passed, 0 failed.
- refactor: none needed after the green. The three call sites each shrank by a few lines.

## Group 4: the Pi admission rule (tasks T1340 to T1344, H11)

Behaviors: U1358 to U1368, A1316 to A1321.
Commit subject: "feat: refuse Pi in local-only projects (H11)".

- test: `src/dispatch/gate.test.ts` gained `admit` and admission cases (U1358 to U1366), and `src/limits/queue.test.ts` gained U1367 and U1368, against a stub `admit` that admits every provider.
- red: `pnpm vitest run src/dispatch/gate.test.ts src/limits/queue.test.ts` -> `6 failed`; `AssertionError: expected null to deeply equal StringContaining{…}` (U1358), `expected null to be 'The provider \`pi\` is not admitted for…'` (U1364), `expected { ok: false, …(3) } to match object { ok: false, …(2) }` (U1363), `expected [ …(2) ] to deeply equal []` (U1365: the gate had read bb), `expected { ok: false, …(3) } to match object { code: 'provider_not_admitted' }` (U1366), and the U1367 queue case.
  U1359 to U1362 and U1368 passed against the stub by design: they pin what stays admitted.
  Their mutant: the Pi row refuses `direct-PR` and not `local-only` -> 16 tests fail, U1358 to U1360, U1363 to U1367 among them (M3 killed).
- green: `admit(providerId, mode)` reads the contract row, and `gateProfile` calls it first with `permanent: true`; a queued task with a permanent refusal fails with "The queued task can no longer start: <message>".
  `BlockCode` gained `provider_not_admitted`. `pnpm vitest run src/dispatch/gate.test.ts src/limits/queue.test.ts` -> 37 passed.
- test: `test/acceptance/harness-admission.test.ts` (new, 12 cases, A1316 to A1321).
  It was written after the code, so 11 cases passed on the first run and the deliberate-mutant check applies.
  The twelfth failed (A1320, `expected [] to have a length of 1 but got +0`) for a reason that belonged to the test: a plugin reload gives the fake host a new call log, so the spawns before the restart are not counted.
  I changed the assertion to "no spawn since the restart", which is stricter than the first version, as a step of its own.
  Mutants: Pi refuses `direct-PR` instead of `local-only` -> A1316, A1317 and the unit cases fail (M3 killed); the queue start does not fail a permanently refused task -> U1367 and A1320 fail (M4 killed); the gate with no admission call -> 11 tests fail, among them A1316, A1318, A1320 (M20 killed through U1365 as well); dispatch passes a fixed mode to the gate -> A1316, A1318, A1321 fail (M19-style).
- suite: `pnpm run check` -> 100 files, 1436 passed, 0 failed.
- refactor: none needed. A leftover string `replace` in the first draft of `admit` was removed before the commit.

## Group 5: model-aware checks and per-provider ladders (tasks T1350 to T1361 and T1398, H2)

Behaviors: U1344, U1369 to U1393, U1395 to U1403, U1473, A1330 to A1338, A1350.
BASELINE behaviors carried by this group: U1394 (`[U707]`), U1399 (`[U701]`), U1404 (`[U722]` to `[U725]`).
Commit subject: "feat: check the model and its levels against what bb lists (H2)".

- test: `src/bb/adapter.test.ts` gained a `listModels` block (5 cases) against a stub that throws "not implemented".
- red: `pnpm vitest run src/bb/adapter.test.ts -t "listModels"` -> `5 failed`; `Error: not implemented`.
- green: the adapter calls `providers.models` with `{ providerId }` or `{ providerId, hostId }` and maps the fields.
  The fixtures gained `FakeBbPort.models`, `modelsByHost`, `modelsError`, `modelEntry`, `DEFAULT_MODEL_IDS`, and `loadWorld`'s `models`, `modelsByHost`, `modelsError`, `modelFixture`, `setModels`.
  The default list holds the model IDs that the existing tests dispatch with, so a test that scripts no list keeps its meaning.
- test: `src/dispatch/config.test.ts` gained the ladder cases against a stub `ladderFor` that returns its input.
- red: `pnpm vitest run src/dispatch/config.test.ts` -> `5 failed | 21 passed`; `expected false to deeply equal { Object (codex, claude-code) }` (U1390), `expected false to be true` (U1392), `expected 'Invalid input: expected array, receiv…' to match /duplicate|repeat/i` (U1393), `expected { codex: [...] } to deeply equal [ 'low', 'ultra' ]` (U1397), and U1398.
  U1391 passed against the old schema only because a record was rejected whole; the mutant check after the green (a record key schema that accepts a blank key) makes U1391 fail.
- test: `src/dispatch/resolver.test.ts` gained four ladder cases (U1400 to U1403).
- red: `pnpm vitest run src/dispatch/resolver.test.ts` -> `4 failed`; `TypeError: ladder.indexOf is not a function`, because the resolver handed the record to code that wants an array.
- test: `src/dispatch/availability.test.ts` gained 14 model cases (U1374 to U1388) after `ProfileFacts` gained `models`.
- red: `pnpm vitest run src/dispatch/availability.test.ts` -> `11 failed | 25 passed`; the failures are the model texts (`Expected / Received`) and the omp `off` case.
- test: `src/dispatch/gate.test.ts` gained U1344 and a models assertion in U1340.
- red: `pnpm vitest run src/dispatch/gate.test.ts` -> `4 failed`; `TypeError: Cannot read properties of undefined (reading 'models')` (the gate passed no model list yet) and `expected [] to deeply equal [ [ 'claude', 'host_gpu' ] ]` (U1340).
- green: the config accepts an array or a record of provider ID to array (non-blank key, non-empty array, no repeated level), `ladderFor` picks the ladder, the resolver ranks in the explicit profile's provider ladder, `checkProfile` applies R4, and `gateProfile` reads the models with the placed machine's ID.
  `ladderFor` and `DEFAULT_REASONING_LEVELS` live in `src/dispatch/types.ts`, which has no imports, because test A718 allows the resolver to import only `./types` and `../machine/types`.
  `config.ts` re-exports them. The first draft imported `./config` into the resolver and A718 failed; I kept A718 as it is and moved the code.
- test: `src/limits/queue.test.ts` U1473, and `test/acceptance/harness-models.test.ts` (new, 10 cases: A1330 to A1338, A1350).
  They were written after the code and passed on the first run, so the deliberate-mutant check applies.
  Mutants, one at a time with the file restored: the provider-wide level list always used -> U1374, U1375, U1386 to U1388, A1330, A1331 fail (M14 killed); Pi accepts unlisted models -> U1379 to U1381 and A1332 fail (M15 killed); `ladderFor` ignores the record entry -> U1397, U1400, A1336 fail (M5 killed); `ladderFor` returns nothing for an omitted provider -> U1398, U1402, A1337 fail (M6 killed); a record key that may be blank -> U1391 fails; models matched by `id` only -> U1387 fails; the models read without the host ID -> U1340 fails; a failed models read that passes -> U1344 and A1338 fail (M17 killed); unlisted models refused for every provider -> A1333, U1383 to U1385 and the old U730, U734, U735 fail.
- existing tests that changed, forced by the requirement (D-107):
  `src/dispatch/gate.test.ts` "passes pi in direct-PR and no-mistakes modes on to the other checks" and `test/acceptance/harness-admission.test.ts` [A1317] and [A1318] (both from group 4) now list Pi's model in bb, because Pi refuses a model that bb does not list.
  `test/acceptance/dispatch-resolver.test.ts` [A710] "a reasoning level it does not list" now scripts a model whose levels are `unknown`, because a model whose levels are known decides, and the provider-wide list is the fallback.
  No assertion was loosened. The new setups make the old reasons explicit.
- suite: `pnpm run check` -> 101 files, 1486 passed, 0 failed.
- refactor: none needed after the green.

## Group 6: no built-in default, the exclusive write, and `dispatch init` (tasks T1370 to T1379, H10)

Behaviors: U1405 to U1408, U1410 to U1444, A1322 to A1329.
BASELINE behavior carried by this group: U1409 (`[U711]`, `[U716]`, `[U744]`).
Commit subject: "feat: remove the built-in default profile and add dispatch init (H10)".

- test: `src/files.test.ts` gained three `writeNew` cases against a stub that throws "not implemented".
- red: `pnpm vitest run src/files.test.ts` -> `2 failed | 4 passed`; `Error: not implemented` for U1405 and U1406.
  U1407 passed against the stub because the stub also throws.
  A mutant check after the green found that the first version of U1407 did not exercise the write's own error handling (a mutant that returned "exists" for every error survived).
  I added a second assertion with a 300-character file name (`ENAMETOOLONG`, raised by the write and not by `mkdir`), and the mutant then failed U1407.
- green: `nodeFiles.writeNew` creates the directory and opens the file with `flag: "wx"`, mapping `EEXIST` to "exists".
  A mutant with flag `w` fails U1406 and A1326 (M8 killed).
  `FakeFiles` gained `writeNew`, `writes`, and `writeErrors`.
- test: `src/dispatch/resolver.test.ts` U1408 and U1410, `src/tools/dispatch.test.ts` U1411 (two cases), and `test/acceptance/dispatch-resolver.test.ts` [A706].
- red: `pnpm vitest run src/dispatch/resolver.test.ts src/tools/dispatch.test.ts test/acceptance/dispatch-resolver.test.ts` -> `4 failed | 77 passed`; `expected { status: 'clear', …(4) } to deeply equal { status: 'blocked', …(2) }` (U1408), `expected [ 'BUILTIN_PROFILE', …(1) ] to not include 'BUILTIN_PROFILE'` (U1410), `expected true to be false` (U1411 block), `expected false to be true` (A706).
- green: `BUILTIN_PROFILE` and the `builtin` source are gone, and the last rung returns `blocked` with `no_default_profile` and the message of the contract.
- existing tests that changed, forced by the requirement (D-107):
  `src/dispatch/resolver.test.ts` [U710] (title only: it no longer names the built-in default), [U717] (its assertion applied the built-in default; U1408 now states the reverse, so the old assertion is retired and not kept), [U726] (title only), [U811] (its last line asserted `source: "builtin"`; it now asserts the block);
  `test/acceptance/dispatch-resolver.test.ts` [A706] (the second half asserted the built-in profile; it now asserts the block) and [A717] (the untagged case now names a configured `default`);
  `test/acceptance/limits-queue.test.ts` [A1025], [A1026] (the project's `dispatch.json` now has a `default`, because the queued task relied on the built-in);
  `test/acceptance/machine-placement.test.ts` [A826] (the call names a profile, because the project has no readable checkout and the block now comes first).
  The suite also relied on the built-in in about forty other acceptance tests.
  `loadWorld` now supplies `TEST_DEFAULT_DISPATCH` (the old built-in profile as a `default`, with `standingPermission.lowerReasoning` on because the built-in set no floor, D-064) wherever a checkout has no `dispatch.json`.
  A test that wants the real block passes `bareConfig: true`.
  That keeps every one of those tests asserting what it asserted.
- test: `src/dispatch/init.test.ts` (new, 34 cases, U1412 to U1440) against a stub `runDispatchInit` that throws "not implemented".
- red: `pnpm vitest run src/dispatch/init.test.ts` -> `34 failed`; every case fails with `Error: not implemented`.
- green: `src/dispatch/init.ts` implements the command of `contracts/cli-dispatch-init.md`; `checkSupport` was split out of `checkProfile` first, as a structural step on green, so the command can run the same checks minus readiness.
  `pnpm vitest run src/dispatch/init.test.ts` -> 34 passed.
- test: `src/tools/supervisor-command.test.ts` (U1441 to U1443) and `src/server.test.ts` (U1444).
- red: `pnpm vitest run src/tools/supervisor-command.test.ts src/server.test.ts` -> `7 failed`; `expected 2 to be +0` (the command did not route `dispatch`) and `expected undefined to match object { Object (usage) }` (no CLI entry).
- green: `runFactorymanCommand` routes `dispatch init`, the usage text lists the line, and `createPlugin` registers the `dispatch` entry. 32 tests passed in the two files.
- test: `test/acceptance/harness-default.test.ts` (new, 16 cases, A1322 to A1329).
  It was written after the code and passed on the first run, so the deliberate-mutant check applies.
  Mutants, one at a time with the file restored: init writes with flag `w` -> A1326 and U1406 fail; init skips the profile check -> U1431 and A1328 fail; the mode order reversed -> U1426, U1427, U1437, A1324, A1325 fail; the written file without a `default` -> U1437, A1324, A1325 fail; a repeated flag accepted -> U1412 fails; a built-in default returned from the last rung -> U811, U1408, U1411, A1322 fail; `dispatch` routes any subcommand to init -> survived at first, because the other inputs print the same usage, so I added `["dispatch", "--provider", "claude", "--project", "proj-1"]` to U1442 and the mutant then failed.
- suite: `pnpm run check` -> 103 files, 1550 passed, 0 failed.
- refactor: none needed after the green.

## Group 7: the cause of a failure (tasks T1380 to T1386, H3)

Behaviors: U1445 to U1464, U1466 to U1471, A1339 to A1344.
BASELINE behaviors carried by this group: U1465 (`[U135]`, `[U136]`, `[U137]`), U1472 (`[U128]`, `[U214]`).
Commit subject: "feat: carry the provider's reported cause in the failure evidence (H3)".

- test: `src/wiring/failure-cause.test.ts` (new, 14 cases, U1445 to U1455) against a stub whose `boundCause` returns its input and whose `remedyFor` returns null.
- red: `pnpm vitest run src/wiring/failure-cause.test.ts` -> `8 failed | 6 passed`; U1446 (control characters kept), U1448 (no cut), and U1449 to U1454 (no remedy) fail on `Expected / Received`.
  U1445, U1447, and U1455 passed against the stub by design.
  Mutants: `limit < 300` -> U1447 fails; cut at 298 characters -> U1448 fails; HTTP 401 ignored -> U1453 fails.
  The sign-in-before-model mutant (M7) survived the first U1451, because "Use /login, set an API key" matches none of the sign-in patterns.
  I added an input that matches both families ("No model selected. Not logged in · Please run /login"), as a step of its own, and the mutant then failed U1451 (M7 killed).
- green: `src/wiring/failure-cause.ts` holds `boundCause` (control characters become one space, spaces collapse, 300 characters with a closing `...`) and `remedyFor` (model patterns first, then sign-in patterns, HTTP 401, and the category `unauthorized`).
  The first draft of the control-character regex tripped `no-control-regex`; it uses the Unicode category `\p{Cc}` now.
- test: `src/bb/adapter.test.ts` gained a `getFailureCause` block (7 cases) against a stub that throws "not implemented".
- red: `pnpm vitest run src/bb/adapter.test.ts -t "getFailureCause"` -> `7 failed`; `Error: not implemented`.
- green: the adapter lists `provider/error` and `system/error` events, newest first, one row, and returns the `detail` or the `message`.
  A mutant that lists oldest first fails U1456 and A1339 (M18 killed).
  The fixtures gained `FakeBbPort.failureCauses`, `failureCauseError`, and `loadWorld`'s `threadEvents` and `eventsError`, with a `threads.events.list` fake that applies `types`, `order`, and `limit`.
- test: `src/wiring/handlers.test.ts` (nine cases for U1461 to U1469) and `src/wiring/wake.test.ts` (U1470, U1471).
- red: `pnpm vitest run src/wiring/handlers.test.ts src/wiring/wake.test.ts` -> `10 failed`; `expected 'worker thread failed: Provider crashed' to be 'worker thread failed: Provider crashe…'` (U1461, U1462, U1463, U1464), `expected -1 to be 1` (U1468: the cause was never read), `expected false to be true` (U1466: no warning), and `expected '[factoryman] Task t1 (ship, no-mistak…' to contain 'Evidence: xxxx…'` (U1470, U1471).
  U1469 passed against the old code, because the old code never reads the cause; it guards the new code.
- green: `threadFailed` builds today's evidence, reads the cause once after the wait for an empty error text, and appends the bounded cause and the remedy; a failed read is logged and costs the failure nothing; the wake limit for a `failed` task is 1200 characters.
  `pnpm vitest run src/wiring` -> 70 passed.
- test: `test/acceptance/harness-failure.test.ts` (new, 16 cases, A1339 to A1344).
  It was written after the code and passed on the first run (one case failed on a wrong name for the host's log, `inspection.logs`; the field is `logEntries`).
  The deliberate-mutant check, one at a time with the file restored: the wake limit left at 600 -> U1470 and U1471 fail, but A1341 did not, because its evidence was short.
  I added a case with 400 characters of error text and a 300-character cause, as a step of its own, and the mutant then failed A1341 (M13 killed).
  Other mutants: the oldest event read -> A1339 and U1456 fail; a failed read that throws out of the handler -> U1466 and A1343 fail; the cause never read -> 22 tests fail; an unbounded cause -> U1467 and A1344 fail; a remedy that ignores the turn failure's status -> U1464 fails.
- suite: `pnpm run check` -> 105 files, 1598 passed, 0 failed.
- refactor: none needed after the green.

## Group 8: the decision record and the docs (tasks T1390 to T1394, story 7)

Behaviors: A1345 to A1348.
Commit subject: "docs: record the harness-independence decisions D-100 to D-107".

- test: `test/acceptance/harness-docs.test.ts` (new, 6 cases) was written before any doc changed.
- red: `pnpm vitest run test/acceptance/harness-docs.test.ts` -> `6 failed`; `expected [ 99 ] to deeply equal [ 99, 100, 101, 102, 103, 104, …(3) ]` (A1345), `expected '\nThe design lists "the plugin\'s bui…' to match /Amended by D-104/` (A1346), `... /Amended by D-105/` (A1347), `docs/DESIGN.md: ... not to match /built-in default/i` (A1348), and the two string checks on `docs/DESIGN.md` and `docs/LIVE-CHECK.md`.
- green: `docs/DECISIONS.md` gained D-100 to D-107 and an "Amended by" line in D-063 and D-064 (their text is unchanged); `docs/DESIGN.md` rung 4 and the `docs/LIVE-CHECK.md` line name the block and `dispatch init`.
  The first wording of both lines said "The plugin has no built-in default", which the test (rightly) rejects as a mention, so they say "The plugin picks no harness for you" and "The plugin picks no profile itself".
  `pnpm vitest run test/acceptance/harness-docs.test.ts test/acceptance/live-check.test.ts` -> 16 passed.
- plan refinement: the A1348 row of the test list said that `CLAUDE.md` is unchanged.
  A unit test cannot know the base commit, and pinning a hash would block every later edit.
  The row now says that the final gate checks it against the base commit (T1397), and the docs test checks the docs and skills only.
- also in this group (no behavior id): `test/acceptance/dispatch-resolver.test.ts` [A713] ("gives the built-in default when dispatch.json is absent") would have kept passing for the wrong reason, because the test world supplies a default.
  It now uses `bareConfig` and asserts the init hint.
  The note on the tdd profile (`.specify/memory/tdd-profile.md`, task T1393) lists the new fixtures and options.
- suite: `pnpm run check` -> 106 files, 1604 passed, 0 failed.
- refactor: none needed.

## Group 9: the final gate and the notes (tasks T1395 to T1397)

- gate: `pnpm run check` -> type check, lint, and 106 files, 1604 passed, 0 failed.
  `pnpm run build` (`bb plugin build`, bb CLI 0.48.1) -> `dist/server.js`, `dist/app.js`, and their maps were written, no error.
  Behavior A1349 is this manual run.
- diff size: 55 files and about 3300 added lines outside `specs/` (about 2500 of them tests and fixtures), 2000 added lines under `specs/`, 143 under `docs/` and `.specify/`.
  The six tasks share one function, `gateProfile`, and the tests of each build on the fixtures of the one before, so a split would make two stacked branches that cannot pass on their own.
  The work ships as one pull request.
- final checks (T1397): `git status` clean; `CLAUDE.md` and `CHANGELOG.md` have no change since `b4e462a`; no commit carries a co-author line; nothing outside the worktree changed except the status file and the scratch directory.
- deliberate mutants (M1 to M20 of the test list), all run and all killed: M1, M2, M3, M4, M5, M6, M7 (after a stronger U1451), M8, M9, M10, M11, M12 (through U1447 and U1448), M13 (after a stronger A1341), M14, M15, M16, M17, M18, M19 (21 tests fail), and M20 (U1340, U1341, U1342, U1365 fail).

### Notes and deviations

- The header of this log says that tests are committed with stubs first.
  They were not: the repository commits only on green (D-099), so each group is one commit with its tests, its code, and its entry, and the red evidence is in the entry.
  A group's tests ran red against a stub or against the old code before the code was written, except where an entry says otherwise.
- Group 6 says that "about forty" acceptance tests relied on the built-in profile.
  That number is an estimate and not a count.
  The first run after the removal showed more than twenty failing acceptance tests, and I did not count the rest because the test world's default made them pass again.
- Tasks that name a `BASELINE` behavior were ticked as well as tasks whose behaviors are all `DONE`.
  The rule in the run command ticks only `DONE`, and a task such as T1324 (which names U1322) would otherwise stay open for ever, and `/speckit.implement` would redo it.
- Acceptance files written after their code (harness-readiness, harness-admission, harness-models, harness-default, harness-failure) passed on the first run, and the entries above list the mutants that show each one can fail.
  Eight times a mutant survived the first version of a test (U1407, U1442, U1451, A1341, the `\p{Cc}` regex aside); each time the test was strengthened in a step of its own and the mutant then failed.
- Not done here, by design: the live check of `quickstart.md`, part 2, which is the owner's step.
