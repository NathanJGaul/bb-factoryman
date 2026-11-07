# Feature Specification: Tools and approval, event wiring, and the validator

**Feature Branch**: `fm/bb-factoryman-milestones-4-6`

**Created**: 2026-11-06

**Status**: Approved (scope fixed by the captain's intent for this task)

**Input**: User description: "Build the next milestones of bb-factoryman: milestones 4 to 6 in docs/DESIGN.md (tools and approval, event wiring, validator).
Milestones 1 to 3 (scaffold, state machine, storage) are merged on master.
Read CLAUDE.md, then docs/DESIGN.md.
Write tests first.
Keep src/machine/ free of bb imports.
Commit after each milestone.
Record any deviation from the design in docs/DECISIONS.md.
Do not build dispatch resolver, machine placement, extension surface, limits or skills (milestones 7 to 11).
When milestone 6 is done, stop and summarize."

## User scenarios and testing *(mandatory)*

The people who use this feature are the plugin owner, who approves merges, the supervisor agent that works for the owner, the worker agents that do the tasks, and the maintainers who build the later milestones.
The feature has no screen of its own.
Its real entry points are the plugin factory, the five agent tools, the bb thread events the plugin listens to, and the validator interface.
Tests reach these entry points through the bb fake plugin host.
The facts about bb and no-mistakes that this feature depends on are in `spike/RESULTS.md`, recorded against bb 0.48.1 and no-mistakes v1.84.0.

### User story 1 - Run tasks through five tools with a human-approved merge (Priority: P1)

A supervisor agent dispatches ship and scout tasks, reads their state, asks for a merge, and tears down finished work.
A worker agent hands back its outcome with evidence.
The owner approves every merge in a form, unless the project's `yolo` flag is on.
The tools turn each call into an event for the state machine, so a gate that the machine refuses stays refused.

**Why this priority**: Without the tools, the state machine has no caller.
The merge approval is the design's most important gate, and it must work before anything depends on it.

**Independent test**: Load the plugin in the fake host, call each tool as the supervisor and as a worker, and drive the approval form through the host's submit and cancel controls.
Read the event log and the recorded calls to the fake merge executor.

**Acceptance scenarios**:

1. **Given** a thread whose plugin metadata names the supervisor role, a thread that names the worker role, and a thread with no role, **When** bb resolves the agent configuration for each, **Then** the supervisor is offered `factoryman_dispatch`, `factoryman_status`, `factoryman_merge`, and `factoryman_teardown`, the worker is offered only `factoryman_report`, and the third thread is offered none.
   (AC-1.1)
2. **Given** a thread that the store records as a task's worker, **When** it calls a supervisor tool anyway, **Then** the call is refused and nothing changes, because tool visibility is a hint and the store is the authority.
   A thread that is not a recorded worker is also refused when it calls `factoryman_report`.
   (AC-1.2)
3. **Given** a supervisor thread, a project config, and a complete dispatch profile, **When** the supervisor calls `factoryman_dispatch`, **Then** the plugin creates a task in the project's delivery mode, spawns one worker thread as a child of the supervisor with the plugin's role metadata and with bb's automatic parent notifications off, and records the task as started with that thread and the planned branch name.
   The result names the task ID, the thread, and the branch.
   (AC-1.3)
4. **Given** a dispatch call with an incomplete profile, an empty description, or an unknown kind, **When** the supervisor calls `factoryman_dispatch`, **Then** it is refused before any thread is spawned, and no task is created.
   (AC-1.4)
5. **Given** a dispatch call whose thread spawn fails, **When** the supervisor calls `factoryman_dispatch`, **Then** the task is recorded as failed with the spawn error as evidence, and the result says so.
   (AC-1.5)
6. **Given** a worker on a `no-mistakes` ship task, a worker on a `direct-PR` or `local-only` ship task, and a worker on a scout task, **When** each calls `factoryman_report` with an outcome and evidence, **Then** the plugin records a handoff, a ready, or a report event as the task's kind and mode require.
   A blocked or failed outcome records a block or a fail event.
   A report with empty evidence is refused by the machine and the refusal is logged and returned.
   (AC-1.6)
7. **Given** tasks in several states, **When** the supervisor calls `factoryman_status`, **Then** it reads the state of one task, or of the tasks in the project filtered by state, and the call writes nothing to the log.
   (AC-1.7)
8. **Given** a `review_ready` ship task in a project with `yolo` off, **When** the supervisor calls `factoryman_merge` and the owner submits an approval in the form, **Then** the plugin records the request, records the owner's approval, runs the merge once, and records the merge, so the task ends `merged`.
   (AC-1.8, hard rule 1)
9. **Given** the same task, **When** the owner submits a denial, **Then** the denial is recorded, nothing is merged, and the task stays `awaiting_approval`.
   (AC-1.9, hard rule 1)
10. **Given** the same task, **When** the owner cancels the form or the form times out, **Then** no approval is recorded, nothing is merged, the task stays `awaiting_approval`, and the result tells the supervisor that the owner did not answer.
    A later `factoryman_merge` call opens a new form.
    (AC-1.10, hard rule 1)
11. **Given** a form whose submitted value is not exactly an approval or a denial, **When** it comes back, **Then** the plugin records no approval and no denial and says the answer was unreadable.
    (AC-1.11, hard rule 1)
12. **Given** a `review_ready` ship task in a project with `yolo` on, **When** the supervisor calls `factoryman_merge`, **Then** no form opens, the merge runs, and the recorded merge event carries the `yolo` flag.
    (AC-1.12, hard rule 1)
13. **Given** an approved merge whose merge command fails, **When** the supervisor calls `factoryman_merge`, **Then** the merge event is not recorded, the task stays `awaiting_approval`, and the result carries the failure.
    (AC-1.13, hard rule 8)
14. **Given** a task that is not `review_ready` or `awaiting_approval`, a scout task, or a worker caller, **When** `factoryman_merge` is called, **Then** it is refused and no form opens.
    (AC-1.14, hard rule 8)
15. **Given** a merged or failed task whose worktree has uncommitted changes or unpushed commits, **When** the supervisor calls `factoryman_teardown`, **Then** the machine refuses, the refusal is logged, and the worker's environment is not removed.
    (AC-1.15, hard rule 2)
16. **Given** a merged task whose worktree is clean and landed, **When** the supervisor calls `factoryman_teardown`, **Then** the task becomes `torn_down` and the worker's environment is removed.
    (AC-1.16, hard rule 2)
17. **Given** the plugin starts in the fake host, **When** the factory runs, **Then** it opens the store on the host's per-plugin database, runs start-up recovery, and registers the five tools.
    (AC-1.17)
18. **Given** a thread that is not a recorded worker, **When** the owner runs the plugin's supervisor command for it, **Then** the thread's plugin metadata names the supervisor role.
    The same command refuses a thread that is a recorded worker.
    (AC-1.18)

---

### User story 2 - Turn thread events into transitions and wake the supervisor only when it matters (Priority: P2)

The plugin listens to bb's thread events.
It advances the state machine when a worker's thread fails or disappears.
It messages the supervisor only when a task reaches a state that needs attention.
While workers run normally, the supervisor uses no tokens.

**Why this priority**: The design promises a supervisor that is idle until a task needs it.
It depends on the tools of story 1, because a tool call and a thread event are two ways to reach the same transition.

**Independent test**: Feed a recorded sequence of thread events to the fake host and compare the log, the task rows, and the messages sent to the supervisor with the expected list.

**Acceptance scenarios**:

1. **Given** a `working` task, **When** its worker thread fails, **Then** the task becomes `failed` with evidence built from the failure and the supervisor receives one message.
   The evidence uses the thread's error text when it exists and the turn failure's category and status code when it does not.
   (AC-2.1, hard rule 3)
2. **Given** a `working` task, **When** its worker thread goes idle without a report, **Then** the supervisor receives one message and the task state is unchanged.
   (AC-2.2)
3. **Given** a task that has not reached `merged`, **When** its worker thread is deleted, **Then** the task becomes `failed` with evidence and the supervisor is told.
   When the thread is archived instead, the supervisor is told that the worktree may be removed and the task state is unchanged.
   (AC-2.3)
4. **Given** a worker thread, **When** an interaction that another source raised becomes pending on it, **Then** the supervisor receives one message with the interaction's title.
   A pending form that this plugin raised produces no message.
   (AC-2.4)
5. **Given** any applied transition, **When** the new state is `needs_decision`, `review_ready`, `report_ready`, `blocked`, or `failed`, **Then** the supervisor receives one message that names the task, its state, and its evidence.
   A transition into any other state sends nothing.
   (AC-2.5)
6. **Given** an event for a thread that is not a recorded worker, for a task in a terminal state, or for a task in a state where the worker is no longer expected to run, **When** the plugin handles it, **Then** it changes nothing and sends nothing.
   (AC-2.6)
7. **Given** a recorded event sequence that includes a duplicate failure event, **When** the sequence replays through the fake host, **Then** the messages sent equal the expected list exactly, and the duplicate produces no second message.
   (AC-2.7)
8. **Given** a worker thread with a parent, **When** the plugin wakes the supervisor, **Then** it sends one message to that parent thread in a mode that starts a turn on an idle thread.
   A worker with no parent produces no message and a warning in the log.
   A failed send is logged and never undoes the transition.
   (AC-2.8)
9. **Given** the plugin restarts with non-terminal tasks, **When** a task's worker thread is missing or in error and the log says otherwise, **Then** start-up appends one `reconcile` row for the task, messages the supervisor once, and changes no task state.
   A second restart with the same mismatch appends and sends nothing.
   (AC-2.9, constitution III)
10. **Given** the recorded real bb payloads from `test/fixtures/recorded/bb-0.48.1/`, **When** the plugin handles them, **Then** it produces the transitions and messages of the scenarios above.
    (AC-2.10)

---

### User story 3 - Validate no-mistakes tasks through a validator interface (Priority: P3)

A `no-mistakes` ship task does not reach review ready until the no-mistakes pipeline has finished.
The plugin starts the pipeline in the worker's worktree when the worker hands off, follows it, and pauses the task when the pipeline stops on a finding.
A fake validator and the real no-mistakes command-line interface sit behind the same interface.

**Why this priority**: It completes the `no-mistakes` delivery mode.
It builds on the machine's `validating` and `needs_decision` states and on the wake messages of story 2.

**Independent test**: Drive a task from handoff to review ready with a fake validator, then with the recorded no-mistakes output replayed through the real adapter.
Check that a finding pauses the task.

**Acceptance scenarios**:

1. **Given** the validator interface, **When** a maintainer reads it, **Then** it offers five operations: start a run, read its status, read its findings, answer a finding, and cancel a run.
   (AC-3.1)
2. **Given** a `no-mistakes` ship task, **When** the worker hands off, **Then** the task becomes `validating` and the validator starts in the worker's worktree with the task's intent.
   (AC-3.2)
3. **Given** a validating task, **When** the validator reports a gate, **Then** the task becomes `needs_decision`, and the supervisor receives each finding's ID, severity, file, action, and description exactly as the validator wrote them.
   (AC-3.3)
4. **Given** a task in `needs_decision`, **When** someone answers the findings through the plugin, or the gate is answered outside the plugin, **Then** the task returns to `validating` and the run continues.
   The plugin never answers a finding on its own.
   (AC-3.4)
5. **Given** a validating task, **When** the validator reports a finished run with a pull request and green checks, **Then** the task becomes `review_ready` with the pull request URL and the supervisor is told.
   (AC-3.5)
6. **Given** a validating task, **When** the run ends failed or cancelled, **Then** the task becomes `failed` with the validator's error as evidence.
   (AC-3.6, hard rule 3)
7. **Given** a finished run that ends in an override, in skipped steps, or without a pull request, **When** the validator reports it, **Then** the task becomes `needs_decision` with the reason and never becomes `review_ready`, and it stays there until the validator reports a different view.
   Output the plugin cannot read, or an outcome it does not know, advances nothing.
   (AC-3.7, hard rule 8)
8. **Given** the recorded no-mistakes output, **When** the adapter reads each file, **Then** it returns the same gate, findings, outcome, pull request URL, and error as the file shows, and it reads standard output only.
   (AC-3.8)
9. **Given** the plugin restarts while a task is `validating` or in `needs_decision`, **When** start-up recovery finishes, **Then** the plugin picks the run up again from the worktree without starting a second run.
   (AC-3.9)
10. **Given** a `direct-PR` or `local-only` task, **When** the worker reports, **Then** the validator is never started.
    (AC-3.10)

---

### Edge cases

- A refused event is logged and returned to the caller as an error result, and it never throws past the tool.
- A second `factoryman_merge` call for a task whose approval form is still open is refused with a message that the owner has not answered yet.
- A `factoryman_merge` call on a task already in `awaiting_approval` opens a fresh form and does not send a second `request_approval`.
- The owner's form answer arrives after the thread was stopped: the form result is `cancelled`, and the plugin records nothing.
- A worker that reports `blocked` produces a wake message, and the supervisor can see the state with `factoryman_status`.
- A merge approved before a `request_changes` event does not carry over, because the machine clears it (D-028).
- A tool call that names a task in another project is refused.
- An approval form that outlives its task state, for example because the task failed in the meantime, produces no merge when it is submitted late.
- A project with no registered config dispatches as `no-mistakes` with `yolo` off.
- A validator run that is still going when the plugin shuts down keeps going, because the pipeline owns it.
- A `local-only` project without a configured base branch refuses merge and teardown, because the landed-work and merge checks need it.
- No-mistakes output with an extra column or an extra field still reads, because the adapter reads the header it is given.

## Requirements *(mandatory)*

### Functional requirements

**Tools and approval (milestone 4)**

- **FR-101**: The plugin MUST register exactly five agent tools: `factoryman_dispatch`, `factoryman_status`, `factoryman_merge`, `factoryman_teardown`, and `factoryman_report`.
- **FR-102**: The plugin MUST choose each thread's tools from the plugin metadata on the thread, and a thread without a role MUST get no tools.
- **FR-103**: Every tool MUST decide the caller's authority at call time from the store and the thread ID of the call, and MUST NOT trust the thread's plugin metadata or any argument that names a role.
- **FR-104**: A thread that the store records as a worker MUST be refused on every supervisor tool.
- **FR-105**: Every tool call MUST turn into events for the existing `TaskLog`, and a refusal MUST be logged and MUST come back to the agent as an error result.
- **FR-106**: `factoryman_dispatch` MUST validate the whole task contract (kind, description, and a complete profile, whose permission mode is `accept-edits`, `auto`, or `full`) before it creates a task or spawns a thread.
- **FR-107**: `factoryman_dispatch` MUST spawn the worker as a child of the calling supervisor thread with bb's automatic parent notifications off, so the plugin sends the only wake messages.
- **FR-108**: `factoryman_dispatch` MUST stamp the worker thread with the plugin's role metadata and the task ID, and MUST record the worker thread and a planned branch name in the `start` event.
- **FR-109**: `factoryman_dispatch` MUST NOT resolve a profile, choose a machine, or enforce caps.
  The caller supplies the whole profile, and the worker runs on the project's default host.
- **FR-110**: `factoryman_report` MUST map the worker's outcome to a machine event from the task's kind and delivery mode, and MUST require the evidence the machine requires.
- **FR-111**: `factoryman_status` MUST NOT append to the log or change any row.
- **FR-112**: `factoryman_merge` MUST open an approval form through `bb.ui.requestInput` for every merge in a project whose `yolo` flag is off.
- **FR-113**: `factoryman_merge` MUST record an approval only from a submitted form whose value matches the approval schema exactly, and MUST record the `user` actor only for such a value.
- **FR-114**: `factoryman_merge` MUST record a denial when the form's value is a valid denial.
  It MUST record nothing when the form is cancelled, times out, or returns a value that matches neither schema.
- **FR-115**: `factoryman_merge` MUST run the merge only after the machine would accept the `merge` event, and MUST record the `merge` event only after the merge succeeds.
- **FR-116**: A project with `yolo` on MUST skip the form, MUST still pass through `awaiting_approval` (D-012), and MUST record the `yolo` flag on the merge event.
- **FR-117a**: A pull request executor MUST refuse, at preflight and also when `yolo` is on, a pull request URL that is not `https://<host>/<owner>/<repo>/pull/<number>` in the project's own repository (D-059).
- **FR-117**: The merge MUST run behind an executor interface.
  The pull request modes MUST merge the pull request with the GitHub command-line tool.
  The `local-only` mode MUST merge the branch into the configured base branch of the project checkout and MUST refuse when the checkout is dirty, off the base branch, or has no base branch configured.
- **FR-118**: `factoryman_teardown` MUST gather the worktree report from git itself and MUST NOT accept it as an argument.
- **FR-119**: The worktree report MUST count a commit as unpushed when it is on no remote ref for the pull request modes, and when it is not reachable from the base branch for `local-only`.
- **FR-120**: `factoryman_teardown` MUST remove the worker's environment only after the `teardown` event is recorded.
- **FR-121**: The plugin MUST open its store on `bb.storage.database()` and MUST run start-up recovery when it loads.
- **FR-122**: The plugin MUST offer one command that sets the supervisor role on a thread that is not a recorded worker.
- **FR-123**: Tool results MUST be plain text that names the task ID, the state, and any refusal code, and MUST NOT include secrets or full diffs.

**Event wiring (milestone 5)**

- **FR-201**: The plugin MUST handle the bb thread events `thread.failed`, `thread.idle`, `thread.deleted`, `thread.archived`, and `interaction.pending`, and MUST ignore the other thread events.
- **FR-202**: The plugin MUST handle an event only when its thread is the recorded worker of a task that has not reached `torn_down`.
- **FR-203**: A `thread.failed` event MUST fail a task that is `working` or `blocked`, with evidence built from the thread's error text or, when that is empty, from the category and status code of the turn failure that follows it (the handler waits briefly for it).
- **FR-204**: A `thread.deleted` event MUST fail a task in any state before `merged`, with evidence, and MUST leave a `merged` task unchanged without a message (D-060).
- **FR-205**: A `thread.idle` event on a `working` task MUST wake the supervisor and MUST NOT change the state.
- **FR-206**: A `thread.archived` event MUST wake the supervisor with a warning that the worktree may be removed, and MUST NOT change the state.
- **FR-207**: An `interaction.pending` event on a worker thread MUST wake the supervisor unless the interaction came from this plugin.
- **FR-208**: After any applied event, whether from a tool, an event handler, or the validator, the plugin MUST wake the supervisor when the new state is `needs_decision`, `review_ready`, `report_ready`, `blocked`, or `failed`, and MUST send nothing for other states.
- **FR-209**: The wake target MUST be the parent of the worker thread as bb reports it.
  A worker without a parent MUST send nothing and MUST log a warning.
- **FR-210**: A wake message MUST be one plain-text message that names the task, its kind, its new state, and its evidence cut to a fixed length.
- **FR-211**: A failed wake send MUST be logged and MUST NOT undo or block a transition.
- **FR-212**: At start-up, after recovery, the plugin MUST observe the worker thread of every non-terminal task, MUST write one `reconcile` row per mismatch through the existing `reconcile` function, and MUST message the supervisor for each row it wrote.
- **FR-213**: Observing a thread MUST report `missing` for a deleted or unknown thread (when bb answers 404 for an unknown thread, the parent is unknown, so the plugin writes the `reconcile` row and logs a warning but sends no message, D-047), `failed` for a thread in `error`, and the logged state otherwise.
- **FR-214**: Event handlers MUST NOT throw.
  A handler error MUST be logged and MUST leave the log and the cache as they were.

**Validator (milestone 6)**

- **FR-301**: The plugin MUST define a validator interface with `start`, `status`, `findings`, `answer`, and `cancel`, and every operation MUST return a result value and not throw for an expected failure.
- **FR-302**: The plugin MUST provide a fake validator for tests and a no-mistakes validator that calls the `no-mistakes axi` commands.
- **FR-303**: The no-mistakes validator MUST run each command in the worker's worktree, MUST read standard output only, MUST decode it as TOON, and MUST pass the task's intent to `axi run`.
- **FR-304**: The no-mistakes validator MUST read the gate step, status, and findings with the columns the output gives, MUST read the outcome, error, pull request URL, and run ID, and MUST treat an unreadable or unknown output as `unreadable` and never as success.
- **FR-305**: The validator driver MUST start a run when a `no-mistakes` task becomes `validating`, and MUST NOT start one for the other delivery modes.
- **FR-306**: The driver MUST move a validating task to `needs_decision` when the run reports a gate, because a pipeline never passes a gate on its own, and MUST include the findings verbatim in the wake message.
- **FR-307**: The driver MUST move a task from `needs_decision` back to `validating` after an answer is sent through the validator, or after it observes that the validator's view differs from the view that parked the task.
- **FR-308**: The driver MUST NOT answer a finding unless a caller asks it to, and no code path MUST answer a finding on its own.
- **FR-309**: The driver MUST record `validated` with `pipelineFinished` true and a pull request URL only when the run ends with the outcome `checks-passed` and the run names a pull request.
- **FR-310**: The driver MUST move a task to `needs_decision` when the run ends `passed-with-override`, `passed-with-skips`, or `passed` without a pull request, and MUST fail the task when the run ends `failed` or `cancelled`.
- **FR-311**: The driver MUST keep waiting while a run is still going, MUST reattach to a run in the worktree by asking again, and MUST NOT start a second run for a branch that already has one.
- **FR-312**: At start-up the driver MUST resume every task that is `validating` or in `needs_decision`.
- **FR-313**: The plugin MUST NOT stop a no-mistakes run when it shuts down.
- **FR-314**: The driver MUST take its clock and its delays as injected values, so tests run without waiting.

**Constraints that cover all three milestones**

- **FR-401**: `src/machine/` MUST gain no bb import and no input or output.
- **FR-402**: The new code MUST NOT call another bb plugin.
- **FR-403**: Every new behavior MUST have a test that failed first, and the failure MUST be recorded in the cycle log.
- **FR-404**: The plugin MUST add no tool, state, or event beyond this list.
  The five-tool list stays closed (D-031 records the one gap this leaves).

### Key entities

- **Tool call context**: The thread ID, project ID, and cancellation signal that bb passes to a tool, and the caller identity that the plugin derives from them and from the store.
- **Dispatch request**: The task kind, description, and profile that a supervisor sends, checked before anything is created.
- **Approval form**: The request that the plugin shows the owner, and the two answers it accepts, approve and deny, each with an optional comment.
- **Merge executor**: The part that merges a pull request or a local branch after the machine would accept the merge.
- **Worktree report**: The facts about uncommitted changes and unpushed commits that git gives for a worker's worktree.
- **Wake message**: A plain-text message to the supervisor thread about one task in one attention state.
- **Observation**: What the plugin saw in live bb for a task's worker thread, in the terms that `reconcile` takes.
- **Validator run**: One no-mistakes pipeline run on a branch, with a run ID, a status, an optional gate, an optional outcome, and an optional pull request URL.
- **Finding**: A gate item with an ID, severity, file, action, and description.
- **Recorded fixture**: A real bb payload or a real no-mistakes output, stored with its tool version.

## Success criteria *(mandatory)*

### Measurable outcomes

- **SC-001**: Each of the five tools has at least one test through the fake host for its success path and one for its refusal path, and no tool test calls the store directly.
- **SC-002**: The merge approval has three tests, for a submitted approval, a cancelled form, and a timed-out form, and each asserts the count of merge executions and the final task state.
- **SC-003**: Hard rules 1, 2, 3, and 8 each have a test through a tool that shows the refusal and a test that shows the permitted path.
- **SC-004**: A replayed sequence of at least ten thread events yields exactly the expected list of wake messages and no others.
- **SC-005**: A fake validator and the recorded no-mistakes output each drive a task from handoff to review ready, and a finding pauses the task in both. The review-ready output is derived from a recorded run, because the spike could not record `checks-passed` (D-049).
- **SC-006**: The recorded bb and no-mistakes files all parse and replay, and a changed shape fails a named test.
- **SC-007**: The full suite, lint, and type-check finish in under 90 seconds on a developer laptop.
- **SC-008**: `pnpm run build` produces the plugin bundle with the new modules.
- **SC-009**: A deliberate mutant in each gate-bearing function is caught by at least one test.

## Assumptions

- The spike results in `spike/RESULTS.md` hold.
  They name bb 0.48.1, SDK 0.6.104, and no-mistakes v1.84.0, and a test fails if the SDK pin drifts.
- The owner's live install in bb is the owner's step.
  Tests use the fake host, and the real merge, git, and no-mistakes commands run only against throwaway repositories and recorded output.
- `bb.ui.requestInput` returns whatever JSON reaches the form, and bb does not record who submitted it.
  The plugin validates strictly and records the gap (D-030).
- bb names the worker's branch itself, so the dispatch prompt gives the worker the planned branch name and the task records that name.
- The dispatch call carries a complete profile.
  The rules table that fills in a profile is milestone 7.
- Every worker runs on the project's default host.
  Machines are milestone 8.
- A supervisor is a thread with the supervisor role in its plugin metadata.
  The plugin offers one command to set it, and the skill that tells a person when to use it is milestone 11.
- No tool answers a pipeline finding, because the design lists five tools and none fits.
  The driver exposes the answer operation, and a person can also answer in no-mistakes directly, which the driver observes.
  D-031 records this as an open question for the owner.
- A scout report is stored as the evidence of its `report` event.
  The report file export is later work.
- Task, project, and thread IDs are opaque strings, and times are ISO 8601 UTC strings from an injected clock.
- Dispatch rules, machine placement, the extension surface, caps and budgets, the webhook, the firstmate import, and skills are out of scope.
