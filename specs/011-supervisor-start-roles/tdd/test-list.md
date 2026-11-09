---
feature: 011-supervisor-start-roles
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 46
planned_at: 8578209
updated_at: 8578209
suite_baseline: green
---

# Test list: Supervisor start command, role advice, and the dispatch roles block

The acceptance layer is an in-process integration test.
It enters through the real plugin factory in the fake host (the registered `bb factoryman` command, the `factoryman_report` and `factoryman_dispatch` tools, `agents.configure`), through `loadDispatchConfig`, and through the conformance runner's `main(argv, deps)` with the fake lab behind it.
It is weaker than a test against a real bb.
A fake host cannot show that a real harness is offered the four tools and the skill on its first turn, that a real Codex or omp needs no clear for a seeded role, or that the full suite leaves no directory behind.
The only check of those is the live runs: behaviors A1614 to A1617 are live checks, run in `bblab` and logged in `cycle-log.md` and in the result files.
`tools/conformance/real-lab.ts` has no unit test because it drives a real bb.
Its pure parts (the `supervisor start` arguments, the thread-ID reader, the lab project's `dispatch.json`) are extracted into functions that have unit tests, and the glue between them is covered by the live runs only.
The fake lab uses the real contract table and the real advice text, so a driver or a text that disagrees with the plugin fails in the unit tests.
The suite baseline was 143 files and 1842 tests, all passing (26 s).
Tests carry their behavior id in the title, for example `[U1601]`.
Table-driven tests cover the lines that name several inputs, and the cycle log records one red for the group.

## Outer loop: acceptance behaviors

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| A1601 | The registered command `supervisor start --project p --profile claude` in the fake host spawns exactly one thread with the profile's provider, model, reasoning level, and permission mode, with the metadata `{ role: "supervisor" }` set in the spawn call, and prints the thread ID | US1.1, FR-001, FR-002, FR-003, FR-008 | example | DONE | `test/acceptance/supervisor-start.test.ts::[A1601]` |
| A1602 | `agents.configure` of the plugin for the metadata of the spawned thread offers the four supervisor tools and the `factoryman-supervisor` skill and no worker tool or skill | US1.2, FR-002, SC-002 | example | DONE | `test/acceptance/supervisor-start.test.ts::[A1602]` |
| A1603 | The thread's first prompt is the `--prompt` text when given, and the fixed default (wait for instructions) when not | US1.3, US1.4 | example | DONE | `test/acceptance/supervisor-start.test.ts::[A1603]` |
| A1604 | A profile whose provider is not ready, whose permission mode the provider lacks, or whose model or level is not listed makes the command exit 1 with dispatch's reason, spawns nothing, and adds no event or row to the store; a Pi profile in a `local-only` project spawns | US1.5, US1.6, FR-005, SC-007 | example | DONE | `test/acceptance/supervisor-start.test.ts::[A1604]` |
| A1605 | The profile is the `--profile` flag, else `roles.supervisor.profile` of the project's `dispatch.json`; with neither, or with an undefined name, or with a missing, unreadable, or invalid file, the command exits 1, names the remedy, and spawns nothing | US2.1, US2.2, US2.3, US2.4, US2.7, FR-004, FR-006, SC-007 | example | DONE | `test/acceptance/supervisor-start.test.ts::[A1605]` |
| A1606 | `factoryman_dispatch` for a project whose file has an invalid `roles` block is blocked with `config_invalid` and the path of the field, one whose file has a valid `roles` block dispatches as before, and a file without `roles` is unchanged | US2.5, US2.6, US5.1, US5.2, US5.3, US5.4, FR-012, FR-013, FR-014 | example | DONE | `test/acceptance/roles-config.test.ts::[A1606]` |
| A1607 | The registered command `supervisor <thread>` stamps the role and prints the clear advice for Codex and omp threads, the next-turn advice for Claude Code and Pi threads, the clear advice for an unknown or unreadable provider, no advice and exit 1 for a rejected stamp, and a refusal for a worker thread; no output says "from its next session" | US3.1, US3.2, US3.3, US3.4, US3.5, US3.6, FR-009, FR-010, FR-011, SC-003 | example | DONE | `test/acceptance/tools-supervisor-command.test.ts::[A1607]` |
| A1608 | The `factoryman_report` hand-off of a `no-mistakes` ship task puts the worker's evidence first and the validator line after a blank line in the `handoff` event, names the agent, its bb provider, and a ready state, and the task becomes `validating` | US4.1, FR-016, FR-017, FR-021, SC-005 | example | DONE | `test/acceptance/validator-observe.test.ts::[A1608]` |
| A1609 | The same hand-off for a provider bb reports as `unauthenticated` names the agent and bb's remedy and says it is not ready, and the task still becomes `validating` | US4.2, FR-017, FR-021 | example | DONE | `test/acceptance/validator-observe.test.ts::[A1609]` |
| A1610 | The hand-off line is correct for an ordered list, for `auto` and for a host with no configuration file, for an agent with no known bb provider, and for a configuration that cannot be read, and none of them says ready unless a mapped provider is ready | US4.3, US4.4, US4.5, US4.6, FR-016, FR-018, FR-019, FR-020, SC-005 | example | DONE | `test/acceptance/validator-observe.test.ts::[A1610]` |
| A1611 | For a task on a remote machine the observation reads the configuration and the provider states of that machine, and a `direct-PR` or `local-only` hand-off and a scout report get no validator line and run no read | US4.7, US4.10, FR-016, FR-021 | example | DONE | `test/acceptance/validator-observe.test.ts::[A1611]` |
| A1612 | `bb factoryman preflight <machine> --project <id>` for a remote machine of a `no-mistakes` project exits 1 with a `validator_agent` problem when the agent is not ready or cannot be observed, exits 0 and names the agent when it is ready, skips the host that holds the clone, and a dispatch to the remote machine with an unready agent is refused with `preflight_failed` and creates no task | US4.8, US4.9, US4.10, FR-022, FR-023 | example | DONE | `test/acceptance/validator-observe.test.ts::[A1612]` |
| A1613 | During every observation of A1608 to A1612 the recorded `exec` calls hold only the one `sh -c` read of the configuration and the project's own custom checks, and no call writes, creates, or changes a file | US4.11, FR-015, SC-006 | example | DONE | `test/acceptance/validator-observe.test.ts::[A1613]` |
| A1614 | `main` with tier 1.5 for each of the four harness drivers against the fake lab runs S9 to `pass`, S9 holds the check `S9.start-tools`, the committed gap list is empty, and the run exits 0 with no stale gap; tier 1 does the same | US6.1, US6.2, US6.3, US6.4, US6.5, US6.6, US6.7, FR-024, FR-025 | example | DONE | `test/acceptance/conformance-tier15.test.ts::[A1614]` |
| A1615 | Live: tier 1 exits 0 with S9 `pass` and no known gap | US6.1, US6.7, FR-026, SC-001, SC-004 | example | DONE | live run: `conformance/results/1-stub.json` (exit 0, S9 pass, no known gap) |
| A1616 | Live: tier 1.5 for Claude Code, Codex, Pi, and omp each exit 0 with S9 `pass` (the started supervisor is offered 4 of 4 tools and its skill on its first request, the stamp text for Codex and omp tells the person to clear), offline, with no credential | US6.1, US6.2, US6.3, US6.4, US6.5, FR-026, SC-001, SC-002, SC-003, SC-008 | example | DONE | live runs: `conformance/results/1.5-claude-code.json`, `1.5-codex.json`, `1.5-pi.json`, `1.5-omp.json` (each exit 0, S9 pass with all five checks, offline) |
| A1617 | Live: each of the five runs reports isolation clean and a tripwire with no event | US6.8, SC-008 | example | DONE | live runs: `isolation.clean` is true and the tripwire has no event in all five result files |
| A1618 | The decision log has headings from D-123 on with no duplicate number and every citation valid, and the constitution is at version 1.4.0 with Principle VI naming H4 and H12 | US7.1, US7.2, FR-027 | example | DONE | `test/acceptance/decision-log.test.ts::[A1618]` |
| A1619 | The generated support document, built from the result files, lists S9 as `pass` for every harness and lists no known gap | US7.3, SC-004 | example | DONE | `test/acceptance/conformance-docs.test.ts::[A1619]` |
| A1620 | Live: a full `pnpm run check` adds no `bb-fake-plugin-host-*` directory, and no other directory made by a new test helper, to the temporary directory | US7.4, FR-028, SC-009 | example | DONE | measured: 3212 matching directories before and 3212 after one full `pnpm test` (0 added) |

## Inner loop: unit behaviors

### `src/bb/adapter.ts` (tests in `src/bb/adapter.test.ts`)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1601 | `getThread` returns the thread's provider ID | US3.1, FR-010 | example | DONE | `src/bb/adapter.test.ts::[U1601]` |
| U1602 | `getThread` returns a null provider ID when the thread carries none | US3.3, FR-010 | example | DONE | `src/bb/adapter.test.ts::[U1602]` |
| U1603 | `spawnSupervisor` makes one spawn call with the profile's provider, model, reasoning level, and permission mode, no parent thread, and the metadata it was given | US1.1, FR-002, FR-003, FR-007 | example | DONE | `src/bb/adapter.test.ts::[U1603]` |
| U1604 | `spawnSupervisor` starts the thread in a managed worktree off the project's default branch on the project's default host | US1.1, FR-007 | example | DONE | `src/bb/adapter.test.ts::[U1604]` |
| U1605 | `spawnSupervisor` throws with bb's reason when the project has no host, and makes no spawn call | US1.5, FR-007 | example | DONE | `src/bb/adapter.test.ts::[U1605]` |

### `src/dispatch/gate.ts` (tests in `src/dispatch/gate.test.ts`)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1606 | `gateReadiness` passes a ready Pi profile for a `local-only` project and reads the providers, the states, and the models | US1.6, FR-005 | example | DONE | `src/dispatch/gate.test.ts::[U1606]` |
| U1607 | `gateReadiness` returns `provider_unavailable` with bb's remedy for a provider that is not ready | US1.5, FR-005 | example | DONE | `src/dispatch/gate.test.ts::[U1607]` |
| U1608 | `gateReadiness` returns `provider_unavailable` for a permission mode the provider does not offer | US1.5, FR-005 | example | DONE | `src/dispatch/gate.test.ts::[U1608]` |
| U1609 | `gateReadiness` returns `provider_unavailable` for a model or a reasoning level that the provider does not list | US1.5, FR-005 | example | DONE | `src/dispatch/gate.test.ts::[U1609]` |
| U1610 | `gateReadiness` returns `read_failed` when any of the three reads throws | FR-005, FR-029 | example | DONE | `src/dispatch/gate.test.ts::[U1610]` |
| U1611 | `gateProfile` still refuses Pi in `local-only` with `provider_not_admitted` before any bb read, and still passes a ready admitted profile | FR-005, FR-029 | characterization | DONE | `src/dispatch/gate.test.ts::[U1363]`, `[U1339]` (existing, unchanged, passing before and after the split) |

### `src/dispatch/config.ts` and `src/dispatch/load.ts` (tests in `src/dispatch/config.test.ts` and `load.test.ts`)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1612 | A version 1 file with no `roles` parses and carries `roles` with a null supervisor profile and the validator agent `observe` | US2.6, US5.1, FR-012, FR-014 | example | DONE | `src/dispatch/config.test.ts::[U1612]` |
| U1613 | `roles.supervisor.profile` naming a defined profile parses and is carried | US2.1, FR-013 | example | DONE | `src/dispatch/config.test.ts::[U1613]` |
| U1614 | `roles.supervisor.profile` naming an undefined profile fails and the message names the profile | US2.5, FR-013 | example | DONE | `src/dispatch/config.test.ts::[U1614]` |
| U1615 | A blank `roles.supervisor.profile` fails | FR-013 | example | DONE | `src/dispatch/config.test.ts::[U1615]` |
| U1616 | `roles.validator.agent` of `observe` parses | US5.2, FR-014 | example | DONE | `src/dispatch/config.test.ts::[U1616]` |
| U1617 | `roles.validator.agent` of `inherit`, `set`, or any other value fails, and the message names the field and the accepted value | US5.3, FR-014 | example | DONE | `src/dispatch/config.test.ts::[U1617]` |
| U1618 | An unknown key in `roles`, in `roles.supervisor`, or in `roles.validator` fails | US5.4, FR-012 | example | DONE | `src/dispatch/config.test.ts::[U1618]` |
| U1619 | An empty `roles`, an empty `roles.supervisor`, and an empty `roles.validator` parse with the defaults filled in | US2.6, FR-012 | example | DONE | `src/dispatch/config.test.ts::[U1619]` |
| U1620 | `emptyDispatchConfig` carries the default roles | FR-012 | example | DONE | `src/dispatch/config.test.ts::[U1620]` |
| U1621 | `loadDispatchConfig` blocks a file with an invalid `roles` block with `dispatch.json is invalid` and the field path, and no default replaces it | US2.7, FR-006, FR-029 | example | DONE | `src/dispatch/load.test.ts::[U1621]` |
| U1622 | `loadDispatchConfig` gives the default roles for a project with no file | US2.6 | example | DONE | `src/dispatch/load.test.ts::[U1622]` |

### `src/tools/supervisor-start.ts` (tests in `src/tools/supervisor-start.test.ts`)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1623 | The command spawns once with the profile's four fields and the metadata `{ role: "supervisor" }`, and prints the thread ID, the profile name, the provider, and the model | US1.1, FR-001 to FR-003, FR-008 | example | DONE | `src/tools/supervisor-start.test.ts::[U1623]` |
| U1624 | `--prompt` text is the thread's first prompt | US1.3 | example | DONE | `src/tools/supervisor-start.test.ts::[U1624]` |
| U1625 | Without `--prompt` the first prompt is the fixed text that tells the supervisor to wait for instructions | US1.4 | example | DONE | `src/tools/supervisor-start.test.ts::[U1625]` |
| U1626 | `roles.supervisor.profile` is used when `--profile` is absent | US2.1, FR-004 | example | DONE | `src/tools/supervisor-start.test.ts::[U1626]` |
| U1627 | `--profile` wins over `roles.supervisor.profile` | US2.2, FR-004 | example | DONE | `src/tools/supervisor-start.test.ts::[U1627]` |
| U1628 | With neither, the command exits 1, names both ways to choose a profile, says that `default` is the worker's and is not used, and spawns nothing | US2.3, FR-004, SC-007 | example | DONE | `src/tools/supervisor-start.test.ts::[U1628]` |
| U1629 | An undefined profile name exits 1, lists the defined profiles (or says none), and spawns nothing | US2.4, FR-004, SC-007 | example | DONE | `src/tools/supervisor-start.test.ts::[U1629]` |
| U1630 | The project is `--project`, falls back to the command context, and `--project` wins when both are present | FR-001 | example | DONE | `src/tools/supervisor-start.test.ts::[U1630]` |
| U1631 | An invalid `dispatch.json` exits 1 with the loader's message and spawns nothing | US2.7, FR-006 | example | DONE | `src/tools/supervisor-start.test.ts::[U1631]` |
| U1632 | An unreadable `dispatch.json` exits 1 with the reason and spawns nothing | US2.7, FR-006 | example | DONE | `src/tools/supervisor-start.test.ts::[U1632]` |
| U1633 | A missing `dispatch.json` and a project with no checkout each exit 1 as having no defined profile and spawn nothing | US2.7, FR-006 | example | DONE | `src/tools/supervisor-start.test.ts::[U1633]` |
| U1634 | A checkout read that throws exits 1 with the reason and spawns nothing | FR-006, FR-029 | example | DONE | `src/tools/supervisor-start.test.ts::[U1634]` |
| U1635 | A provider that is not ready exits 1 with the gate's message and `Nothing was spawned.` | US1.5, FR-005, SC-007 | example | DONE | `src/tools/supervisor-start.test.ts::[U1635]` |
| U1636 | A permission mode the provider lacks, and a model or level the provider does not list, each exit 1 with the gate's message and spawn nothing | US1.5, FR-005, SC-007 | example | DONE | `src/tools/supervisor-start.test.ts::[U1636]` |
| U1637 | A gate read that throws exits 1 and spawns nothing | FR-005, FR-029 | example | DONE | `src/tools/supervisor-start.test.ts::[U1637]` |
| U1638 | A Pi profile in a `local-only` project spawns, because the admission rule is not applied | US1.6, FR-005 | example | DONE | `src/tools/supervisor-start.test.ts::[U1638]` |
| U1639 | The gate reads the default host (no host ID) and runs before the spawn | FR-005, FR-007 | example | DONE | `src/tools/supervisor-start.test.ts::[U1639]` |
| U1640 | A spawn that throws exits 1 with `Could not start the supervisor` and bb's reason, and records nothing | FR-008 | example | DONE | `src/tools/supervisor-start.test.ts::[U1640]` |
| U1641 | No project, a repeated flag, a flag without a value, a blank value, an unknown flag, and an extra positional each exit 2 with the usage text and spawn nothing | FR-001 | example | DONE | `src/tools/supervisor-start.test.ts::[U1641]` |

### `src/tools/supervisor-command.ts` and `src/server.ts` (tests in `src/tools/supervisor-command.test.ts` and `src/server.test.ts`)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1642 | The word `start` selects the start command, and any other first word is a thread ID that is stamped | FR-001, FR-009 | example | DONE | `src/tools/supervisor-command.test.ts::[U1642]` |
| U1643 | The usage text and the registered CLI summary list `supervisor <thread-id>` and then `supervisor start ...` | FR-001 | example | DONE | `src/tools/supervisor-command.test.ts::[U1643]`, `src/server.test.ts::[U1643]` |
| U1644 | A stamp on a Codex thread and on an `acp-omp` thread prints the thread, the harness, and `bb thread clear <thread>` | US3.1, FR-010 | example | DONE | `src/tools/supervisor-command.test.ts::[U1644]` |
| U1645 | A stamp on a `claude-code` thread and on a `pi` thread says the tools arrive at the next turn and does not mention a clear | US3.2, FR-010 | example | DONE | `src/tools/supervisor-command.test.ts::[U1645]` |
| U1646 | A stamp on a thread whose provider has no contract row prints the generic advice with `bb thread clear` and names the provider | US3.3, FR-010 | example | DONE | `src/tools/supervisor-command.test.ts::[U1646]` |
| U1647 | A stamp whose thread has a null provider, or whose provider read throws, still succeeds with exit 0 and prints the generic advice and says that bb did not name the harness | US3.3, FR-010 | example | DONE | `src/tools/supervisor-command.test.ts::[U1647]` |
| U1648 | No output of the stamp command, for any provider, contains "from its next session" | US3.4, FR-011 | example | DONE | `src/tools/supervisor-command.test.ts::[U1648]` |
| U1649 | A recorded worker thread is refused, nothing is stamped, and no thread is read | US3.5, FR-009 | example | DONE | `src/tools/supervisor-command.test.ts::[U1649]` |
| U1650 | A stamp that bb rejects exits 1 with bb's reason, prints no advice, and reads no thread | US3.6 | example | DONE | `src/tools/supervisor-command.test.ts::[U1650]` |

### `src/harness/advice.ts` (tests in `src/harness/advice.test.ts`)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1651 | The advice for a `clear` row names the thread and the provider and gives the instruction `bb thread clear <thread>` | US3.1, FR-010 | example | DONE | `src/harness/advice.test.ts::[U1651]` |
| U1652 | The advice for a `next-turn` row names the thread, says the tools and the skill arrive at the next turn, and gives no clear instruction | US3.2, FR-010 | example | DONE | `src/harness/advice.test.ts::[U1652]` |
| U1653 | The advice for the generic row names the provider, says that it has no recorded role-change behavior, and gives the clear instruction | US3.3, FR-010 | example | DONE | `src/harness/advice.test.ts::[U1653]` |
| U1654 | The advice for an unreadable provider says that bb did not name the harness and gives the clear instruction | US3.3, FR-010 | example | DONE | `src/harness/advice.test.ts::[U1654]` |
| U1655 | Over every row of `CONTRACTS` the advice contains the clear instruction exactly when `roleChange` is `clear`, and no advice contains "from its next session" | FR-010, FR-011 | example | DONE | `src/harness/advice.test.ts::[U1655]` |

### `src/validator/agent.ts`: the setting (tests in `src/validator/agent.test.ts`)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1656 | A scalar `agent: claude` reads as the one name `claude` | FR-016 | example | DONE | `src/validator/agent.test.ts::[U1656]` |
| U1657 | A flow list `agent: [codex, grok]` reads as the names in order | FR-016, US4.3 | example | DONE | `src/validator/agent.test.ts::[U1657]` |
| U1658 | A block list (`agent:` then `- codex` lines) reads as the names in order | FR-016, US4.3 | example | DONE | `src/validator/agent.test.ts::[U1658]` |
| U1659 | Quotes around a name are removed | FR-016 | example | DONE | `src/validator/agent.test.ts::[U1659]` |
| U1660 | A trailing comment is not part of the value | FR-016 | example | DONE | `src/validator/agent.test.ts::[U1660]` |
| U1661 | A commented-out `agent` line is ignored | FR-016 | example | DONE | `src/validator/agent.test.ts::[U1661]` |
| U1662 | An indented `agent` key is ignored, because only a top-level key counts | FR-016 | example | DONE | `src/validator/agent.test.ts::[U1662]` |
| U1663 | No `agent` line reads as `auto` | FR-016, US4.4 | example | DONE | `src/validator/agent.test.ts::[U1663]` |
| U1664 | `agent: auto` reads as `auto`, and `auto` inside a list is an entry of the list | FR-016, FR-018 | example | DONE | `src/validator/agent.test.ts::[U1664]` |
| U1665 | An unclosed flow list, an `agent:` with no items, two top-level `agent` lines, and an empty name each fail with a reason that names the shape, and none is guessed | FR-016, FR-020, US4.6 | example | DONE | `src/validator/agent.test.ts::[U1665]` |
| U1666 | The table of agent to provider holds exactly `claude`, `codex`, `pi`, `acp:omp`, `opencode`, `grok`, and `cursor` with their providers | FR-017 | example | DONE | `src/validator/agent.test.ts::[U1666]` |
| U1667 | `acp:other`, `copilot`, `rovodev`, `devin`, `antigravity`, and an unknown name map to no provider | FR-017, FR-019 | example | DONE | `src/validator/agent.test.ts::[U1667]` |

### `src/validator/agent.ts`: the observation

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1668 | A mapped agent whose provider bb reports `ready` is `ready` and names its provider | US4.1, FR-017 | example | DONE | `src/validator/agent.test.ts::[U1668]` |
| U1669 | A mapped agent whose provider is `unauthenticated`, `not_installed`, `expired`, or `unsupported_version` is `not_ready` with the text and the remedy that dispatch gives | US4.2, FR-017 | example | DONE | `src/validator/agent.test.ts::[U1669]` |
| U1670 | A mapped agent whose provider is missing from the host's states is `not_ready` and the text says that bb reports no state | FR-017, FR-020 | example | DONE | `src/validator/agent.test.ts::[U1670]` |
| U1671 | An agent with no mapped provider is `unchecked`, its reason says that readiness was not checked, and it is never `ready` | US4.5, FR-019 | example | DONE | `src/validator/agent.test.ts::[U1671]` |
| U1672 | An ordered list is ready when one entry is ready (also when the first is not and a later one is), and keeps its order | US4.3, FR-016, FR-017 | example | DONE | `src/validator/agent.test.ts::[U1672]` |
| U1673 | An ordered list with no ready entry is not ready | US4.3, FR-017 | example | DONE | `src/validator/agent.test.ts::[U1673]` |
| U1674 | `auto` lists the mapped providers that bb reports ready on the host and is ready when the list is not empty | US4.4, FR-018 | example | DONE | `src/validator/agent.test.ts::[U1674]` |
| U1675 | `auto` with no ready mapped provider is not ready | US4.4, FR-018 | example | DONE | `src/validator/agent.test.ts::[U1675]` |
| U1676 | A host with no configuration file (the read exits 3) reads as the default `auto`, with source `default` | US4.4, FR-016 | example | DONE | `src/validator/agent.test.ts::[U1676]` |
| U1677 | Any other non-zero exit of the read is `unobserved` with the exit code and the standard error | US4.6, FR-020 | example | DONE | `src/validator/agent.test.ts::[U1677]` |
| U1678 | A read that did not run, or was killed or timed out (exit code null), is `unobserved` with the reason | US4.6, FR-020 | example | DONE | `src/validator/agent.test.ts::[U1678]` |
| U1679 | A setting that cannot be read (U1665) is `unobserved` with the reason of the parser | US4.6, FR-020 | example | DONE | `src/validator/agent.test.ts::[U1679]` |
| U1680 | A `getProviderStates` call that throws makes the observation `unobserved`, and an `exec` call that throws does too, and the function never throws | US4.6, FR-020, FR-029 | example | DONE | `src/validator/agent.test.ts::[U1680]` |
| U1681 | The only `exec` call is `sh` with `-c` and the contract's script, with `timeoutMs` 30000 and the host of the call, and `getProviderStates` gets the same host | US4.7, US4.11, FR-015 | example | DONE | `src/validator/agent.test.ts::[U1681]` |

### `src/validator/agent.ts`: the text

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1682 | The line for one ready agent names the agent, its provider, and the host, and says it is ready | US4.1, FR-021 | example | DONE | `src/validator/agent.test.ts::[U1682]` |
| U1683 | The line for a not-ready agent says it is not ready and carries bb's problem text | US4.2, FR-021 | example | DONE | `src/validator/agent.test.ts::[U1683]` |
| U1684 | The line for a list names each agent in order with its own readiness | US4.3, FR-021 | example | DONE | `src/validator/agent.test.ts::[U1684]` |
| U1685 | The line for `auto` says that no-mistakes picks the first runnable agent when the run starts, and lists the ready providers or says there is none | US4.4, FR-018, FR-021 | example | DONE | `src/validator/agent.test.ts::[U1685]` |
| U1686 | The line for a host with no file says that the default applies, before the `auto` line | US4.4, FR-021 | example | DONE | `src/validator/agent.test.ts::[U1686]` |
| U1687 | The line for an unmapped agent says that its readiness was not checked | US4.5, FR-019, FR-021 | example | DONE | `src/validator/agent.test.ts::[U1687]` |
| U1688 | The line for an unobserved result says that the agent could not be observed, gives the reason, and says readiness is not known | US4.6, FR-020, FR-021 | example | DONE | `src/validator/agent.test.ts::[U1688]` |
| U1689 | Over every case above, no line says an unchecked or unobserved result is ready, and `validatorProblem` is null exactly when the observation is ready | US4.5, US4.6, FR-019, FR-020, SC-005 | example | DONE | `src/validator/agent.test.ts::[U1689]` |

### `src/machines/preflight.ts` (tests in `src/machines/preflight.test.ts`)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1690 | For a `no-mistakes` project, an agent that is not ready adds a `validator_agent` problem with the agent's line | US4.8, FR-022 | example | DONE | `src/machines/preflight.test.ts::[U1690]` |
| U1691 | For a `no-mistakes` project, an unobserved agent adds a `validator_agent` problem | US4.8, FR-022 | example | DONE | `src/machines/preflight.test.ts::[U1691]` |
| U1692 | For a `no-mistakes` project, a ready agent adds no problem and `preflightReport` returns the line as a note | US4.9, FR-022 | example | DONE | `src/machines/preflight.test.ts::[U1692]` |
| U1693 | For `direct-PR` and `local-only` projects no observation runs | US4.10, FR-022 | example | DONE | `src/machines/preflight.test.ts::[U1693]` |
| U1694 | `runPreflight` returns only the problems, and `preflightOnce` caches only a pass as before | FR-022 | characterization | DONE | `src/machines/preflight.test.ts::[U838]` (updated for the new read), `[U844]` (unchanged) |
| U1695 | `reportText` prints the notes after the headline, for a ready machine and for a machine with another problem | US4.9, FR-022 | example | DONE | `src/machines/preflight.test.ts::[U1695]` |
| U1696 | The `preflight` command exits 1 for a `validator_agent` problem and exits 0 and names the agent when it is ready, and the host that holds the clone is still skipped | US4.8, US4.9, FR-022 | example | DONE | `src/tools/supervisor-command.test.ts::[U1696]`, `[U874]` covers the clone-host skip |
| U1697 | A dispatch to a remote machine whose validator agent is not ready is refused with `preflight_failed` and creates no task | FR-023 | example | DONE | `src/tools/dispatch.test.ts::[U1697]` |
| U1698 | A queued task for such a machine stays queued, as for any preflight problem | FR-023 | example | DONE | `src/limits/queue.test.ts::[U1698]` |

### `src/tools/report.ts` (tests in `src/tools/report.test.ts`)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1699 | The `handoff` event of a `no-mistakes` ship task holds the worker's evidence, a blank line, and the validator line | US4.1, FR-021 | example | DONE | `src/tools/report.test.ts::[U1699]` |
| U1700 | The hand-off still moves the task to `validating` when the agent is not ready, unobserved, or unchecked | US4.2, US4.5, US4.6, FR-021 | example | DONE | `src/tools/report.test.ts::[U1700]` |
| U1701 | A failure inside the observation, including a throw from `exec`, never refuses the hand-off | FR-020, FR-021 | example | DONE | `src/tools/report.test.ts::[U1701]` |
| U1702 | A `direct-PR` or `local-only` ship hand-off, a scout report, and a `blocked` or `failed` report get no validator line and run no read | US4.10, FR-021 | example | DONE | `src/tools/report.test.ts::[U1702]` |
| U1703 | A task on a remote machine runs the read with that machine's host ID and reads that machine's provider states | US4.7, FR-016 | example | DONE | `src/tools/report.test.ts::[U1703]` |
| U1704 | Failing custom checks refuse the hand-off before any observation runs | FR-021 | example | DONE | `src/tools/report.test.ts::[U1704]` |
| U1705 | The only commands of a hand-off are the project's custom checks and the one read | US4.11, FR-015 | example | DONE | `src/tools/report.test.ts::[U1705]` |
| U1719 | A hand-off with blank evidence is still refused as `evidence_required`, and the validator line is not added to it and no read runs | FR-021, FR-029 (hard rule 3) | example | DONE | `src/tools/report.test.ts::[U1719]` |

### `tools/conformance` and the fake lab (tests in `tools/conformance/lab-env.test.ts`, `readers.test.ts`, `scenarios/scenarios.test.ts`, `gaps.test.ts`, and `test/fixtures/conformance-lab.test.ts`)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1706 | The argument list of `supervisor start` carries the project, the prompt with the label marker, and no profile flag | FR-024 | example | DONE | `tools/conformance/lab-env.test.ts::[U1706]` |
| U1707 | The thread-ID reader takes the ID from the first line of the command's output and returns null when the line has none | FR-024 | example | DONE | `tools/conformance/readers.test.ts::[U1707]` |
| U1708 | The lab project's `dispatch.json` holds the driver's profile as `harness`, `default: harness`, and `roles.supervisor.profile: harness`, and the plugin's parser accepts it | FR-024 | example | DONE | `test/acceptance/conformance-project-row.test.ts::[U1708]` |
| U1709 | The fake lab's `startSupervisor` returns a thread ID and seeds the role at spawn, so the offers are complete before any clear on every driver | US6.2 | example | DONE | `test/fixtures/conformance-lab.test.ts::[U1709]` |
| U1710 | The fake lab's stamp text is the real advice for the driver's provider | US6.5 | example | DONE | `test/fixtures/conformance-lab.test.ts::[U1710]` |
| U1711 | S9 passes for the stub and the four harness drivers | US6.1 to US6.7 | example | DONE | `tools/conformance/scenarios/scenarios.test.ts::[U1711]` |
| U1712 | S9 fails `S9.start-command` when the command does not exist or exits non-zero | US6.1, FR-024 | example | DONE | `tools/conformance/scenarios/scenarios.test.ts::[U1712]` |
| U1713 | S9 fails `S9.start-tools` when the started supervisor lacks a tool or the skill, is offered a worker tool, or gets its tools only after a clear | US6.2, FR-024 | example | DONE | `tools/conformance/scenarios/scenarios.test.ts::[U1713]` |
| U1714 | S9 fails `S9.unstamped-no-tools` when a thread with no role is offered a factoryman tool or skill | US6.3, FR-024 | example | DONE | `tools/conformance/scenarios/scenarios.test.ts::[U1714]` |
| U1715 | S9 fails `S9.stamp-advice` when a harness whose step is a clear gets no clear advice, and when the stamp command fails | US6.4, US6.5, FR-024 | example | DONE | `tools/conformance/scenarios/scenarios.test.ts::[U1715]` |
| U1716 | S9 fails `S9.tools-after-step` when the late stamp never arrives | US6.4, FR-024 | example | DONE | `tools/conformance/scenarios/scenarios.test.ts::[U1716]` |
| U1717 | The committed `conformance/known-gaps.json` has no entry, and `loadGaps` returns an empty list | US6.6, FR-025 | example | DONE | `tools/conformance/gaps.test.ts::[U1717]` |
| U1718 | A gap entry that now passes still fails the run as stale | FR-025 | characterization | DONE | `tools/conformance/verdict.test.ts::[U1305]`, `test/acceptance/conformance-gaps.test.ts::[A1309]` (existing, unchanged) |

### `src/validator/agent.ts`: the shell read (found by tdd.verify, mutant M17; tests in `src/validator/agent.shell.test.ts`)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1722 | The provider states that the preflight reads for the validator agent are the host's own, not the server's | US4.7, FR-017 | example | PENDING | |
| U1723 | `READ_SCRIPT` run by a real `sh` prints the configuration file and exits 0 when the file exists | US4.1, FR-016 | example | DONE | `src/validator/agent.shell.test.ts::[U1723]` |
| U1724 | `READ_SCRIPT` run by a real `sh` exits 3 and prints nothing when the file does not exist | US4.4, FR-016 | example | DONE | `src/validator/agent.shell.test.ts::[U1724]` |
| U1725 | `READ_SCRIPT` reads `$NM_HOME/config.yaml` when `NM_HOME` is set, and `$HOME/.no-mistakes/config.yaml` when it is not | FR-016 | example | DONE | `src/validator/agent.shell.test.ts::[U1725]` |
| U1726 | `READ_SCRIPT` writes and changes nothing in the home directory or in the no-mistakes directory | US4.11, FR-015 | example | DONE | `src/validator/agent.shell.test.ts::[U1726]` |

### Acceptance gaps found by tdd.verify

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| A1621 | The registered command `supervisor start` with no `--profile` spawns the profile that `roles.supervisor.profile` names | US2.1, FR-004 | example | PENDING | |
| A1622 | The thread ID that `startedThreadId` reads from the real command's output is the ID of the thread that the command spawned | US1.1, FR-008, FR-024 | example | PENDING | |

### `tools/conformance/wait.ts` (found by the first live Pi run; tests in `tools/conformance/wait.test.ts`)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1720 | `waitUntil` returns true as soon as a read says so, sleeping the delay between reads and not before the first | US6.8, FR-026 | example | DONE | `tools/conformance/wait.test.ts::[U1720]` |
| U1721 | `waitUntil` returns false after the attempts run out, having read once per attempt and slept between them, and a read that throws counts as not yet | US6.8, FR-026 | example | DONE | `tools/conformance/wait.test.ts::[U1721]` |

## Invariants and edge cases still to place

- A thread ID that is the word `start` cannot be stamped with the old command. This is the documented effect of the routing in U1642, and no test pins it beyond U1642.
- A hand-off for a task whose `handoff` event already happened never rewrites old evidence (US4, edge case). The event log is append-only, and the existing log tests cover it.

## Out of scope

- Tier 2 runs and any credential: no worker handles a credential.
- The docs rewrite (report task H9): only text that this change makes wrong is corrected, and checked by reading in `checklist.md`.
- The optional tool hint (report task H14).
- Writing no-mistakes configuration, and the `inherit` and `set` validator modes: the schema refuses them (U1617).
- Per-role `serviceTier` and session `options`.
- Choosing a machine other than the default host for a supervisor.
- A real YAML parser: the reader handles the one key in three shapes and refuses the rest (U1665).
- Mutation tooling: the profile has none, so `/speckit.tdd.verify` uses deliberate mutants.

## Verification commands

Copied verbatim from `.specify/memory/tdd-profile.md` at planning time:

- Single test: `pnpm vitest run {file} -t "{name}"`
- File: `pnpm vitest run {file}`
- Full suite: `pnpm test`
- Acceptance: `pnpm vitest run {file}`
- Coverage: none (`@vitest/coverage-v8` is not installed)
- Mutation: none (StrykerJS is not installed); deliberate mutants are used instead
- Combined gate: `pnpm run check`
