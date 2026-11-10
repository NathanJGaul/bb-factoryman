# Implementation plan: The `factoryman_decide` tool

**Branch**: `fm/bb-factoryman-decide-tool` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

## Summary

The captain approved a sixth tool (D-057, from D-031).
`factoryman_decide` lets the supervisor answer a pending no-mistakes gate, and the answer goes through a form that the owner approves.

The plan has five parts.

1. **The decision key.**
   A pure module turns the validator's live view into a short key.
   The driver writes the key into the evidence that parks a task, so the wake message shows it.
   The tool compares the supervisor's key with the live view's key.
2. **The tool.**
   `src/tools/decide.ts` checks the caller and the task, reads the live view, validates the answer against the live gate, opens the owner's form, reads the live view again, and only then sends the answer through the driver.
3. **The driver.**
   It gains a read of the live view, a `rerun` path (the existing `resolve` event), and an optional evidence argument on `answer`.
   Its loop still never answers a gate.
4. **The form.**
   A new renderer shows the findings and the exact answer.
   It shares one import-free contract module with the tool, as the merge form does.
5. **Registration, harness suite, and documents.**
   The tool joins the supervisor tools, S5, S8, and S9 learn the fifth tool, and the five offline conformance runs repeat.
   `docs/DESIGN.md`, `docs/DECISIONS.md` (from D-136), the constitution (1.5.0), and the supervisor skill change with it.

No state machine change: `resolve` and `fail` already exist in `needs_decision`.
What the machine cannot do (accept an override and go to `review_ready`) is a gap, recorded and not built.

## Technical context

- Language and tooling: TypeScript 6 (binary `tsc6`), ESM, Node 26, `pnpm` 12, `vitest` 5, `zod` 4, React 19 for the form.
  The conformance tools run under Node's type stripping, with `.ts` extensions in relative imports.
- Files that change or appear in `src/`:
  - `src/validator/key.ts` (new, no imports from bb): `viewSignature` (moved from the driver) and `decisionKey`.
  - `src/validator/driver.ts`: the key line in the parking evidence, `current(taskId)`, `rerun(taskId, actor, evidence)`, and an optional `evidence` on `answer`.
  - `src/approval/contract.ts`: the decision renderer ID, the payload type, and `readDecisionPayload` (still no imports).
  - `src/tools/decide.ts` (new): the schema, the answer rules, and the flow.
  - `src/tools/register.ts`: the tool, the supervisor list, and the `Decider` parameter.
  - `src/runtime.ts`: `openDecisionForms`.
  - `src/server.ts`: pass the driver to `registerTools`; the CLI summary text; the approval-timeout setting label.
  - `src/app/decision-approval-form.tsx` (new) and `src/app.tsx`: the renderer and its registration.
  - `src/harness/advice.ts`, `src/tools/supervisor-start.ts`, `src/tools/supervisor-command.ts`: "four supervisor tools" becomes "five".
- Files that change outside `src/`:
  - `skills/factoryman-supervisor/SKILL.md`.
  - `tools/conformance/scenarios/helpers.ts`, `s05-confinement.ts`, `s08-refusals.ts`, `s09-role-change.ts`, and the fake lab in `test/fixtures/conformance-lab.ts`.
  - `conformance/results/*.json` and `docs/HARNESS-SUPPORT.md` (regenerated from real runs), `docs/CONFORMANCE.md`, `docs/LIVE-CHECK.md`.
  - `docs/DESIGN.md`, `docs/DECISIONS.md`, `.specify/memory/constitution.md`, `.specify/memory/tdd-profile.md` (notes only).
- Tests: unit tests beside the sources, acceptance tests in `test/acceptance/`, form tests under jsdom, scenario tests in `tools/conformance/scenarios/scenarios.test.ts`.
  The acceptance layer is in-process, so the form's look is not checked there.
  The tier 1 and tier 1.5 runs check the registration and the wrong-state refusal through a real bb server.
- Facts used:
  - `Validator.answer` sends `approve`, `skip`, or `fix` with finding IDs and instructions.
    The adapter never passes `--yes` (FR-308 of milestone 6).
  - `ValidationDriver.answer` calls the validator and then applies `resolve`, and its loop already runs while the task is in `needs_decision`.
  - The machine allows `resolve` from `needs_decision` for any actor, and `finding` from `validating`.
  - The recorded gate output lists the three answers in `help` and has no per-finding allowed-actions field.
  - `bb.ui.requestInput` takes JSON, so the payload types are aliases and not interfaces (D-096).
  - The wake message keeps 8000 characters of the evidence for a `needs_decision` task.
- Constraints: no credential, no write to no-mistakes configuration, offline conformance runs, the lab path outside `/tmp` and outside any path that contains `firstmate`.
- Scale: three new source files, one new form, one tool, one scenario check, about eight decisions.

## Constitution check

| Principle | How the plan complies |
| --- | --- |
| I. Gates live in code and fail closed | The answer is sent only after a strict `approved` from the form, after two reads of the live view agree, and never under a read failure. The tool never reads `yolo`. No gate is removed. The gate is in the tool, because the validator call is outside the machine; D-140 records that. |
| II. Machine core is pure | No change to `src/machine/`. The key module sits in `src/validator/` and imports nothing from bb. |
| III. Event log is the source of truth | The `resolve` event carries the evidence of the owner's approval and the exact answer. The `finding` event carries the key. A denial leaves no row, which D-140 records as a gap. |
| IV. Storage behind an interface | No store change. |
| V. Test first | Every behavior in `tdd/test-list.md` gets a failing test first, recorded in `tdd/cycle-log.md`. The pure parts (key, payload reader, answer rules) get table-driven tests. The tool gets tests through the plugin factory, the form through jsdom, and the registration through the fake host and the conformance suite. |
| VI. Scope | **Needs an amendment.** Principle VI says `factoryman_decide` stays out of scope (D-057). The captain has now asked for it ("start the decide tool"), so the plan removes that clause and bumps the constitution to 1.5.0 (minor: scope widened). D-136 records the reason. The live install stays the owner's step. |
| Engineering constraints | No other bb plugin is called. `src/machine/` has no bb import. No dependency is added. Docs follow the Google developer documentation style, one sentence per line. |

Result: one justified amendment (Principle VI), no violation, so no complexity tracking.
The post-design check (below) found no new issue.

## Decisions

The decisions land in `docs/DECISIONS.md` from D-136.
The research file gives each one with its alternatives.

1. **D-136, scope**: build the sixth tool, amend Principle VI, and resolve D-031 and D-057.
2. **D-137, answers**: a pending gate takes `approve`, `skip`, or `fix` with IDs from the live gate; a parked finished run takes `rerun`.
   The advertised schema is flat.
3. **D-138, key**: the key is `nm-<run>-<step or outcome>-<hash>`, from the live view, and the driver writes it into the parking evidence.
4. **D-139, form**: a new renderer on the merge form's contract pattern, always shown, `yolo` never read, the approval timeout reused.
5. **D-140, gate and log**: the gate lives in the tool, the machine gets no event, and a denial or cancel leaves no log row (gap).
6. **D-141, second case**: only `rerun` through `resolve`; accepting an override or skipped steps needs a new machine event (gap, not built); the pipeline's reaction to a new `axi run` after a finished run is unverified (limit).
7. **D-142, conformance**: S5, S8, and S9 host the tool; no scenario reaches `needs_decision` because the lab has no `no-mistakes` project (limit).
8. **D-143, process**: the clarify step was skipped (no open marker), and the test-first waivers, if any, are recorded here.

## Project structure

```text
src/validator/key.ts                  # new: viewSignature, decisionKey
src/validator/driver.ts               # current, rerun, answer(evidence?), key in parking evidence
src/approval/contract.ts              # + DECISION_RENDERER_ID, DecisionRequestPayload, readDecisionPayload
src/tools/decide.ts                   # new: schema, answer rules, flow
src/tools/register.ts                 # + factoryman_decide, Decider parameter
src/runtime.ts                        # + openDecisionForms
src/app/decision-approval-form.tsx    # new: the owner's form
src/app.tsx                           # + second renderer
skills/factoryman-supervisor/SKILL.md # + the decide section
tools/conformance/scenarios/          # helpers, s05, s08, s09
specs/013-factoryman-decide-tool/     # these artifacts
```

## Design

### The key (`src/validator/key.ts`)

`viewSignature(view)` is the driver's current `signature` function, moved and exported unchanged.
`decisionKey(view)` returns `nm-<runId or "unknown">-<step or outcome or "running">-<8 hex>`.
The hex is the first eight characters of the SHA-256 of `viewSignature(view)`.
The prefix keeps the key readable and ties it to a run, and the hash covers the status, the finding IDs, and the outcome.
Two views have the same key when the driver would call them equal.

### The driver

- `park(task, view, evidence)` appends the line `Decision key: <key>` to the evidence of the `finding` event.
  The `failed()` park (five validator errors) has no view and so no key line.
- `current(taskId)` runs `validator.status` in the task's worktree on its host, with the same `context` the loop uses, and returns `{ ok: true, view } | { ok: false, message }`.
  It reads only, and it does not require a state.
- `answer(taskId, response, actor, evidence?)` keeps its behavior, and a given `evidence` replaces the default `answered the gate: <action>` text of the `resolve` event.
- `rerun(taskId, actor, evidence)` refuses outside `needs_decision`, applies `resolve` with the evidence, clears the baseline, and returns `AnswerResult`.
  The loop then runs `start` because the task is `validating`, as it does after any `resolve`.

### The tool (`src/tools/decide.ts`)

Order of work, each step before the next and every refusal before a form:

1. Worker caller: `actor_forbidden`.
2. Strict argument parse: `invalid_event`.
3. Task exists in the caller's project: else "No task ... exists in this project."
4. Ship task: else `illegal_transition`.
5. State is `needs_decision`: else `illegal_transition`.
6. No form open for the task: else a failure that says so.
7. Live view from `driver.current`: on failure, fail closed.
8. Key equals `decisionKey(view)`: else a failure that names the live key and the live IDs.
9. Answer rules against the view (gate: approve, skip, fix; finished and parked: rerun; anything else: refuse with the reason).
10. Machine preview of `resolve` with `wouldAccept`.
11. `bb.requestInput` with `DECISION_RENDERER_ID` on the caller's thread.
12. `cancelled`: failure. Unreadable answer: failure. `denied`: failure with the comment.
13. `approved`: read the task and the live view again. If the state or the key changed, send nothing.
14. Send: `driver.answer(taskId, answer, "supervisor", evidence)` or `driver.rerun(...)`.
    A failure reports the validator's reason, or that the task already moved on.
15. Success text: the task is `validating`, and the plugin wakes the supervisor at the next gate or outcome.

The evidence of `resolve` reads: `answered the gate: fix review-1, review-2 (instructions: ...). The owner approved this answer in the decision form for key nm-... (comment: ...).`
For `rerun`: `The owner approved a new no-mistakes run in the decision form for key nm-... (the last run finished as passed-with-override).`

### The form

`DecisionApprovalForm` mirrors `MergeApprovalForm`: a read of the payload, a comment box, Approve, Deny, Cancel, one in-flight action.
It shows the task, the step and status (or the run's outcome), a list of findings with their five fields, and an "Answer that will be sent" block that it builds from the payload's `answer`.
`readDecisionPayload` checks the exact keys and types, and checks that every `answer.findingIds` entry appears in `findings`, and that `fix` has at least one ID; otherwise the form offers no Approve.
All text is a React text node.

### Registration and conformance

`registerTools` adds the tool to `SUPERVISOR_TOOLS` last, and takes the driver as its `Decider`.
The conformance `SUPERVISOR_TOOLS` list gains the tool, so S5 and S9 expect five.
S8 gains `S8.decide-wrong-state`: it calls the tool on the silent scout task (state `working`) and requires an error that names `needs_decision`, no `resolve` row, and an unchanged state.
The fake lab learns the same refusal so that the scenario tests pass offline.
`conformance/known-gaps.json` stays empty.

### Documents

- `docs/DESIGN.md`: the tool table, the counts ("four", "fifth"), one row in the authority gates table, and a sentence in the validator paragraph.
- `docs/DECISIONS.md`: D-136 to D-143, an "Amended by" line on D-031 and D-057, and the cited numbers.
- `.specify/memory/constitution.md`: 1.5.0.
- `docs/CONFORMANCE.md` and `docs/LIVE-CHECK.md`: the counts.
- The supervisor skill: a section "Answer a finding" and the table row.

## Test plan (summary)

The full list is in `tdd/test-list.md`, derived next.

- Unit: key, driver additions, contract reader, decide rules and flow, form, registration, `server.ts` counts.
- Acceptance (real entry points: the plugin factory, the registered renderer, the conformance scenarios): the tool's happy path for each answer, every refusal, the form paths, yolo, `--yes`, the second case, visibility, the documents.
- Mutants for the verify step: drop the key check, drop the post-approval re-read, read `yolo`, send before approval, treat `denied` as approval, accept a `fix` with an unknown ID, pass `--yes`, register the tool for workers.

## Post-design constitution check

- The tool adds no event, guard, or state, so Principles I to III hold.
- The key module is pure and sits outside `src/machine/`.
- The driver change is additive: one evidence line, one read, one send path, and an optional argument.
  The driver's tests stay as they are, and new tests cover the additions.
- The renderer and the tool share only an import-free module, so the bundle gains no `zod`.
- No new dependency.
