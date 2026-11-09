# Feature specification: Supervisor start command, role advice, and the dispatch roles block

**Feature branch**: `fm/bb-factoryman-supervisor-profile-validator-observe`

**Created**: 2026-11-09

**Status**: Approved (scope fixed by the captain's intent, decision D4 option B, and the Firstmate spec for this task)

**Input**: The captain decided D4 of the harness-independence report (option B) and said "go with the recommendations; continue development".
The report is `data/bb-factoryman-harness-independence/report.md` in the firstmate home, sections 6.1, 6.2, 7 (tasks H4 and H12), and 8 (decision D4).
Option B keeps today's split of who picks each role's harness: the plugin picks the worker's, a person picks the supervisor's, and no-mistakes picks the validator's.
It adds two things.
First, a `bb factoryman supervisor start --profile` command, so the plugin spawns the supervisor with its role seeded at the first session, plus advice after `supervisor <thread>` for providers whose role change needs a clear.
Second, a `roles` block in the dispatch schema (supervisor profile, validator observe), so the plugin observes and readiness-checks the validator's agent and never writes it.

## User scenarios and testing

The people who use this feature are the owner, who starts and stamps supervisor threads, and the maintainer, who runs `pnpm run conformance` and reads `docs/HARNESS-SUPPORT.md`.
The feature has no screen.
Its real entry points are the `bb factoryman` command line, the `factoryman_report` tool (a worker's hand-off), `bb factoryman preflight`, and `pnpm run conformance`.

### User story 1 - Start a supervisor that has its role from the first session (priority: P1)

The owner runs `bb factoryman supervisor start --project <id> --profile <name>`.
The plugin spawns the supervisor thread itself and seeds the role in the thread's plugin metadata at spawn.
The supervisor's first turn already offers the four supervisor tools and the `factoryman-supervisor` skill, on every supported harness.

**Why this priority**: On Codex the tools appear only after `bb thread clear`, and on omp the skill does too.
A thread that a person created and stamped late is wrong on its first turns, and the owner has no signal that it is wrong.
Seeding the role at spawn removes the trap instead of documenting it.

**Independent test**: Run the command against the fake bb, then read the spawn request.
Run scenario S9 at tier 1.5 and read what the harness's model was offered on its first request.

**Acceptance scenarios**:

1. **Given** a project whose `dispatch.json` defines the profile `claude` and a ready provider, **When** the owner runs `supervisor start --project p --profile claude`, **Then** one thread is spawned with the profile's provider, model, reasoning level, and permission mode, with the plugin metadata `role: supervisor`, and the command prints the new thread's ID.
2. **Given** the spawned thread, **When** its first turn runs on Claude Code, Codex, Pi, or omp, **Then** the model is offered the four supervisor tools and the `factoryman-supervisor` skill on that first turn, and no worker tool.
3. **Given** `--prompt "<text>"`, **When** the command spawns the thread, **Then** the thread's first prompt is that text.
4. **Given** no `--prompt`, **When** the command spawns the thread, **Then** the first prompt is a fixed default that tells the supervisor to wait for instructions.
5. **Given** a profile whose provider is not ready on the host, whose permission mode the provider does not offer, or whose model or reasoning level the provider does not list, **When** the command runs, **Then** it refuses with the same reason that dispatch gives, and nothing is spawned.
6. **Given** a Pi profile in a `local-only` project, **When** the command runs, **Then** it is not refused for admission, because the admission rule confines workers and a supervisor is not a worker.

### User story 2 - Choose the supervisor's profile once, in the project's dispatch file (priority: P1)

The owner writes `roles.supervisor.profile` in `.bb/factoryman/dispatch.json`.
`supervisor start` then needs no `--profile`.
A `--profile` flag on the command overrides the file for that one start.

**Why this priority**: The supervisor's harness is the owner's choice.
The file is where the project already records harness choices, and a second place to look would split them.

**Independent test**: Parse files with and without a `roles` block and run the command with and without the flag.

**Acceptance scenarios**:

1. **Given** a file with `roles.supervisor.profile: "codex"` and a defined profile `codex`, **When** the owner runs `supervisor start --project p`, **Then** the thread is spawned with the `codex` profile.
2. **Given** that file, **When** the owner runs `supervisor start --project p --profile claude`, **Then** the `claude` profile is used and the file's choice is ignored for this start.
3. **Given** neither a flag nor a `roles.supervisor.profile`, **When** the owner runs the command, **Then** it refuses, names both ways to choose a profile, and spawns nothing.
   It does not use the file's `default` profile, because that profile is the worker's.
4. **Given** a `--profile` or a `roles.supervisor.profile` that names no defined profile, **When** the command runs, **Then** it refuses, lists the defined profile names, and spawns nothing.
5. **Given** a `roles.supervisor.profile` that names no defined profile, **When** the file is loaded, **Then** the file is invalid with a message that names the profile, as a bad `default` is today.
6. **Given** a version 1 file with no `roles` block, **When** it is loaded, **Then** it is valid and behaves as it does today.
7. **Given** a project with no `dispatch.json`, an unreadable one, or an invalid one, **When** the command runs, **Then** it refuses with the reason and spawns nothing.

### User story 3 - Know what to do after stamping an existing thread (priority: P1)

The owner already has a supervisor thread and runs `bb factoryman supervisor <thread>`.
The plugin stamps the role as it does today, then prints advice that matches the thread's provider.
For a provider whose contract says a role change needs a clear, the advice tells the owner to run `bb thread clear <thread>`.
For a provider whose contract says the role arrives at the next turn, the advice says so.

**Why this priority**: The current message says the tools arrive "from its next session".
That is wrong for Codex, where the tools stay missing until a clear, and wrong for omp, where the skill does.
The owner then waits for tools that never come.

**Independent test**: Stamp a thread of each provider in the fake bb and read the output.
Run scenario S9 at tier 1.5 and read the stamp text for Codex and omp.

**Acceptance scenarios**:

1. **Given** a thread whose provider has `roleChange: "clear"` (Codex and `acp-omp`), **When** the owner stamps it, **Then** the output names the thread, says the role is stamped, and tells the owner to run `bb thread clear <thread>` for the tools and the skill to appear.
2. **Given** a thread whose provider has `roleChange: "next-turn"` (Claude Code and Pi), **When** the owner stamps it, **Then** the output says the tools arrive at the next turn and does not tell the owner to clear.
3. **Given** a thread whose provider has no contract row, or whose provider the plugin cannot read, **When** the owner stamps it, **Then** the output gives the clear advice, because the generic contract row says `clear` and the safe advice is the one that works for every harness.
4. **Given** any stamp, **When** the output is read, **Then** it never says "from its next session".
5. **Given** a recorded worker thread, **When** the owner stamps it, **Then** the command refuses and stamps nothing, as today.
6. **Given** a stamp that bb rejects, **When** the command runs, **Then** it fails with bb's reason and prints no advice.

### User story 4 - See which agent the validator uses, and whether it is ready (priority: P1)

The plugin never chooses the validator's agent.
no-mistakes chooses it from its own configuration.
The plugin reads that choice, checks that the matching bb provider is ready on the host that runs the pipeline, and says both in the places the owner already looks.

**Why this priority**: A worker and the validator can run on different vendors with different sign-ins.
Today the plugin checks that no-mistakes is installed and initialized, and not that its agent can run.
The pipeline then fails late, with an error that the owner cannot trace to a missing sign-in.

**Independent test**: Run the preflight and a no-mistakes hand-off against the fake bb, with fake configuration text for the host, and read the report and the event evidence.

**Acceptance scenarios**:

1. **Given** a no-mistakes configuration with `agent: claude` and bb reporting `claude-code` ready on the host, **When** a worker hands off a no-mistakes ship task, **Then** the evidence of the event that moves the task into `validating` names the agent `claude`, its bb provider `claude-code`, and says it is ready.
2. **Given** `agent: codex` and bb reporting `codex` as `unauthenticated`, **When** the hand-off runs, **Then** the evidence names `codex` and says it is not ready, with bb's status and remedy, and the task still moves to `validating`.
3. **Given** `agent: [codex, grok]` (an ordered list), **When** the hand-off runs, **Then** the evidence names each agent in order with its readiness.
4. **Given** `agent: auto` or no `agent` line, **When** the hand-off runs, **Then** the evidence says that no-mistakes picks the first runnable agent when the run starts, and lists the bb providers that are ready on the host.
5. **Given** an agent that has no known bb provider, **When** the hand-off runs, **Then** the evidence names the agent and says its readiness was not checked.
   The evidence never calls such an agent ready.
6. **Given** a configuration file that is missing, unreadable, or not in the supported shape, or a read that fails, **When** the hand-off runs, **Then** the evidence says that the agent could not be observed and why, and never claims readiness.
7. **Given** a remote machine, **When** the observation runs, **Then** it reads the configuration and the provider states of that machine, not of the server.
8. **Given** `bb factoryman preflight <machine> --project <id>` for a remote machine and a `no-mistakes` project, **When** the validator's agent is not ready or cannot be observed, **Then** the report lists a `validator_agent` problem and the command exits 1.
   The host that holds the project's clone still gets no remote preflight, as today.
9. **Given** the same command and a ready agent, **When** the report is printed, **Then** it names the agent and says it is ready.
10. **Given** a project in `direct-PR` or `local-only` mode, **When** the preflight or a hand-off runs, **Then** no validator observation runs, because no pipeline runs.
11. **Given** any observation, **When** the commands that ran are listed, **Then** every one only reads.
    The plugin writes no no-mistakes configuration.

### User story 5 - Declare the validator role in the dispatch file (priority: P2)

The owner may write `roles.validator.agent: "observe"` in the dispatch file.
It is the default, and it is the only accepted value.

**Why this priority**: The report keeps `inherit` and `set` as options for the captain and not as part of the base design.
The file must refuse them now, with a reason, so no project can ask for a plugin that writes another tool's configuration.

**Independent test**: Parse files with each value.

**Acceptance scenarios**:

1. **Given** a file with no `roles.validator`, **When** it is loaded, **Then** the validator role is `observe`.
2. **Given** `roles.validator.agent: "observe"`, **When** it is loaded, **Then** the file is valid.
3. **Given** `roles.validator.agent: "inherit"` or `"set"` or any other value, **When** the file is loaded, **Then** the file is invalid, and the message names the field and the accepted value.
4. **Given** an unknown key inside `roles`, `roles.supervisor`, or `roles.validator`, **When** the file is loaded, **Then** the file is invalid, as an unknown key is invalid elsewhere in the file.

### User story 6 - Scenario S9 passes on all four harnesses (priority: P1)

The maintainer runs tier 1.5 for Claude Code, Codex, Pi, and omp, offline with no credential.
S9 passes on each, and the three S9 entries are gone from the known-gap list.

**Why this priority**: A real harness with a scripted model is the only proof that seeding the role at spawn reaches the model on the first turn.
The fake lab in the unit tests cannot show it.

**Independent test**: Run `pnpm run conformance -- --tier 1.5 --harness <id>` for each harness and read the S9 line.

**Acceptance scenarios**:

1. **Given** the final code, **When** tier 1.5 runs for each of the four harnesses, **Then** S9 is `pass` on each.
2. **Given** a supervisor started with `supervisor start`, **When** S9 reads what its model was offered on its first request, **Then** the four supervisor tools and the `factoryman-supervisor` skill are all present, and no clear or second prompt came first.
3. **Given** a thread with no role, **When** S9 reads its first request, **Then** it is offered no factoryman tool and no factoryman skill.
4. **Given** a thread stamped late, **When** the person takes the documented step (the next turn, or `bb thread clear` when the command's advice says so), **Then** the supervisor has its tools and its skill.
5. **Given** Codex and omp, **When** S9 reads the stamp command's text, **Then** it contains the clear advice.
6. **Given** `conformance/known-gaps.json`, **When** it is read, **Then** it lists no S9 entry, and no run reports a stale gap.
7. **Given** tier 1 (the stub agent), **When** it runs, **Then** S9 passes there too.
8. **Given** any of the five runs, **When** it ends, **Then** it exits 0, the isolation check is clean, and the tripwire records no event.

### User story 7 - The change is recorded and the repository stays tidy (priority: P2)

The owner reads `docs/DECISIONS.md`, the constitution, and the pull request description and finds what was decided and what was run.

**Why this priority**: The repository's rule is that every deviation and every decision is recorded, and that a verdict is reported with the run that produced it.

**Independent test**: Read the decision log, the constitution's version line, and the generated support document.

**Acceptance scenarios**:

1. **Given** `docs/DECISIONS.md`, **When** the new entries are read, **Then** they start at D-123, every number appears on one heading, and each entry gives the reason for its choice.
2. **Given** `.specify/memory/constitution.md`, **When** Principle VI is read, **Then** its scope line names H4 and H12, the version is bumped, and the amendment has a written reason in the decision log.
3. **Given** `docs/HARNESS-SUPPORT.md`, **When** it is regenerated from the result files, **Then** it shows S9 as `pass` for every harness and lists no known gap.
4. **Given** a full `pnpm run check`, **When** it ends, **Then** it adds no temporary directory to the system temporary directory, and every new test helper that makes a directory makes it under the test file's private `TMPDIR` and removes it.

### Edge cases

- The thread behind a stamp does not exist.
  bb rejects the metadata write, the command fails with bb's reason, and it prints no advice.
- The provider of a stamped thread cannot be read (bb answers with an error).
  The stamp still succeeds, and the output gives the generic clear advice and says that the provider was not read.
- `supervisor start` is run with both `--profile` and a `roles.supervisor.profile` that differ.
  The flag wins and the file is not consulted for the name.
- `supervisor start` is run in a project whose `dispatch.json` is valid but has no profiles.
  It refuses, because there is no profile to name.
- The spawn call fails after the gate passes.
  The command exits non-zero with bb's reason, and no metadata or task is recorded.
- The `agent` line of the no-mistakes configuration is commented out, indented, or has a trailing comment.
  Only a top-level `agent` key counts, and a trailing comment is not part of the value.
- The `agent` list is written in block form (`agent:` followed by `- codex` lines) instead of flow form.
  Both forms are read.
- `NM_HOME` is set on the host.
  The observation reads `$NM_HOME/config.yaml`, and otherwise `$HOME/.no-mistakes/config.yaml`.
- The observation's read hangs or the host is unreachable.
  The read is bounded to 30 seconds, the evidence says the agent could not be observed, and the hand-off goes on.
- A no-mistakes project's hand-off records its evidence while bb cannot list the provider states.
  The evidence says that readiness could not be read, and never claims `ready`.
- A task whose hand-off already happened.
  The evidence of past events is never rewritten.

## Requirements

### Functional requirements

- **FR-001**: The plugin MUST provide `bb factoryman supervisor start --project <id> [--profile <name>] [--prompt <text>]`, and `--project` MUST fall back to the project that bb names in the command context.
- **FR-002**: The command MUST spawn the supervisor thread with the plugin metadata `role: supervisor` set in the spawn call, not in a later write.
- **FR-003**: The command MUST take the provider, model, reasoning level, and permission mode of the spawn from the chosen profile, and MUST NOT accept an override of any of them.
- **FR-004**: The profile name MUST come from `--profile` first, then from `roles.supervisor.profile`.
  With neither, or with a name that is not a defined profile, the command MUST refuse and MUST spawn nothing.
  It MUST NOT use `default`.
- **FR-005**: Before it spawns, the command MUST apply the readiness, permission mode, model, and reasoning level checks that dispatch applies to a worker profile (R1 to R4), on the project's default host, and it MUST refuse with the same reasons.
  It MUST NOT apply the worker admission rule.
- **FR-006**: The command MUST read the project's `dispatch.json` through the existing loader, and MUST refuse when the file is missing, unreadable, or invalid.
- **FR-007**: The command MUST spawn the thread in the same kind of environment as a worker (a managed worktree off the project's default branch on the project's default host), with no parent thread.
- **FR-008**: On success the command MUST print the new thread's ID, the profile name, and the provider, and MUST exit 0.
  On any refusal or failure it MUST print the reason, exit non-zero, and leave no thread behind.
- **FR-009**: `bb factoryman supervisor <thread>` MUST keep stamping `role: supervisor`, MUST keep refusing a recorded worker thread, and MUST read the thread's provider after a successful stamp.
- **FR-010**: After a successful stamp, the command MUST choose its advice from `contractFor(provider).roleChange`.
  For `clear` it MUST tell the owner to run `bb thread clear <thread>`.
  For `next-turn` it MUST say the tools arrive at the next turn.
  When the provider is unknown or unreadable it MUST give the `clear` advice.
- **FR-011**: No command output MUST contain the words "from its next session".
- **FR-012**: The dispatch schema MUST accept an optional `roles` block with an optional `supervisor.profile` and an optional `validator.agent`, MUST keep every key strict, and MUST keep a version 1 file without `roles` valid.
- **FR-013**: `roles.supervisor.profile` MUST name a defined profile, and the schema MUST reject a name that is not defined, with a message that names it.
- **FR-014**: `roles.validator.agent` MUST accept only `"observe"`, and the parsed config MUST carry `observe` when the field is absent.
  The schema MUST reject `inherit`, `set`, and every other value.
- **FR-015**: The plugin MUST NOT write, create, or change any no-mistakes configuration, on the server or on a remote machine.
  Every command the observation runs MUST only read.
- **FR-016**: For a `no-mistakes` ship task, the observation MUST read the `agent` setting of no-mistakes' own configuration on the host that runs the pipeline, as a scalar or an ordered list, with `auto` allowed and an absent setting read as `auto`.
- **FR-017**: The observation MUST map each named agent to its bb provider ID, MUST read bb's provider state for that provider on the same host, and MUST report each agent as ready only when bb reports its provider `ready`.
- **FR-018**: For `auto`, the observation MUST report that no-mistakes picks the first runnable agent at run time, and MUST list the bb providers that are ready on the host.
- **FR-019**: For an agent with no known bb provider, the observation MUST report that readiness was not checked.
  It MUST NOT report such an agent as ready.
- **FR-020**: When the configuration cannot be read or parsed, or a bb read fails, the observation MUST report that the agent could not be observed and why, MUST NOT claim readiness, and MUST NOT throw.
- **FR-021**: The evidence of the event that moves a `no-mistakes` ship task into `validating` MUST include a line that names the validator's agent and its readiness, after the worker's own evidence.
  The observation result MUST NOT block or refuse the hand-off, and its configuration read MUST stop after 30 seconds.
- **FR-022**: `bb factoryman preflight` MUST, for a `no-mistakes` project, add a `validator_agent` problem when the agent is not ready or cannot be observed, and MUST name the agent and its readiness in the report when it is ready.
  For the other two delivery modes it MUST run no validator observation.
- **FR-023**: The dispatch preflight on a remote machine MUST include the same validator check, so a dispatch to a machine whose validator agent is not ready is refused with `preflight_failed`, as any other preflight problem is.
- **FR-024**: Scenario S9 MUST check that a supervisor started by `supervisor start` is offered its four tools and its skill on its first request, with no clear before it, and MUST check that a thread without a role is offered none.
  It MUST keep its checks of the stamp advice and of the tools after the documented step.
- **FR-025**: `conformance/known-gaps.json` MUST list no S9 entry, and the gap mechanism MUST keep failing a run that lists a gap that now passes.
- **FR-026**: The result files in `conformance/results/` and `docs/HARNESS-SUPPORT.md` MUST come from a real run of the final code at tier 1 and at tier 1.5 for the four harnesses, offline, with no credential.
- **FR-027**: Every decision this feature takes, and every deviation from the report or the design, MUST be recorded in `docs/DECISIONS.md` from D-123 on.
  The constitution's Principle VI scope line MUST name H4 and H12, and the version MUST be bumped.
- **FR-028**: New test helpers MUST make their temporary directories under the test file's private `TMPDIR` and MUST remove them, so a full `pnpm run check` adds no directory to the system temporary directory.
- **FR-029**: The change MUST keep the eight hard rules of `CLAUDE.md`.
  In particular, no path may fail open, and `src/machine/` MUST NOT import bb.

### Key entities

- **Supervisor start request**: The project ID, the chosen profile name, and the first prompt.
- **Roles block**: The optional `roles` object of `dispatch.json`, with the supervisor's profile name and the validator's mode.
- **Harness contract**: One row of `src/harness/contracts.ts`, read here for its `roleChange` value.
- **Validator agent observation**: The agents that no-mistakes' configuration names on a host, each with its bb provider ID and its readiness, or the reason it could not be observed.
- **Known gap**: An entry of `conformance/known-gaps.json` that excuses one failing check until a named report task closes it.

## Success criteria

### Measurable outcomes

- **SC-001**: Scenario S9 is `pass` at tier 1.5 for all four harnesses and at tier 1, where today it is a known gap.
- **SC-002**: On every harness, a supervisor started by the command is offered 4 of 4 supervisor tools and its skill on its first request.
- **SC-003**: The stamp output contains `bb thread clear` for 100 percent of `clear` providers (Codex and omp) and for 0 percent of `next-turn` providers (Claude Code and Pi), and no output contains "from its next session".
- **SC-004**: `conformance/known-gaps.json` lists 0 entries, and `docs/HARNESS-SUPPORT.md` lists 0 known gaps.
- **SC-005**: Every `validating` event of a `no-mistakes` ship task in the tests carries a validator line, and 0 tests find a case where an unreadable or unchecked agent is reported as ready.
- **SC-006**: Across every observation test, the number of commands that write to no-mistakes configuration is 0.
- **SC-007**: A refused `supervisor start` (no profile, undefined profile, not ready, invalid file) spawns 0 threads in every test.
- **SC-008**: The five conformance runs (tier 1, and tier 1.5 for the four harnesses) all exit 0, with a clean isolation check.
- **SC-009**: `pnpm run check` passes with no new lint or type error, and adds 0 directories to the system temporary directory.

## Assumptions

- The supervisor is the owner's thread, and the owner may keep creating and stamping threads by hand.
  `supervisor start` is an addition, and `supervisor <thread>` stays.
- The supervisor runs on the project's default host, in a managed worktree off the default branch, as the conformance lab and the live-check guide already spawn it.
  Choosing another machine for a supervisor is not part of this feature.
- The role stamp that `supervisor start` seeds at spawn behaves as the report observed for workers: all four harnesses showed their role tools on the first turn.
  The tier 1.5 run is what confirms it for supervisors, and a contradicting result is recorded as a conflict and not hidden.
- no-mistakes keeps the agent setting in its global configuration (`$NM_HOME/config.yaml`, default `~/.no-mistakes/config.yaml`) as a top-level `agent` key whose value is a name or an ordered list.
  The binary's own error text tells the owner to set `agent` there.
  The installed version (1.84.0) is the one these shapes were read from.
- The agent names that map to a bb provider are `claude` to `claude-code`, `codex` to `codex`, `pi` to `pi`, and `acp:omp` to `acp-omp`, from the report's matrix (row "no-mistakes agent").
  Other names map to the bb provider of the same ACP agent when bb ships one (`opencode`, `grok`, `cursor`), and otherwise to none.
- A not-ready validator agent is information at hand-off and a problem at preflight.
  The hand-off is not refused, because the worker cannot fix the validator's sign-in, and because the pipeline reports its own failure through the existing validation driver.
- The observation runs through the plugin's existing command runner, which already routes a command to the right host, so a remote machine needs no new channel.
- bb 0.49.0 and the CLI versions of the live check (Claude Code 2.1.316, Codex 0.166.0, Pi 1.4.0, omp) are installed, and the pinned bb in the lab matches.

## Out of scope

- Tier 2 runs and any credential.
- The docs rewrite (report task H9), except for text that this change makes wrong.
- The optional tool hint in the worker prompt (report task H14).
- Writing, creating, or changing no-mistakes' own agent configuration, and the `inherit` and `set` validator modes.
- Per-role `serviceTier` and session `options`.
- Choosing a machine other than the default host for a supervisor.
- Changing which harness a worker uses, or any dispatch rule.
