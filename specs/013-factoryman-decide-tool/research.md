# Research: The `factoryman_decide` tool

Each entry gives the decision, the reason, and what else was weighed.
The numbers D-136 to D-143 are the decision-log entries that the implementation writes.

## R1: Which answers does a gate allow?

**Decision**: A pending gate allows `approve`, `skip`, and `fix` with finding IDs that all appear in the live gate.
A finished run that parked a task allows `rerun` only.
**Evidence**: `no-mistakes axi respond --help` says `--action string approve | fix | skip (required)`.
The recorded gate output (`test/fixtures/recorded/no-mistakes-1.84.0/gate-review.toon`) lists the same three in its `help` lines, and it holds no per-finding allowed-actions list.
The finding's own `action` column (`auto-fix`, `ask-user`) classifies the finding and does not restrict the answer.
**Rationale**: The brief says to refuse an answer that is not one of the finding's allowed actions.
The only allowed set the pipeline publishes is these three, so the plugin enforces exactly them, and it enforces the `fix` ID rule because the pipeline would otherwise get an ID that does not exist.
**Alternatives considered**: Read the allowed set from the `finding.action` column.
It is a classification, so using it would invent a rule the pipeline does not have.
Pass any answer through and let the pipeline refuse it: this fails open on a stale or wrong ID.
**Records**: D-137.

## R2: What is the finding key?

**Decision**: `nm-<runId>-<step or outcome>-<8 hex>`.
The hex is a SHA-256 prefix over the driver's existing view signature (phase, gate step, gate status, finding IDs, outcome, run ID).
**Rationale**: The key must change when the gate changes, including after a `fix` round that keeps the run and step but drops findings (see `gate-fix-review.toon`).
The driver already defines "the same view" with that signature, so reusing it keeps one meaning.
A hash keeps the key short enough for an agent to copy without a typo, and the run and step prefix keeps it readable and matches the shape the fleet already uses for escalations.
**Where it shows**: The driver writes it into the evidence of the `finding` event.
The wake message already carries that evidence (up to 8000 characters), so the supervisor sees it without a new channel, and the log keeps it as an audit trail.
**Alternatives considered**: A bare finding ID.
It does not change when the gate moves.
A read-only call to the tool that returns the key.
It adds a second path and a second place where the key can go stale.
A counter in the store.
It adds state the log would have to replay.
**Records**: D-138.

## R3: Where does the tool get the live view?

**Decision**: A new `ValidationDriver.current(taskId)` that runs `validator.status` in the task's worktree and host, using the same context as the loop.
**Rationale**: The driver already owns "where does the validator run for this task" (`context`).
A second copy in the tool would drift.
The tool depends on a small `Decider` interface, so tests pass a fake and the registration needs no driver import.
**Alternatives considered**: Call the validator from the tool.
It would need the worker's worktree path and the host, which duplicates `context`.
Read the view from the last `finding` evidence.
It can be stale, and it holds no structured findings.
**Records**: D-138.

## R4: What does the form look like, and which path does it use?

**Decision**: A new renderer, `factoryman-decision-approval`, in `src/app/decision-approval-form.tsx`, registered in `src/app.tsx` beside the merge renderer.
It reuses the merge form's answer contract (`ApprovalAnswer`, `answerFor`) and the same server-side strict schema for the reply.
**Rationale**: The brief says to route the answer "through the same form path the merge approval uses".
That path is `bb.ui.requestInput` with a renderer ID and a JSON payload from an import-free module.
The merge form shows a pull request and an evidence block, so it cannot show findings and an answer.
**Alternatives considered**: Reuse the merge renderer with the findings packed into `evidence`.
It would label the form "Merge approval" and show no exact answer.
bb's default input form with no custom renderer.
It would show raw JSON.
**Records**: D-139.

## R5: What about `yolo`?

**Decision**: The tool never reads `yolo`.
**Rationale**: The brief says never to skip the form when `yolo` would bypass an `ask-user` finding.
The simplest way to hold that is that the tool has no code path that reads the flag, and a test with `yolo` on shows the form opens.
The merge approval's `yolo` skip is a property of the merge gate (hard rule 1), not of findings.
**Alternatives considered**: Skip the form under `yolo` for findings that are not `ask-user`.
A finding's `action` column is the pipeline's own label, and the tool would then depend on it for a safety decision.
**Records**: D-139.

## R6: Is a new machine event needed?

**Decision**: No.
The answer records `resolve`, which the machine allows from `needs_decision`, with the owner's approval in the evidence.
A denial or a cancel records nothing, because no event describes it.
**Rationale**: The brief says to record a needed machine event as a gap and not to widen scope.
Adding a `record_approval` scope for decisions would be a machine change (a new scope, a table entry, a guard), so it waits for the owner.
**Gap**: A denied or timed-out decision form leaves no row in the event log.
The plugin log and the tool result carry it.
**Alternatives considered**: Add the scope now.
It is the better audit trail, and it is a design change to a hard-rule area.
**Records**: D-140.

## R7: What can the machine already do for a finished run?

**Decision**: `rerun` only: apply `resolve` (needs_decision to validating) so that the driver's loop calls `start` again.
**Rationale**: D-031 names a run that ends with an override, skipped steps, or no pull request.
There is no gate, so `validator.answer` has nothing to answer.
The one transition the machine offers besides `fail` is `resolve`.
The owner decides whether another run is worth it, which is a real decision.
**Gap**: Accepting the outcome and moving the task to `review_ready` needs a new machine event, such as `validated` from `needs_decision` with an override flag.
It is recorded and not built.
**Limit**: What `no-mistakes axi run` does when the last run on the branch has finished is not verified here.
If it returns the same finished run, the driver parks the task again with the same key, and the supervisor can ask again.
`fail` from `needs_decision` also exists, but a tool to fail a task is a separate feature.
**Records**: D-141.

## R8: Can the existing conformance scenarios host the tool?

**Decision**: Yes, in three places.
S5 and S9 already check the supervisor's tool list from `SUPERVISOR_TOOLS`, so adding the tool there makes both require five.
S8 already calls a tool on a task in the wrong state and requires a refusal, so one more check there covers `factoryman_decide`.
**Limit**: The lab's project is `local-only` or `direct-PR`, with no `no-mistakes` pipeline, so no scenario can drive a task into `needs_decision`.
The answer path is covered by unit and acceptance tests with the fake validator.
**Alternatives considered**: A new scenario that seeds a `no-mistakes` project and a fake `no-mistakes` binary.
That changes the lab and is wider than the brief allows.
**Records**: D-142.

## R9: What other text says "four" or "five"?

**Found by search** (`grep -rniE "four.*tool|five tool"`):
`docs/DESIGN.md` lines 159 and 246 (and the build plan on line 350, which is history and stays), `docs/CONFORMANCE.md` lines 94 and 98, `docs/LIVE-CHECK.md` line 377, `src/harness/advice.ts`, `src/tools/supervisor-start.ts`, `src/tools/supervisor-command.ts`, `src/server.ts`, and the S5 and S9 scenario titles.
Tests that pin them: `src/harness/advice.test.ts`, `test/acceptance/design-profiles.test.ts` (A1710), `test/fixtures/conformance-lab.test.ts`, `tools/conformance/readers.test.ts`, `tools/conformance/scenarios/scenarios.test.ts`, `src/tools/register.test.ts`, `src/server.test.ts`, `test/acceptance/plugin.test.ts`, `test/acceptance/tools-visibility.test.ts`, `test/acceptance/skills.test.ts`, and `test/acceptance/decision-log.test.ts` (A1618 pins constitution 1.4.0).
Each of these changes with the product text, in the same commit as the text, and each change is an update to the new truth and not a weaker check.

## R10: Should the clarify step run?

**Decision**: No.
The specification has no open marker, and the Firstmate brief fixes the choices that a clarification would ask about (the form path, the tool name, the second case limit).
**Records**: D-143.
