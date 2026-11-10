# Tasks: The `factoryman_decide` tool

**Input**: Design documents from `specs/013-factoryman-decide-tool/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/decide.md, quickstart.md, tdd/test-list.md

**Tests**: Mandatory. The constitution (principle V) makes every behavior change test first.
Every test is seen failing for the right reason before its implementation, and the failure goes in `tdd/cycle-log.md`.
A bracketed id such as `[U1801]` ties a task to a behavior in `tdd/test-list.md`.
`/speckit.tdd.run` ticks a task only when it can read an id from it.

**Organization**: Tasks are grouped by user story.
The phases run in dependency order and not in priority order: the shared modules come first, then the registration (story 5, first half), because every acceptance test calls the tool through the plugin; then the answer path (story 1), the refusals (story 3), the form (story 2), the second case (story 4), the harness suite and the wording (story 5, second half), and the documents (story 6).
Commands run from the repository root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: The user story in `spec.md` that the task serves.

## Phase 1: Setup

- [X] T001 Run `pnpm install --frozen-lockfile` and `pnpm run check` on the clean branch, and record in `specs/013-factoryman-decide-tool/tdd/cycle-log.md` that the baseline is green (tests, lint, type check) and how long it takes. Count the `bb-fake-plugin-host-*` directories directly under `${TMPDIR:-/tmp}` before and after one `pnpm run test`, and record both numbers as the leak baseline for [A1820].

## Phase 2: Foundational (blocks every story)

**Purpose**: The key, the payload contract, the driver additions, and the runtime set that more than one story needs.

- [X] T002 [P] Write the key tests in `src/validator/key.test.ts`: [U1801] a gate view gives `nm-<runId>-<step>-<8 hex>`; [U1802] a finished view gives `nm-<runId>-<outcome>-<8 hex>`, a null run ID gives `unknown`, and a running view gives `running` in the middle part; [U1803] equal views give equal keys, and a change of status, finding ID, finding order, outcome, run ID, or phase changes the key (table-driven). Then add `src/validator/key.ts` with `viewSignature` (moved from `src/validator/driver.ts`, unchanged) and `decisionKey`, and make the driver import `viewSignature`. Covers [U1801] [U1802] [U1803].
- [ ] T003 [P] Write the contract tests in `src/approval/contract.test.ts`: [U1813] the decision renderer ID is `factoryman-decision-approval` and differs from the merge ID; [U1814] `readDecisionPayload` returns a valid gate payload and a valid finished-run payload unchanged; [U1815] it returns null for a non-object, an array, null, an extra key at any level, a missing key, a wrong type, a `kind` or `answer.action` outside its set, an `answer.findingIds` entry that is not in `findings`, a `fix` with no IDs, and a finding with an extra key (table-driven). Then add `DECISION_RENDERER_ID`, `DecisionRequestPayload`, and `readDecisionPayload` to `src/approval/contract.ts` (no imports; type aliases and not interfaces). Covers [U1813] [U1814] [U1815].
- [ ] T004 Write the driver tests in `src/validator/driver.test.ts`: [U1805] the evidence of the `finding` event for a gate ends with the line `Decision key: <key>` and keeps its earlier text; [U1806] the same for a finished run that parks the task (override, skips, passed, no pull request); [U1807] the park after five validator errors has no key line; [U1808] `current` returns the view that `validator.status` gave, with the worktree path and the host of the task (a remote task too), and writes no event; [U1809] `current` returns `ok: false` with a message when the worktree path is unreadable or the validator fails; [U1810] `answer` with an `evidence` argument records that text on `resolve`, and without it keeps the default text; [U1811] `rerun` in `needs_decision` records `resolve` with the actor and the evidence, calls no validator operation, and clears the baseline, and outside `needs_decision` it returns `ok: false` and the machine logs the refusal; [U1812] after `rerun` the loop calls `start`. Then implement `park`'s key line, `current`, the `evidence` argument, and `rerun` in `src/validator/driver.ts`. Covers [U1805] [U1806] [U1807] [U1808] [U1809] [U1810] [U1811] [U1812].
- [ ] T005 Add `openDecisionForms` (a `Set<string>`, as `openMergeForms` is) to `Runtime` in `src/runtime.ts`. A test is not needed on its own: [A1809] covers it.

## Phase 3: User story 5, first half - The tool is registered for supervisors (P1)

**Goal**: bb offers `factoryman_decide` to supervisor threads only, and the factory registers six tools.

**Independent test**: The registration tests below pass in the fake host.

- [ ] T006 [US5] Write the acceptance test [A1816] in `test/acceptance/tools-visibility.test.ts`: `agents.configure` offers a supervisor thread the five supervisor tools with `factoryman_decide` last, a worker only `factoryman_report`, and a thread with no role none. See it fail.
- [ ] T007 [P] [US5] Write the unit tests in `src/tools/register.test.ts`: [U1824] `toolsForMetadata` returns five names for a supervisor, the last one `factoryman_decide`, and the other two roles are unchanged; [U1825] `registerTools` registers six tool names and no seventh, the `factoryman_decide` parameters are one flat object whose `action` is an enum and which has no `oneOf` or `anyOf`, and a call reaches `decide`. Update [U36] and [U33] to the new truth (six names, five supervisor tools).
- [ ] T008 [P] [US5] Update the plugin-level pins to the new truth in `src/server.test.ts` ([U123]: six tools) and `test/acceptance/plugin.test.ts` ([A17]: exactly six tools), and write [U1826] in `src/server.test.ts`: the plugin passes its driver to the registration, so a call to `factoryman_decide` reaches the driver. See them fail.
- [ ] T009 [US5] Add the `Decider` interface and a first `decide` function with the schema `decideSchema` to `src/tools/decide.ts`, add the tool to `SUPERVISOR_TOOLS` (last) and one `define(...)` to `src/tools/register.ts` with a `decider` parameter, and pass the driver from `src/server.ts`. The first `decide` does only what [U1825] and [A1816] need: the worker check, the argument parse, and a call to the tool body. Update the existing callers of `registerTools` in `src/tools/register.test.ts`. Covers [A1816] [U1824] [U1825] [U1826].

## Phase 4: User story 1 - Answer a pending gate with the owner's approval (P1)

**Goal**: A supervisor's `approve`, `skip`, or `fix` reaches the pipeline after the owner approves a form, and the task returns to `validating`.

**Independent test**: [A1801] to [A1804] and [A1813] pass through the plugin factory with the fake validator and the real adapter.

- [ ] T010 [US1] Write the acceptance tests in `test/acceptance/tools-decide.test.ts` through `loadWorld`, with a helper that drives a `no-mistakes` task into `needs_decision` by the real driver: [A1813] the `finding` event holds `Decision key:` and the wake message to the supervisor shows it; [A1801] a `fix` of one finding with instructions opens one form, and the validator receives the answer only after the owner approves, and the task is `validating` with a `resolve` row whose evidence names the answer and the owner's approval; [A1802] `approve` and `skip` reach the validator with no finding IDs (table-driven); [A1803] when the validator rejects the answer the task stays `needs_decision`, no `resolve` row is written, and the text gives the reason; [A1804] with the real `NoMistakesValidator` over a recording exec, the answer's command line is `axi respond --action fix --findings ... --instructions ... --wait ...` and holds no `--yes` and no `-y`. See them fail.
- [ ] T011 [P] [US1] Write the unit tests in `src/tools/decide.test.ts` for the pure parts: [U1816] `decideSchema` is strict and refuses an unknown key, a missing `key`, and an action outside the four; [U1817] the answer rules for a pending gate (table-driven, see spec FR-006); [U1819] `decisionRequest` builds the payload: a gate gives `kind: "gate"` with the findings verbatim, `answer.instructions` is `""` when none, and a finished run gives `kind: "finished"`, empty `findings`, and the outcome; [U1820] `decisionEvidence` names the action, the finding IDs, the instructions, the key, and the owner's comment. See them fail.
- [ ] T012 [US1] Implement the flow in `src/tools/decide.ts` for the happy path only: task and state lookup, `driver.current`, the key and the gate-answer rules, `wouldAccept` of `resolve`, `bb.requestInput` with `DECISION_RENDERER_ID` and the payload, the strict `approvalAnswerSchema` reply, the second read, and `driver.answer(..., "supervisor", evidence)`. Build the payload and evidence with the functions of T011. Covers [A1801] [A1802] [A1803] [A1804] [A1813] [U1816] [U1817] [U1819] [U1820].
- [ ] T013 [US1] Write [U1821] in `src/tools/decide.test.ts` with a fake `Decider`: the tool reads the live view twice, sends the answer once, and sends it with the evidence of [U1820]; [U1822] when the send fails and the task is no longer `needs_decision`, the text says that the task moved on; [U1823] when the machine would refuse `resolve`, nothing is sent. See them fail, then make them pass in `src/tools/decide.ts`. Covers [U1821] [U1822] [U1823].

## Phase 5: User story 3 - A refusal fails closed and sends nothing (P1)

**Goal**: Every wrong call is refused before a form opens, and a form that does not approve sends nothing.

**Independent test**: [A1805] to [A1810] pass, and in each the fake validator received no answer.

- [ ] T014 [US3] Write [A1805] in `test/acceptance/tools-decide.test.ts` (table-driven, each row checks that no form opened, no answer reached the validator, and the state and the log did not change): a task not in `needs_decision`; a scout task; an unknown task; a task of another project; a worker caller; an unknown action; an unknown argument; a key that does not match (the text names the live key and the live finding IDs); a `fix` with an unknown ID, with no IDs, and with a duplicate ID; `instructions` with `approve` and with `skip`; `rerun` on a gate. See each fail and add the check to `src/tools/decide.ts`.
- [ ] T015 [P] [US3] Write [A1806] in the same file: with `yolo` on, the form opens, and the answer reaches the validator only after the approval. Write [A1807] (table-driven): a denial, a cancel, a timeout (`approvalTimeoutMinutes: 0.0005`), and the replies `{decision:"approved", extra:1}`, `{decision:"yes"}`, `"approved"`, and `null` each send nothing, leave the task `needs_decision`, and leave the event log unchanged. See them fail where they can; [A1806] may pass at once because the tool never reads `yolo`, and the cycle log then records a deliberate mutant that reads it (waiver W1).
- [ ] T016 [US3] Write [A1808] (the status read after the approval shows another key, or the task was resolved by the driver while the form was open: nothing is sent and the text says the gate changed), [A1809] (a second call for the same task while a form is open is refused and opens no second form, and a later call after the first closes opens one), and [A1810] (a failing `validator.status`, and one that returns an unreadable output, make the call fail closed with no form). See them fail and implement in `src/tools/decide.ts`.

## Phase 6: User story 2 - The owner sees the finding and the exact answer (P1)

**Goal**: The decision form shows what the owner approves, and fails closed on a payload it cannot read.

**Independent test**: [U1828] to [U1833] pass under jsdom, and [A1814], [A1815], and [A1821] pass through the registered app.

- [ ] T017 [P] [US2] Write the form tests in `src/app/decision-approval-form.test.tsx` (first line `// @vitest-environment jsdom`; reuse `test/fixtures/approval-form.ts`): [U1828] the form shows the task, the key, the step and status, each finding's five fields, and the answer sentence for `approve`, `skip`, and `fix` with IDs and instructions; [U1829] a finished-run payload shows the outcome and no findings list, and the sentence says that approval starts a new run; [U1830] an unreadable payload shows an alert, offers no Approve, and Deny and Cancel work; [U1831] Approve submits `{decision:"approved"}` with the trimmed comment, Deny submits `denied` with the comment, Cancel cancels, a second click while the first is in flight does nothing, and a failed submit shows the reason and enables the buttons again; [U1832] a finding description with markup renders as text and creates no element. See them fail.
- [ ] T018 [US2] Add `src/app/decision-approval-form.tsx` (`DecisionApprovalForm`, built on the same class names, state machine, and `answerFor` as the merge form, with the findings list and the "Answer that will be sent" block) and make [U1828] to [U1832] pass. Covers [U1828] [U1829] [U1830] [U1831] [U1832].
- [ ] T019 [US2] Write [U1833] in `src/app.test.tsx` (or a new `src/app.test.tsx` if none exists): the app registers the merge renderer and the decision renderer under their two IDs, and the merge renderer is unchanged. Write [A1814] in `test/acceptance/decision-approval-form.test.tsx`: mount the registered decision renderer with `renderSlot` and a payload that `decide` built through the plugin, click Approve, and read the reply that the tool accepts (the reply passes the strict `approvalAnswerSchema`). Write [A1815] in the same file: the merge renderer still renders the merge payload. Write [A1821] in the same file: an unreadable payload shows an alert and no Approve and keeps Deny and Cancel, and a finding with markup shows as text. Register the renderer in `src/app.tsx`. Covers [U1833] [A1814] [A1815] [A1821].

## Phase 7: User story 4 - Decide on a run that finished without a clean pass (P2)

**Goal**: `rerun` approves a new run for a parked finished run, and the tool refuses every other combination.

**Independent test**: [A1811] and [A1812] pass, and [U1818] holds for the outcomes in the table.

- [ ] T020 [P] [US4] Write [U1818] in `src/tools/decide.test.ts` (table-driven): the answer rules for a finished view accept `rerun` for `passed`, `passed-with-override`, `passed-with-skips`, and `checks-passed` with no pull request; refuse `rerun` for `checks-passed` with a pull request, `failed`, `cancelled`, and a running view; and refuse `approve`, `skip`, and `fix` for every finished view. See it fail and add the rules to `src/tools/decide.ts`.
- [ ] T021 [US4] Write [A1811] in `test/acceptance/tools-decide.test.ts`: a task parked on a `passed-with-override` run, `rerun` with the current key opens a form that carries the outcome, calls no validator `answer`, and after the approval records `resolve` with the owner's approval in its evidence, and the driver then calls `start`. Write [A1812] (table-driven): `rerun` on a gate, `approve`, `skip`, and `fix` on a finished run, and a view that is `running`, `failed`, or `cancelled` are each refused with the reason and send nothing. See them fail and implement the `rerun` branch in `src/tools/decide.ts`. Covers [A1811] [A1812] [U1818].

## Phase 8: User story 5, second half - The harness suite and the wording (P1)

**Goal**: S5, S8, and S9 expect or probe the fifth tool, every text that counts the tools says five, and the five offline runs pass.

**Independent test**: [A1817] passes with the fake lab, and the live runs ([A1818]) exit 0.

- [ ] T022 [P] [US5] Update the pins to the new wording, each seen failing first: [U1834] `src/harness/advice.test.ts` (both advice lines say "five supervisor tools"); [U1835] `src/tools/supervisor-start.test.ts`, `src/tools/supervisor-command.test.ts`, `test/fixtures/conformance-lab.test.ts`, and `tools/conformance/readers.test.ts` (the start output and the CLI summary say "five"). Then change the text in `src/harness/advice.ts`, `src/tools/supervisor-start.ts`, `src/tools/supervisor-command.ts`, and `src/server.ts`.
- [ ] T023 [P] [US5] Write the scenario tests in `tools/conformance/scenarios/scenarios.test.ts`: [U1837] S5 and S9 pass when a supervisor is offered five tools and fail when `factoryman_decide` is missing; [U1838] S8 gains `S8.decide-wrong-state`, which passes when the lab refuses the call with an error that names `needs_decision` and leaves the state `working`, and fails when the lab resolves the task or changes its state. Update the fake lab in `test/fixtures/conformance-lab.ts` and write [U1839] in `test/fixtures/conformance-lab.test.ts`: the fake lab's `factoryman_decide` refuses a task that is not in `needs_decision`, with the real tool's wording and no `resolve` row. See them fail.
- [ ] T024 [US5] Add `factoryman_decide` to `SUPERVISOR_TOOLS` in `tools/conformance/scenarios/helpers.ts`, add the check to `tools/conformance/scenarios/s08-refusals.ts`, and change the titles of S5 and S9 from "four tools" to "five tools". Write [A1817] in `test/acceptance/conformance-tier1.test.ts` and `test/acceptance/conformance-tier15.test.ts`: the runner with the fake lab passes S5, S8, and S9 for the five drivers, and `conformance/known-gaps.json` lists no entry. Covers [U1837] [U1838] [U1839] [A1817].
- [ ] T025 [US5] Run the five offline conformance runs for the final code (see `quickstart.md` step 5) in `bblab` under `/var/tmp`, with no credential: tier 1, and tier 1.5 for Claude Code, Codex, Pi, and omp. Write the five result files and regenerate `docs/HARNESS-SUPPORT.md` with `pnpm run conformance:docs`. Log each run (exit code, isolation report, S5, S8, S9) in `tdd/cycle-log.md`. Covers [A1818]. If a run cannot happen here, say so in the cycle log and the report, and do not edit a result file by hand.

## Phase 9: User story 6 - The change is recorded and the repository stays tidy (P2)

**Goal**: The documents, the log, the constitution, and the skill agree with the code.

**Independent test**: [A1819] and the unit pins below pass.

- [ ] T026 [P] [US6] Write the document pins first and see them fail: [U1840] update `[A1710]` in `test/acceptance/design-profiles.test.ts` (the supervisor has five tools, a worker a sixth, the tool table lists `factoryman_decide`, the authority gates table has a row for a pipeline finding, and the "Supervisor start" paragraph says five); [U1841] update `[A1618]` in `test/acceptance/decision-log.test.ts` (constitution 1.5.0, Principle VI no longer says `factoryman_decide` stays out and cites D-136) and add a test that D-136 to the last number of this feature each have one heading and that D-031 and D-057 carry an `Amended by` line that names a decision with a heading; [U1842] the counts in `docs/CONFORMANCE.md` and `docs/LIVE-CHECK.md` (`test/acceptance/conformance-docs.test.ts`, `test/acceptance/live-check.test.ts`); [U1836] in `test/acceptance/skills.test.ts` the supervisor skill lists `factoryman_decide` in its tool table, has a section that tells the supervisor to read the findings and the key from the wake message, to call the tool, and that the owner approves, and no longer says "You cannot answer a finding".
- [ ] T027 [US6] Write the documents: `docs/DESIGN.md` (tool table, counts, authority row, validator paragraph), `docs/DECISIONS.md` (D-136 to D-143 and the `Amended by` lines), `.specify/memory/constitution.md` (1.5.0, Principle VI), `docs/CONFORMANCE.md`, `docs/LIVE-CHECK.md`, and `skills/factoryman-supervisor/SKILL.md`. Keep one sentence per line. Make the T026 pins pass. Write [A1819] as the sum of the T026 pins. Covers [A1819] [U1836] [U1840] [U1841] [U1842].
- [ ] T028 [US6] Change the label and description of the `approvalTimeoutMinutes` setting in `src/server.ts` so that it covers the decision form too ("Approval timeout (minutes)"), after a test in `src/server.test.ts` ([U1843]) that reads the setting's label from the fake host and fails on the old text.

## Phase 10: Polish and cross-cutting

- [X] T029 Run `pnpm run check` and confirm lint, type check, and the whole suite pass with no new warning, and that the leak count of [A1820] equals the baseline of T001. [A1820] is covered by the existing `test/acceptance/tmpdir-leak.test.ts`; this task only confirms that no new helper makes a directory outside the test's private `TMPDIR`.
- [ ] T030 Update `.specify/memory/tdd-profile.md` with a note for feature 013 (new fixtures and test files, the baseline counts), and `specs/013-factoryman-decide-tool/quickstart.md` if a command changed during the work.
- [ ] T031 Run the quickstart scenarios 1 to 6 once on the final code and record the results in `tdd/cycle-log.md`.
- [ ] T032 If the lab allows it, run the decision form once in the isolated lab (`bblab` with the pinned bb 0.49.0) with the stub agent and a fake `no-mistakes`, take screenshots of the form, and record what was seen. If the lab cannot host it, record that as a limit in `docs/DECISIONS.md` and the report: jsdom shows no layout.

## Dependencies

- Phase 2 blocks everything. T002, T003, and T004 can run in parallel (three files). T005 is one line.
- Phase 3 needs T002 to T005 and blocks phases 4 to 7, because every acceptance test calls the tool through the plugin.
- Phase 4 blocks phases 5 and 7, which extend `src/tools/decide.ts`.
- Phase 6 needs only T003 and the registration, so it can run beside phase 5.
- Phase 8 needs phases 3 to 7. T022 and T023 can start after phase 3.
- Phase 9 needs the final behavior, so the documents describe what was built.
- Phase 10 comes last.

## Parallel examples

- T002, T003: two pure modules in two files.
- T007, T008: two test files that change in the same way.
- T011, T017: tool unit tests and form tests share no file.
- T022, T023: wording pins and scenario tests.

## Implementation strategy

1. Build the shared modules (phase 2) and the registration (phase 3).
2. Deliver story 1 first: a supervisor can answer a gate, with the owner's approval. This is the minimum useful slice.
3. Add the refusals (story 3) and the form (story 2) next. The tool is not safe to use until both are in, so the live install stays blocked until they are.
4. Add `rerun` (story 4), then the harness suite and wording (story 5), then the documents (story 6).
5. Verify with `/speckit.tdd.verify`, which records the deliberate mutants for the highest-risk behaviors.

## Phase 11: Story closure (one task per story; the outer-loop tests must be green)

- [ ] T033 [US1] Confirm [A1801] [A1802] [A1803] [A1804] [A1813] are green and that each has a red in `tdd/cycle-log.md`, or a recorded waiver.
- [ ] T034 [US2] Confirm [A1814] [A1815] [A1821] are green and that each has a red in `tdd/cycle-log.md`, or a recorded waiver.
- [ ] T035 [US3] Confirm [A1805] [A1806] [A1807] [A1808] [A1809] [A1810] are green and that each has a red in `tdd/cycle-log.md`, or a recorded waiver.
- [ ] T036 [US4] Confirm [A1811] [A1812] are green and that each has a red in `tdd/cycle-log.md`, or a recorded waiver.
- [ ] T037 [US5] Confirm [A1816] [A1817] are green, and that [A1818] has five result files from the final code, or that the limit is recorded.
- [ ] T038 [US6] Confirm [A1819] [A1820] are green.
