# Feature specification: Machine placement

**Feature branch**: `fm/bb-factoryman-milestones-7-11`

**Created**: 2026-11-07

**Status**: Approved (scope fixed by the captain's intent for this task)

**Input**: Milestone 8 of `docs/DESIGN.md`: "Add the machine column to dispatch rules and tasks, spawn workers on the chosen machine, and add the remote preflight check. Done when tests show a task pinned to an offline machine goes blocked and wakes the supervisor, a `local-only` task refuses any machine but the one with the clone, and the preflight reports a missing gate install."

## User scenarios and testing

The people who use this feature are the supervisor, which dispatches workers onto machines, and the owner, who enrolls machines and writes the dispatch rules.
The feature has no screen.
Its real entry points are `factoryman_dispatch`, the `bb factoryman preflight` command, the thread and host events that the plugin listens to, and a background machine monitor, all loaded through the bb fake plugin host.
The bb facts it depends on are spike items 6, 7, and 8 in `spike/RESULTS.md`.

### User story 1 - Place a worker on a chosen machine (priority P1)

A task carries a machine.
The machine comes from the call, then the matching rule, then the project's default machine.
With none of the three, the worker runs on the project's default host, as before.

**Acceptance scenarios**:

1. **Given** an explicit `machine` on the call, **When** the supervisor dispatches, **Then** the worker spawns on that machine's host, and the task records the machine. (AC-1.1)
2. **Given** no explicit machine and a matching rule with a `machine`, **Then** the rule's machine applies. (AC-1.2)
3. **Given** neither, and a project default machine, **Then** the default applies. (AC-1.3)
4. **Given** none of the three, **Then** the worker spawns on the project's default host and the task records no machine. (AC-1.4)
5. **Given** a machine name that matches no machine, or matches two, **Then** dispatch is blocked and no task exists. (AC-1.5)
6. **Given** a machine with no source of the project on it, **Then** dispatch is blocked. (AC-1.6)
7. **Given** two matching rules with the same profile and different machines, **Then** the result is `ambiguous`. (AC-1.7)

### User story 2 - Never fall back from an offline machine (priority P1)

Hard rule 5: a task pinned to an offline machine goes blocked and never moves to another machine.

**Acceptance scenarios**:

1. **Given** a pinned machine that is offline at dispatch, **When** the supervisor dispatches, **Then** dispatch is blocked with `machine_offline`, no task exists, no other machine is tried, and the message names the machine. (AC-2.1)
2. **Given** a `working` task whose machine goes offline, **When** the monitor next reads the machines, **Then** the task becomes `blocked` with system evidence and the supervisor is woken. (AC-2.2)
3. **Given** that blocked task and the machine back online, **Then** the monitor returns the task to `working`. A task that its worker blocked is not touched. (AC-2.3)
4. **Given** a machine that bb deletes, **When** the `experimental_host.deleted` event arrives, **Then** each `working` task pinned there becomes `blocked`, and it is never unblocked. (AC-2.4)
5. **Given** a blocked task, **Then** no event changes its machine. (AC-2.5)
6. **Given** a task in another state on an offline machine, **Then** the monitor logs a warning and changes nothing. (AC-2.6)

### User story 3 - Keep `local-only` work on the clone's machine (priority P1)

Hard rule 6.

**Acceptance scenarios**:

1. **Given** a `local-only` project and a machine other than the host that holds the clone, **When** the supervisor dispatches, **Then** the `start` event is refused by the state machine, and the tool reports the refusal. (AC-3.1)
2. **Given** the machine equal to the clone host, **Then** dispatch succeeds. (AC-3.2)
3. **Given** a `local-only` task and no machine, **Then** it succeeds, and the worker runs on the clone host. (AC-3.3)

### User story 4 - Preflight a remote machine (priority P1)

**Acceptance scenarios**:

1. **Given** a remote machine whose agent CLI is not available, **When** the owner runs `bb factoryman preflight <machine>`, **Then** the report lists the failed check. (AC-4.1)
2. **Given** no-mistakes is missing on the machine, or not initialized in the project's source there, **Then** the report names the missing gate install. (AC-4.2)
3. **Given** `gh` has no credentials on the machine and the mode opens pull requests, **Then** the report names it. (AC-4.3)
4. **Given** a machine that fails any required check, **When** the supervisor dispatches to it, **Then** dispatch is blocked with the report, and no worker starts. (AC-4.4)
5. **Given** a machine that holds the clone (the default host), **Then** the preflight is skipped. (AC-4.5)

### User story 5 - Run gate commands where the worktree lives (priority P1)

**Acceptance scenarios**:

1. **Given** a task on a remote machine, **When** the validator or the teardown check runs a command, **Then** the command runs on that machine through a host terminal, and the plugin reads its exit code, standard output, and standard error. (AC-5.1)
2. **Given** a host terminal that fails, times out, or truncates output, **Then** the command fails closed, so teardown is refused. (AC-5.2)
3. **Given** a task with no machine, **Then** commands run on the server as before. (AC-5.3)

### Edge cases

- A host whose lifecycle phase is not `active` counts as offline.
- A machine given by name resolves to its ID before it is stored.
- A `local-only` task with a machine and no known clone host is refused.

## Requirements

- **FR-801**: The machine MUST come from the explicit value, the matching rule, the project default, or none, in that order.
- **FR-802**: A machine name MUST resolve to exactly one host ID, and the task MUST record the ID.
- **FR-803**: The dispatch tool MUST block when the host is unknown, ambiguous, offline, not active, or has no source of the project.
- **FR-804**: The dispatch tool MUST NOT try another machine after a block.
- **FR-805**: The `start` event MUST carry `cloneMachine`, and the state machine MUST refuse a `local-only` `start` whose `machine` is set and differs from `cloneMachine` or has no `cloneMachine`.
- **FR-806**: A background monitor MUST read `bb.sdk.hosts.list` on an interval, block `working` tasks on an offline host, wake the supervisor, and unblock only tasks that it blocked.
- **FR-807**: The plugin MUST handle `experimental_host.deleted` by blocking `working` tasks pinned to that host.
- **FR-808**: The preflight MUST check: host online, project source on the host, provider available on the host, `no-mistakes` installed and initialized (for `no-mistakes` mode), and `gh` credentials (for the two pull request modes).
- **FR-809**: A remote command runner MUST run argv on a host through `bb.sdk.terminals`, read the exit code and both streams, and fail closed on any error.
- **FR-810**: The validator, the worktree report, and the preflight MUST use the task's machine for their commands.
- **FR-811**: The rule's `machine` MUST count toward ambiguity (D-065).
- **FR-812**: The preflight command MUST be `bb factoryman preflight <machine>` and MUST change nothing.

## Success criteria

- **SC-801**: A task on an offline machine reaches `blocked` and the supervisor gets one wake message.
- **SC-802**: No test passes with a fallback to another machine.
- **SC-803**: The suite, type check, and lint pass.

## Assumptions

- The default host of the project is the host that holds the clone.
- A hosts poll every `machinePollSeconds` (default 30) is fast enough for the supervisor.
