---
description: "Task list for the conformance harness"
---

# Tasks: Conformance harness for agent harnesses

**Input**: `specs/009-conformance-harness/spec.md`, `plan.md`, `quickstart.md`
**Tests**: Mandatory. Every behavior has its test task before its code task, and the test is observed failing first (constitution principle V).
`/speckit.tdd.plan` adds a bracketed behavior id (for example `[U1301]`) to each task and writes `tdd/test-list.md`.
`/speckit.tdd.run` ticks the task when the behavior is done and records the red evidence in `tdd/cycle-log.md`.
Tests are never weakened, skipped, or deleted to reach green.
Live runs (tasks that start a lab) are not in `pnpm test`. Their evidence goes in `tdd/cycle-log.md` and in the result files.

## Phase 1: Setup

- [ ] T1301 Add `tools` to `include` in `tsconfig.json`, add `allowImportingTsExtensions` and `erasableSyntaxOnly`, and confirm `pnpm run typecheck` still passes for `src/` and `test/`.
- [ ] T1302 [P] Let `vitest.config.ts` run `tools/**/*.test.ts` and confirm an empty tools folder breaks nothing.
- [ ] T1303 [P] Cover `tools/` in `eslint.config.js` (TypeScript rules, Node globals for the tools), keep `src/machine/` and the browser rules unchanged, and confirm `pnpm run lint` passes.
- [ ] T1304 [P] Add the scripts `conformance` (`node tools/conformance/cli.ts`) and `conformance:docs` (`node tools/conformance/docs-cli.ts`) to `package.json`. Add no dependency.

## Phase 2: Foundational (the lab port and the data shapes)

- [ ] T1305 Write red tests, then create `tools/conformance/port.ts` with the `Lab` interface the scenarios use (dispatch through the supervisor, task and event reads, provider states, thread reads, offered tools and skills, waits, shell in the lab, plugin reload) and the `Check`, `Evidence`, and `Scenario` types.
- [ ] T1306 [U1327] Write red tests, then create `tools/conformance/drivers/types.ts` with the `Driver` interface (id, provider, CLI binds, home files, profile, ship profile, unsupported profile, failure mode, role-change step, tool route) and `tools/conformance/drivers/index.ts` that resolves an id and refuses an unknown id with the list of known ids (AC-3.5).
- [ ] T1307 [P] Write a scripted fake lab in `test/fixtures/conformance-lab.ts` that implements the `Lab` interface in memory (tasks, events, offers, wakes, worktrees) and can be told to misbehave. The scenario and acceptance tests use it.

## Phase 3: User story 2 - A plugin gap is a visible gap (P1)

This phase comes before story 1 because the runner needs the verdict rules.

**Goal**: Checks roll up to verdicts, and a known gap is reported as a gap and never as a pass.
**Independent test**: Feed the verdict function a set of checks and a gap list and read the verdicts and the exit code.

- [ ] T1310 [US2] [U1301] [U1302] [U1303] [U1304] [U1305] [U1306] [U1307] [U1308] [U1309] [U1310] [U1311] Write red tests in `tools/conformance/verdict.test.ts` for: all checks pass is `pass`; a failing unlisted check is `fail`; a failing listed check is `known-gap` with its task and reason; a passing listed check fails the run with a "remove this entry" message; a gap that names one harness does not apply to another; a skipped scenario is `skipped`; the exit code is 0 only when no scenario is `fail` and no gap is stale.
- [ ] T1311 [US2] [U1312] [U1313] [U1314] [U1315] [U1316] Write red tests in `tools/conformance/gaps.test.ts` for the loader: it reads `conformance/known-gaps.json`, rejects an entry without a report task or a reason, rejects an unknown field, and rejects a duplicate check and harness pair.
- [ ] T1312 [US2] [U1301] [U1302] [U1303] [U1304] [U1305] [U1306] [U1307] [U1308] [U1309] [U1310] [U1311] [U1312] [U1313] [U1314] [U1315] [U1316] Implement `tools/conformance/verdict.ts` and `tools/conformance/gaps.ts`, and create `conformance/known-gaps.json` as an empty list.
- [ ] T1313 [US2] [A1308] [A1309] [A1310] Write the red acceptance test in `test/acceptance/conformance-gaps.test.ts` that runs the runner's `main` with a fake lab: a failing listed check prints `known-gap` and exits 0, a passing listed check exits 1, a failing unlisted check exits 1 (AC-2.1, AC-2.2, AC-2.3).
- [ ] T1314 [US2] [A1308] [A1309] [A1310] [A1311] Outer loop: the story 2 acceptance tests are green and `pnpm test` is green.

## Phase 4: User story 1 - Run the plugin's scenarios against the stub (P1)

**Goal**: One command runs S1 to S12 against the stub agent in a clean checkout.
**Independent test**: `pnpm run conformance -- --tier 1` exits 0 and prints twelve verdicts (live), and the acceptance test with the fake lab prints twelve verdicts and writes the result file.

- [ ] T1320 [US1] [U1335] [U1336] [U1337] [U1338] [U1339] [U1340] [U1341] [U1342] [U1343] [U1344] Write red process tests in `tools/stub-agent/stub-agent.test.ts` that start the stub over stdio with a tiny stdio MCP server behind it: initialize and `session/new` list the MCP tools; `LIST_TOOLS` reports them; `CALL` returns the tool result; `SHELL` runs in the session directory; `SLEEP` waits; each worker flag (`silent`, `empty-evidence`, `double-report`, `dirty`, `nocommit`, `blocked`, `fail=<code>`) takes its path; both `[brain:...]` and `[stub:...]` markers work.
- [ ] T1321 [US1] [U1335] [U1336] [U1337] [U1338] [U1339] [U1340] [U1341] [U1342] [U1343] [U1344] Promote the t01 stub agent to `tools/stub-agent/stub-agent.ts` (typed, no dependencies) and add `SLEEP`, `silent`, `double-report`, `fail=<code>`, and the `[brain:...]` marker.
- [ ] T1322 [P] [US1] [U1348] [U1349] Promote `bblab` and `bblab-evidence` to `tools/bblab/` unchanged except for the fixes listed in the t01 report (`|| true` after the tripwire report, wait for the daemon port after `up`). Write red process tests in `tools/bblab/bblab.test.ts` for the new `plan` subcommand and for the refusals (a lab path under `firstmate`, a reserved port).
- [ ] T1323 [US1] [U1317] [U1318] [U1319] [U1320] Write red tests in `tools/conformance/result.test.ts` for the result file: it names the tier, harness, CLI version, bb version, plugin commit, start time, and every verdict with its checks and evidence; a file with a missing field is rejected; the file name is `<tier>-<harness>.json`.
- [ ] T1324 [US1] [U1317] [U1318] [U1319] [U1320] Implement `tools/conformance/result.ts`.
- [ ] T1325 [US1] [U1321] [U1322] [U1323] [U1324] [U1325] [U1326] Write red tests in `tools/conformance/args.test.ts` (tier, harness, scenario filter, lab directory, bb app directory, ports, `--no-offline`, unknown flag refusal), then implement `tools/conformance/args.ts`.
- [ ] T1326 [P] [US1] [U1385] [U1386] [U1387] [U1388] Write red scenario tests, then implement `tools/conformance/scenarios/s03-scout.ts` and `s04-ship.ts`, each with a passing run and a deliberate failure on the fake lab (a task that never reaches `report_ready`, a ship task whose landed commits differ from the branch count, a missing wake, a double wake) (AC-1.3).
- [ ] T1327 [P] [US1] [U1389] [U1390] [U1391] [U1392] Write red scenario tests, then implement `s05-confinement.ts` and `s06-silence.ts` (offered tools and skills per role; one silent-turn wake and a task that stays `working`).
- [ ] T1328 [P] [US1] [U1395] [U1396] [U1401] [U1402] Write red scenario tests, then implement `s08-refusals.ts` and `s11-teardown.ts` (an empty-evidence report, a second report in the wrong state, a supervisor teardown in the wrong state, a dirty worktree refused and logged, a clean worktree removed, no process left).
- [ ] T1329 [P] [US1] [U1381] [U1382] [U1383] [U1384] [U1393] [U1394] Write red scenario tests, then implement `s01-readiness.ts`, `s02-profile.ts`, and `s07-failure.ts` (provider states, the profile on the thread row, an unsupported mode or level blocked before spawn with no task, a failed turn that fails the task with the cause in the evidence and one wake).
- [ ] T1330 [P] [US1] [U1397] [U1398] [U1399] [U1400] [U1403] [U1404] Write red scenario tests, then implement `s09-role-change.ts`, `s10-restart.ts`, and `s12-wake-while-busy.ts` (the supervisor start command and the late stamp with the driver's documented step, a plugin reload that adds no event, a wake sent mid-turn that arrives once).
- [ ] T1331 [US1] [U1405] Implement `tools/conformance/scenarios/index.ts` with the registry and the tier sets (tier 1: S1 to S12; tier 1.5: S1 to S9, S11, S12 and S10 skipped), and a test that pins both sets (AC-1.1, FR-1306).
- [ ] T1332 [US1] [A1301] [A1302] [A1303] [A1304] [A1305] [A1306] Write the red acceptance test in `test/acceptance/conformance-tier1.test.ts` that runs `main` with the fake lab and checks: twelve verdicts, the exit codes, the result file, and that the lab is stopped and the isolation check runs on a thrown error (AC-1.1, AC-1.2, AC-1.4, AC-1.5).
- [ ] T1333 [US1] [U1406] [U1407] [U1408] [U1409] Implement `tools/conformance/run.ts` (lab lifecycle, isolation check before and after, scenarios, verdicts, result file, teardown on every exit path) and `tools/conformance/cli.ts`.
- [ ] T1334 [US1] [U1371] [U1372] [U1373] [U1374] [U1375] Implement the real lab in `tools/conformance/lab.ts` and `tools/conformance/drivers/stub.ts`: pin bb into the lab directory, build and install the plugin inside the lab, copy `tools/`, register the stub, create the project (bare origin, clone, `dispatch.json`, the project row), start the supervisor, and implement every `Lab` method over `bblab x` and the read RPC (AC-1.6).
- [ ] T1335 [US1] [A1307] Live run: `pnpm run conformance -- --tier 1` in a lab outside `/tmp`. Fix what it finds with a red test first. Record the verdict table and the isolation diff in `tdd/cycle-log.md`, list the failing checks that wait for H1, H3, or H4 in `conformance/known-gaps.json`, and commit the result file `conformance/results/1-stub.json`.
- [ ] T1336 [US1] [A1301] [A1302] [A1303] [A1304] [A1305] [A1306] [A1307] Outer loop: the story 1 acceptance tests are green, `pnpm test` is green, and the tier 1 live run exits 0.

## Phase 5: User story 4 - A fake model serves every wire format (P1)

**Goal**: One server answers chat completions, Responses, and Messages, and plays the script that the prompt carries.
**Independent test**: Send a recorded request of each format and check the answer shape, then run the server behind each harness.

- [ ] T1340 [US4] [U1350] [U1351] [U1352] Write red tests in `tools/fake-model/tools.test.ts` for finding a tool by role (report, shell, search) across the four harnesses' names and for building arguments from a JSON schema (the `command` or `cmd` string gets the command, other required strings get a fixed word, numbers get 0, booleans false).
- [ ] T1341 [US4] [U1353] [U1354] [U1355] [U1356] [U1357] [U1358] [U1359] Write red tests in `tools/fake-model/brain.test.ts` for the next action: `CALL`, `SHELL`, and `SLEEP` directives run in order across turns; the worker script for scout and ship by kind and flag; Claude's `ToolSearch` hop before the deferred tool; omp's `write` to the `xd://` device named in the system prompt; the final text after the last tool result; a failing flag returns an HTTP error action.
- [ ] T1342 [US4] [U1360] [U1361] [U1362] [U1363] [U1364] [U1365] [U1366] Write red tests in `tools/fake-model/wire/*.test.ts`, one file per format, using recorded-shape requests: the request becomes a `Conversation` (offered tools, system text, turns, tool results); each `Action` becomes the exact streamed and, where the format has one, non-streamed response; an error action becomes the format's error body.
- [ ] T1343 [US4] [U1350] [U1351] [U1352] [U1353] [U1354] [U1355] [U1356] [U1357] [U1358] [U1359] [U1360] [U1361] [U1362] [U1363] [U1364] [U1365] [U1366] Implement `tools/fake-model/types.ts`, `tools.ts`, `brain.ts`, and `wire/chat.ts`, `wire/responses.ts`, `wire/messages.ts`.
- [ ] T1347 [US4] [U1410] [U1411] Write red tests in `tools/fake-model/instructions.test.ts` and extend `tools/fake-model/server.test.ts`, then implement `tools/fake-model/instructions.ts` and the log fields `pluginTools` and `skills` (found while designing the S5 check).
- [ ] T1344 [US4] [U1367] [U1368] [U1369] [U1370] [A1318] [A1319] [A1320] [A1321] Write red process tests in `tools/fake-model/server.test.ts` that start the server on a free loopback port: it routes by path to the right format; it logs every request body to the log file with the tools and skills offered; it listens on the loopback only; it ignores any bearer value and sends nothing out (AC-4.1, AC-4.3, AC-4.4).
- [ ] T1345 [US4] [U1367] [U1368] [U1369] [U1370] [A1318] [A1319] [A1320] [A1321] Implement `tools/fake-model/server.ts` (entry point, `--port`, `--log`, `--delay-ms` for `SLEEP`).
- [ ] T1346 [US4] [A1318] [A1319] [A1320] [A1321] Outer loop: the story 4 acceptance tests are green and `pnpm test` is green.

## Phase 6: User story 3 - Run a real harness against a fake model (P1)

**Goal**: `pnpm run conformance -- --tier 1.5 --harness <id>` runs the scenarios through the real CLI.
**Independent test**: The acceptance test with the fake lab checks the tier 1.5 flow; the live runs check the four harnesses.

- [ ] T1350 [US3] [U1328] [U1329] [U1330] [U1331] [U1332] [U1333] [U1334] Write red tests in `tools/conformance/drivers/drivers.test.ts` for each driver's lab files (the exact paths and keys for Claude Code, Codex, Pi, and omp, with the literal `mock-not-a-credential` and the fake model's loopback URL), its profile, ship profile, unsupported profile, role-change step, and CLI binds; and a test that no driver reads an environment variable or a path under the real home (AC-3.1, FR-1313).
- [ ] T1351 [US3] [U1328] [U1329] [U1330] [U1331] [U1332] [U1333] [U1334] Implement `drivers/claude-code.ts`, `drivers/codex.ts`, `drivers/pi.ts`, and `drivers/omp.ts`.
- [ ] T1352 [US3] [A1312] [A1313] [A1316] [A1317] Write the red acceptance test in `test/acceptance/conformance-tier15.test.ts`: the tier 1.5 set runs and S10 is `skipped`; a harness whose CLI is missing reports "cannot run" and records no pass (AC-3.6); an unknown id starts no lab (AC-3.5).
- [ ] T1353 [US3] [A1312] [A1313] Extend `tools/conformance/lab.ts` for tier 1.5: bind the CLI read-only, write the home files, start the fake model inside the lab, add the harness-supervisor thread for S5, S9, and S12, and read the offered tools and skills from the fake model's log.
- [ ] T1354 [US3] [A1314] [A1315] Live run, one harness at a time, in the order Pi, Codex, Claude Code, omp. Fix what each run finds with a red test first (the recorded requests become fixtures for the wire and brain tests). Commit `conformance/results/1.5-<harness>.json` and update `conformance/known-gaps.json` with the checks that wait for H1, H3, or H4.
- [ ] T1355 [US3] [A1312] [A1313] [A1314] [A1315] [A1316] [A1317] Outer loop: the story 3 acceptance tests are green and all four harnesses pass tier 1.5 live.

## Phase 7: User story 5 - The lab can run with no network (P2)

**Goal**: `bblab up --offline` gives the sandbox a loopback only, and tier 1.5 uses it by default.
**Independent test**: Start an offline lab, fail a public connection, and reach the lab's bb on the loopback.

- [ ] T1360 [US5] [U1345] [U1346] [U1347] [A1322] [A1325] Extend `tools/bblab/bblab.test.ts` with red tests: `bblab plan` with `--offline` lists `--unshare-net` and without it does not; `lab_x` joins the network namespace when offline; the readiness probe runs inside the lab when offline (AC-5.1, AC-5.4).
- [ ] T1361 [US5] [U1345] [U1346] [U1347] [A1322] [A1325] Implement `--offline` (and `BBLAB_OFFLINE=1`) in `tools/bblab/bblab`.
- [ ] T1362 [US5] [U1373] [A1324] Write the red test for the runner's offline proof (a public connection fails, the lab's bb answers, the fake model answers), then implement it in `lab.ts`, make `--offline` the tier 1.5 default, and add `--no-offline` for tier 1 debugging (AC-5.3).
- [ ] T1363 [US5] [A1323] Live check: start a bb 0.49.0 server offline, install the plugin, and run one scout. If bb needs the network, record exactly what fails, add it to `docs/DECISIONS.md`, and make tier 1.5 report that reason (AC-5.2, FR-1315).
- [ ] T1364 [US5] [A1322] [A1323] [A1324] [A1325] Outer loop: the story 5 acceptance tests are green and the offline live check is logged.

## Phase 8: User story 6 - The support statement is generated from evidence (P2)

**Goal**: `docs/HARNESS-SUPPORT.md` comes from the result files and nothing else.
**Independent test**: Generate the document from a set of result files and compare it with the committed file.

- [ ] T1370 [US6] [U1376] [U1377] [U1378] [U1379] [U1380] Write red tests in `tools/conformance/docs.test.ts`: the document lists each harness with its CLI version, bb version, plugin commit, date, and a verdict per scenario; a known gap shows as a gap with its task; a harness with no result file is listed as unsupported with the reason; the output is stable (sorted, no clock) (AC-6.2, AC-6.3).
- [ ] T1371 [US6] [U1376] [U1377] [U1378] [U1379] [U1380] Implement `tools/conformance/docs.ts` and `tools/conformance/docs-cli.ts`.
- [ ] T1372 [US6] [A1311] [A1326] [A1327] [A1328] [A1329] Write the red acceptance test in `test/acceptance/conformance-docs.test.ts`: regenerate from `conformance/results/` and compare with `docs/HARNESS-SUPPORT.md` (AC-6.1, AC-6.4).
- [ ] T1373 [US6] [A1326] [A1327] [A1328] [A1329] Generate and commit `docs/HARNESS-SUPPORT.md` from the committed result files.
- [ ] T1374 [US6] [A1326] [A1327] [A1328] [A1329] Outer loop: the story 6 acceptance tests are green and the committed document matches the generated one.

## Phase 9: Polish and cross-cutting

- [ ] T1380 Write `docs/CONFORMANCE.md` (how to run each tier, how to read a verdict, how to add a harness, the lab directory and quota notes), in the Google developer documentation style with one sentence per line.
- [ ] T1381 Record the decisions in `docs/DECISIONS.md`: known gaps as strict expected failures, the stub supervisor at tier 1.5, the directive language, the tools run under Node's type stripping, the offline outcome, and the live findings (FR-1318).
- [ ] T1382 Correct any wrong statement that this change made in `CLAUDE.md`, `docs/LIVE-CHECK.md`, or `docs/DESIGN.md` (edit only wrong text).
- [ ] T1383 [A1330] Run `pnpm run check`, `bb plugin build`, and the lab isolation diff for the final runs. Confirm `git status` is clean outside the committed files and no lab process is left.

## Dependencies

```text
Setup (T1301-T1304) -> Foundational (T1305-T1307)
Foundational -> US2 (verdicts) -> US1 (runner and tier 1)
Foundational -> US4 (fake model) [independent of US1 until the live runs]
US1 + US4 -> US3 (tier 1.5)
US1 -> US5 (offline) -> tier 1.5 live runs in US3
US1 + US3 -> US6 (document)
Everything -> Polish
```

## Parallel work

- T1302, T1303, and T1304 touch different files.
- T1326 to T1330 are different scenario files and can run in parallel after T1305 and T1307.
- US4 (T1340 to T1345) has no dependency on US1 and can run in parallel with it.
- The four live harness runs in T1354 run one after another, because they share the lab directory and the ports.

## Implementation strategy

1. MVP: Setup, Foundational, US2, US1. That gives tier 1 with the stub and a result file.
2. Add US4, then US3 for Pi first (the report already proved Pi's scout and ship), then Codex, Claude Code, and omp.
3. Add the offline mode as early as its live check allows, because tier 1.5 depends on it.
4. Generate the document last, from the real result files.
