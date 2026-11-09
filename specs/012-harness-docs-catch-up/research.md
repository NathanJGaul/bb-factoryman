# Research: claims checked against the code

Each row is a claim that the documents will make, the file that proves it, and the result.
"Result" is what the file says at commit `2b0bac6`.

## Claims for DESIGN.md

| # | Claim | Source | Result |
| --- | --- | --- | --- |
| R1 | Resolution order: explicit override, best rule, `default`, then a block with the `dispatch init` hint. No built-in profile. | D-112, `src/dispatch/resolver.ts` | Confirmed by D-112 (code `no_default_profile`). |
| R2 | Dispatch and the queue start call `gateProfile`. It checks admission first, then readiness, permission mode, model, and level. | `src/dispatch/gate.ts` | Confirmed. |
| R3 | Only bb status `ready` passes. `not_installed`, `unauthenticated`, `expired`, `unsupported_version`, `unknown`, a missing state, and a failed read block. | `src/dispatch/availability.ts` `readinessProblem`, `gate.ts` `read` | Confirmed. |
| R4 | A block creates no task and spends no slot of the day cap. | D-109 | Confirmed by the decision. |
| R5 | The model's own level list decides when bb knows it. An unlisted model follows the contract row: Claude Code and Codex accept it, the others refuse it. | `availability.ts` `checkSupport`, `contracts.ts` `unlistedModels` | Confirmed. |
| R6 | The contract table has rows for `claude-code`, `codex`, `pi`, `acp-omp` and a generic row. It imports nothing. | `src/harness/contracts.ts` | Confirmed. |
| R7 | Pi is refused in `local-only` mode, with the code `provider_not_admitted`. Admission applies to workers only. | `contracts.ts` (`refusedModes`), `gate.ts` `admit`, `gateReadiness` | Confirmed. |
| R8 | `reasoningLevels` is an array or a record keyed by provider ID. | `src/dispatch/config.ts` | Confirmed. |
| R9 | `roles.supervisor.profile` is optional and must name a defined profile. `roles.validator.agent` accepts `observe` only. | `config.ts` `roles`, `superRefine` | Confirmed. |
| R10 | `supervisor start` takes `--project`, `--profile`, `--prompt`. The profile is the flag, then `roles.supervisor.profile`, never `default`. It sets `role: supervisor` in the spawn call. It runs `gateReadiness`, not admission. | `src/tools/supervisor-start.ts` | Confirmed. |
| R11 | The default first prompt is "You are the factoryman supervisor. Wait for instructions." | `supervisor-start.ts` `DEFAULT_PROMPT` | Confirmed. |
| R12 | `supervisor <thread>` stamps the role and prints advice: next turn where the contract says `next-turn`, otherwise `bb thread clear <id>`. A provider with no row gets the clear advice. | `src/tools/supervisor-command.ts`, `src/harness/advice.ts` | Confirmed. |
| R13 | The supervisor has four tools and a worker has one. | `src/tools/register.ts` `SUPERVISOR_TOOLS`, `WORKER_TOOLS` | Confirmed. DESIGN.md says "five tools" for the supervisor: wrong. |
| R14 | The plugin reads the validator's agent from no-mistakes' `config.yaml`, never writes it, and maps agent names to bb providers. | `src/validator/agent.ts`, D-126 | Confirmed. |
| R15 | A `no-mistakes` hand-off adds one validator line to the evidence and never refuses on it. The preflight reports `validator_agent` as a problem. | `src/tools/report.ts`, `src/machines/preflight.ts`, D-128 | Confirmed. |
| R16 | The tool hint for `mcp-deferred` and `xd-device` routes is off unless the composition root sets `toolHints`. | `src/server.ts:39`, `register.ts:108` | Confirmed. DESIGN.md does not need to describe it beyond one line. |
| R17 | The failure evidence quotes the provider's cause from `provider/error` or `system/error`. | D-115 | Confirmed by the decision. |

## Claims for LIVE-CHECK.md

| # | Claim | Source | Result |
| --- | --- | --- | --- |
| R20 | `pnpm run conformance -- --tier 1` and `--tier 1.5 --harness <claude-code, codex, pi, omp>`. Tier 2 is refused by the tool. | `tools/conformance/args.ts` | Confirmed. |
| R21 | Tier 1.5 is offline by default. | `args.ts` USAGE, D-103 | Confirmed. |
| R22 | Result files exist for `1-stub`, `1.5-claude-code`, `1.5-codex`, `1.5-omp`, `1.5-pi`. | `conformance/results/` | Confirmed. |
| R23 | Support is generated into `docs/HARNESS-SUPPORT.md`. It says "Tier 2 has not run". | `docs/HARNESS-SUPPORT.md` | Confirmed. |
| R24 | The stub agent exists in `tools/stub-agent`. | `ls tools` | Confirmed. D-093 and the runbook say it does not. |
| R25 | Pi offers only `full`. Omp offers `accept-edits` and `full`. Claude Code and Codex offer all three. | `contracts.ts` `workerModes` | Confirmed (information only: the runtime reads bb). |
| R26 | Role change by `bb thread clear` applies to Codex and omp. Claude Code and Pi take it at the next turn. | `contracts.ts` `roleChange` | Confirmed. |
| R27 | Pi is refused for `local-only`, so a Pi tier 2 ship task needs a `direct-PR` project. | `contracts.ts`, D-111, D-118 | Confirmed. The runbook's single `local-only` ship task cannot run on Pi. |
| R28 | Codex reports `unauthenticated` until `codex login status` succeeds. | D-105 item 3 | Confirmed by the decision (seen with a dummy key in the lab). |
| R29 | bb passes only `BB_CLAUDE_CODE_EXECUTABLE` and `CLAUDE_CODE_OAUTH_TOKEN` to the Claude CLI. | The report, section 3.2, tagged source | Taken from the report. Not exercised at tier 2. |
| R30 | `BBLAB_PASS_ENV` names the variables that `bblab x` passes into commands. `BBLAB_RO` binds extra paths read-only. | `tools/bblab/bblab` lines 85 and 94 | Confirmed. |
| R31 | `bb` commands in the runbook must exist in `test/fixtures/bb-cli.json` (bb 0.48.1). | `test/acceptance/live-check.test.ts` A1109 | Constraint. `bb provider list`, `provider models`, `thread spawn`, `thread clear`, `thread tell`, `thread wait`, `thread output` exist. |
| R32 | With no built-in profile, tier 2 needs a `dispatch.json` with a `default`, or dispatch blocks with `no_default_profile`. The old runbook never writes one. | D-112, `resolver.ts` | Confirmed. This is a defect of the old runbook that the rewrite fixes. |
| R33 | Per-harness tier 2 credentials. Claude Code: `CLAUDE_CODE_OAUTH_TOKEN` (D-092). Codex, Pi, omp: one OpenAI key (`OPENAI_API_KEY`) with a provider-side cap (D-108 D2). | D-092, D-108, report section 6.4 | Credential names confirmed by decisions. The way each key enters the lab is the report's design and is **not exercised**. The runbook says so and has a stop rule. |

## Decisions of the plan

- **Decision**: Keep the eleven numbered sections and rename sections 6 and 7.
  **Rationale**: The runbook keeps its shape, so the owner's muscle memory and the guard stay close.
  **Alternative**: A new layout. Rejected: more churn, no gain.
- **Decision**: Write one tier 2 credential block that uses `read -rs` per variable, plus a per-harness table, and add no harness-specific shell block for Codex login.
  **Rationale**: The way a key reaches Codex, Pi, and omp inside the lab is unexercised (R33). A shell block would state a procedure nobody has run.
  The table names the variable, and the stop rule says what to do when the provider is not ready.
  **Alternative**: Add `codex login --with-api-key` steps. Rejected: unverified command.
- **Decision**: The ship task in tier 2 runs in `local-only` for harnesses other than Pi, and in `direct-PR` for Pi, as the conformance driver does (D-118).
  **Rationale**: R27.
  **Alternative**: Skip Pi. Rejected: the harness is supported at tier 1.5 in `direct-PR`.
  The `direct-PR` ship task cannot finish against a local bare origin (the old runbook says so), so the Pi tier 2 ship task stops at `review_ready`, which the runbook states.
- **Decision**: Do not touch `skills/`.
  **Rationale**: The skills name no harness (grep found no "Claude" in them), and the brief says no code changes.

## Wording that goes

| Where | Old wording | Why it goes |
| --- | --- | --- |
| LIVE-CHECK preamble | "never ran a real agent end to end" | Still true for tier 2, but it reads as the only state. Rewritten to name tiers 1 and 1.5. |
| LIVE-CHECK section 2 | "the captain's own Claude account" as the only funding | Per harness now. |
| LIVE-CHECK section 3 | "Read your Claude usage" | Per account. |
| LIVE-CHECK section 6 | "That stub agent does not exist yet." | R24. |
| LIVE-CHECK section 7 | `claude setup-token`, `claude-code` in the spawn line, "Haiku-class", "the Claude CLI" | Harness-neutral behavior. The Claude path stays as one row. |
| LIVE-CHECK section 9 | "The tier 1 stub agent, until someone writes it." | R24. |
| LIVE-CHECK section 10 | "Read your Claude usage again" | Per account. |
| DESIGN dispatch profiles | "an unavailable provider" | R3. |
| DESIGN supervisor | "five tools" | R13. |
| DECISIONS D-092, D-093 | Read as current | Amended-by lines. |
