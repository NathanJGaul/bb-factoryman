# Feature specification: Conformance harness for agent harnesses

**Feature branch**: `fm/bb-factoryman-conformance-harness`

**Created**: 2026-11-08

**Status**: Approved (scope fixed by the captain's intent and the Firstmate spec for this task)

**Input**: The harness-independence scout report (`data/bb-factoryman-harness-independence/report.md` in the firstmate home, sections 5 to 8 and the appendices) found that bb-factoryman is not tied to Claude Code in its code, but nothing proves that any other harness works.
The captain accepted all five recommendations in section 8 of the report, including D1 option A: a harness is supported when it passes tier 1.5 (the real harness command-line tool with a scripted fake model and no credential), and, once, tier 2 (a real model, funded by the captain).
This feature builds the missing rungs below tier 2.
It covers report tasks H6 (promote the stub agent and the lab scripts, add the conformance runner at tier 1), H8 (offline lab), and H7 (fake model server, per-harness drivers, tier 1.5 for Claude Code, Codex, Pi, and omp, generated support document).
Report tasks H1 to H5 and H9 to H14, every tier 2 run, and all credential handling are out of scope.

## User scenarios and testing

The people who use this feature are the maintainer, who changes the plugin or upgrades a harness or bb and needs to know what still works, and the owner, who reads the support statement before choosing a harness.
The feature has no screen.
Its real entry points are `pnpm run conformance` (with `--tier` and `--harness`), the lab launcher `tools/bblab/bblab`, and the generated `docs/HARNESS-SUPPORT.md`.
The bb facts it depends on are the provider abstraction, the plugin install path, `bb thread` commands, and `bb.sdk.system.providerStates()` (report sections 3 and 5).

Tier 1 uses the stub agent as the brain.
Tier 1.5 uses the real harness CLI and a fake model server as the brain.
Assertions look at plugin events and bb state, never at model text, so the same assertions hold for every brain.

### User story 1 - Run the plugin's scenarios against the stub (priority: P1)

The maintainer runs one command in a clean checkout and gets a verdict for each scenario S1 to S12.

**Why this priority**: Tier 1 proves the plugin is correct, and every other claim depends on it.
It is also the only tier that runs on every change.

**Independent test**: Run `pnpm run conformance -- --tier 1` in a fresh checkout that has `bblab` and a pinned bb, and read the verdict table.

**Acceptance scenarios**:

1. **Given** a clean checkout, **When** the maintainer runs `pnpm run conformance -- --tier 1`, **Then** the runner builds the plugin, starts a lab, installs the plugin, registers the stub agent, runs S1 to S12, stops the lab, and prints one verdict per scenario.
   (AC-1.1)
2. **Given** a run, **Then** each verdict is `pass`, `fail`, `known-gap`, or `skipped`, and the exit code is 0 only when no scenario is `fail`.
   (AC-1.2)
3. **Given** the scenarios, **Then** each one asserts on the plugin's recorded events, the task rows, the thread rows in bb, the git state of the clone, and the processes in the lab, and none asserts on model text.
   (AC-1.3)
4. **Given** a run, **Then** it writes a result file that names the tier, the harness, the CLI version, the bb version, the plugin commit, the time, and every verdict with its evidence.
   (AC-1.4)
5. **Given** any outcome, including a crash, **Then** the lab is stopped, the isolation check (`bblab-evidence`) shows no change to the real home, and a change makes the run fail.
   (AC-1.5)
6. **Given** the repository, **Then** the stub agent lives in `tools/stub-agent` and the lab scripts live in `tools/bblab`, and the runner uses those copies and not a copy on the machine's `PATH`.
   (AC-1.6)

### User story 2 - A plugin gap is a visible gap, never a pass (priority: P1)

Some scenarios cannot pass today because the plugin lacks a capability that report tasks H1 to H5 will add.
The maintainer needs the suite to say so, and to say which task closes the gap.

**Why this priority**: The scenarios come from the report and are written to the target behavior.
Hiding a failing scenario would make the suite lie, and failing the whole run on a known gap would make the suite useless until H1 to H5 land.

**Independent test**: Run the runner with a scenario that fails and is listed as a known gap, then with the same scenario passing.

**Acceptance scenarios**:

1. **Given** a scenario that fails and is listed in the known-gap list with the report task that closes it, **Then** its verdict is `known-gap`, the output names the task and the failure, and the run does not fail on it.
   (AC-2.1)
2. **Given** a scenario that passes and is listed in the known-gap list, **Then** the run fails and tells the maintainer to remove the entry.
   (AC-2.2)
3. **Given** a scenario that fails and is not listed, **Then** its verdict is `fail` and the run fails.
   (AC-2.3)
4. **Given** a known gap, **Then** the generated support document shows it as a gap with its task and never as a pass.
   (AC-2.4)

### User story 3 - Run a real harness against a fake model (priority: P1)

The maintainer runs the same scenarios with the real Claude Code, Codex, Pi, or omp command-line tool as the brain's host, and a scripted fake model behind it.
No credential is involved.

**Why this priority**: Tier 1.5 is the claim of support under D1 A.
It proves that spawn, tool delivery, skill delivery, role confinement, report, wake, and failure work on that harness.

**Independent test**: Run `pnpm run conformance -- --tier 1.5 --harness pi` and check that the verdicts for S1 to S9, S11, and S12 are present and that no scenario failed.

**Acceptance scenarios**:

1. **Given** a harness id of `claude-code`, `codex`, `pi`, or `omp`, **When** the maintainer runs `pnpm run conformance -- --tier 1.5 --harness <id>`, **Then** the runner starts the lab with that CLI bound read-only, writes the harness's own configuration into the lab home so the CLI talks to the fake model, and dispatches tasks with a profile for that harness.
   (AC-3.1)
2. **Given** the run, **Then** it runs S1 to S9, S11, and S12, marks S10 `skipped` for the tier, and never reads or writes a real credential, the real home, or the real harness configuration.
   (AC-3.2)
3. **Given** a scout task, **Then** the harness's model sees the report tool through that harness's own route (a plain function for Codex and Pi, a deferred tool found with `ToolSearch` for Claude Code, a device written through `write` for omp), calls it, and the task reaches `report_ready`.
   (AC-3.3)
4. **Given** a ship task in `local-only` mode, **Then** the harness's model runs a real `git commit` through that harness's own shell tool, reports the commit count, and the task reaches `review_ready` with `landedCommits` equal to the commits on the branch.
   (AC-3.4)
5. **Given** a harness id that has no driver, **Then** the runner refuses with the list of known ids and starts no lab.
   (AC-3.5)
6. **Given** a harness whose CLI is not installed on the machine, **Then** the runner reports that the harness cannot run and does not record a pass.
   (AC-3.6)

### User story 4 - A fake model serves every harness's wire format (priority: P1)

The fake model server answers the three request formats that the four harnesses use, and follows a script that comes from the task, so the same server drives every scenario.

**Why this priority**: Without it no harness can run without a credential.

**Independent test**: Send a recorded request of each format to the server and check the shape of each answer, then run the server behind each harness.

**Acceptance scenarios**:

1. **Given** an OpenAI chat completions request (Pi, omp), an OpenAI Responses request (Codex), or an Anthropic Messages request (Claude Code), **Then** the server answers in that format, both streamed and, where the format has one, not streamed.
   (AC-4.1)
2. **Given** a task description that carries a behavior marker (for example a request to stay silent, to give empty evidence, to hold, to leave the worktree dirty, or to fail), **Then** the server plays that behavior.
   (AC-4.2)
3. **Given** every request, **Then** the server logs it, and the runner can read from the log which tools and skills the harness offered the model.
   (AC-4.3)
4. **Given** the server, **Then** it listens only on the loopback interface and needs no credential, and a request that carries a bearer value is never forwarded anywhere.
   (AC-4.4)

### User story 5 - The lab can run with no network (priority: P2)

The maintainer runs tier 1.5 with the lab's network switched off, so no harness can reach a vendor by accident.

**Why this priority**: The scout found that a Codex run without a credential sent an unauthenticated request to a vendor.
Tier 1.5 must not do that.

**Independent test**: Start the lab with `--offline`, ask for a connection to a non-loopback address from inside, and check that it fails while the loopback still works.

**Acceptance scenarios**:

1. **Given** `bblab up --offline`, **Then** the sandbox has a loopback interface only, and a connection from inside to any other address fails.
   (AC-5.1)
2. **Given** an offline lab, **Then** bb 0.49.0 starts, serves its API on the loopback, and accepts a plugin install, or the run records exactly what bb needs from the network.
   (AC-5.2)
3. **Given** the tier 1.5 run, **Then** it uses `--offline` by default, and a run that cannot start offline fails with the reason and does not retry online.
   (AC-5.3)
4. **Given** the lab without `--offline`, **Then** the lab behaves as before, with the network shared.
   (AC-5.4)

### User story 6 - The support statement is generated from evidence (priority: P2)

The owner opens `docs/HARNESS-SUPPORT.md` and sees, for each harness, which versions passed which scenarios.

**Why this priority**: D1 A says that a harness is supported only with a result file that names the CLI and bb versions it passed on.

**Independent test**: Generate the document from a set of result files and check that nothing in it is typed by hand.

**Acceptance scenarios**:

1. **Given** the result files, **When** the maintainer runs `pnpm run conformance:docs`, **Then** `docs/HARNESS-SUPPORT.md` is written from them and from nothing else.
   (AC-6.1)
2. **Given** the document, **Then** it lists each harness with its CLI version, the bb version, the plugin commit, the date, and a verdict for each scenario, and it shows a gap as a gap.
   (AC-6.2)
3. **Given** a harness with no result file, **Then** the document lists it as unsupported, with the reason that no tier 1.5 result exists.
   (AC-6.3)
4. **Given** the generated document and the result files, **Then** a test fails when the document is out of date.
   (AC-6.4)

### Edge cases

- The harness takes about 30 seconds to fail with a 401 (Codex).
  The failure scenario waits for the terminal event and does not assume a quick failure.
- A model-less turn ends with no report (S6).
  The task stays `working`, and the supervisor gets one wake and no more.
- The lab's ports are held by another lane's lab.
  The runner picks free ports and never uses a reserved bb port.
- `/tmp` is a small shared quota on this machine.
  The runner puts the lab and its scratch output under a directory the maintainer names, and refuses a lab directory under `firstmate`.
- The same scenario passes on one harness and is a known gap on another.
  The result file records the verdict per harness.
- The CLI version changes between two runs.
  The new result file replaces the old one for that harness and names the new version, and the document shows the version it passed on.
- A fake-model script drifts from a harness's tool route after a CLI upgrade.
  The affected scenario fails, and the maintainer fixes the driver and not the scenario.

## Requirements

- **FR-1301**: The repository MUST hold the stub agent in `tools/stub-agent` and the lab scripts (`bblab`, `bblab-evidence`) in `tools/bblab`, and the conformance runner MUST use them.
- **FR-1302**: `pnpm run conformance -- --tier 1` MUST run scenarios S1 to S12 against the stub agent and print a verdict per scenario.
- **FR-1303**: A verdict MUST be one of `pass`, `fail`, `known-gap`, or `skipped`, and the exit code MUST be 0 only when no scenario is `fail` and no known gap has started passing.
- **FR-1304**: The scenarios MUST be defined once and run at every tier.
  Only the brain and the tier set differ.
- **FR-1305**: The scenarios MUST be: S1 readiness, S2 profile honored, S3 scout, S4 ship in `local-only` mode, S5 confinement, S6 silence, S7 failure, S8 refusals, S9 role change, S10 restart, S11 teardown, and S12 wake while busy, with the assertions in section 6.3 of the report.
- **FR-1306**: Tier 1 MUST run S1 to S12.
  Tier 1.5 MUST run S1 to S9, S11, and S12, and mark S10 `skipped`.
- **FR-1307**: Assertions MUST read plugin events, plugin task rows, bb thread state, the clone's git state, and lab processes, and MUST NOT read model text.
- **FR-1308**: A known-gap list MUST map a scenario and a harness (or all harnesses) to the report task that closes the gap and to the reason.
  A scenario in the list that passes MUST fail the run.
- **FR-1309**: Every run MUST write a result file that names the tier, the harness, the CLI version, the bb version, the plugin commit, the start time, and each scenario's verdict and evidence.
- **FR-1310**: The runner MUST stop the lab on every exit path and MUST run the isolation check before and after, and MUST fail the run when the isolation check finds a change.
- **FR-1311**: The fake model server MUST serve OpenAI chat completions, OpenAI Responses, and Anthropic Messages, MUST follow a script that comes from the task, MUST log every request, and MUST listen on the loopback only.
- **FR-1312**: The runner MUST have one driver per harness (`claude-code`, `codex`, `pi`, `omp`) that binds the CLI into the lab read-only, writes the CLI's configuration into the lab home to point at the fake model, and names the profile and the tool route for the harness.
  Adding a harness MUST need one driver file and no change to a scenario.
- **FR-1313**: The runner MUST NOT read, write, create, or pass a real credential, and MUST NOT read or write the real home of any harness.
  Keys in a lab MUST be the literal `mock-not-a-credential`.
- **FR-1314**: `bblab up --offline` MUST start the sandbox with no network except the loopback, and tier 1.5 MUST use it by default.
- **FR-1315**: The feature MUST verify that a bb 0.49.0 server starts and installs the plugin with no network, and MUST record in `docs/DECISIONS.md` what bb needs if it does not.
- **FR-1316**: `pnpm run conformance:docs` MUST generate `docs/HARNESS-SUPPORT.md` from the result files, and a test MUST fail when the committed document differs from the generated one.
- **FR-1317**: The plugin's behavior MUST NOT change.
  The feature adds tools, tests, and documents, and the eight hard rules stay as they are.
- **FR-1318**: `docs/DECISIONS.md` MUST record each deviation from the report, including how known gaps are handled.

## Key entities

- **Scenario**: A named behavior (S1 to S12) with the tiers it runs at and an assertion that reads events and bb state.
- **Brain**: What plays the agent: the stub (tier 1), a real harness with the fake model (tier 1.5), or a real model (tier 2, out of scope).
- **Driver**: One file per harness that says how to put the CLI in the lab, how to point it at the fake model, and which profile and tool route to use.
- **Verdict**: The outcome of one scenario: `pass`, `fail`, `known-gap`, or `skipped`, with evidence.
- **Known gap**: A recorded reason that a scenario cannot pass yet, with the report task that closes it.
- **Result file**: The record of one run, which the support document is generated from.
- **Lab**: The isolated bb, plugin, and project created by `bblab` for a run.

## Success criteria

- **SC-1301**: `pnpm run conformance -- --tier 1` exits 0 in a clean checkout with `bblab`, and prints a verdict for all twelve scenarios.
- **SC-1302**: `pnpm run conformance -- --tier 1.5 --harness <id>` exits 0 for each of the four harnesses, and each result file shows S1 to S9, S11, and S12 as `pass` or `known-gap`, with every `known-gap` naming its report task.
- **SC-1303**: In every run, the isolation check shows no change to the real home, the shared no-mistakes daemon, or the firstmate tree.
- **SC-1304**: With the lab offline, the tier 1.5 runs make no connection to a non-loopback address.
- **SC-1305**: `docs/HARNESS-SUPPORT.md` is generated, lists all four harnesses with the CLI and bb versions they passed on, and a test fails when it is stale.
- **SC-1306**: A maintainer adds a fifth harness by writing one driver file and running one command.
- **SC-1307**: The suite, type check, lint, and `bb plugin build` pass, and no plugin source under `src/` changes behavior.

## Assumptions

- The maintainer has `bwrap` and the harness command-line tools installed on the machine.
  The runner binds those tools read-only into the lab and installs no copies.
- A pinned bb (0.49.0 at the time of the report) is installed into the lab directory by a documented step, because the bb on the `PATH` is older than the bb the owner runs.
- Tier 1 and tier 1.5 are run by a maintainer or by Firstmate on demand.
  They are not part of `pnpm test`, because they need `bwrap`, a bb build, and several minutes.
  The unit tests of the runner, the fake model server, the drivers' configuration, the known-gap logic, and the document generator run in `pnpm test`.
- Scenarios that need a plugin capability from report tasks H1 to H5 (the readiness gate H1, the cause-bearing failure evidence H3, the supervisor start command H4) are written to the target behavior and are `known-gap` until those tasks land.
  The feature does not build those capabilities.
- The scenarios S1 and S9 can check the states and commands that the lab can produce.
  For S1 the lab can produce `ready` and `not_installed` at tier 1 and `unauthenticated` where a CLI is bound with no login.
  `unsupported_version` needs a CLI shim and is exercised only if the shim is cheap.
- The model-behavior checks M1 to M4 and every tier 2 run are out of scope.
  The captain holds all credentials, and no worker receives one.
- The plugin's run directory, the stub's directives, and the report's fake model server are the starting point.
  Where the report's code is wrong or incomplete for a harness (for example the ship flow on Claude Code, Codex, and omp), the feature fixes it and records the change.
