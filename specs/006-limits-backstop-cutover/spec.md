# Feature specification: Limits, backstop, and cutover

**Feature branch**: `fm/bb-factoryman-milestones-7-11`

**Created**: 2026-11-07

**Status**: Approved (scope fixed by the captain's intent for this task)

**Input**: Milestone 10 of `docs/DESIGN.md`: "Add the worker and spend caps, the webhook notification, the branch-protection setup steps, and the firstmate registry import. Done when tests show a cap queues a task, an over-budget task is refused, an attention state posts to the webhook, and the import dry run reports every project's mode."
The captain's carried-over decisions say that the approval form is not proof of a human, so branch protection and scoped tokens are the backstop.
The brief limits the branch-protection work to documentation and a setup command that prints a checklist, and it makes the registry import a dry run that only reads.

## User scenarios and testing

The people who use this feature are the owner, who sets the limits and the webhook and runs the cutover, and the supervisor, who sees why a task waits or is refused.
The feature has no screen.
Its real entry points are `factoryman_dispatch`, `factoryman_status`, the worker lifecycle events, the plugin settings, `.bb/factoryman/workflow.json`, and two `bb factoryman` commands, all reached through the bb fake plugin host.
The bb facts it depends on are spike items 12 and 13 in `spike/RESULTS.md`, and the registry format is read from firstmate's `data/projects.md` and `bin/fm-project-mode.sh` header (read only).

### User story 1 - Cap running workers and queue the rest (priority P1)

**Acceptance scenarios**:

1. **Given** a project cap of N running workers and N running, **When** the supervisor dispatches, **Then** the task is created `queued`, no worker starts, and the result says so. (AC-1.1)
2. **Given** a global cap in the plugin settings, **Then** the same applies across projects. (AC-1.2)
3. **Given** a queued task and a worker that leaves its running states, **Then** the oldest queued task starts, in first-in first-out order. (AC-1.3)
4. **Given** a queued task, **Then** `factoryman_status` shows it with its description. No tool cancels a queued task in this release (a follow-up with `factoryman_decide`). (AC-1.4)
5. **Given** no cap, **Then** nothing queues. (AC-1.5)
6. **Given** a restart with queued tasks and free slots, **Then** the start-up drains them. (AC-1.6)
7. **Given** a queued task whose stored request is unreadable, **Then** it fails with evidence. A task whose machine is offline stays queued. (AC-1.7)

### User story 2 - Refuse work over budget (priority P1)

**Acceptance scenarios**:

1. **Given** `maxTasksPerDay` and that many tasks created today, **Then** dispatch is refused with the reason. (AC-2.1)
2. **Given** `perDayBudget` and recorded spend at or above it, **Then** dispatch is refused with the reason. (AC-2.2)
3. **Given** `perTaskBudget` and a running task over it, **Then** dispatch is refused until that task is stopped. (AC-2.3)
4. **Given** a budget and no cost data from bb, **Then** the budget is not enforced, `maxTasksPerDay` still is, and the dispatch result says that the budget could not be checked. (AC-2.4)
5. **Given** any refusal, **Then** no task exists and the log is unchanged. (AC-2.5)

### User story 3 - Post attention states to a webhook (priority P1)

**Acceptance scenarios**:

1. **Given** a webhook URL, **When** a task enters `needs_decision`, `review_ready`, `report_ready`, `blocked`, or `failed`, **Then** the plugin posts one JSON body with the task facts. (AC-3.1)
2. **Given** any other state, **Then** nothing is posted. (AC-3.2)
3. **Given** a failing post, **Then** the transition stands and a warning names the host and not the URL. (AC-3.3)
4. **Given** no URL, or a URL that is not http or https, **Then** nothing is posted. (AC-3.4)

### User story 4 - Document the backstop (priority P1)

**Acceptance scenarios**:

1. **Given** `bb factoryman protection <owner/repo>`, **Then** it prints the checklist and the `gh api` commands that require the `no-mistakes` check on the default branch, runs none of them, and says that it changed nothing. (AC-4.1)
2. **Given** `docs/BRANCH-PROTECTION.md`, **Then** it explains the required check, scoped tokens, how to verify, and that the approval form is not proof of a human. (AC-4.2)

### User story 5 - Dry-run the firstmate registry import (priority P1)

**Acceptance scenarios**:

1. **Given** `bb factoryman import-registry --file <path>`, **Then** it reports each registered project's mode, `yolo`, branch prefix, and forge, and matches each to a bb project by name. (AC-5.1)
2. **Given** a legacy line with no bracket, and a `no-mistakes-prod-only` line, **Then** both map to `no-mistakes`, with a note for the second. (AC-5.2)
3. **Given** an unknown mode or token, **Then** the report flags the line and does not guess. (AC-5.3)
4. **Given** the import, **Then** it writes nothing: the project configs are unchanged. (AC-5.4)
5. **Given** `--apply`, **Then** the command refuses and says that only the dry run exists. (AC-5.5)

### Edge cases

- A cap of zero or an absent cap means no cap.
- Cost in a different currency than the budget counts as unknown.
- The day is the UTC date of the injected clock.

## Requirements

- **FR-1001**: The plugin MUST count running workers as tasks in `working`, `blocked`, `validating`, and `needs_decision`.
- **FR-1002**: The project cap (`limits.maxWorkers` in `workflow.json`) and the global cap (the `maxWorkers` setting) MUST both hold, and `0` or absent MUST mean no cap.
- **FR-1003**: A dispatch at a cap MUST create the task in `queued`, store the resolved request in the log, and start no worker.
- **FR-1004**: The queue MUST drain first in, first out, when a worker leaves the running states, at start-up, and when the setting changes.
- **FR-1005**: A refused dispatch (budget, day cap) MUST create no task.
- **FR-1006**: Spend MUST come from `bb.sdk.threads.context(...).usage.cost`, and cost in another currency or no cost MUST count as unknown.
- **FR-1007**: `limits` MUST be tighten-only values in `workflow.json`, and a missing or invalid file MUST follow milestone 9's fail-closed rule.
- **FR-1008**: The webhook MUST post a JSON body on a transition into an attention state, MUST use only http or https, MUST time out, and MUST NOT log the URL.
- **FR-1009**: A webhook failure MUST NOT undo a transition.
- **FR-1010**: `bb factoryman protection` MUST print and MUST NOT run any command or change any setting.
- **FR-1011**: `bb factoryman import-registry` MUST only read, MUST report every registry line, and MUST refuse `--apply`.
- **FR-1012**: `src/machine/` MUST gain only the optional `request` field of `create`.

## Success criteria

- **SC-1001**: A cap queues a task, and the next free slot starts it.
- **SC-1002**: An over-budget dispatch is refused with a reason and leaves no task.
- **SC-1003**: An attention state posts to the webhook.
- **SC-1004**: The import dry run reports the mode of every project in the fixture registry.
- **SC-1005**: The suite, type check, and lint pass.

## Assumptions

- The registry format is the one in the `bin/fm-project-mode.sh` header (D-088).
- bb exposes cost only when the provider reports it (spike item 12).
