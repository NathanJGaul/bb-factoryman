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
