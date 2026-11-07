---

description: "Task list for tools and approval, event wiring, and the validator"
---

# Tasks: Tools and approval, event wiring, and the validator

**Input**: Design documents from `specs/002-tools-events-validator/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are mandatory (constitution principle V). Every test task precedes the implementation task it drives, and every test must be seen failing first.

**Organization**: Tasks group by user story. User story 1 is milestone 4 (tools and approval), user story 2 is milestone 5 (event wiring), and user story 3 is milestone 6 (validator). The spike (milestone 0 for these milestones) is already committed.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task belongs to (US1, US2, US3)
- Each task names the exact file path

## Phase 1: Setup (shared test infrastructure, no behavior)

**Purpose**: Give every story the same fakes and loaders. These tasks add test helpers and no production behavior.

- [ ] T001 [P] Add the recorded-fixture loader in `test/fixtures/recorded.ts` (read `test/fixtures/recorded/bb-0.48.1/*.json` and `no-mistakes-1.84.0/*.toon`)
- [ ] T002 [P] Add temporary git repository builders in `test/fixtures/git-repo.ts` (init, commit, bare remote, branch, dirty tree)
- [ ] T003 Add the hand-written `BbPort` fake in `test/fixtures/bb-port.ts` (records calls, scripted results; written together with the port types in T012)
- [ ] T004 Add the runtime builder over the memory store, a fake clock, and fake IDs in `test/fixtures/runtime.ts`

**Checkpoint**: The suite still passes, and no production file changed.

---

## Phase 2: Foundational (blocks every story)

**Purpose**: The edges and the one apply path that all three stories share.

### Tests (write first, watch fail)

- [X] T010 [P] [U1] [U2] [U3] [U4] [U5] Exec runner test in `src/exec.test.ts` (captures stdout, stderr, exit code; honors `cwd`; runs without a shell; reports a missing binary as a result and not a throw)
- [X] T011 [P] [U6] [U7] [U8] [U9] Runtime test in `src/runtime.test.ts` (apply records the event, calls listeners once per applied event and never for a refused one, a throwing listener does not undo the event)
- [X] T012 [P] [U10] [U11] [U12] [U13] [U14] [U15] [U16] [U17] [U18] Adapter test in `src/bb/adapter.test.ts` through the fake host (spawn arguments, parent notifications off, plugin metadata, thread read maps a missing thread to null, send uses mode `auto`, retire archives then deletes, input form passes through)
- [X] T013 [P] [U19] [U20] [U21] [U22] Access test in `src/tools/access.test.ts` (worker by recorded thread ID, other for everything else, project check)
- [ ] T014 [P] [U23] [U24] [U25] Preview test in `src/tools/preview.test.ts` (would-accept and would-refuse for a `merge` event, no row written)
- [ ] T022 [P] [U26] [U27] [U28] Results test in `src/tools/results.test.ts` (refusal text, success text, cut at the limit and at limit minus one and plus one)

### Implementation

- [X] T015 [P] [U1] [U2] [U3] [U4] [U5] Implement the runner and the `Exec` type in `src/exec.ts`
- [ ] T016 [P] Define `BbPort` and its data types in `src/bb/port.ts`
- [X] T017 [U10] [U11] [U12] [U13] [U14] [U15] [U16] [U17] [U18] Implement `BbPort` over `BbPluginApi` in `src/bb/adapter.ts`
- [X] T018 [U6] [U7] [U8] [U9] Implement `Runtime` and the one apply path in `src/runtime.ts`
- [X] T019 [P] [U19] [U20] [U21] [U22] Implement `identify` in `src/tools/access.ts`
- [ ] T020 [P] [U23] [U24] [U25] Implement `wouldAccept` in `src/tools/preview.ts`
- [ ] T021 [P] [U26] [U27] [U28] Implement `ToolOutcome` helpers and refusal formatting in `src/tools/results.ts`

**Checkpoint**: The foundational tests pass, and nothing registers with bb yet.

---

## Phase 3: User story 1 - Run tasks through five tools with a human-approved merge (Priority: P1) - milestone 4

**Goal**: The five tools, per-thread visibility, the approval form, the merge and teardown facts from git, and the supervisor command.

**Independent test**: Call each tool through the fake host as a supervisor and as a worker, and drive the form with the host's submit and cancel controls.

### Tests for user story 1 (write first, watch fail)

- [ ] T030 [P] [US1] [A1] Visibility test in `test/acceptance/tools-visibility.test.ts` (supervisor, worker, and no-role threads; AC-1.1)
- [ ] T031 [P] [US1] [A2] Authority test in `test/acceptance/tools-authority.test.ts` (a recorded worker refused on supervisor tools, a non-worker refused on report, a task in another project refused; AC-1.2)
- [ ] T032 [P] [US1] [A3] [A4] [A5] [U41] [U42] [U43] [U44] [U45] [U46] [U47] [U48] [U49] [U50] [U51] Dispatch tests in `test/acceptance/tools-dispatch.test.ts` and `src/tools/dispatch.test.ts` (success, incomplete profile, empty description, unknown kind, spawn failure, thread already failed after start; AC-1.3 to AC-1.5)
- [ ] T033 [P] [US1] [A6] [U52] [U53] [U54] [U55] [U56] [U57] [U58] [U59] [U60] [U61] Report tests in `test/acceptance/tools-report.test.ts` and `src/tools/report.test.ts` (scout, `no-mistakes`, `direct-PR`, `local-only`, blocked, failed, empty evidence; AC-1.6)
- [ ] T034 [P] [US1] [A7] [U62] [U63] [U64] [U65] [U66] [U67] [U68] Status tests in `test/acceptance/tools-status.test.ts` and `src/tools/status.test.ts` (one task, project list, state filter, writes nothing; AC-1.7)
- [ ] T035 [P] [US1] [A8] [A9] [A10] [A11] [A12] [A13] [A14] [U89] [U90] [U91] [U92] [U93] [U94] [U95] [U96] [U97] [U98] [U99] [U100] [U101] [U102] [U103] [U104] [U105] [U106] Merge approval tests in `test/acceptance/tools-merge.test.ts` and `src/tools/merge.test.ts` (submitted approval, denial, cancelled form, timed-out form, unreadable answer, `yolo`, executor failure, wrong state, scout, worker caller, second call while a form is open; AC-1.8 to AC-1.14)
- [ ] T036 [P] [US1] [A15] [A16] [U107] [U108] [U109] [U110] [U111] [U112] [U113] [U114] [U115] [U116] Teardown tests in `test/acceptance/tools-teardown.test.ts` and `src/tools/teardown.test.ts` (dirty tree, unpushed commits, clean and landed, failed task, retire failure after the event; AC-1.15, AC-1.16)
- [ ] T037 [P] [US1] [U69] [U70] [U71] [U72] [U73] [U74] [U75] [U76] [U77] Worktree report tests in `src/git/report.test.ts` against temporary repositories (clean, dirty, untracked file, unpushed commit, pushed commit, `local-only` base rule, command failure)
- [ ] T038 [P] [US1] [U78] [U79] [U80] [U81] [U82] [U83] [U84] [U85] [U86] [U87] [U88] Merge executor tests in `src/git/merge.test.ts` (the `gh` command line for each method with a fake runner, local merge in a temporary repository, dirty checkout, wrong branch, missing base branch, conflict then abort)
- [ ] T039 [P] [US1] [A18] [U117] [U118] [U119] Supervisor command tests in `test/acceptance/tools-supervisor-command.test.ts` and `src/tools/supervisor-command.test.ts` (stamps a non-worker, refuses a worker; AC-1.18)
- [ ] T040 [P] [US1] [A17] [U120] [U121] [U123] [U124] Factory tests in `test/acceptance/plugin.test.ts` and `src/server.test.ts` (opens the store on the host database, recovers, registers five tools; AC-1.17)
- [ ] T041 [P] [US1] [U29] [U30] [U31] [U32] Worker prompt test in `src/tools/prompt.test.ts` (names task ID, branch, mode, and the report tool; says never push for `no-mistakes`)
- [ ] T055 [P] [US1] [U33] [U34] [U35] [U36] [U37] [U38] [U39] [U40] Registration tests in `src/tools/register.test.ts` (configure by role, the closed tool list, dispatch schema, error mapping, no cross-plugin call)

### Implementation for user story 1

- [ ] T042 [P] [US1] [U69] [U70] [U71] [U72] [U73] [U74] [U75] [U76] [U77] Implement the worktree report in `src/git/report.ts`
- [ ] T043 [P] [US1] [U78] [U79] [U80] [U81] [U82] [U83] [U84] [U85] [U86] [U87] [U88] Implement the merge executors and preflight in `src/git/merge.ts`
- [ ] T044 [P] [US1] [U29] [U30] [U31] [U32] Implement `buildWorkerPrompt` in `src/tools/prompt.ts`
- [ ] T045 [US1] [U41] [U42] [U43] [U44] [U45] [U46] [U47] [U48] [U49] [U50] [U51] Implement `factoryman_dispatch` in `src/tools/dispatch.ts`
- [ ] T046 [US1] [U52] [U53] [U54] [U55] [U56] [U57] [U58] [U59] [U60] [U61] Implement `factoryman_report` in `src/tools/report.ts`
- [ ] T047 [P] [US1] [U62] [U63] [U64] [U65] [U66] [U67] [U68] Implement `factoryman_status` in `src/tools/status.ts`
- [ ] T048 [US1] [U89] [U90] [U91] [U92] [U93] [U94] [U95] [U96] [U97] [U98] [U99] [U100] [U101] [U102] [U103] [U104] [U105] [U106] Implement `factoryman_merge` and the approval form schema in `src/tools/merge.ts`
- [ ] T049 [US1] [U107] [U108] [U109] [U110] [U111] [U112] [U113] [U114] [U115] [U116] Implement `factoryman_teardown` in `src/tools/teardown.ts`
- [ ] T050 [US1] [U33] [U34] [U35] [U36] [U37] [U38] [U39] [U40] Implement tool registration, schemas, and `configure` in `src/tools/register.ts`
- [ ] T051 [US1] [U117] [U118] [U119] Implement the supervisor command in `src/tools/supervisor-command.ts`
- [ ] T052 [US1] [U120] [U121] [U123] [U124] Build the runtime, open the store, run recovery, and register everything in `src/server.ts`
- [ ] T053 [US1] [U122] Add the `mergeMethod` and approval timeout settings in `src/server.ts` and read them in `src/git/merge.ts` and `src/tools/merge.ts`
- [ ] T054 [US1] Update `docs/DECISIONS.md` with the milestone 4 findings and commit milestone 4
- [ ] T056 [US1] [A1] [A2] [A3] [A4] [A5] [A6] [A7] [A8] [A9] [A10] [A11] [A12] [A13] [A14] [A15] [A16] [A17] [A18] Outer-loop gate: A1 to A18 are green through the plugin factory before milestone 4 is committed

**Checkpoint**: User story 1 passes on its own. The tools run through the fake host with no wake messages and no validator.

---

## Phase 4: User story 2 - Turn thread events into transitions and wake the supervisor only when it matters (Priority: P2) - milestone 5

**Goal**: Thread-event handlers, wake messages by state, and start-up reconcile.

**Independent test**: Replay a recorded event sequence through the fake host and compare the messages with the expected list.

### Tests for user story 2 (write first, watch fail)

- [ ] T060 [P] [US2] [A23] [A26] [U125] [U126] [U127] [U128] [U129] [U130] [U131] [U132] [U133] [U134] Wake tests in `src/wiring/wake.test.ts` (attention states, other states silent, message text, parent target, no parent, send failure; AC-2.5, AC-2.8)
- [ ] T061 [P] [US2] [A19] [A20] [A21] [A22] [A24] [U135] [U136] [U137] [U138] [U139] [U140] [U141] [U142] [U143] [U144] [U145] [U146] [U147] [U148] [U149] [U150] [U151] [U152] Handler tests in `src/wiring/handlers.test.ts` (failed, idle, deleted, archived, pending interaction, ignored events, non-worker threads, terminal tasks, post-handoff states; AC-2.1 to AC-2.4, AC-2.6)
- [ ] T062 [P] [US2] [A25] Replay test in `test/acceptance/wiring-events.test.ts` (a sequence of at least ten thread events, duplicate failure, exact message list; AC-2.7, SC-004)
- [ ] T063 [P] [US2] [A28] Recorded payload test in `test/acceptance/wiring-recorded.test.ts` (the real `thread.failed`, `turn.failed`, `thread.idle`, and `interaction.pending` payloads; AC-2.10)
- [ ] T064 [P] [US2] [A27] Start-up test in `test/acceptance/wiring-startup.test.ts` (missing thread, errored thread, matching thread, second restart sends nothing; AC-2.9)
- [ ] T065 [P] [US2] [U153] [U154] [U155] [U156] [U157] [U158] [U159] [U160] Observation tests in `src/wiring/startup.test.ts` (missing, failed, and logged-state mapping)

### Implementation for user story 2

- [ ] T066 [P] [US2] [U125] [U126] [U127] [U128] [U129] [U130] [U131] [U132] [U133] [U134] Implement the notifier and message text in `src/wiring/wake.ts`
- [ ] T067 [US2] [U135] [U136] [U137] [U138] [U139] [U140] [U141] [U142] [U143] [U144] [U145] [U146] [U147] [U148] [U149] [U150] [U151] [U152] Implement the thread-event handlers in `src/wiring/handlers.ts`
- [ ] T068 [US2] [U153] [U154] [U155] [U156] [U157] [U158] [U159] [U160] Implement observation, reconcile, and resume in `src/wiring/startup.ts`
- [ ] T069 [US2] Register the handlers, the notifier listener, and the start-up service in `src/server.ts`
- [ ] T070 [US2] Update `docs/DECISIONS.md` with the milestone 5 findings and commit milestone 5
- [ ] T071 [US2] [A19] [A20] [A21] [A22] [A23] [A24] [A25] [A26] [A27] [A28] Outer-loop gate: A19 to A28 are green through the plugin factory before milestone 5 is committed

**Checkpoint**: User story 2 passes on its own. A report that reaches `review_ready` now wakes the supervisor.

---

## Phase 5: User story 3 - Validate no-mistakes tasks through a validator interface (Priority: P3) - milestone 6

**Goal**: The validator interface, a fake, the no-mistakes adapter, and the driver.

**Independent test**: Drive a task from handoff to review ready with the fake validator and with the recorded no-mistakes output.

### Setup for user story 3

- [ ] T080 [US3] Add `@toon-format/toon` 4.4.0 with `pnpm add --save-exact` and commit `pnpm-lock.yaml`

### Tests for user story 3 (write first, watch fail)

- [ ] T081 [P] [US3] [U164] [U165] [U166] [U167] [U168] [U169] [U170] [U171] [U172] [U173] [U174] [U175] TOON decode tests in `src/validator/toon.test.ts` over every recorded file (gate, findings columns from the header, outcome, error, `other_branch_run`, unreadable and empty output; AC-3.8)
- [ ] T082 [P] [US3] [U176] [U177] [U178] [U179] [U180] [U181] [U182] [U183] [U184] Adapter tests in `src/validator/no-mistakes.test.ts` with a fake runner (command lines, `cwd`, stdout only, never `--yes`, exit codes, unknown outcome; AC-3.8)
- [ ] T083 [P] [US3] [U161] [U162] [U163] Fake validator tests in `src/validator/fake.test.ts` (scripted views, recorded calls)
- [ ] T084 [P] [US3] [A30] [A31] [A32] [A33] [A34] [A35] [A37] [A38] [U185] [U186] [U187] [U188] [U189] [U190] [U191] [U192] [U193] [U194] [U195] [U196] [U197] [U198] [U199] [U200] [U201] [U202] [U203] [U204] [U205] [U206] [U207] Driver tests in `src/validator/driver.test.ts` (handoff starts a run, gate to `needs_decision`, answer to `validating`, external answer observed, `checks-passed` to `review_ready`, failed and cancelled to `failed`, override and skips and no PR to `needs_decision`, unreadable five times, no second run, no run for other modes, resume; AC-3.2 to AC-3.7, AC-3.9, AC-3.10)
- [ ] T085 [P] [US3] [A29] [A30] [A31] [A32] [A33] [A34] [A35] [A37] [A38] Acceptance test with the fake validator in `test/acceptance/validator-fake.test.ts` (dispatch, report done, validating, finding, answer, validated, review ready, wake messages; SC-005)
- [ ] T086 [P] [US3] [A36] Acceptance test with recorded output in `test/acceptance/validator-recorded.test.ts` (the real adapter over replayed recorded stdout; SC-005, SC-006)
- [ ] T087 [P] [US3] [A29] Interface test in `src/validator/types.test.ts` (five operations exist on the fake and the adapter; AC-3.1)

### Implementation for user story 3

- [ ] T088 [P] [US3] [U161] [U162] [U163] Define the interface and types in `src/validator/types.ts`
- [ ] T089 [P] [US3] [U161] [U162] [U163] Implement the scripted fake in `src/validator/fake.ts`
- [ ] T090 [US3] [U164] [U165] [U166] [U167] [U168] [U169] [U170] [U171] [U172] [U173] [U174] [U175] Implement the decoder in `src/validator/toon.ts`
- [ ] T091 [US3] [U176] [U177] [U178] [U179] [U180] [U181] [U182] [U183] [U184] Implement the adapter in `src/validator/no-mistakes.ts`
- [ ] T092 [US3] [U185] [U186] [U187] [U188] [U189] [U190] [U191] [U192] [U193] [U194] [U195] [U196] [U197] [U198] [U199] [U200] [U201] [U202] [U203] [U204] [U205] [U206] [U207] Implement the driver in `src/validator/driver.ts`
- [ ] T093 [US3] Register the driver listener, resume on start-up, and dispose in `src/server.ts`
- [ ] T094 [US3] Update `docs/DECISIONS.md` with the milestone 6 findings and commit milestone 6
- [ ] T095 [US3] [A29] [A30] [A31] [A32] [A33] [A34] [A35] [A36] [A37] [A38] Outer-loop gate: A29 to A38 are green through the plugin factory before milestone 6 is committed

**Checkpoint**: User story 3 passes on its own. A `no-mistakes` task reaches `review_ready` through the validator, and a gate pauses it.

---

## Phase 6: Polish and close-out

- [ ] T100 Run `pnpm run build` and check `dist/server.js` and `dist/server.meta.json` (SC-008)
- [ ] T101 Run `pnpm run check` and confirm no skipped test and a total time under 90 seconds (SC-007)
- [ ] T102 Run the deliberate-mutant pass on the gate-bearing functions and record it (SC-009)
- [ ] T103 Update `.specify/memory/tdd-profile.md` with the new helpers and suite time
- [ ] T104 Run `/speckit.tdd.verify`, `/speckit.checklist`, `/speckit.analyze`, and `/speckit.converge`, and commit the artifacts

---

## Dependencies and order

- Phase 1 comes first. Phase 2 blocks every story.
- User story 1 needs Phase 2. User story 2 needs Phase 2 and the runtime of story 1 (`server.ts` registration). User story 3 needs stories 1 and 2, because the driver applies events through the runtime and wakes through the notifier.
- Inside a story, tests come before implementation, and implementation files that import each other follow import order.
- The tasks marked `[P]` touch different files and can run in either order.

## Implementation strategy

1. Finish Phase 1 and Phase 2, then commit.
2. Deliver story 1 and commit milestone 4. This alone gives a usable plugin: the owner can dispatch, merge with approval, and tear down, with no wake messages.
3. Deliver story 2 and commit milestone 5.
4. Deliver story 3 and commit milestone 6.
5. Close out with the verification, checklist, analysis, and convergence artifacts.
