# Feature specification: Extension surface

**Feature branch**: `fm/bb-factoryman-milestones-7-11`

**Created**: 2026-11-07

**Status**: Approved (scope fixed by the captain's intent for this task)

**Input**: Milestone 9 of `docs/DESIGN.md`: "Load workflow config from `.bb/factoryman/`, stamp thread metadata, and publish the versioned read RPC. Done when a test plugin reads tasks and events through `callRpc` and can't trigger a transition, and a config that tries to remove a gate is rejected."

## User scenarios and testing

The people who use this feature are the owner and bb agents that write the project's workflow config, and sibling plugins that read the plugin's state.
The feature has no screen.
Its real entry points are `.bb/factoryman/workflow.json`, the `factoryman_dispatch` and `factoryman_report` tools, the worker thread's plugin metadata, and the plugin's RPC methods, all reached through the bb fake plugin host.
The bb facts it depends on are spike items 9, 10, and the `.bb/factoryman/` loading note in `spike/RESULTS.md`.

### User story 1 - Load workflow config and fail closed (priority P1)

**Acceptance scenarios**:

1. **Given** no `workflow.json`, **Then** dispatch and report behave as before. (AC-1.1)
2. **Given** a `workflow.json` that is not valid JSON or fails the schema, **When** the supervisor dispatches or a worker reports done, **Then** the call is blocked with the reason, and no default replaces the file. (AC-1.2)
3. **Given** `project.branchPrefix` or `project.defaultMachine` in the file, **When** the stored project config leaves them empty, **Then** the file fills them. A value that the store holds wins. (AC-1.3)
4. **Given** `project.deliveryMode` in the file, **Then** it applies only if it is at least as strict as the stored mode (`no-mistakes`, then `direct-PR`, then `local-only`). A looser mode blocks. (AC-1.4)

### User story 2 - Reject any config that removes a gate (priority P1)

Hard rule 7.

**Acceptance scenarios**:

1. **Given** a file that sets `yolo`, `gates`, `skip`, `approval`, or a similar key, **Then** loading fails with a message that says config can add checks and never remove a gate. (AC-2.1)
2. **Given** a file that sets `project.baseBranch`, **Then** loading fails, because the base branch decides the landed-work check. (AC-2.2)
3. **Given** any other unknown key, **Then** loading fails. (AC-2.3)

### User story 3 - Run custom checks before review (priority P1)

**Acceptance scenarios**:

1. **Given** checks for the task's delivery mode, **When** the worker reports done, **Then** the plugin runs each check in the worker's worktree, on the worker's machine, and records the results in the `handoff` or `ready` event. (AC-3.1)
2. **Given** a check that fails, **Then** the state machine refuses the event with `check_failed`, the task stays `working`, the refusal is logged, and the worker sees the failing checks and their output. (AC-3.2)
3. **Given** all checks pass, **Then** the other gates still apply (for example, evidence is still required). (AC-3.3)
4. **Given** a check that cannot run, **Then** it counts as failed. (AC-3.4)
5. **Given** a scout task, **Then** no check runs. (AC-3.5)

### User story 4 - Stamp thread metadata (priority P2)

**Acceptance scenarios**:

1. **Given** a worker thread, **When** its task's state changes, **Then** the thread's plugin metadata holds `taskId`, `kind`, `mode`, `state`, and `machine`, and keeps `role`. (AC-4.1)
2. **Given** bb fails the metadata write, **Then** the transition stands and the plugin logs a warning. (AC-4.2)

### User story 5 - Publish a versioned read RPC (priority P1)

**Acceptance scenarios**:

1. **Given** a sibling plugin, **When** it calls `listTasks`, `getTask`, and `listEvents` with `since`, **Then** it reads rows that match the store, each answer carries `apiVersion: 1`, and `apiVersion` answers the version. (AC-5.1)
2. **Given** the same plugin, **When** it calls any method that would change state, **Then** the call fails and the event log is unchanged. The plugin registers no method that writes. (AC-5.2)
3. **Given** the registered methods, **Then** each is marked discoverable with a description. (AC-5.3)

### Edge cases

- A check's command is not found: it counts as failed.
- A project with no checkout: the file is absent, so the config is empty.
- `listEvents` with `since` returns only rows after that sequence number, up to a limit.

## Requirements

- **FR-901**: The plugin MUST read `<checkout>/.bb/factoryman/workflow.json` with a strict `zod` schema, and an absent file MUST give the empty config.
- **FR-902**: An unreadable or invalid file MUST block the calls that need it, and nothing MUST replace it.
- **FR-903**: The file MUST NOT carry a key that loosens a gate. The schema MUST reject `yolo`, `baseBranch`, and every unknown key, and MUST name hard rule 7 for the gate-like keys.
- **FR-904**: `project.deliveryMode` MUST apply only when it is at least as strict as the stored mode. `branchPrefix` and `defaultMachine` MUST fill only a blank stored value.
- **FR-905**: The `handoff` and `ready` events MUST accept `checks: [{ name, passed }]`, and a guard MUST refuse the event when any check has `passed: false`.
- **FR-906**: The report tool MUST run the configured checks of the task's delivery mode before it sends `handoff` or `ready`, in the worktree and on the machine of the task, with no shell.
- **FR-907**: A check that returns a non-zero code, times out, or cannot run MUST count as failed.
- **FR-908**: The plugin MUST stamp the worker thread's metadata after each applied event, and a failed write MUST NOT undo the event.
- **FR-909**: The plugin MUST register the RPC methods `apiVersion`, `listTasks`, `getTask`, and `listEvents`, each discoverable, each returning `apiVersion: 1` in its answer, and no method that writes.
- **FR-910**: `src/machine/` MUST gain only the event field, the guard, and the reason code, and MUST NOT import bb.

## Success criteria

- **SC-901**: A test plugin reads tasks and events through `callRpc` and no call changes the log.
- **SC-902**: A config that tries to remove a gate is rejected for each key in the list.
- **SC-903**: The suite, type check, and lint pass.

## Assumptions

- The workflow file lives in the server's checkout (D-062).
- Checks run with the privileges of the plugin process, like the worker's own shell on that machine (D-079).
