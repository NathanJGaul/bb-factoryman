# Cycle log: Conformance harness for agent harnesses

Append only.
Newest last.
Every entry's `red` block is the evidence that the test existed and failed before the implementation.

## Baseline

- suite: `pnpm test` -> 95 files, 1307 passed, 0 failed
- commit: `8148863`

## Setup before the first cycle (tasks T1301 to T1304)

Commit `2a901a4`: `tools` joins the type check through `tools/tsconfig.json` (with `erasableSyntaxOnly`, so Node's type stripping can run the files), `allowImportingTsExtensions` in the root `tsconfig.json`, `tools/**/*.test.ts` in the `vitest` include, and the scripts `conformance` and `conformance:docs`.
The root config cannot take `erasableSyntaxOnly`, because `src/` uses constructor parameter properties.
`pnpm run typecheck` and `pnpm run lint` stay green.
No dependency was added.

## Group 1: the verdict rules and the known-gap loader (U1301 to U1316)

Tests and stubs came first: `judge` returned an empty run, `parseGaps` and `loadGaps` returned `[]`.
All 16 tests ran red for the right reason (an assertion about the missing behavior).

- red: `pnpm vitest run tools/conformance` -> 16 failed
  - U1301 `AssertionError: expected [] to deeply equal [ [ 'S3', 'pass' ] ]`
  - U1302 `AssertionError: expected undefined to be 'fail'`
  - U1303 `AssertionError: expected undefined to be 'known-gap'`
  - U1305 `AssertionError: expected [] to deeply equal [ { check: 'S1.remedy', …(3) } ]`
  - U1312 `AssertionError: expected [] to deeply equal [ { check: 'S1.remedy', …(3) }, …(1) ]`
  - U1313 to U1315 `AssertionError: expected [Function] to throw an error`
  - U1316 `AssertionError: promise resolved "[]" instead of rejecting`
- green: `tools/conformance/verdict.ts` (`judge`, `applicable`, `judgeScenario`) and `tools/conformance/gaps.ts` (a `zod` schema, the duplicate check, a loader that fails on a missing file). `pnpm vitest run tools/conformance` -> 16 passed.
- refactor: none needed.

## Group 2: the result file and the command line (U1317 to U1326)

Tests and stubs first: `parseResult` threw "not implemented", `serializeResult` and `resultFileName` returned `""`, `parseArgs` refused everything.

- red: `pnpm vitest run tools/conformance/result.test.ts tools/conformance/args.test.ts` -> 14 failed
  - U1317 `Error: not implemented`
  - U1318 `AssertionError: expected false to be true // Object.is equality` (the trailing newline)
  - U1319 `SyntaxError: Unexpected end of JSON input` (the stub wrote nothing, so the damage step could not run; the check below shows the real reason)
  - U1320 `AssertionError: expected '' to be '1.5-claude-code.json'`
  - U1321 to U1325 `Error: expected ok, got: not implemented`
  - U1322 `AssertionError: expected 'not implemented' to match /--harness/`
  - U1323 `AssertionError: expected 'not implemented' to match /tier 2/i`
  - U1326 `AssertionError: expected 'not implemented' to match /firstmate/`
- green: `tools/conformance/result.ts` (a `zod` schema for the file, strict, with the verdict values) and `tools/conformance/args.ts` (the flags, the tier rules, the lab-directory refusal, offline by default at tier 1.5). `pnpm vitest run tools/conformance` -> 30 passed. `pnpm run typecheck` and `pnpm run lint` pass.
- note on U1319: its red came from the stub's empty output and not from a missing validator, so the audit must prove the test with a mutant (a loosened schema) and not by the red alone.
- refactor: none needed.

## Group 3: the drivers (U1327 to U1334)

Tests and a stub index first: `HARNESS_IDS` was empty and `resolveDriver` refused every id.

- red: `pnpm vitest run tools/conformance/drivers` -> 6 failed, 2 passed
  - U1327 `AssertionError: expected [] to deeply equal [ 'claude-code', 'codex', 'omp', 'pi' ]`
  - U1328 to U1331 `Error: not implemented` (the helper threw the stub's refusal)
  - U1334 `Error: not implemented`
  - U1332 and U1333 passed at first. They looped over the empty id list, so the pass proved nothing. The tests were strengthened before any implementation (`expect(HARNESS_IDS).toHaveLength(4)` first), and then ran red: `pnpm vitest run tools/conformance/drivers` -> 8 failed.
- green: `tools/conformance/drivers/` holds `types.ts` (the `Driver` interface), `bind.ts` (the install-directory rule), one file per driver (`claude-code.ts`, `codex.ts`, `pi.ts`, `omp.ts`, `stub.ts`), and `index.ts`. The values come from the harness-independence report, appendix B. `pnpm vitest run tools/conformance/drivers` -> 8 passed. `pnpm run typecheck` and `pnpm run lint` pass.
- refactor: none needed.

## Group 4: the stub agent (U1335 to U1344)

Tests, a fake stdio MCP server (`tools/stub-agent/fake-mcp.ts`), and a placeholder agent first.
The placeholder answered `initialize` and refused every other method.
The tests start the agent as a child process and speak ACP over stdio.

- red: `pnpm vitest run tools/stub-agent` -> 10 failed
  - U1335 `AssertionError: expected '' not to be ''` (no session id)
  - U1336 `AssertionError: expected '' to contain '[tools] factoryman_report'`
  - U1337 `AssertionError: expected '' to contain '[shell ok] marker.txt'`
  - U1338 `AssertionError: expected undefined to be 'done'`
  - U1339 `Error: Command failed: git ... rev-list --count main..fm/t-1` (no branch)
  - U1340 `AssertionError: expected '' to match /silent/i`
  - U1341 `AssertionError: expected [] to deeply equal [ true, true, false ]`
  - U1343 `AssertionError: expected 'Method not found: session/prompt' to contain 'CONFORMANCE-CAUSE-401'`
- green: `tools/stub-agent/stub-agent.ts` is the t01 agent (report appendix A, with the `prlong=` flag of the approval-form copy) in TypeScript, with `SLEEP`, `silent`, `double-report`, `fail=<code>`, the `dirty` flag for scouts, and the `[brain:...]` marker. `pnpm vitest run tools/stub-agent` -> 10 passed.
- lint: `no-useless-assignment` flagged `let args: Json = {}`; fixed to `let args: Json;` (no behavior change). `pnpm run typecheck` and `pnpm run lint` pass.
- refactor: none needed.

## Group 5: the lab scripts and the offline mode (U1345 to U1349)

`bblab` and `bblab-evidence` were copied from `~/.local/bin` into `tools/bblab/` unchanged, then the tests ran against the copy.

- red: `pnpm vitest run tools/bblab` -> 5 failed
  - U1345 `AssertionError: expected 2 to be +0` (`bblab plan` did not exist, so the script printed its usage and exited 2)
  - U1346 `AssertionError: expected '# bblab - isolated live-test lab for …' to contain '--unshare-net'`
  - U1347 `AssertionError: expected '# bblab - isolated live-test lab for …' to match /nsenter:.* --net /`
  - U1348 `AssertionError: expected '' to match /refusing lab dir/`
  - U1349 `AssertionError: tripwire: 0 file-level events on canary credentials (directory listings ignored)` then `expected 1 to be +0`: with only directory events in the tripwire log, `bblab down` aborted before it printed "done" (t01 finding 5.13).
- green: `tools/bblab/bblab` now has `plan`, `--offline` and `BBLAB_OFFLINE=1` (`--unshare-net` in the sandbox, `--net` in `nsenter`, a `run/offline` marker so `bblab x` and `down` agree), a readiness probe that runs inside an offline lab, a wait for the daemon port (t01 finding 5.4), and `|| true` after the tripwire pipeline (t01 finding 5.13). The config refusals moved into `check_config`, which `plan` also runs. `pnpm vitest run tools/bblab` -> 5 passed.
- refactor: `preflight` split into `check_config` and the runtime checks; no behavior change.
- not proven by these tests: that a real offline sandbox starts bb (task T1363, a live check).

## Group 6: the fake model's tool routes and brain (U1350 to U1359)

Tests first, with `findRoute`, `findShell`, and `buildArgs` returning `null`, `null`, and `{}`, and the brain always answering `stub`.

- red: `pnpm vitest run tools/fake-model/tools.test.ts` -> 3 failed, 1 passed
  - U1350 `AssertionError: expected null to deeply equal { kind: 'function', …(1) }`
  - U1351 `AssertionError: expected undefined to be 'Bash'`
  - U1352 `AssertionError: expected {} to deeply equal { command: 'git status', …(1) }`
  - The second U1350 test (a name that only ends in the tool's name) passed against the stub. It is a boundary test and needs the mutant check in the audit.
- red: `pnpm vitest run tools/fake-model/brain.test.ts` -> 6 failed, 1 passed
  - U1353 `Error: expected a tool call, got {"kind":"text","text":"stub"}`
  - U1354 `AssertionError: expected [] to deeply equal [ 'git checkout -b fm/t-1' ]`
  - U1355 `AssertionError: expected [] to deeply equal [ true, true, false ]`
  - U1356 `AssertionError: expected { kind: 'text', text: 'stub' } to deeply equal { kind: 'error', status: 401, …(1) }`
  - U1357, U1358 `Error: expected a tool call, got {"kind":"text","text":"stub"}`
  - U1359 passed against the stub, because every answer was text. The audit must prove it with a mutant that replays the directive on a wake message.
- green: `tools/fake-model/types.ts`, `tools.ts`, and `brain.ts`. Two corrections came from the green run, each made before the behavior was done and each with its reason:
  1. U1350 expected `{ kind: "search", name: <deferred name> }`. The route's `name` is the tool to call, which is `ToolSearch`, so the test now expects `name: "ToolSearch"` and the query that names the deferred tool.
  2. U1354 and U1355 looked for the text `git commit`. The commit command sets an identity (`git -c user.name=... commit`), so they now match `/git .*commit/`. A lab has no guaranteed git identity for a harness that rewrites `HOME`.
  `pnpm vitest run tools/fake-model` -> 11 passed. `pnpm run typecheck` and `pnpm run lint` pass.
- refactor: the delay handling in `runStep` was rewritten once, before green, so a delay applies to the real step right after it.

## Group 7: the three wire formats (U1360 to U1366)

Tests and stubs that threw "not implemented" first.
The `responses` and `messages` test files read a request at the top of the file, so they failed to load, and the chat and error tests failed one by one.

- red: `pnpm vitest run tools/fake-model/wire` -> 5 failed, 2 files failed to load
  - U1360, U1361, U1366 (three formats) `Error: not implemented`
  - `responses.test.ts` and `messages.test.ts`: `Error: not implemented` at `responses.parse(request)` and `messages.parse(request)` (module level, so U1362, U1363, U1364, and U1365 did not run)
- green: `tools/fake-model/wire/shared.ts`, `chat.ts`, `responses.ts`, and `messages.ts`. The event shapes follow the harness-independence report, appendix A, which ran against Pi, Codex, Claude Code, and omp. `pnpm vitest run tools/fake-model/wire` -> 9 passed.
- lint: an unused `Turn` import; removed. `pnpm run typecheck` and `pnpm run lint` pass.
- note: the formats are checked against shapes written from the report, not against bytes recorded from a CLI. The live runs record real request bodies, and the next group adds them as fixtures if a CLI sends something these parsers drop.
- refactor: none needed.

## Group 8: the fake model server (U1367 to U1370, A1318 to A1321)

Unit tests with a server stub that rejected with "not implemented" first.

- red: `pnpm vitest run tools/fake-model/server.test.ts` -> 4 failed, all `Error: not implemented`
- green: `tools/fake-model/server.ts` (`startServer`, a loopback HTTP server that routes by path, runs the brain, waits out delays, logs one JSON line per request with the tools, skills, actor, and chosen action, and notes a bearer value only as `present`; and a command-line entry that prints the address it listens on). `pnpm vitest run tools/fake-model` -> 24 passed. `pnpm run typecheck` and `pnpm run lint` pass.
- acceptance (`test/acceptance/conformance-fake-model.test.ts`, which starts the server as a process): the unit cycle had already built the behaviors, so the four tests passed on their first run. That is not a valid red. To get one, a revert-red was run on the server: the `/responses` route renamed, the host set to `0.0.0.0`, and the skills list emptied.
  - `pnpm vitest run test/acceptance/conformance-fake-model.test.ts` -> 3 failed, 1 passed
  - A1318 `AssertionError: expected '{}' to contain 'event: response.completed'`
  - A1320 `AssertionError: expected { Object (t, method, ...) } to match object { wire: 'messages', …(3) }`
  - A1321 `AssertionError: expected '0.0.0.0' to be '127.0.0.1'`
  - A1319 did not react to these three mutations. The audit needs its own mutant (a changed `fail=` status).
  - The file was restored (`cp` of the saved copy) and the four tests passed again. These four are `TEST_AFTER` with a recorded revert-red, as in D-099.
- refactor: none needed.

## Group 9: what a harness tells its model (U1410, U1411) - found while designing the S5 check

S5 needs to read which plugin tools and skills a role was offered. The lab showed that three of the four harnesses do not list the report tool in the tool array (Claude Code defers it, omp makes it a device), and that the task text itself names the tools and skills. So two behaviors were appended to the test list (U1410, U1411, task T1347).

- red: `pnpm vitest run tools/fake-model/instructions.test.ts` -> 1 failed: U1410 `AssertionError: expected [] to deeply equal [ 'factoryman-supervisor', …(1) ]`
- red: `pnpm vitest run tools/fake-model/server.test.ts` -> 1 failed, 4 passed: U1411 `AssertionError: expected { Object (t, method, ...) } to match object { …(2) }` (the log had no `pluginTools` and counted skills from the whole text)
- green: `tools/fake-model/instructions.ts` (`instructionText`, `pluginToolsIn`, `skillsIn`) and the server log fields `skills` and `pluginTools`. `pnpm vitest run tools/fake-model test/acceptance/conformance-fake-model.test.ts` -> 30 passed. `pnpm run typecheck` and `pnpm run lint` pass.
- refactor: `skillsOf` in `server.ts` was replaced by the new helpers.
- live notes from the first offline lab run (T1363, T1334 groundwork):
  - bb 0.49.0 starts offline. `ENETUNREACH` for `1.1.1.1:443`, HTTP 200 on the lab's own loopback port.
  - `bb plugin build` and `bb plugin install` both need bb's build toolchain (`esbuild`, `tailwindcss`) in `<data dir>/plugins/toolchain-*`, which bb installs with `npm install` on first use. Offline that call retried for 4 minutes and failed with `EAI_AGAIN`. The runner therefore builds the plugin once with the network on, outside the sandbox, with `BB_DATA_DIR` set to the lab's data directory. After that, `bb plugin install` takes 1.4 seconds offline.
  - A `curl` inside the lab opens the canary `.ssh/known_hosts` four times (the tripwire counted it). The probe inside the lab uses `node` instead.
  - A wake is a `client/turn/requested` event with `originPluginId: "bb-factoryman"` in the supervisor's thread log. The worker's model, reasoning level, and permission mode are in its first `client/turn/requested` event, under `execution`.

## Group 5 addendum: the offline probe uses node and not curl (U1347)

The first offline lab run showed that a `curl` inside the lab opens the canary `.ssh/known_hosts`, which the tripwire counts.
The test for U1347 gained an assertion that the script has no `lab_x curl`.

- red: `pnpm vitest run tools/bblab` -> 1 failed: `AssertionError: expected '#!/usr/bin/env bash\n# bblab - isolat…' not to match /lab_x curl/`
- green: `probe_http` runs a `node` one-liner (`fetch` with a 2 second timeout) inside an offline lab. `pnpm vitest run tools/bblab` -> 5 passed.

## Group 10: the scenarios S1 to S12 and the registry (U1381 to U1405)

The lab port (`tools/conformance/port.ts`) and a scripted fake lab (`test/fixtures/conformance-lab.ts`, with a `Faults` switch for each deliberate failure) came first.
The scenarios were stubs that returned no checks, so every test saw an empty list.
Nothing in the port returns model text, so a scenario cannot read it (A1303).

- red: `pnpm vitest run tools/conformance/scenarios` -> 25 failed
  - U1381 `AssertionError: expected [] to deeply equal [ 'S1.ready', 'S1.remedy', …(1) ]`
  - U1382 `AssertionError: expected [] to deeply equal [ 'S1.remedy', 'S1.unready-blocks' ]`
  - U1383 `AssertionError: expected [] to deeply equal [ 'S2.thread-profile', …(1) ]`
  - U1384 `AssertionError: expected [] to deeply equal [ 'S2.thread-profile' ]`
  - U1385 to U1404 the same shape (an empty list where the scenario's check ids were expected)
  - U1405 failed on the registry: `scenariosFor` returned `[]`
- green: `tools/conformance/scenarios/` holds `helpers.ts` and `s01-readiness.ts` to `s12-wake-while-busy.ts` and `index.ts`. `pnpm vitest run tools/conformance/scenarios` -> 25 passed after one change: the S7 wait scaled with the driver's failure time (120 s), so the failure test timed out at 5 s. The port gained `failurePatienceMs`, and the fake lab sets it small. The change fixed the lab's wait and weakened no assertion.
- lint: three unused destructured names in the fake lab; replaced with an explicit mapping. `pnpm run typecheck` and `pnpm run lint` pass.
- the fake-lab tests prove each scenario's checks pass on a correct lab and fail on the named fault. They do not prove the real lab behaves like the fake one; the live runs do.
- refactor: none needed.

## Group 11: the pure parts of the real lab (U1371 to U1375, U1412)

The first lab run changed two plans, so the list changed before these tests were written:

- U1374 and U1375 now read the thread's event log (a wake is a `client/turn/requested` event from `bb-factoryman`) and the brain's own log by marker, so the count of wakes does not depend on the brain.
- U1412 is new: the stub starts its MCP servers when a session opens. Before that, a supervisor turn with no tool call left the stub's log with no tool list, so the offers of a plain turn could not be read.
- The `readers.ts` and `lab-env.ts` modules replace the old `lab.ts` group, and the old rows were removed from the list (ids U1371 to U1375 now name the new rows only).

- red (U1412): `pnpm vitest run tools/stub-agent/stub-agent.test.ts -t U1412` -> `Test timed out in 5000ms` (no `mcp-ready` line without a tool call)
- red: `pnpm vitest run tools/conformance/readers.test.ts tools/conformance/lab-env.test.ts` -> 6 failed
  - U1371 `AssertionError: expected { bblab: '', evidence: '', …(1) } to deeply equal { …(3) }`
  - U1372 `AssertionError: expected '' to contain '--exclude=.git'`
  - U1373 `AssertionError: expected true to be false`
  - U1374, U1375 failed against stubs that returned empty values
- test fix before green: U1372 used an awkward template for the exclusion strings; it now checks `--exclude=<path>` plainly. No assertion became weaker.
- green: the stub's `session/new` handler now calls `mcpFor(session)` after replying; `tools/conformance/readers.ts` and `tools/conformance/lab-env.ts` are implemented. `pnpm vitest run tools/stub-agent tools/conformance/readers.test.ts tools/conformance/lab-env.test.ts` -> 17 passed. `pnpm run typecheck` and `pnpm run lint` pass.
- refactor: none needed.

## Group 12: the runner and its acceptance tests (U1406 to U1409, A1301 to A1306, A1308 to A1310, A1312, A1313, A1316, A1317, A1324)

`tools/conformance/run.ts` (the deps interface and a `main` that returned 99), the run fixture (`test/fixtures/conformance-run.ts`, deps with a fake lab behind them), and the tests first.

- red: `pnpm vitest run tools/conformance/run.test.ts` -> 4 failed: U1406 `AssertionError: expected 99 to be +0 // Object.is equality`; U1407 and U1408 `expected 99 to be 1`; U1409 the same.
- green: `main` parses the command line, resolves the driver, checks the CLI, opens the lab, runs the scenarios in order (S10 `skipped` at tier 1.5, a thrown scenario recorded as an error), closes the lab in a `finally` block, judges the checks with the gaps, prints the table, and writes the result file (not for a `--scenario` run). `pnpm vitest run tools/conformance/run.test.ts` -> 4 passed.
- acceptance (`test/acceptance/conformance-tier1.test.ts`, `-gaps.test.ts`, `-tier15.test.ts`): the unit cycle had already built `main`, so a first run would have passed. To get a valid red, `main` was replaced by the 99 stub for one run and the real file restored from a saved copy.
  - `pnpm vitest run test/acceptance/conformance-tier1.test.ts test/acceptance/conformance-gaps.test.ts test/acceptance/conformance-tier15.test.ts` against the stub -> 12 failed, 2 passed
  - A1301, A1302, A1304, A1305, A1308, A1309, A1310, A1312, A1313, A1316, A1317, A1324 failed (for example `expected 99 to be 0`)
  - A1303 and A1306 passed against the stub. They check structure (the port has no method that returns model text; the lab tools are named by repository path) and do not run `main`. They need mutants in the audit.
  - With the real `main`: `pnpm vitest run test/acceptance/conformance` -> 18 passed. These 12 are `TEST_AFTER` with a recorded revert-red, as in D-099.
- `pnpm run typecheck` and `pnpm run lint` pass.
- refactor: none needed.

## Group 13: the support document (U1376 to U1380, A1311, A1326 to A1329)

- red: `pnpm vitest run tools/conformance/docs.test.ts` (against a `renderSupport` that returned `""`) -> 5 failed
- green: `tools/conformance/docs.ts` (`renderSupport`: one section per harness in a fixed order, a status line, a facts table, a scenario table with known gaps shown as gaps, a tier 1 section, no clock and no machine path) and `tools/conformance/docs-cli.ts` (`pnpm run conformance:docs [--root <dir>]`, reading `conformance/results/*.json` only). `pnpm vitest run tools/conformance/docs.test.ts` -> 5 passed.
- acceptance (`test/acceptance/conformance-docs.test.ts`, which runs the CLI as a process against a temporary root): the CLI and its tests were written in one step, so the first run passed for A1326, A1327, A1311, and A1328. That is a process error, recorded here. A valid red was made afterwards by replacing the CLI with a one-line stub:
  - `pnpm vitest run test/acceptance/conformance-docs.test.ts` -> 5 failed: `Error: ENOENT: no such file or directory, open '.../docs/HARNESS-SUPPORT.md'` (A1326, A1327, A1311, A1328), and A1329 failed because no committed document existed yet.
  - The CLI was restored from a saved copy, the document was generated (`Wrote docs/HARNESS-SUPPORT.md from 0 result file(s)`), and `pnpm vitest run test/acceptance/conformance-docs.test.ts tools/conformance/docs.test.ts` -> 10 passed.
  - A1326, A1327, A1311, A1328 are `TEST_AFTER` with a recorded revert-red, as in D-099. A1329 was red first.
- the document text had two sentences on one line; they were split (the style rule), and the document was regenerated.

## Live run 1: tier 1 against the stub (A1307, T1335)

The real lab (`tools/conformance/real-lab.ts`, `cli.ts`) cannot be unit tested, so the first runs are the test. Each finding below was fixed with a red test first where code could carry one.

- Run 0 (`pnpm run conformance -- --tier 1 --lab-dir /var/tmp/bblab-conformance`): `Unknown argument --.` pnpm passes the `--` separator to the script. Red test U1414 (`parseArgs(["--", "--tier", "1"])` failed), then the fix.
- Run 1 (7 min 32 s): the lab started with the pinned bb 0.49.0, and the isolation check was clean. Verdicts: S2, S3, S4, S5, S8, S10, S11, S12 `pass`; S1, S6, S7, S9 `fail`.
  - S6.one-wake and S7.wake read `0 wake(s)`. The cause was in the lab and not in the plugin: `bb thread log` shows the oldest 100 events unless it gets `--all`, and the driver supervisor's thread was longer. The thread log of the driver supervisor held both wakes (`reports: the worker finished a turn without reporting`, `is now failed`). Fix: `threadLog` passes `--all` (no unit test: it is in the real lab, and the next run proves it).
  - S1.unready-blocks and S1.remedy: a dispatch to `codex`, which bb reports `not_installed`, created a task (`t-907b11e3`) whose thread then failed with `Command thread.start failed`. This is report task H1.
  - S7.cause: the failure evidence was `worker thread failed: provider error (category unknown, HTTP unknown)`, but the worker's thread log holds `provider/error` with `detail: "STUB upstream failure: CONFORMANCE-CAUSE-500"`. This is report task H3.
  - S9.start-command: `bb factoryman supervisor start --project ...` exits 2 with the usage text. This is report task H4.
- Gaps listed in `conformance/known-gaps.json`: S1.unready-blocks and S1.remedy (H1), S7.cause (H3), S9.start-command (H4), each for every harness.
- Run 2 (3 min 34 s): `pnpm run conformance -- --tier 1 --lab-dir /var/tmp/bblab-conformance` -> exit 0. S1, S7, S9 `known-gap`; the other nine `pass`; isolation clean (`no change to the real home, the credentials, or the lab process list. tripwire: no events`). The result file is `conformance/results/1-stub.json` (stub-agent 0.0.1, bb 0.49.0).

## Group 14: `exec` returns when the command exits (U1415, U1416) - found by the first tier 1.5 run

The first Pi run stalled for 19 minutes after the lab started. The runner had started the fake model with `bash -c "cd ... && setsid nohup node server.ts ... &"`. The `&` covered the whole `cd ... && ...` list, so a subshell stayed alive as the parent of the server and held the command's output pipe. `exec` waited for the pipe to close, which never happened.

- red: `pnpm vitest run tools/conformance/shell.test.ts`
  - U1415 `Error: Test timed out in 5000ms.`
  - U1416 `AssertionError: expected '' to match /timed out after 300 ms/`
- green: `exec` resolves when the command exits (after a 300 ms grace for output), stops a command at its time limit with a note in `stderr`, and ignores a write error on a closed input pipe (that `EPIPE` showed as an unhandled error in the first green run and was fixed in the same cycle). The fake model start command no longer uses `cd &&`, and every command that runs in the lab gets a 300 s limit by default. `pnpm vitest run tools/conformance/shell.test.ts` -> 3 passed.
- refactor: none needed.

## Live run 2: tier 1.5 on Pi (A1312 to A1315, T1354)

`pnpm run conformance -- --tier 1.5 --harness pi --lab-dir /var/tmp/bblab-conformance` (8 min 39 s), real Pi 1.4.0 behind the fake model, lab offline (a public connection failed with `ENETUNREACH`, the loopback answered with HTTP 200).

- Verdicts: S2, S3, S4, S5, S6, S8, S11, S12 `pass`; S1, S7, S9 `known-gap` (the same four checks as tier 1: S1.unready-blocks, S1.remedy, S7.cause, S9.start-command); S10 `skipped`.
- Pi evidence worth keeping: the S7 failure evidence was `worker thread failed: provider error (category unauthorized, HTTP 401)`, with the 401 text dropped (H3). The supervisor half of S5 and S9 and S12 ran on a Pi supervisor thread with the fake model playing `CALL` and `SLEEP`.
- The isolation check said `CHANGED: real-home file NAMES`. The diff showed two new files, `~/.local/share/opencode/opencode.db-shm` and `-wal`, which another lane's opencode wrote, and growth of the captain's bb host daemon log. That is churn from other tools, not a leak: the credential section was identical, no lab process was visible on the host, and the tripwire had no events. A check that fails on a busy machine is a flaky check, so the verdict is now a pure function (`tools/conformance/isolation.ts`, behavior U1417).
- red: `pnpm vitest run tools/conformance/isolation.test.ts` -> 2 failed: `AssertionError: expected { clean: true, changes: [], …(1) } to match object …` and `expected true to be false`
- green: `judgeIsolation` calls a run unclean for a `LEAK` line, a change to the credential and git config section, or a changed file name under the harness homes (`.pi`, `.omp`, `.codex`, `.claude`, `.ssh`, `.bb`), the bb machine homes (not their logs), `.config/{gh,git,systemd,bb,omp,pi}`, or any path with `bblab`. Other file names are counted and ignored. `pnpm vitest run tools/conformance/isolation.test.ts` -> 2 passed; the real lab uses it. `pnpm run typecheck` and `pnpm run lint` pass.

## Live run 3: tier 1.5 on Codex (8 min 9 s) and the driver fix it asked for

Real Codex 0.166.0 behind the fake model's Responses format, lab offline, isolation clean (tripwire: 0 events).

- Verdicts: S2, S3, S4, S5, S6, S8, S11, S12 `pass`; S1 `fail`, S9 `fail`, S7 `known-gap`; S10 `skipped`.
- S1.ready failed: `codex is unauthenticated`. bb reports Codex as unauthenticated until `codex login status` succeeds, even though the fake model works with `requires_openai_auth = false`. The harness is a real Codex, so this is the readiness state that bb gives. The fix is in the lab and not in the plugin: the driver writes `~/.codex/auth.json` with the literal dummy key (`{"OPENAI_API_KEY":"mock-not-a-credential"}`) into the lab home, and a check with `HOME` pointed at a temporary directory showed `codex login status` -> `API key configured - mock-not***ntial`, exit 0. The key is a placeholder and not a credential.
  - red: `pnpm vitest run tools/conformance/drivers` -> U1329 `Error: codex writes no .codex/auth.json`
  - green: `tools/conformance/drivers/codex.ts` adds the file. `pnpm vitest run tools/conformance` -> all pass.
- S9.stamp-advice failed for Codex: the stamp text was `Thread ... is now a factoryman supervisor. It sees the four supervisor tools from its next session.` with no advice to clear the thread, but Codex needs `bb thread clear` (S9.tools-after-step passed after the driver cleared the thread). This is report task H4 (item 10 of the report). The gap list now holds `S9.stamp-advice` for `codex` and `omp` (omp is expected to show the same; the omp run confirms or removes it).
- Codex failure evidence (S7): `worker thread failed: provider error (category connection-failed, HTTP 401)` with the cause text dropped, as the report found (H3).

## Group 15: unique tool call ids and a request limit (U1418, U1419) - found by the first Claude Code run

The first Claude Code run did not finish. The fake model's log showed one worker answering the same request more than 2,000 times, with the history never growing, until the run was stopped by hand (about 20 minutes). Claude Code's own transcript in the lab home (`home/.claude/projects/.../*.jsonl`) showed the cause: every `tool_use` the fake model made had the id `toolu_conformance`. Claude Code runs a tool call once per id, so it ran the first call and skipped every later one, then asked again. Pi and Codex accepted the repeated id (`call_conformance`), which hid the mistake.

- red: `pnpm vitest run tools/fake-model/wire/ids.test.ts` -> U1418 failed for all three formats: `AssertionError: expected 1 to be 4 // Object.is equality`
- green: `callId` in `tools/fake-model/wire/shared.ts` builds an id from the number of calls already in the conversation; the chat, Responses, and Messages renderers use it. `pnpm vitest run tools/fake-model` -> 30 passed.
- red: `pnpm vitest run tools/fake-model/server.test.ts -t U1419` -> `AssertionError: expected 'tool_calls' to be 'stop'` (the 151st identical request still got a tool call)
- green: the server counts requests per actor and ends the script with a text answer after 150. A looping harness can no longer hold the lab. `pnpm vitest run tools/fake-model` -> 30 passed; `pnpm run typecheck` and `pnpm run lint` pass.
- note: a run stopped by hand leaves the lab up. `bblab down` stopped it, and the next run resets the lab directory.

## Group 16: Claude Code's system-role messages (U1420 to U1422) - found by the second Claude Code run

The second Claude Code run passed S2, S3, S4, S6, S8, and S11 and failed S5, S9, and S12: the supervisor was offered no tool and no skill, and neither was the worker's skill. The first diagnosis step was to keep the raw request bodies (U1420, `--bodies`), because the summary log could not show the cause. A partial run (`--scenario S5,S9,S12`) then wrote `model/bodies.jsonl`. The body of the supervisor request showed it: Claude Code sends the sandbox text, the deferred tool list, and the skill list as messages with the role `system` inside the `messages` array (`user, system, assistant, user, system`). The Messages parser dropped them.

- red (U1420): `pnpm vitest run tools/fake-model/server.test.ts -t U1420` -> `Error: ENOENT: no such file or directory, open '.../bodies.jsonl'`
- red (U1421): `pnpm vitest run tools/fake-model/wire/messages.test.ts` -> `AssertionError: expected 'You are Claude Code. Skill: bb-global…' to contain 'mcp__bb-bridge__factoryman_dispatch'`
- green: the server writes the raw bodies when it gets `--bodies <file>` (the real lab passes it), and `messages.parse` reads a `system` message as system text. `pnpm vitest run tools/fake-model` -> 33 passed.
- U1422 (the recorded request): `test/fixtures/recorded/claude-code-supervisor-after-stamp.json` holds the real request body (Claude Code 2.1.316) with the tool schemas and the main system prompt cut. The test was written after the fix, so a revert-red was run: the old `messages.ts` restored from `HEAD` -> `AssertionError: expected [] to deeply equal [ 'factoryman_dispatch', …(3) ]`, then the fix restored -> `pnpm vitest run tools/fake-model` -> 33 passed. U1422 is `TEST_AFTER` with a recorded revert-red, as in D-099.
- lint and type check pass.

## Live run 4: Claude Code tier 1.5 after the system-role fix, and one more fix (U1423)

`pnpm run conformance -- --tier 1.5 --harness claude-code` (10 min 14 s): S2, S3, S4, S5, S6, S8, S11 `pass`; S1, S7, S9 `known-gap` (the same checks as the other harnesses); S10 `skipped`; S12 `fail`. The isolation was clean.

S12 failed because the busy supervisor's `CALL factoryman_dispatch` never ran. After the `ToolSearch` hop, Claude Code adds the user text `Tool loaded.` and a `<total_tokens>` reminder after tool results. The brain took the latest user text as the prompt, found no directive in it, and answered with plain text.

- red: `pnpm vitest run tools/fake-model/brain.test.ts -t U1423` -> `Error: expected a tool call, got {"kind":"text","text":"OK (conformance)"}`
- green: the reminder pattern in `brain.ts` also strips `<total_tokens>` blocks and the line `Tool loaded.`. `pnpm vitest run tools/fake-model tools/conformance/scenarios` -> 59 passed.
- S12 also changed in one respect: the supervisor's busy time is 45 s and no longer the lab's whole patience (5 minutes), because the scenario needs only the time for a worker to report. A worker that is slower than 45 s makes the wake arrive after the turn, and S12.mid-turn then fails, which is the signal the check exists to give.

## Live run 5: the first omp run, and the permission finding (U1331)

The first omp run did not finish: S4 (ship) passed, but four scouts stayed `working` and the run waited out each scenario's patience. The thread log of a stuck scout showed why: `system/interaction/lifecycle` with `"payload": {"kind": "approval", "subject": {"kind": "command"...` and the item `git checkout -b fm/t-...` with `"approvalStatus": "waiting_for_approval"`. In `accept-edits`, omp asks for approval before a shell command. The scripted worker cannot answer, so it waits. The ship profile used `full`, which is why S4 passed. (The report's omp scouts passed because the scripted worker only wrote to the `xd://` device and never ran a shell command.)

This is a property of the harness that the owner should know: an omp worker in `accept-edits` stops at its first shell command and the plugin wakes the supervisor with the `interaction.pending` text. It goes in the decision log and in the support document's notes.

- red: `pnpm vitest run tools/conformance/drivers` -> U1331 `AssertionError: expected 'accept-edits' to be 'full'`
- green: the omp driver's profile and ship profile use `full` (tier 1.5 tests the plumbing, not the sandbox). `pnpm vitest run tools/conformance` -> 85 passed. Type check and lint pass.
