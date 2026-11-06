# Feature Specification: Core scaffold, task state machine, and event storage

**Feature Branch**: `fm/bb-factoryman-milestones-1-3`

**Created**: 2026-11-05

**Status**: Approved (scope fixed by the captain's intent for this task)

**Input**: User description: "Read CLAUDE.md, then docs/DESIGN.md. Build milestones 1 to 3 only: scaffold, state machine, storage. Write tests first. Keep src/machine/ free of bb imports and enforce that with a lint rule. Commit after each milestone. Don't write tools, event wiring, machine placement, or validator code yet. Record any deviation from the design in docs/DECISIONS.md. When milestone 3 is done, stop and summarize."

## User scenarios and testing *(mandatory)*

The people who use this feature are the plugin owner, who approves merges, and the maintainers who build the later milestones.
The feature has no end-user interface yet.
Its real entry points are the plugin factory, the pure transition function, and the store interface.

### User story 1 - Scaffold a loadable, lintable plugin (Priority: P1)

A maintainer clones the repository, installs dependencies, and runs one command each for tests, lint, type-check, and build.
The empty plugin loads in the bb fake plugin host.
The repository has the layout the design calls for.
A lint rule stops any file under `src/machine/` from importing bb packages.

**Why this priority**: Every later milestone builds on a working toolchain.
The machine-isolation rule protects the design's central promise that every gate is testable without a running bb.

**Independent test**: Run the test, lint, and type-check commands on a fresh checkout.
Then add a file under `src/machine/` that imports from `@get-bb/plugin-sdk` and confirm that lint fails.

**Acceptance scenarios**:

1. **Given** a fresh checkout with dependencies installed, **When** the maintainer loads the plugin factory in the fake host, **Then** the load succeeds, registers nothing beyond the plugin's identity, and disposes cleanly. (AC-1.1)
2. **Given** the package manifest, **When** the maintainer reads it, **Then** it names the package `bb-factoryman`, declares the server entry point, and pins the plugin SDK to one exact version. (AC-1.2)
3. **Given** a source file under `src/machine/` that imports a `@get-bb/*` module, **When** lint runs, **Then** lint fails and names the restricted import. (AC-1.3)
4. **Given** the same import in a file outside `src/machine/`, **When** lint runs, **Then** lint passes. (AC-1.4)
5. **Given** the repository, **When** the maintainer runs the build command, **Then** it delegates to `bb plugin build`. (AC-1.5)

---

### User story 2 - Enforce the delivery contract in a pure state machine (Priority: P2)

The plugin owner relies on the ship and scout task machines to refuse every move that breaks a hard rule.
A caller passes a task snapshot and an event.
The machine answers with either the next snapshot or a refusal that names the broken gate.
The machine never reads the clock, the disk, the network, or bb.

**Why this priority**: The state machine is the product's core promise.
Storage and tools both depend on its transition function.

**Independent test**: Drive the transition function with table-driven cases.
Every state and event pair outside the legal set is refused.
Each gate has a test for both the refusal and the permitted case.

**Acceptance scenarios**:

1. **Given** a ship task in `awaiting_approval` with no recorded merge approval and a project without `yolo`, **When** a `merge` event arrives, **Then** the machine refuses and the task stays in `awaiting_approval`. (AC-2.1, hard rule 1)
2. **Given** the same task in a project with `yolo` on, **When** a `merge` event arrives, **Then** the task moves to `merged`. (AC-2.2, hard rule 1)
3. **Given** a merged task whose worktree has uncommitted changes or unpushed commits, **When** a `teardown` event arrives, **Then** the machine refuses and the task stays `merged`. (AC-2.3, hard rule 2)
4. **Given** a task in `working`, **When** a completion or `fail` event arrives with empty or whitespace-only evidence, **Then** the machine refuses. (AC-2.4, hard rule 3)
5. **Given** a scout task in `report_ready` with no recorded promotion approval, **When** a `promote` event arrives, **Then** the machine refuses. With a promotion approval recorded by the owner, the task becomes a queued ship task. (AC-2.5, hard rule 4)
6. **Given** any task and any event that is not legal in the task's current state, **When** the event arrives, **Then** the machine refuses with a machine-readable reason and leaves the snapshot unchanged. (AC-2.6, hard rule 8)
7. **Given** a project in each delivery mode, **When** the worker reaches review ready, **Then** the machine applies that mode's check: a finished pipeline plus an open pull request for `no-mistakes`, an open pull request for `direct-PR`, and landed commits on the branch for `local-only`. (AC-2.7)
8. **Given** a `no-mistakes` project, **When** the worker hands off, **Then** the task passes through `validating` and may pause in `needs_decision`. For the other two modes `validating` and `needs_decision` are unreachable. (AC-2.8)
9. **Given** a queued task with no resolved profile, **When** a `start` event arrives, **Then** the machine refuses. (AC-2.9)
10. **Given** a task in `working`, **When** a `block` event arrives, **Then** the task becomes `blocked`, and an `unblock` event returns it to `working`. A `block` event in any other state is refused. (AC-2.10)
11. **Given** any task that is not `torn_down` or already `failed`, **When** a `fail` event arrives with evidence, **Then** the task becomes `failed`. (AC-2.11)
12. **Given** an approval event, **When** its actor is not the owner, **Then** the machine refuses. A worker actor is also refused on `request_approval`, `merge`, `promote`, and `teardown`. (AC-2.12)

---

### User story 3 - Survive restarts with an append-only event log (Priority: P3)

The plugin owner restarts the server and expects every task to come back exactly as it was.
The event log is the source of truth.
The task cache can be thrown away and rebuilt.
When live bb state disagrees with the log, the plugin records the disagreement and never fixes it silently.

**Why this priority**: Restart safety is a design goal, but it builds on the machine.
It is the last piece of milestones 1 to 3.

**Independent test**: Record a sequence of events, destroy the task cache, rebuild, and compare.
Then feed a conflicting live observation to reconcile and read the log.

**Acceptance scenarios**:

1. **Given** a store, **When** the caller records an event through the task log, **Then** one log row, the updated task row, and any approval row are written together or not at all. (AC-3.1)
2. **Given** a refused event, **When** the caller records it, **Then** a log row marks it refused with the reason, and the task row is unchanged. (AC-3.2, hard rule 8)
3. **Given** log rows already written, **When** any caller tries to update or delete one, **Then** the store refuses. (AC-3.3)
4. **Given** a populated store, **When** the task cache is destroyed and rebuilt from the log, **Then** the rebuilt task rows equal the originals field for field. (AC-3.4)
5. **Given** a log that holds an applied event the machine now refuses, **When** replay runs, **Then** replay reports the task as corrupt instead of guessing a state. (AC-3.5)
6. **Given** live observations that differ from replayed state, **When** reconcile runs, **Then** it appends one `reconcile` event per mismatching task, leaves task state unchanged, and appends nothing when the same mismatch is already the last log entry. (AC-3.6)
7. **Given** the same contract suite, **When** it runs against the in-memory store and the SQLite store, **Then** both pass with identical results. (AC-3.7)
8. **Given** a project ID with no stored config, **When** the caller reads its config, **Then** the store returns `no-mistakes` with `yolo` off. (AC-3.8)
9. **Given** a store reopened on the same SQLite file, **When** start-up recovery runs, **Then** it replays every non-terminal task and returns the rebuilt state. (AC-3.9)

---

### Edge cases

- A `fail` event on a `torn_down` task is refused.
- An event with a payload that fails schema validation is refused as invalid and logged, never thrown past the caller.
- An event type the machine does not know is refused as unknown.
- Evidence made only of whitespace counts as empty.
- A merge approval recorded for a different scope, such as `promote`, does not satisfy the merge gate.
- A denied approval does not satisfy the gate, and a later approved decision replaces it.
- A merge approval recorded while the task is not in `awaiting_approval` is refused, so approval cannot be banked in advance.
- Two events recorded back to back for one task keep strict sequence order.
- Reconcile on a task that already matches live state appends nothing.
- A promoted task keeps its task ID, branch, and thread, but it needs a fresh profile before it starts as a ship task.

## Requirements *(mandatory)*

### Functional requirements

**Scaffold**

- **FR-001**: The package MUST be named `bb-factoryman` and MUST declare its plugin server entry in the manifest.
- **FR-002**: The manifest MUST pin the plugin SDK to one exact version.
- **FR-003**: The plugin factory MUST load in the fake plugin host and register nothing beyond its identity until later milestones add tools.
- **FR-004**: The repository MUST provide commands for tests, lint, type-check, and build, and the build command MUST call `bb plugin build`.
- **FR-005**: Lint MUST fail on any import from `@get-bb/*` in files under `src/machine/`, including type-only imports and subpath imports.
- **FR-006**: The repository MUST contain the directories `src/machine/`, `src/store/`, `spike/`, and `docs/`, and no directory for later milestones.

**State machine**

- **FR-010**: The machine MUST define ship and scout task kinds, the three delivery modes, and the states in the design.
- **FR-011**: A transition function MUST take a task snapshot and an event, MUST be deterministic, and MUST return either the next snapshot or a refusal.
- **FR-012**: The machine MUST NOT import bb packages and MUST NOT perform input or output.
- **FR-013**: Every refusal MUST carry a stable reason code and a human-readable message.
- **FR-014**: The machine MUST refuse every state and event pair that the design does not list as legal.
- **FR-015**: Entering `validating`, `review_ready`, `report_ready`, or `failed` MUST require non-empty evidence after trimming.
- **FR-016**: `merged` MUST require a recorded approval for the `merge` scope with an approved decision, unless the project's `yolo` flag is on for that merge.
- **FR-017**: `torn_down` MUST require a worktree report that shows no uncommitted changes and no unpushed commits, and a missing report MUST be a refusal.
- **FR-018**: Promotion from scout to ship MUST require a recorded approval for the `promote` scope with an approved decision.
- **FR-019**: Approval events MUST come from the owner actor, and worker actors MUST be refused on `request_approval`, `merge`, `promote`, and `teardown`.
- **FR-020**: Review ready MUST apply the delivery mode's check as the "Delivery modes" table in `CLAUDE.md` defines it.
- **FR-021**: `start` MUST require a complete dispatch profile of provider, model, reasoning level, and permission mode.
- **FR-022**: `blocked` MUST be reachable only from `working` and MUST return only to `working`.
- **FR-023**: The machine MUST validate every event payload and MUST turn a validation error into a refusal.

**Storage**

- **FR-030**: The event log MUST be append-only and MUST record task ID, time, from state, to state, event, actor, and evidence for every entry.
- **FR-031**: The store MUST persist tasks, approvals, and project configs next to the log.
- **FR-032**: The store MUST sit behind one interface with an in-memory and a SQLite implementation, and both MUST pass one shared contract suite.
- **FR-033**: Recording an event MUST run the machine, append the log entry, update the task row, and write any approval row in one atomic step.
- **FR-034**: Refused events MUST be logged and MUST NOT change any task row.
- **FR-035**: Replay MUST rebuild a task from its log entries by running them through the machine, and MUST report a task as corrupt when an applied entry no longer passes.
- **FR-036**: Rebuilding the cache MUST produce rows equal to the rows that incremental updates produced.
- **FR-037**: Reconcile MUST compare replayed state with live observations that a caller supplies, MUST append a `reconcile` event per mismatch, and MUST NOT change task state.
- **FR-038**: Reading the config of an unregistered project MUST return the `no-mistakes` mode with `yolo` off.
- **FR-039**: Start-up recovery MUST replay every non-terminal task.

### Key entities

- **Project config**: A bb project ID, delivery mode, `yolo` flag, branch prefix, base branch, and default machine.
- **Task**: A task ID, kind, state, worker thread ID, branch, machine, and pull request URL. It is a cache of the log.
- **Task event**: An append-only record of task ID, time, from state, to state, event, actor, and evidence, plus the event payload and outcome that replay needs.
- **Approval**: A task ID, the scope that the owner approved, the decision, and the time.
- **Refusal**: A reason code and message that the machine returns when it declines an event.

## Success criteria *(mandatory)*

### Measurable outcomes

- **SC-001**: Every state and event-type pair is exercised by a table-driven test, and every pair outside the legal set is refused.
- **SC-002**: Each hard rule that this feature covers (rules 1, 2, 3, 4, and 8) has at least one test that proves the refusal and one that proves the permitted path.
- **SC-003**: A seeded random walk of at least 200 event sequences, each recorded incrementally, yields task rows identical to a full cache rebuild in every case.
- **SC-004**: A lint fixture that imports `@get-bb/*` from `src/machine/` fails lint in the test suite.
- **SC-005**: The full suite, lint, and type-check finish in under 60 seconds on a developer laptop.
- **SC-006**: The same contract suite passes against both store implementations with no skipped tests.

## Assumptions

- The spike results in `spike/RESULTS.md` do not exist yet. No code in this feature depends on an unconfirmed bb behavior.
- The `bb` command-line tool was not installed when the scaffold started, so the build step waited. The owner installed bb 0.48.1 during the work, and `bb plugin build` now runs. `docs/DECISIONS.md` records the outcome (D-001).
- Hard rules 5, 6, and 7 depend on machine placement and extension code, which are later milestones. This feature gives `blocked` its state and events and leaves the placement checks to milestone 8 and the extension check to milestone 9.
- The facts that gates need arrive in event payloads: the worktree report, the pull request URL, the landed-commit count, the pipeline result, and the `yolo` flag. Later tools gather these facts. This feature never gathers them.
- Task, project, and thread IDs are opaque strings. Times are ISO 8601 UTC strings supplied by the caller.
- A denied approval keeps the task in `awaiting_approval`. The design has no rework arrow, so `docs/DECISIONS.md` records this as an open question.
- Scout reports, dispatch rules, tools, event wiring, validators, machine placement, extension surface, caps, spend, notifications, and the firstmate import are out of scope.
