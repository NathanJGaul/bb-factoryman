# Implementation plan: Conformance harness for agent harnesses

**Branch**: `fm/bb-factoryman-conformance-harness` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)

## Summary

Add a developer toolchain under `tools/` that runs one list of scenarios (S1 to S12) against three kinds of brain: the stub ACP agent (tier 1), and the real Claude Code, Codex, Pi, and omp command-line tools behind a scripted fake model (tier 1.5).
The toolchain promotes four pieces from the scout reports: the stub agent, the `bblab` and `bblab-evidence` scripts, the fake model server, and the per-harness lab configuration.
It adds a conformance runner, per-harness drivers, a known-gap list, result files, an offline mode for the lab, and a generator for `docs/HARNESS-SUPPORT.md`.
The plugin under `src/` does not change.

## Technical context

- Language and tooling: TypeScript 6 (binary `tsc6`), ESM, Node 26, `pnpm` 12, `vitest` 5.
  The tools run directly under Node's built-in type stripping (`node tools/conformance/cli.ts`), so there is no build step and no new dependency.
  That needs `.ts` extensions in relative imports, `import type` for types, and no enums, namespaces, or parameter properties.
  The tools add `allowImportingTsExtensions` and `erasableSyntaxOnly` to `tsconfig.json`.
- The lab: `bblab` (bash, bubblewrap).
  The runner builds the plugin inside the lab with the pinned bb, so the build matches the runtime.
  The lab copies `node_modules` from the checkout, so a lab with no network can install the plugin.
- bb facts (report sections 3 and 5, and `spike/RESULTS.md`):
  - A custom ACP agent registers with `bb plugin config provider-acp set customAgents '<json>'` and appears as `acp-<id>`.
  - bb lists `mcpServers` (a stdio server named `bb-bridge`) in ACP `session/new`.
    The plugin's tools reach an ACP agent that way.
  - `bb provider list`, `bb thread spawn|tell|wait|log|show|clear`, `bb plugin install|reload|rpc call`, and `bb.sdk.system.providerStates()` (through the SDK in the pinned `bb-app`) are the only bb surfaces the runner touches.
  - The plugin's read RPC (`listTasks`, `getTask`, `listEvents`) is the source of truth for assertions on tasks and events.
- Harness facts (report sections 5 and appendix B), pinned in the drivers:
  - Claude Code reads `ANTHROPIC_BASE_URL` from `~/.claude/settings.json` `env`, and shows the report tool as the deferred tool `mcp__bb-bridge__factoryman_report`.
  - Codex reads `~/.codex/config.toml` with `[model_providers.*]` and `wire_api = "responses"`, and shows a plain `factoryman_report` function.
  - Pi reads `~/.pi/agent/models.json` with `api: "openai-completions"`, and shows a plain function.
  - omp reads `~/.omp/agent/models.yml` and `modelRoles`, and routes the tool to the device `xd://mcp__bb_bridge_factoryman_report` through `write`.
- Storage: result files are JSON under `conformance/results/`.
- Target: Linux with `bwrap`, on the maintainer's machine.
  The tools are not part of the plugin bundle.
- Constraints: no credential of any kind; the lab path must not contain `firstmate` and should sit under `/var/tmp` (the `/tmp` quota is small and shared); the runner never writes outside the lab, the repository, and the result directory.
- Scale: 12 scenarios, 5 drivers (stub plus four harnesses), 3 wire formats.

## Constitution check

| Principle | How the plan complies |
| --- | --- |
| I. Gates live in code | The feature adds no gate and changes none. The suite observes the gates through the event log. Scenario S8 and S11 check that refusals happen in code and are logged. |
| II. Machine core is pure | No change to `src/machine/`. The new code does not import `src/` at all, so the lint rule and the layering stay as they are. |
| III. Event log is the source of truth | Assertions read the plugin's event log through the read RPC. |
| IV. Storage behind an interface | No change. |
| V. Test first | Each behavior gets a failing test before code, recorded in `tdd/cycle-log.md`. The pure parts (verdicts, result files, document generator, wire formats, brain script, driver files, argument parsing) have unit tests. The scenarios have tests against a scripted fake lab, including deliberate-failure cases, so a scenario cannot pass without looking. The live runs are the end-to-end acceptance. |
| VI. Scope | The captain's intent and the Firstmate spec extend the scope to report tasks H6, H8, and H7. The feature adds tools, tests, and documents. It builds none of H1 to H5, runs no tier 2, and handles no credential. The live install into the owner's bb stays the owner's step: every run happens in `bblab`. |
| Engineering constraints | No other bb plugin is called. Docs follow the Google developer documentation style. Firstmate's scripts and its herdr backend are not used. `bblab` comes from the isolation report, not from firstmate. |

Result: no violation, so no complexity tracking.
One scope call needs a record (D-100 below): scenarios that need H1, H3, or H4 are known gaps.

## Decisions

### Scenarios are lists of named checks, and gaps are keyed by check

A scenario returns a list of checks, each with an id such as `S1.unready-blocks`, a pass or fail, and the evidence.
The scenario verdict is `fail` when any check without a known gap fails, `known-gap` when only checks with a known gap fail, and `pass` when all checks pass.
A tier can skip a scenario (`skipped`).
The known-gap file maps a check id, and optionally one harness, to the report task and the reason.
A listed check that passes fails the run (strict expected failure), so the list cannot rot.
This keeps the S1, S7, and S9 checks that the plugin does pass today (for example, that a ready provider dispatches) live, while the checks that wait for H1, H3, and H4 are visible.

### The supervisor brain is the stub, except where a harness supervisor is the point

Dispatching and reading state need a supervisor that never fails.
The stub supervisor runs `CALL factoryman_dispatch {...}` with an explicit `profile`, so the worker runs on the harness under test.
Three scenarios need the harness as the supervisor: the supervisor half of S5, S9, and S12.
Those spawn a second supervisor thread on the harness, with the fake model playing the same directive script (`CALL`, `SHELL`, `SLEEP`).

### One directive language drives both brains

The stub and the fake model read the same directives from the prompt: `CALL <tool> <json>`, `SHELL <command>`, `SLEEP <milliseconds>`, and `LIST_TOOLS` (stub only).
A worker prompt carries a behavior marker `[brain:<flag>]` in its task description.
The flags are `silent`, `empty-evidence`, `double-report`, `dirty`, `nocommit`, `blocked`, `hold`, `fail=<code>`, and `pr=<url>`.
The stub also accepts the old `[stub:<flag>]` marker, so recorded runs still replay.
The runner writes directives and markers; the brain does not guess.

### The fake model builds tool calls from the schema each harness offers

The fake model never hard-codes argument names for a harness's shell tool.
It finds the offered tool by role (shell, report, search) from a small table, then fills the arguments from the tool's JSON schema: the string property named `command` or `cmd` gets the command, and any other required string gets a short fixed word.
Routes the harness hides are resolved from the request, as the report found: Claude Code's deferred tool needs one `ToolSearch` call first, and omp's report tool is a device that the system prompt names.
A driver lists which route it expects, and a test fails when a recorded request for that harness offers a different one.

### The lab runs offline by default at tier 1.5

`bblab up --offline` adds `--unshare-net` to the sandbox.
The sandbox then has a loopback only, and the host cannot reach the lab's ports, so every call goes through `bblab x` (which joins the network namespace).
The fake model listens inside the sandbox on the loopback.
The runner proves the lab is offline before the first scenario: a connection to a public address must fail, and a connection to the lab's bb must work.
If bb 0.49.0 cannot start offline, the runner records the failing step in the result file and the decision log (FR-1315), and tier 1.5 fails with that reason.

### Known harness facts live in the drivers, not in the scenarios

A driver says how to bind the CLI, which files to write into the lab home, which profile to dispatch, which ship profile to use (full permission where an approval prompt would stall the scripted shell), which unsupported profile S2 should try, which failure the fake model should play for S7, and the documented step after a late supervisor stamp (`next-turn` or `clear`) for S9.
The values come from the report.
A CLI upgrade that changes a fact fails a scenario, and the maintainer edits one driver.

### Result files are committed evidence, and the support document is a pure function of them

`conformance/results/<tier>-<harness>.json` is committed.
`docs/HARNESS-SUPPORT.md` is generated from those files by `pnpm run conformance:docs`.
A unit test regenerates the document and compares it to the committed file.
A harness without a result file is listed as unsupported.

### Scenario S10 runs once, at tier 1

The restart check reloads the plugin and compares the event log, which does not depend on the harness (report section 6.3).

## Source layout

```text
tools/
  bblab/bblab                  # promoted from the isolation report; adds --offline and a `plan` subcommand
  bblab/bblab-evidence         # promoted
  stub-agent/stub-agent.ts     # promoted from the t01 report; adds SLEEP, silent, double-report, fail=<code>, [brain:...]
  stub-agent/stub-agent.test.ts
  fake-model/types.ts          # Conversation, Action, Offered
  fake-model/brain.ts          # directives + markers -> the next Action (pure)
  fake-model/tools.ts          # find a tool by role, build arguments from a JSON schema
  fake-model/wire/chat.ts      # OpenAI chat completions: request -> Conversation, Action -> response
  fake-model/wire/responses.ts # OpenAI Responses
  fake-model/wire/messages.ts  # Anthropic Messages
  fake-model/server.ts         # loopback HTTP server, request log, entry point
  conformance/cli.ts           # `pnpm run conformance`
  conformance/args.ts          # argument parsing
  conformance/run.ts           # the run: lab lifecycle, scenarios, verdicts, result file
  conformance/lab.ts           # the real Lab over bblab
  conformance/port.ts          # the Lab interface the scenarios use
  conformance/verdict.ts       # checks + known gaps -> verdicts and the exit code
  conformance/gaps.ts          # load and validate conformance/known-gaps.json
  conformance/result.ts        # result file shape, write, read
  conformance/docs.ts          # HARNESS-SUPPORT.md generator
  conformance/docs-cli.ts      # `pnpm run conformance:docs`
  conformance/scenarios/*.ts   # s01-readiness ... s12-wake-while-busy, index.ts
  conformance/drivers/*.ts     # stub, claude-code, codex, pi, omp, index.ts
conformance/
  known-gaps.json
  results/*.json
docs/HARNESS-SUPPORT.md        # generated
docs/CONFORMANCE.md            # how to run the tiers
docs/DECISIONS.md              # + D-100 onward
test/acceptance/conformance-*.test.ts   # entry-point tests with a fake lab
package.json                   # + scripts conformance, conformance:docs
tsconfig.json                  # + tools in include, allowImportingTsExtensions, erasableSyntaxOnly
vitest.config.ts               # + tools/**/*.test.ts
eslint.config.js               # + tools in scope, stub and fake-model globals if needed
```

## Test strategy

- **Unit tests** sit next to the code under `tools/`.
  They cover the verdict rules, the known-gap loader, the result file, the document generator, each wire format (a recorded request in, the exact response shape out), the brain, the schema-driven argument builder, each driver's files, and argument parsing.
- **Process tests** start the stub agent as a child process and speak ACP to it over stdio, with a tiny stdio MCP server behind it.
  They start the fake model server on a free loopback port and send real HTTP requests.
  They run `bblab plan` to check that `--offline` adds `--unshare-net` and that a lab path under `firstmate` is refused.
- **Scenario tests** run each scenario against a scripted fake lab, once with a lab that behaves correctly and once for each deliberate failure that the scenario must catch (for example, a task that never reports, or a refusal that is not logged).
- **Acceptance tests** in `test/acceptance/` enter through `main(argv, deps)` of the runner with a fake lab factory.
  They check the verdict table, the exit codes, the result file, the lab teardown on a crash, and the generated document.
  The acceptance layer is in process, which is weaker than a real lab, so the live runs below are the end-to-end check.
- **Live runs** (not in `pnpm test`): `pnpm run conformance -- --tier 1`, then `--tier 1.5 --harness <id>` for each of the four.
  The result files and the evidence directory are kept, and `quickstart.md` records the commands.
- The test list says which behaviors only the live run can prove.

## Risks

- bb 0.49.0 may not start with no network.
  The first live step settles it.
  The fallback is in the decisions above, and the outcome goes in `docs/DECISIONS.md`.
- A harness may stall on a prompt (an approval, a trust dialog, an update check) that the report's runs did not hit, because the report used `accept-edits` for scouts only.
  The driver picks `full` for the ship profile where that is the case, and the fake model never asks a question.
- A CLI on this machine may be newer or older than the report's versions.
  The result file names the version it ran on, and the document shows it.
- The Claude Code, Codex, and omp ship flows were never run.
  The shell tool names and argument shapes (`Bash`, `exec_command`, `bash`) come from the first live runs, and the recorded requests become test fixtures.
- Another lane may hold ports or the `bblab` lab path.
  The runner finds free ports itself and the lab path is an argument.
