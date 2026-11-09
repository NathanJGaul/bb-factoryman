---
feature: 009-conformance-harness
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 28
planned_at: 8148863
updated_at: 8148863
suite_baseline: green
---

# Test list: Conformance harness for agent harnesses

The acceptance layer is an in-process integration test, which is weaker than a real lab.
It enters through the runner's `main(argv, deps)` and through the real child-process entry points (`stub-agent.ts`, `server.ts`, `bblab plan`) with a scripted fake lab behind `main`.
A fake lab cannot show that bb starts, that a harness reads its configuration, or that a model-less turn behaves as the report saw.
The only check of those is the live runs: behaviors A1307, A1314, A1315, and A1323 are manual live checks, run in `bblab` and logged in `cycle-log.md` and in the result files.
The suite baseline was 95 files and 1307 tests, all passing.
Tests carry their behavior id in the title, for example `[U1301]`.

## Outer loop: acceptance behaviors

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| A1301 | `main` with tier 1 and a fake lab starts the lab, installs the plugin, registers the stub, runs S1 to S12 in order, stops the lab, and prints one verdict line per scenario | AC-1.1, FR-1302 | example | PENDING | |
| A1302 | Every verdict is `pass`, `fail`, `known-gap`, or `skipped`, and the exit code is 0 only when no scenario is `fail` | AC-1.2, FR-1303 | example | PENDING | |
| A1303 | A fake lab whose model text is garbage and whose recorded events are correct gives the same verdicts: no scenario reads model text | AC-1.3, FR-1307 | example | PENDING | |
| A1304 | A run writes `conformance/results/<tier>-<harness>.json` that names the tier, harness, CLI version, bb version, plugin commit, start time, and every verdict with its checks and evidence | AC-1.4, FR-1309 | example | PENDING | |
| A1305 | A scenario that throws still stops the lab and runs the isolation check, and an isolation change fails the run | AC-1.5, FR-1310 | example | PENDING | |
| A1306 | The real lab's commands name `tools/bblab/bblab` and `tools/stub-agent/stub-agent.ts` by repository path, even when the `PATH` holds a decoy `bblab` | AC-1.6, FR-1301 | example | PENDING | |
| A1307 | Live: `pnpm run conformance -- --tier 1` in a lab outside `/tmp` exits 0 and prints twelve verdicts | AC-1.1, SC-1301 | example | PENDING | |
| A1308 | A failing check that the gap list names gives `known-gap`, prints the task and the failure, and exits 0 | AC-2.1, FR-1308 | example | PENDING | |
| A1309 | A passing check that the gap list names exits 1 and says to remove the entry | AC-2.2, FR-1308 | example | PENDING | |
| A1310 | A failing check that no gap names gives `fail` and exits 1 | AC-2.3, FR-1303 | example | PENDING | |
| A1311 | The generated document shows a known gap as a gap with its task and never as a pass | AC-2.4, FR-1316 | example | PENDING | |
| A1312 | `main` with tier 1.5 and a harness id starts the lab with that CLI bound read-only, writes the driver's files into the lab home, and dispatches with that harness's profile | AC-3.1, FR-1312 | example | PENDING | |
| A1313 | A tier 1.5 run runs S1 to S9, S11, and S12, marks S10 `skipped`, and every path it writes sits inside the lab, the repository, or the result directory | AC-3.2, FR-1306, FR-1313 | example | PENDING | |
| A1314 | Live, per harness: a scout task reaches `report_ready` through the harness's own tool route | AC-3.3, SC-1302 | example | PENDING | |
| A1315 | Live, per harness: a ship task in `local-only` mode reaches `review_ready` with `landedCommits` equal to the branch's commits | AC-3.4, SC-1302 | example | PENDING | |
| A1316 | `main` with an unknown harness id exits 2 with the list of known ids and starts no lab | AC-3.5 | example | PENDING | |
| A1317 | `main` with a harness whose CLI is missing reports that it cannot run, exits 1, and writes no passing result | AC-3.6 | example | PENDING | |
| A1318 | The fake model server answers a chat completions request, a Responses request, and a Messages request each in its own format | AC-4.1, FR-1311 | example | PENDING | |
| A1319 | A task description with a behavior marker makes the server play that behavior (silent, empty evidence, hold, dirty, fail) | AC-4.2, FR-1311 | example | PENDING | |
| A1320 | After a request, the server's log shows the tools and skills the harness offered the model | AC-4.3, FR-1311 | example | PENDING | |
| A1321 | The server listens on the loopback only, needs no credential, and never makes an outbound connection | AC-4.4, FR-1311 | example | PENDING | |
| A1322 | `bblab plan --offline` lists `--unshare-net`; live, a connection to a public address from inside the lab fails and the loopback works | AC-5.1, FR-1314 | example | PENDING | |
| A1323 | Live: bb 0.49.0 starts offline, serves its API on the loopback, and installs the plugin, or the result file names what it needs | AC-5.2, FR-1315 | example | PENDING | |
| A1324 | A tier 1.5 run is offline by default, and a lab that cannot start offline fails the run with the reason and does not retry online | AC-5.3, FR-1314 | example | PENDING | |
| A1325 | `bblab plan` without `--offline` is unchanged: the network is shared | AC-5.4 | example | PENDING | |
| A1326 | `conformance:docs` writes `docs/HARNESS-SUPPORT.md` from the result files and nothing else | AC-6.1, FR-1316 | example | PENDING | |
| A1327 | The document lists each harness with its CLI version, bb version, plugin commit, date, and a verdict per scenario | AC-6.2, FR-1316 | example | PENDING | |
| A1328 | A harness with no result file is listed as unsupported with the reason that no tier 1.5 result exists | AC-6.3, FR-1316 | example | PENDING | |
| A1329 | A test fails when the committed document differs from the document generated from the committed result files | AC-6.4, FR-1316 | example | PENDING | |
| A1330 | No file under `tools/` imports from `src/` or from `@get-bb/*`, and `git diff` of this feature shows no change under `src/` | FR-1317 | example | PENDING | |

## Inner loop: unit behaviors

### `tools/conformance/verdict.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1301 | A scenario whose checks all pass is `pass` | AC-1.2, FR-1303 | example | PENDING | |
| U1302 | A scenario with a failing check that no gap names is `fail` | AC-2.3 | example | PENDING | |
| U1303 | A scenario whose failing checks are all named by gaps is `known-gap`, with each gap's task and reason | AC-2.1, FR-1308 | example | PENDING | |
| U1304 | A scenario with one gap failure and one unlisted failure is `fail` | AC-2.3 | example | PENDING | |
| U1305 | A passing check that a gap names makes a stale gap, fails the run, and says to remove the entry | AC-2.2, FR-1308 | example | PENDING | |
| U1306 | A gap that names one harness does not apply to another harness | FR-1308 | example | PENDING | |
| U1307 | A gap with harness `*` applies to every harness | FR-1308 | example | PENDING | |
| U1308 | A skipped scenario is `skipped`, needs no checks, and a gap on one of its checks is not stale | FR-1306 | example | PENDING | |
| U1309 | The exit code is 0 only when no scenario is `fail` and no gap is stale | FR-1303 | example | PENDING | |
| U1310 | A scenario that returns no checks is `fail` (a vacuous pass is refused) | FR-1303 | example | PENDING | |
| U1311 | A scenario that throws is `fail`, with the error text in its evidence | AC-1.5 | example | PENDING | |

### `tools/conformance/gaps.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1312 | Reads a valid gap file into entries with check, harness, task, and reason | FR-1308 | example | PENDING | |
| U1313 | Rejects an entry with no report task or no reason | FR-1308 | example | PENDING | |
| U1314 | Rejects an unknown field and a check id that is not of the form `S<number>.<name>` | FR-1308 | example | PENDING | |
| U1315 | Rejects two entries for the same check and harness | FR-1308 | example | PENDING | |
| U1316 | A missing gap file is an error and not an empty list | FR-1308 | example | PENDING | |

### `tools/conformance/result.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1317 | Builds a result that names tier, harness, CLI version, bb version, plugin commit, start time, offline flag, isolation outcome, and every verdict with checks and evidence | AC-1.4, FR-1309 | example | PENDING | |
| U1318 | Writes and reads a result file back to an equal value | FR-1309 | example | PENDING | |
| U1319 | Rejects a result file with a missing or wrongly typed field | FR-1309 | example | PENDING | |
| U1320 | Names the file `<tier>-<harness>.json`, with `stub` as the harness for tier 1 | FR-1309 | example | PENDING | |

### `tools/conformance/args.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1321 | Parses `--tier 1` with defaults for the lab directory, offline, and ports | AC-1.1 | example | PENDING | |
| U1322 | Tier 1.5 needs `--harness`, and tier 1 refuses one | AC-3.1 | example | PENDING | |
| U1323 | Refuses an unknown tier, an unknown flag, and a flag with no value, and says so in the usage text | FR-1302 | example | PENDING | |
| U1324 | `--scenario S3,S4` limits the run to those ids and refuses an unknown id | FR-1304 | example | PENDING | |
| U1325 | Tier 1.5 is offline by default and `--no-offline` turns it off | AC-5.3, FR-1314 | example | PENDING | |
| U1414 | Skips the lone `--` that `pnpm run conformance --` passes through to the script | AC-1.1 | example | PENDING | |
| U1326 | Refuses a lab directory that contains `firstmate` or sits at `/` | FR-1310 | example | PENDING | |

### `tools/conformance/drivers`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1327 | Resolves each of the four ids and the stub, and refuses an unknown id with the list of known ids | AC-3.5, FR-1312 | example | PENDING | |
| U1328 | The Claude Code driver writes `~/.claude/settings.json` with the fake model's base URL and the literal `mock-not-a-credential`, and names `claude-code`, a profile, and the deferred route | AC-3.1, FR-1312, FR-1313 | example | PENDING | |
| U1329 | The Codex driver writes `~/.codex/config.toml` with the `responses` wire API for the fake model, and names `codex` and the function route | AC-3.1, FR-1312 | example | PENDING | |
| U1330 | The Pi driver writes `~/.pi/agent/models.json` with `openai-completions`, and names `pi` with the `full` permission mode | AC-3.1, FR-1312 | example | PENDING | |
| U1331 | The omp driver writes `~/.omp/agent/models.yml` and the model role command, and names `acp-omp` and the device route | AC-3.1, FR-1312 | example | PENDING | |
| U1332 | Every driver names a ship profile, an unsupported profile, a failure mode, and the documented step after a late supervisor stamp (`next-turn` for Claude Code and Pi, `clear` for Codex and omp) | FR-1312 | example | PENDING | |
| U1333 | Every driver's written paths sit under the lab home, and no driver reads an environment variable or the real home | FR-1313 | example | PENDING | |
| U1334 | Every driver binds its CLI read-only by the path that the machine resolves, and reports the CLI missing when the path does not exist | AC-3.6, FR-1312 | example | PENDING | |

### `tools/stub-agent/stub-agent.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1335 | Answers `initialize` and `session/new`, starts the MCP servers that bb lists, and logs each request | AC-1.6 | example | PENDING | |
| U1336 | `LIST_TOOLS` replies with the MCP tools, and `CALL <tool> <json>` returns the tool's result or the error text | AC-1.1 | example | PENDING | |
| U1337 | `SHELL <command>` runs in the session directory, and `SLEEP <ms>` waits that long | FR-1305 | example | PENDING | |
| U1338 | A scout worker prompt reports `done` with a file list as evidence | AC-1.1 | example | PENDING | |
| U1339 | A ship worker prompt creates the branch, commits one line, and reports the commit count | AC-1.1 | example | PENDING | |
| U1340 | The flag `silent` ends the turn with no report | FR-1305 | example | PENDING | |
| U1341 | The flags `empty-evidence` and `double-report` report an empty evidence and a second report | FR-1305 | example | PENDING | |
| U1342 | The flags `dirty` and `nocommit` leave uncommitted work and no commit | FR-1305 | example | PENDING | |
| U1343 | The flag `fail=<code>` answers the prompt with an ACP error whose text carries the code | FR-1305 | example | PENDING | |
| U1344 | The marker `[brain:<flag>]` and the old marker `[stub:<flag>]` choose the same flag | FR-1305 | example | PENDING | |

### `tools/bblab/bblab`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1345 | `bblab plan` prints the sandbox arguments and the environment without starting anything | AC-5.1 | example | PENDING | |
| U1346 | `--offline` adds `--unshare-net`, and the default does not | AC-5.1, AC-5.4, FR-1314 | example | PENDING | |
| U1347 | An offline lab runs its commands and its readiness probe inside the network namespace | AC-5.1 | example | PENDING | |
| U1348 | Refuses a lab directory under `firstmate` and a reserved port | FR-1310 | example | PENDING | |
| U1349 | The scripts parse (`bash -n`) and the tripwire report cannot abort `bblab down` | AC-1.6 | example | PENDING | |

### `tools/fake-model/tools.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1350 | Finds the report tool by role in all four forms: the plain name, the `mcp__bb-bridge__` name, the deferred name in the system text, and the `xd://` device in the system text | AC-3.3, FR-1311 | example | PENDING | |
| U1351 | Finds the shell tool by role among `Bash`, `bash`, and `exec_command` | AC-3.4 | example | PENDING | |
| U1352 | Builds arguments from the schema: the string property `command` or `cmd` gets the command, any other required string gets a fixed word, a number gets 0, a boolean false | AC-3.4 | example | PENDING | |

### `tools/fake-model/brain.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1353 | Runs `CALL`, `SHELL`, and `SLEEP` directives of the latest user turn in order, one per model step, and ends with a text after the last result | FR-1305 | example | PENDING | |
| U1354 | Plays the worker script from the prompt: a scout reports `done`, and a ship runs one `git` commit through the shell tool and then reports the commit count | AC-3.3, AC-3.4 | example | PENDING | |
| U1355 | Plays each behavior flag: `silent` (text only), `empty-evidence`, `double-report`, `dirty`, `nocommit`, `blocked`, `hold` | AC-4.2 | example | PENDING | |
| U1356 | The flag `fail=<code>` returns an error action with that HTTP status and a cause text | AC-4.2 | example | PENDING | |
| U1357 | Calls `ToolSearch` before the deferred report tool when the report tool is not offered, and calls the report tool after the search result | AC-3.3 | example | PENDING | |
| U1358 | Writes the report JSON to the `xd://` device with the `write` tool when the report tool is only a device | AC-3.3 | example | PENDING | |
| U1359 | Takes a prompt with no directive and no worker text as a plain turn and answers with text | FR-1305 | example | PENDING | |

### `tools/fake-model/wire`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1360 | Chat completions: a request becomes a conversation (offered tools, system text, turns, tool results) | AC-4.1 | example | PENDING | |
| U1361 | Chat completions: a tool-call action and a text action become the streamed chunks, and the non-streamed body | AC-4.1 | example | PENDING | |
| U1362 | Responses: a request becomes a conversation, with `function_call_output` items as tool results | AC-4.1 | example | PENDING | |
| U1363 | Responses: a tool-call action and a text action become the event stream with `response.completed` and usage | AC-4.1 | example | PENDING | |
| U1364 | Messages: a request becomes a conversation, with `tool_result` blocks as tool results and the system reminders kept in the text | AC-4.1 | example | PENDING | |
| U1365 | Messages: a tool-call action and a text action become the event stream, with `stop_reason` set | AC-4.1 | example | PENDING | |
| U1366 | An error action becomes the error body of the format, with the status and cause text | AC-4.2 | example | PENDING | |

### `tools/fake-model/wire` (added)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1418 | Gives every tool call in one conversation its own id, so a harness that deduplicates calls by id (Claude Code does) runs each one | AC-3.3, AC-3.4 | example | PENDING | |

### `tools/fake-model/server.ts` (added)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1419 | Ends the script for an actor after 150 requests with a plain text answer, so a harness that repeats a request cannot loop for ever and hold the lab | AC-4.2 | example | PENDING | |

### `tools/fake-model/server.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1367 | Routes by path to the three formats, serves `/models`, and answers 404 for any other path | AC-4.1 | example | PENDING | |
| U1368 | Logs each request with the tools and skills the harness offered | AC-4.3 | example | PENDING | |
| U1369 | Binds the loopback only, and ignores any bearer value | AC-4.4 | example | PENDING | |
| U1370 | Delays a reply by the `SLEEP` directive's time | FR-1305 | example | PENDING | |

### `tools/stub-agent/stub-agent.ts` (added)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1412 | Starts the MCP servers that bb lists as soon as a session opens, so the tools it was offered are in the log even when the first prompt calls no tool | AC-1.3, FR-1307 | example | PENDING | |

### `tools/fake-model/instructions.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1410 | Finds the plugin tools a harness offers by every route (plain, MCP-prefixed, deferred in a system reminder, device in the instruction text) and the skills named in the instruction text, and ignores the same names in the task text | AC-4.3, FR-1307 | example | PENDING | |
| U1411 | The fake model's log records those tools and skills for each request, so the suite can read what a role was offered | AC-4.3 | example | PENDING | |

### `tools/conformance/lab-env.ts` and `tools/conformance/readers.ts` (the pure parts of the real lab)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1371 | Builds the `bblab` command from the repository path and an environment with the lab variables and no other host variable, so no credential passes | AC-1.6, FR-1313 | example | PENDING | |
| U1372 | Builds the plugin copy command (excluding `.git`, `specs`, `.claude`, `.specify`, `tools`, `conformance`, `dist`) and the build command, which runs with the lab's data directory and a home inside the lab | FR-1302 | example | PENDING | |
| U1373 | The offline proof passes when the public connection fails and the loopback answers, and fails in every other case with the reason | AC-5.1, AC-5.3 | example | PENDING | |
| U1374 | Counts the wake messages of a task from a thread's event log: only events that the plugin sent, naming the task and the state, with a flag for a turn that was running at the time | FR-1307 | example | PENDING | |
| U1375 | Reads the tools and skills a thread was offered from the stub's log or the fake model's log, by the task id or the supervisor label in the prompt | AC-1.3 | example | PENDING | |

### `tools/conformance/lab-env.ts` (added)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1413 | Starts every run from a clean lab directory: removes the previous run's data, repositories, and logs, and keeps the pinned bb and bb's build toolchain, which needs the network to install | AC-1.1, AC-5.3 | example | PENDING | |

### `tools/conformance/isolation.ts` (added)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1417 | Reads the `bblab-evidence diff` and calls the run unclean only for a leak line, a change to a credential or git config file, or a changed file name in a place a harness or bb would write (the harness homes, the bb homes, ssh, gh, git, systemd, or a path with `bblab`), and ignores churn from other tools | AC-1.5, FR-1310 | example | PENDING | |

### `tools/conformance/shell.ts` (added)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1415 | Returns when the command exits, even when a background child still holds its output pipe, so a lab command that starts a server cannot hang the runner | AC-1.1 | example | PENDING | |
| U1416 | Stops a command that outlives its time limit and says so in the result | AC-1.5 | example | PENDING | |

### `tools/conformance/docs.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1376 | Renders one section per harness with CLI version, bb version, plugin commit, date, and a verdict per scenario | AC-6.2 | example | PENDING | |
| U1377 | Renders a known gap with its task and reason, and never as a pass | AC-2.4 | example | PENDING | |
| U1378 | Renders a harness with no result file as unsupported with the reason | AC-6.3 | example | PENDING | |
| U1379 | The output is stable: sorted, with no clock and no machine path | AC-6.1 | example | PENDING | |
| U1380 | Marks a harness supported only with a tier 1.5 result in which no scenario failed | AC-6.2 | example | PENDING | |

### `tools/conformance/scenarios`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1381 | S1 passes when the provider under test is `ready` and a dispatch to it creates a task | FR-1305 | example | PENDING | |
| U1382 | S1 fails when a provider in any other state is dispatched to and a task is created; and the remedy check fails when the refusal lacks bb's login command | FR-1305 | example | PENDING | |
| U1383 | S2 passes when the thread row shows the requested provider, model, level, and mode, and an unsupported profile blocks with no task | FR-1305 | example | PENDING | |
| U1384 | S2 fails when the thread row differs, or when the unsupported profile creates a task | FR-1305 | example | PENDING | |
| U1385 | S3 passes when the task goes `queued`, `working`, `report_ready` with evidence and the supervisor is woken once | FR-1305 | example | PENDING | |
| U1386 | S3 fails on a missing state, empty evidence, no wake, or two wakes | FR-1305 | example | PENDING | |
| U1387 | S4 passes when the branch holds the commit, `landedCommits` equals the count, and the task is `review_ready` | FR-1305 | example | PENDING | |
| U1388 | S4 fails when the branch has no commit or the count differs | FR-1305 | example | PENDING | |
| U1389 | S5 passes when the worker is offered the report tool and the worker skill only, and the supervisor the four tools and its skill only | FR-1305 | example | PENDING | |
| U1390 | S5 fails when a role is offered a tool or skill of the other role | FR-1305 | example | PENDING | |
| U1391 | S6 passes when a silent turn leaves the task `working` and wakes the supervisor once with the silent-turn message | FR-1305 | example | PENDING | |
| U1392 | S6 fails when the task changes state or the supervisor is woken twice | FR-1305 | example | PENDING | |
| U1393 | S7 passes when a failing turn fails the task, wakes the supervisor once, and the evidence holds the cause text; and the cause check is its own check | FR-1305 | example | PENDING | |
| U1394 | S7 fails when the task does not reach `failed` or no wake arrives | FR-1305 | example | PENDING | |
| U1395 | S8 passes when an empty report, a second report, and a wrong-state teardown are each refused and each logged with a reason code | FR-1305 | example | PENDING | |
| U1396 | S8 fails when a refusal is not logged or a task changes state | FR-1305 | example | PENDING | |
| U1397 | S9 passes when a late-stamped supervisor has its tools and skill after the driver's step, and the start command check is its own check | FR-1305 | example | PENDING | |
| U1398 | S9 fails when the supervisor lacks the tools after the step | FR-1305 | example | PENDING | |
| U1399 | S10 passes when a plugin reload keeps every task and state and adds no event | FR-1305 | example | PENDING | |
| U1400 | S10 fails when a reload adds a `reconcile` event or changes a state | FR-1305 | example | PENDING | |
| U1401 | S11 passes when a dirty worktree is refused and logged, a clean one is removed, and no process is left | FR-1305 | example | PENDING | |
| U1402 | S11 fails when a dirty worktree is torn down or a process is left | FR-1305 | example | PENDING | |
| U1403 | S12 passes when a wake sent while the supervisor is busy arrives exactly once | FR-1305 | example | PENDING | |
| U1404 | S12 fails when the wake is lost or arrives twice | FR-1305 | example | PENDING | |
| U1405 | The registry holds S1 to S12 in order, tier 1 runs all twelve, and tier 1.5 runs S1 to S9, S11, S12 | FR-1306 | example | PENDING | |

### `tools/conformance/run.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1406 | Runs the scenarios in order against the lab, rolls the checks up with the gaps, and returns the verdict table and the exit code | FR-1302, FR-1303 | example | PENDING | |
| U1407 | Stops the lab and runs the isolation check on a thrown error, and a changed isolation snapshot fails the run | AC-1.5, FR-1310 | example | PENDING | |
| U1408 | Records the CLI and bb versions that the lab reports in the result | FR-1309 | example | PENDING | |
| U1409 | Reports a missing CLI as `cannot run` before any scenario and writes no passing result | AC-3.6 | example | PENDING | |

## Invariants and edge cases still to place

- The Codex failure takes about 30 seconds (retries). The S7 wait must use the terminal event and a long enough timeout. The live run settles the timeout, and the driver carries it.
- The ship flow on Claude Code, Codex, and omp was never run. The shell tool's argument names come from the first live recording. The recorded request becomes a fixture, and the schema-driven argument builder (U1352) gets a case for each.
- A late stamp on omp reaches the skill only after `bb thread clear`. The driver's documented step covers it, and S9 checks the tools and skill after that step.
- Plugin build offline: the lab copies `node_modules` from the checkout. A checkout without installed dependencies must fail the run with a message that says to run `pnpm install`.

## Out of scope

- Report tasks H1 to H5 and H9 to H14: the readiness gate, model-aware checks, cause-bearing evidence, the supervisor start command, the contracts table, the docs rewrite, the default profile change, the permission floor, the roles block, tier 2 runs, and the tool hint. The scenarios that need H1, H3, or H4 are known gaps.
- Tier 2 and the model-behavior checks M1 to M4: they need a credential, and the captain holds every credential.
- A second enrolled machine, a no-mistakes pipeline run, and opencode, grok, hermes, and cursor providers.
- Property-based and mutation tools: the profile has none. The audit uses deliberate mutants.

## Verification commands

- Single test: `pnpm vitest run {file} -t "{name}"`
- File: `pnpm vitest run {file}`
- Full suite: `pnpm test`
- Whole gate: `pnpm run check` (type check, lint, tests)
- Coverage: none. Mutation: none (deliberate mutants).
