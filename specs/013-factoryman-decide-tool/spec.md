# Feature specification: The `factoryman_decide` tool

**Feature branch**: `fm/bb-factoryman-decide-tool`

**Created**: 2026-11-09

**Status**: Approved (scope fixed by the captain's decision D-057 and the Firstmate spec for this task)

**Input**: The captain approved the follow-up that decision D-031 asked for, recorded as D-057, and said "start the decide tool".
Factoryman has five tools, and none of them answers a no-mistakes pipeline finding.
A task in `needs_decision` therefore waits until someone answers in no-mistakes directly, which the validation driver observes.
This feature adds a sixth tool, `factoryman_decide`, so the supervisor has a path to answer a finding.
The answer goes through a form that the owner approves, as the merge approval does, because an `ask-user` finding belongs to the owner.

## User scenarios and testing

The people who use this feature are the supervisor (an agent that calls the tool), the owner (who approves the form in the bb app), and the maintainer (who runs `pnpm run conformance`).
The feature has one screen: the decision form that the owner sees.
Its real entry points are the `factoryman_decide` tool, the form's renderer in the bb app, and `pnpm run conformance`.

### User story 1 - Answer a pending gate with the owner's approval (priority: P1)

A `no-mistakes` ship task is in `needs_decision` because the pipeline stopped at a gate with findings.
The wake message and `factoryman_status` show the findings and a decision key.
The supervisor calls `factoryman_decide` with the task, the key, and an answer: `approve`, `skip`, or `fix` with the finding IDs to fix and optional instructions.
The plugin opens an approval form for the owner.
When the owner approves, the plugin sends that exact answer to the pipeline and the task returns to `validating`.

**Why this priority**: Today the supervisor can only tell the owner to open no-mistakes and answer there.
The sixth tool gives the supervisor a path, and the form keeps the answer with the owner, who owns an `ask-user` finding.

**Independent test**: Drive a task into `needs_decision` with the fake validator, call the tool through the fake plugin host, answer the form with an approval, and read the validator's received answer and the task state.

**Acceptance scenarios**:

1. **Given** a task in `needs_decision` with a pending gate of two findings, **When** the supervisor calls the tool with the current key and `fix` naming one finding ID, **Then** the plugin opens one approval form, and the validator receives the answer only after the owner approves.
2. **Given** the owner approved, **When** the validator accepts the answer, **Then** the task is `validating`, the log holds a `resolve` event whose evidence names the answer and says that the owner approved it, and the tool result says so.
3. **Given** the owner approved an `approve` or a `skip` answer, **When** the validator accepts it, **Then** the validator receives that action and no finding IDs.
4. **Given** the owner approved a `fix` answer with instructions, **When** the validator receives it, **Then** it carries the finding IDs and the instructions exactly as the supervisor gave them.
5. **Given** the owner approved, **When** the validator rejects the answer (a usage error, a protected-path refusal, an unreadable reply), **Then** the task stays `needs_decision`, no `resolve` event is recorded, and the tool result gives the validator's reason.
6. **Given** the plugin's validator adapter, **When** it sends any answer, **Then** the command line holds no `--yes` and no `-y`.

### User story 2 - The owner sees the finding and the exact answer before approving (priority: P1)

The owner opens the decision form in the bb app.
It shows the task, the gate's step and status, every finding with its ID, severity, file, action, and description, and the exact answer that the plugin will send.
The owner can approve, deny with an optional comment, or cancel.

**Why this priority**: An approval of something the owner cannot read is not an approval.
The summary and the answer must come from the live gate, not from the supervisor's words.

**Independent test**: Mount the registered renderer with a payload, read what it shows, and click each button.

**Acceptance scenarios**:

1. **Given** a payload for a `fix` answer, **When** the form renders, **Then** it shows each finding's fields, the answer's action, the finding IDs, and the instructions.
2. **Given** a payload the form cannot read, **When** it renders, **Then** it offers no Approve button and says why, and Deny and Cancel still work.
3. **Given** the owner clicks Approve, Deny, or Cancel, **When** the click is handled, **Then** the form submits `approved`, submits `denied` with the comment, or cancels, and a second click does nothing while the first is in flight.
4. **Given** the form text came from the validator, **When** it renders, **Then** it shows the text as plain text (React text nodes, never markup), so a finding cannot inject markup.

### User story 3 - A refusal fails closed and sends nothing (priority: P1)

The tool refuses before it opens a form, and again after the form closes, whenever the answer would not match the live gate.
It never answers on its own, and `yolo` never lets it skip the form.

**Why this priority**: The form is the gate.
A path that answers without the owner, or answers a gate that moved, defeats it.

**Independent test**: Call the tool in each wrong situation and check the fake validator received no answer and no form opened.

**Acceptance scenarios**:

1. **Given** a task that is not in `needs_decision`, **When** the supervisor calls the tool, **Then** the call is refused with an `illegal_transition` reason, no form opens, and the validator receives nothing.
2. **Given** a key that does not match the live gate, **When** the supervisor calls the tool, **Then** the call is refused, the text names the live key and the live finding IDs, no form opens, and the validator receives nothing.
3. **Given** a `fix` that names a finding ID not in the live gate, a `fix` with no IDs, or a duplicate ID, **When** the supervisor calls the tool, **Then** the call is refused and nothing is sent.
4. **Given** `instructions` with `approve` or `skip`, **When** the supervisor calls the tool, **Then** the call is refused and nothing is sent.
5. **Given** an action that is not `approve`, `skip`, `fix`, or `rerun`, or an unknown argument, **When** the supervisor calls the tool, **Then** the call is refused as an invalid call and nothing is sent.
6. **Given** a project with `yolo` on, **When** the supervisor calls the tool for an `ask-user` finding, **Then** the form opens anyway, and the validator receives the answer only after the owner approves.
7. **Given** the owner denies, cancels, lets the form time out, or answers with something unreadable, **When** the form closes, **Then** the validator receives nothing, the task stays `needs_decision`, and the tool result says what happened.
8. **Given** the owner approved, **When** the live gate changed while the form was open (a new key), **Then** the plugin sends nothing and tells the supervisor to read the new gate and ask again.
9. **Given** the caller is a worker, **When** it calls the tool, **Then** it is refused as `actor_forbidden`.
10. **Given** a task of another project, an unknown task, or a scout task, **When** the supervisor calls the tool, **Then** the call is refused and nothing is sent.
11. **Given** a form for a task is already open, **When** the supervisor calls the tool for that task again, **Then** the second call is refused and does not open a second form.
12. **Given** the validator cannot report the live gate (the command fails or the output is unreadable), **When** the supervisor calls the tool, **Then** the call fails closed and sends nothing.

### User story 4 - Decide on a run that finished without a clean pass (priority: P2)

A pipeline run finished with `passed-with-override`, `passed-with-skips`, `passed`, or `checks-passed` with no pull request.
The driver parked the task in `needs_decision`, and there is no gate to answer.
The one decision that the existing machine supports is `resolve`, which returns the task to `validating`, where the driver asks the pipeline to start again.
The supervisor calls `factoryman_decide` with action `rerun`, the owner approves a form that says so, and the plugin records `resolve`.

**Why this priority**: D-031 names this case as the second reason a task parks.
The captain's brief limits it to what the machine already supports.
Accepting the outcome and moving the task to review needs a new machine event, and that is recorded as a gap.

**Independent test**: Drive a task to a parked, finished run with the fake validator, call the tool with `rerun`, approve the form, and read the task state and the log.

**Acceptance scenarios**:

1. **Given** a task parked on a finished run, **When** the supervisor calls the tool with `rerun` and the current key, **Then** the form shows the run's outcome and says that approval starts a new run, and nothing is sent to the validator's `answer`.
2. **Given** the owner approved, **When** the plugin records the decision, **Then** the task is `validating`, the log holds a `resolve` event with evidence that the owner approved a new run, and the driver then asks the validator to start.
3. **Given** a pending gate, **When** the supervisor calls the tool with `rerun`, **Then** the call is refused, because a gate is answered with `approve`, `skip`, or `fix`.
4. **Given** a parked finished run, **When** the supervisor calls the tool with `approve`, `skip`, or `fix`, **Then** the call is refused, because no gate is pending.
5. **Given** a task parked because the validator failed five times, or whose live view is `running`, **When** the supervisor calls the tool, **Then** the call is refused with the reason, and nothing is recorded.
6. **Given** the gap, **When** `docs/DECISIONS.md` is read, **Then** it records that accepting an override or skipped steps and moving to `review_ready` needs a new machine event and is not built.

### User story 5 - The supervisor has the tool on all four harnesses (priority: P1)

The plugin registers `factoryman_decide` with the supervisor's tools and never with a worker's.
The conformance harness checks it offline at tier 1 and tier 1.5 on Claude Code, Codex, Pi, and omp.

**Why this priority**: The registration is harness-neutral, so a supervisor on any harness gets the same tools.
The harness suite is how the repository proves that.

**Independent test**: Read the registration, then run `pnpm run conformance` at tier 1 and tier 1.5 for the four harnesses.

**Acceptance scenarios**:

1. **Given** a thread with `role: supervisor`, **When** bb asks which tools to offer, **Then** the list holds the five supervisor tools including `factoryman_decide`.
2. **Given** a thread with `role: worker` or no role, **When** bb asks, **Then** the list holds no `factoryman_decide`.
3. **Given** the plugin factory, **When** it runs in the fake host, **Then** it registers six tools and no seventh.
4. **Given** scenario S5 and scenario S9, **When** they run at tier 1 and tier 1.5, **Then** they require the five supervisor tools and still pass on all four harnesses.
5. **Given** scenario S8, **When** it runs, **Then** it calls `factoryman_decide` on a task that is not in `needs_decision` and requires the refusal and an unchanged state.
6. **Given** the five conformance runs (tier 1, and tier 1.5 on four harnesses), **When** they end, **Then** each exits 0, the isolation check is clean, the tripwire records no event, and `conformance/known-gaps.json` lists no entry.

### User story 6 - The change is recorded and the repository stays tidy (priority: P2)

The owner reads the design, the decision log, the constitution, and the supervisor skill and finds what was decided.

**Why this priority**: The repository's rule is that every deviation and decision is recorded, and the documents must not contradict the code.

**Independent test**: Read the documents and run the guard tests that pin them.

**Acceptance scenarios**:

1. **Given** `docs/DESIGN.md`, **When** the supervisor's tool table is read, **Then** it lists `factoryman_decide` and says the supervisor has five tools and a worker a sixth.
2. **Given** `docs/DECISIONS.md`, **When** the new entries are read, **Then** they start at D-136, no existing number changes, and each entry gives its reason.
3. **Given** `.specify/memory/constitution.md`, **When** Principle VI is read, **Then** it no longer says `factoryman_decide` stays out, and the version is bumped with a written reason in the decision log.
4. **Given** the supervisor skill, **When** it is read, **Then** it tells the supervisor how to answer a finding with `factoryman_decide` and says that the owner approves.
5. **Given** a full `pnpm run check`, **When** it ends, **Then** it adds no directory to the system temporary directory, and every new test helper that makes a directory makes it under the test file's private `TMPDIR` and removes it.

### Edge cases

- The supervisor passes an old key because the gate moved after a `fix` round (the same run and step, new finding IDs).
  The key covers the run ID, step, status, and finding IDs, so the old key no longer matches.
- Someone answers the gate directly in no-mistakes while the form is open.
  The driver's next pass resolves the task, the post-approval check finds the task no longer in `needs_decision`, and the plugin sends nothing.
- The owner approves after the form's timeout.
  bb reports the form as cancelled, so nothing is sent.
- The pipeline answer call times out inside the validator's wait.
  The validator reports the view it has, the driver applies `resolve`, and its loop carries on, as `driver.answer` does today.
- The gate has findings whose `action` is `ask-user`, `auto-fix`, or empty.
  The form shows the action as written, and the answer rules do not depend on it.
- A finding's text holds markdown, HTML, or control characters.
  The form shows it as plain text, and the tool result and the log keep it verbatim.
- The finding list is long.
  The form scrolls the list, and the tool result clips only its own summary and never an ID.
- A restart happens while a form is open.
  The form's wait ends, nothing is sent, and the task is still `needs_decision`.
- A `fix` names every finding in the gate.
  It is allowed, because that is the pipeline's own answer to fix all.

## Requirements

### Functional requirements

- **FR-001**: The plugin MUST register a tool named `factoryman_decide`, and MUST offer it to supervisor threads only.
  A worker thread and a thread with no role MUST NOT be offered it, and a worker that calls it MUST be refused as `actor_forbidden`.
- **FR-002**: The tool MUST take a strict argument object: `taskId`, `key`, `action` (one of `approve`, `skip`, `fix`, `rerun`), and for `fix` the `findingIds` and an optional `instructions`.
  The advertised JSON schema MUST be one flat object, with no `oneOf`, so that every harness accepts it, and the tool MUST check the cross-field rules itself.
- **FR-003**: The tool MUST act only on a ship task in the caller's own project, and only while the task is `needs_decision`.
  Any other call MUST be refused before a form opens.
- **FR-004**: The tool MUST read the live view of the pipeline run through the validator interface (the `status` operation, in the worker's worktree, on the task's host) and MUST NOT trust the supervisor's description of the gate.
  When the view cannot be read, the tool MUST fail closed.
- **FR-005**: The decision key MUST be a deterministic value of the live view: the run ID, the gate step, the gate status, the finding IDs in the order the validator reported them, the outcome, and the phase.
  The driver MUST write the key into the evidence of the `finding` event that parks the task, so the wake message, the status read, and the log show it.
  The tool MUST refuse a call whose key differs from the live view's key, and the refusal MUST name the live key and the live finding IDs.
- **FR-006**: For a pending gate, the tool MUST accept `approve` and `skip` with no finding IDs and no instructions, and `fix` with a non-empty list of distinct finding IDs that all appear in the live gate, with optional non-empty instructions.
  It MUST refuse any other combination, and MUST refuse `rerun`.
- **FR-007**: For a parked, finished run (the outcome is `passed`, `passed-with-override`, `passed-with-skips`, or `checks-passed` with no pull request), the tool MUST accept `rerun` only, and MUST refuse `approve`, `skip`, and `fix`.
  For a view that is `running`, or that cannot be decided, the tool MUST refuse.
- **FR-008**: After the argument and state checks, the tool MUST open an approval form through `bb.ui.requestInput` with a new renderer, on the supervisor's thread, with the configured approval timeout, whatever the project's `yolo` flag says.
  The tool MUST NOT read the `yolo` flag.
- **FR-009**: The form's payload MUST be built from the live view and the validated answer, and MUST carry the task ID, the key, the gate step and status, every finding (ID, severity, file, action, description), and the exact answer (action, finding IDs, instructions).
  For `rerun` it MUST carry the run's outcome in place of findings.
  The payload type and the renderer ID MUST live in one module with no imports, shared by the tool and the frontend, as the merge approval's contract does.
- **FR-010**: The tool MUST accept as approval only the strict answer `{ decision: "approved" }` (with an optional comment).
  Every other result (a denial, a cancel, a timeout, an unreadable value) MUST send nothing to the validator and MUST leave the task unchanged.
- **FR-011**: After the owner approves, the tool MUST read the live view again, and MUST send the answer only if the task is still `needs_decision` and the key is unchanged.
  Otherwise it MUST send nothing and say that the gate changed.
- **FR-012**: The tool MUST send the answer through the validation driver's answer path, which calls the validator interface's `answer` operation and then records `resolve`.
  The driver MUST record `resolve` only after the validator accepts the answer.
  The evidence of `resolve` MUST name the action, the finding IDs, and the instructions, and MUST say that the owner approved the answer in the decision form, with the owner's comment when there is one.
- **FR-013**: For `rerun`, the tool MUST NOT call the validator's `answer` operation.
  It MUST record `resolve` through the driver with evidence that the owner approved a new run, and the driver loop MUST then ask the validator to start, as it does after any `resolve`.
- **FR-014**: The tool MUST NOT change the state machine, the machine's events, or any guard, and `src/machine/` MUST NOT import bb.
  A decision that needs a new machine event MUST be recorded as a gap in `docs/DECISIONS.md` and left unbuilt.
- **FR-015**: The plugin MUST NOT pass `--yes` or `-y` to `no-mistakes`, in any call, and MUST NOT answer a gate except through this tool after the owner's approval.
  The driver's loop MUST still never answer a gate.
- **FR-016**: At most one decision form MUST be open for a task at a time.
- **FR-017**: A denied, cancelled, timed-out, or unreadable form, and a refused call, MUST leave the event log unchanged, because the machine has no event for them.
  The plugin MUST log the outcome to the plugin log, and the tool result MUST tell the supervisor what happened.
  This gap MUST be recorded in `docs/DECISIONS.md`.
- **FR-018**: The decision form MUST render every string from the payload as plain text, MUST offer Approve only when it can read the whole payload, and MUST keep Deny and Cancel always available.
- **FR-019**: The frontend entry MUST register the decision renderer beside the merge renderer, and the merge renderer MUST NOT change.
- **FR-020**: The harness-neutral tool registration MUST include the tool, and the supervisor-tool list in the conformance harness MUST include it, so S5 and S9 check five supervisor tools.
  Scenario S8 MUST check the tool's wrong-state refusal at tier 1 and tier 1.5.
  The harness MUST need no new scenario, no new tier, and no known gap.
- **FR-021**: The result files in `conformance/results/` and `docs/HARNESS-SUPPORT.md` MUST come from a real run of the final code at tier 1 and tier 1.5 for the four harnesses, offline, with no credential.
- **FR-022**: `docs/DESIGN.md` MUST list the tool in the supervisor's tool table, MUST change the counts that the sixth tool makes wrong, and MUST add the decision to the authority gates table.
- **FR-023**: `docs/DECISIONS.md` MUST record each decision and each deviation of this feature from D-136 on, with no renumbering.
  The constitution's Principle VI MUST stop saying that `factoryman_decide` stays out, and the version MUST be bumped.
- **FR-024**: The supervisor skill MUST tell the supervisor to read the findings and the key from the wake message, to call the tool, and to expect the owner's form.
- **FR-025**: The change MUST keep the eight hard rules of `CLAUDE.md`, MUST NOT change how the validator runs, MUST add no dependency, and MUST NOT touch tier 2 runs, credentials, or branch protection.
- **FR-026**: New test helpers MUST make their temporary directories under the test file's private `TMPDIR` and MUST remove them, so a full `pnpm run check` adds no directory to the system temporary directory.

### Key entities

- **Decision key**: A short value that names one state of the live view (run, step, status, findings, outcome). The driver writes it into the parking evidence, and the tool compares it with the live view.
- **Decision request**: The form payload: the task, the key, the gate or the finished run, and the exact answer.
- **Decision answer**: The supervisor's answer: `approve`, `skip`, `fix` with IDs and instructions, or `rerun`.
- **Owner approval**: The strict answer from the form. It authorizes one specific answer for one key, once.
- **Parked task**: A ship task in `needs_decision`, with either a pending gate or a finished run that needs a person.

## Success criteria

### Measurable outcomes

- **SC-001**: In 100 percent of the tests that end with the validator receiving an answer, the owner approved a form for that exact answer first; in 0 tests does the validator receive an answer without one.
- **SC-002**: Across the refusal tests (every acceptance scenario of story 3), the validator receives 0 answers and 0 forms open before the checks that precede the form.
- **SC-003**: With `yolo` on, the form opens in every test, and no test finds a path that skips it.
- **SC-004**: No test finds `--yes` or `-y` in a command the validator runs.
- **SC-005**: The conformance suite reports the five supervisor tools in S5 and S9 for 4 of 4 harnesses at tier 1.5 and at tier 1, S8 passes its new check on all five runs, and the known-gaps file lists 0 entries.
- **SC-006**: `docs/HARNESS-SUPPORT.md` lists 0 known gaps and shows the new results.
- **SC-007**: `pnpm run check` passes with no new lint or type error, and adds 0 directories to the system temporary directory.
- **SC-008**: The documents agree with the code: no document says the supervisor has four tools or that the plugin registers five, and `factoryman_decide` is never described as out of scope.

## Assumptions

- A pipeline gate accepts exactly three answers: `approve`, `skip`, and `fix` with finding IDs.
  The recorded output of no-mistakes 1.84.0 lists them in its `help` lines and `axi respond --help` names them, and the output holds no per-finding list of allowed actions.
  So the "allowed actions" of a finding are these three, and a `fix` may name only the IDs in the live gate.
- The driver's existing `answer` path (the validator's `answer`, then `resolve`) is the right place for the send, and its loop carries on after `resolve` without a restart.
- A form is not proof of a human (D-030, D-058).
  An agent with a shell can answer the owner's form through `bb thread interactions respond`.
  The captain accepts that gap until milestone 10, and this tool inherits it.
- The `finding` evidence that the driver writes has room for one more line, because the wake message keeps up to 8000 characters of it.
- The existing approval-timeout setting is reused for the decision form.
- A restart while a form is open ends the wait and sends nothing, which is the same behavior as the merge form.
- `rerun` relies on the pipeline starting a new run when the driver calls `start` while no run is active.
  No test runs a real no-mistakes install here, and D-134 already records that limit.
  A pipeline that returns the same finished run parks the task again, and the supervisor asks again.
- The conformance lab has no `no-mistakes` project, so no tier 1 or tier 1.5 scenario can reach `needs_decision` through the pipeline.
  The scenarios cover the registration and the refusal path, and unit and acceptance tests cover the answer path with the fake validator.

## Out of scope

- Tier 2 real-model runs and any credential.
- Branch protection work and the owner-typed approval code (D-095).
- Any change to how the validator itself runs: the `no-mistakes` command lines, the adapter's flags, and the polling loop's timing.
- A new machine event or guard, and moving a parked task to `review_ready` after an override or skipped steps (recorded as a gap).
- A tool that cancels a queued task, or that fails a task, for the supervisor.
- The live install into the owner's bb.
