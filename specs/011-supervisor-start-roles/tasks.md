# Tasks: Supervisor start command, role advice, and the dispatch roles block

**Input**: Design documents from `specs/011-supervisor-start-roles/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/supervisor-commands.md, contracts/dispatch-roles.md, contracts/validator-observation.md, quickstart.md, tdd/test-list.md

**Tests**: Mandatory. The constitution (principle V) makes every behavior change test first.
Every test is seen failing for the right reason before its implementation, and the failure goes in `tdd/cycle-log.md`.
A bracketed id such as `[U1601]` ties a task to a behavior in `tdd/test-list.md`.
`/speckit.tdd.run` ticks a task only when it can read an id from it.

**Organization**: Tasks are grouped by user story.
The phases run in dependency order and not in priority order: the roles schema (stories 2 and 5) comes before the command (story 1), because the command reads it.
Commands run from the repository root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task).
- **[Story]**: The user story in `spec.md` that the task serves.

## Phase 1: Setup

- [ ] T001 Run `pnpm install --frozen-lockfile` and `pnpm run check` on the clean branch, and record in `specs/011-supervisor-start-roles/tdd/cycle-log.md` that the baseline is green (tests, lint, type check) and how long it takes. Count the `bb-fake-plugin-host-*` directories directly under `${TMPDIR:-/tmp}` before and after one `pnpm run test`, and record both numbers as the leak baseline for [A1620].

## Phase 2: Foundational (blocks stories 1, 3, and 4)

**Purpose**: The port, the fakes, and the gate split that more than one story needs.

- [X] T002 [P] Write the adapter tests in `src/bb/adapter.test.ts`: [U1601] `getThread` returns the provider ID; [U1602] a null provider ID when the thread has none; [U1603] `spawnSupervisor` makes one `threads.spawn` call with the profile's four fields, no `parentThreadId`, and the given metadata; [U1604] it starts a managed worktree off the default branch on the project's default host; [U1605] it throws with bb's reason when the project has no host and makes no spawn call.
- [X] T003 [P] Write the gate tests in `src/dispatch/gate.test.ts`: [U1606] `gateReadiness` passes a ready Pi profile for a `local-only` project; [U1607] not ready returns `provider_unavailable` with the remedy; [U1608] a permission mode the provider lacks; [U1609] a model or level that is not listed; [U1610] any throwing read returns `read_failed`. Confirm that [U1611] is already covered by `[U1363]` and `[U1339]` and that they pass before and after the split.
- [X] T004 Add `providerId: string | null` to `ThreadInfo`, the `SpawnSupervisorRequest` type, and `BbPort.spawnSupervisor` in `src/bb/port.ts`; implement both in `src/bb/adapter.ts` over one private function shared with `spawnWorker`; teach `FakeBbPort` in `test/fixtures/bb-port.ts` and the in-memory bb in `test/fixtures/plugin-host.ts` to record `spawnSupervisor`, to honor `spawnError`, and to register the thread with its `providerId`. Covers [U1601] [U1602] [U1603] [U1604] [U1605].
- [X] T005 Extract `gateReadiness(bb, profile, host)` from `gateProfile` in `src/dispatch/gate.ts`; `gateProfile` keeps the admission rule and then calls it. Covers [U1606] [U1607] [U1608] [U1609] [U1610] [U1611].

## Phase 3: User stories 2 and 5 - The roles block (P1 and P2)

**Goal**: `dispatch.json` accepts `roles.supervisor.profile` and `roles.validator.agent: "observe"`, refuses everything else, and a file without `roles` behaves as before.

**Independent test**: The config tests below pass, and `loadDispatchConfig` returns the defaults for a project with no file.

- [X] T006 [US2] Write the acceptance test [A1606] in `test/acceptance/roles-config.test.ts` through the plugin factory: `factoryman_dispatch` for a checkout with an invalid `roles` block is blocked with `config_invalid` and the field path; a valid `roles` block dispatches as before; a file without `roles` is unchanged. See it fail.
- [X] T007 [P] [US2] Write the schema tests in `src/dispatch/config.test.ts`: [U1612] no `roles` parses with the defaults; [U1613] a defined supervisor profile is carried; [U1614] an undefined one fails and names the profile; [U1615] a blank one fails; [U1616] `observe` parses; [U1617] `inherit`, `set`, and another value fail with the field and the accepted value; [U1618] an unknown key in any of the three objects fails; [U1619] empty objects parse with defaults; [U1620] `emptyDispatchConfig` carries the defaults.
- [X] T008 [P] [US2] Write the loader tests in `src/dispatch/load.test.ts`: [U1621] an invalid `roles` block blocks with `dispatch.json is invalid` and the path, and no default replaces it; [U1622] a project with no file gets the default roles.
- [X] T009 [US2] Add `RolesConfig` and the `roles` field to `DispatchConfig` in `src/dispatch/types.ts`; add the strict `roles` schema, its defaults, and the refinement that checks `roles.supervisor.profile` against `profiles` in `src/dispatch/config.ts`; set the defaults in `emptyDispatchConfig`; fix every construction of a `DispatchConfig` that the type check flags in `src/` and `test/` (add the default roles; change no assertion). Covers [U1612] [U1613] [U1614] [U1615] [U1616] [U1617] [U1618] [U1619] [U1620] [U1621] [U1622].
- [X] T010 [US2] Run [A1606] and see it green. Story 2 and story 5 are done only when it is.

## Phase 4: User story 1 - Start a supervisor that has its role from the first session (P1)

**Goal**: `bb factoryman supervisor start` spawns the supervisor with `role: supervisor` in the spawn call, from a profile that passes the readiness gate, and refuses and spawns nothing otherwise.

**Independent test**: The command tests below pass against the fake bb, and the live S9 run (T038 to T041) shows the four tools and the skill on the first turn of each harness.

- [X] T011 [US1] Write the acceptance tests in `test/acceptance/supervisor-start.test.ts` through the plugin factory in the fake host: [A1601] the registered command spawns one thread with the profile's fields and `{ role: "supervisor" }` and prints the ID; [A1602] `agents.configure` for the spawned thread's metadata offers the four supervisor tools and the skill and no worker tool; [A1603] the first prompt is the flag text or the default; [A1604] a profile that is not ready, a mode, model, or level the provider lacks, refuse with dispatch's reason and add no event or row, and Pi in `local-only` spawns; [A1605] the profile comes from the flag, then the file, and every missing, undefined, or broken case refuses. See them fail.
- [X] T012 [P] [US1] Write the command tests in `src/tools/supervisor-start.test.ts` against the fake runtime with a checkout that holds a `dispatch.json`: [U1623] a start spawns once with the four fields and the metadata and prints ID, profile, provider, model; [U1624] `--prompt` is the first prompt; [U1625] the default prompt; [U1626] the file's profile is used without a flag; [U1627] the flag wins; [U1628] neither refuses with both remedies and without `default`; [U1629] an undefined name lists the defined profiles; [U1630] `--project`, the context, and `--project` winning; [U1631] an invalid file; [U1632] an unreadable file; [U1633] a missing file or no checkout; [U1634] a throwing checkout read.
- [X] T013 [P] [US1] Write the gate and spawn tests in `src/tools/supervisor-start.test.ts`: [U1635] a provider that is not ready refuses with `Nothing was spawned.`; [U1636] a mode, model, or level the provider lacks refuses; [U1637] a throwing gate read refuses; [U1638] Pi in a `local-only` project spawns; [U1639] the gate reads the default host and runs before the spawn; [U1640] a throwing spawn exits 1 with `Could not start the supervisor` and records nothing; [U1641] every usage error exits 2 with the usage text and spawns nothing.
- [X] T014 [P] [US1] Write the routing tests in `src/tools/supervisor-command.test.ts` and `src/server.test.ts`: [U1642] the word `start` selects the start command and any other word is stamped; [U1643] the usage text and the registered CLI summary list both supervisor lines in order.
- [X] T015 [US1] Create `src/tools/supervisor-start.ts` with `runSupervisorStart(rt, args, ctx)`: parse the flags, read the checkout and `dispatch.json` through `loadDispatchConfig`, choose and look up the profile, call `gateReadiness` on the project's default host, call `spawnSupervisor` once, and print the result as in `contracts/supervisor-commands.md`. Covers [U1623] [U1624] [U1625] [U1626] [U1627] [U1628] [U1629] [U1630] [U1631] [U1632] [U1633] [U1634] [U1635] [U1636] [U1637] [U1638] [U1639] [U1640] [U1641].
- [X] T016 [US1] Route `supervisor start` in `src/tools/supervisor-command.ts`, add its line to the usage text, and update the CLI summary in `src/server.ts`; the existing usage assertions change only by gaining the new line. Covers [U1642] [U1643].
- [X] T017 [US1] Run [A1601] [A1602] [A1603] [A1604] [A1605] and see them green. Story 1 is done only when they are.

## Phase 5: User story 3 - Know what to do after stamping an existing thread (P1)

**Goal**: `bb factoryman supervisor <thread>` prints advice that matches the thread's provider, and never says "from its next session".

**Independent test**: The advice tests pass, and the live S9 run reads the stamp text for Codex and omp.

- [X] T018 [US3] Write the acceptance test [A1607] in `test/acceptance/tools-supervisor-command.test.ts` through the registered command: the clear advice for Codex and omp, the next-turn advice for Claude Code and Pi, the clear advice for an unknown and an unreadable provider, no advice and exit 1 for a rejected stamp, a refusal for a worker, and the old text gone. See it fail.
- [X] T019 [P] [US3] Write the advice tests in `src/harness/advice.test.ts`: [U1651] a `clear` row; [U1652] a `next-turn` row; [U1653] the generic row; [U1654] an unreadable provider; [U1655] a table over every row of `CONTRACTS` that checks the clear instruction exactly when `roleChange` is `clear` and the absence of the old text.
- [X] T020 [P] [US3] Write the command tests in `src/tools/supervisor-command.test.ts`: [U1644] Codex and `acp-omp` print the clear advice; [U1645] `claude-code` and `pi` print the next-turn advice and no clear; [U1646] an unknown provider prints the generic advice and names it; [U1647] a null provider or a throwing provider read still succeeds and says that bb did not name the harness; [U1648] no output contains "from its next session"; [U1649] a worker thread is refused and no thread is read; [U1650] a rejected stamp prints no advice, exits 1, and reads no thread.
- [X] T021 [US3] Create `src/harness/advice.ts` with `roleAdvice(threadId, providerId, contract)`, importing only the contract types. Covers [U1651] [U1652] [U1653] [U1654] [U1655].
- [X] T022 [US3] In `src/tools/supervisor-command.ts`, read the stamped thread's provider through `getThread` after a successful stamp, pick the row with `contractFor`, and print `roleAdvice`; replace the old success text. Covers [U1644] [U1645] [U1646] [U1647] [U1648] [U1649] [U1650].
- [X] T023 [US3] Run [A1607] and see it green. Story 3 is done only when it is.

## Phase 6: User story 4 - See which agent the validator uses, and whether it is ready (P1)

**Goal**: The plugin reads no-mistakes' `agent` setting, checks bb's provider state for it on the right host, and names both in the preflight report and in the hand-off evidence. It writes nothing.

**Independent test**: The observation tests pass, and a recorded `exec` list shows only the read command.

- [X] T024 [US4] Write the acceptance tests in `test/acceptance/validator-observe.test.ts` through the plugin factory with a scripted configuration file and scripted provider states: [A1608] a ready agent in the `handoff` evidence; [A1609] a not-ready agent with bb's remedy and the task still `validating`; [A1610] a list, `auto` and no file, an unmapped agent, and an unreadable configuration; [A1611] a remote machine's own reads, and no line for `direct-PR`, `local-only`, or a scout; [A1612] the preflight command and the refused dispatch to a remote machine; [A1613] the recorded `exec` calls hold only the one read and the custom checks. See them fail.
- [X] T025 [P] [US4] Write the setting tests in `src/validator/agent.test.ts`, table-driven: [U1656] scalar; [U1657] flow list; [U1658] block list; [U1659] quotes; [U1660] trailing comment; [U1661] commented-out line; [U1662] indented key; [U1663] no line reads `auto`; [U1664] `auto` alone and in a list; [U1665] the four broken shapes with their reasons; [U1666] the pinned agent-to-provider table; [U1667] the names that map to none.
- [X] T026 [P] [US4] Write the observation tests in `src/validator/agent.test.ts` with a fake `exec` and a fake bb: [U1668] a ready agent; [U1669] each of the four not-ready statuses with the dispatch text; [U1670] a provider missing from the states; [U1671] an unmapped agent is `unchecked`; [U1672] a list with one ready entry; [U1673] a list with none; [U1674] `auto` with ready providers; [U1675] `auto` with none; [U1676] exit 3 is the default `auto`; [U1677] another non-zero exit; [U1678] a command that did not run or timed out; [U1679] an unparseable setting; [U1680] a throwing states call and a throwing `exec`; [U1681] the one read command with `timeoutMs` 30000 and the host.
- [X] T027 [P] [US4] Write the text tests in `src/validator/agent.test.ts`: [U1682] one ready agent; [U1683] a not-ready agent with the problem; [U1684] a list in order; [U1685] `auto` with and without ready providers; [U1686] the default prefix; [U1687] an unmapped agent; [U1688] an unobserved result; [U1689] an invariant over every case that no line says ready for an unchecked or unobserved result and that `validatorProblem` is null exactly when ready.
- [X] T028 [P] [US4] Write the preflight tests in `src/machines/preflight.test.ts`, `src/tools/supervisor-command.test.ts`, `src/tools/dispatch.test.ts`, and `src/limits/queue.test.ts`: [U1690] a not-ready agent adds `validator_agent`; [U1691] an unobserved agent does too; [U1692] a ready agent adds a note and no problem; [U1693] `direct-PR` and `local-only` run no read; [U1695] `reportText` prints the notes; [U1696] the command exits 1 or 0 and names the agent, and the clone host is still skipped; [U1697] a dispatch to the machine is refused with `preflight_failed` and creates no task; [U1698] a queued task stays queued. Keep [U1694] (`[U838]` and `[U844]`) passing, and update their exact `exec` lists only for the new read, with the reason in the cycle log.
- [X] T029 [P] [US4] Write the hand-off tests in `src/tools/report.test.ts`: [U1699] worker evidence, a blank line, then the validator line; [U1700] the task still becomes `validating` when the agent is not ready, unobserved, or unchecked; [U1701] a throwing observation never refuses the hand-off; [U1702] `direct-PR`, `local-only`, scout, `blocked`, and `failed` get no line and no read; [U1703] a remote task reads with its machine's host ID; [U1704] failing custom checks refuse the hand-off before any read; [U1705] the only commands are the custom checks and the one read; [U1719] blank evidence is refused as before and gets no line and no read (found mid-loop: the line must not turn blank evidence into evidence).
- [X] T030 [US4] Create `src/validator/agent.ts` with `parseAgentSetting`, `AGENT_PROVIDERS`, `observeValidatorAgent`, `describeObservation`, and `validatorProblem`, as in `data-model.md` and `contracts/validator-observation.md`; reuse `readinessProblem` from `src/dispatch/availability.ts`. Covers [U1656] [U1657] [U1658] [U1659] [U1660] [U1661] [U1662] [U1663] [U1664] [U1665] [U1666] [U1667] [U1668] [U1669] [U1670] [U1671] [U1672] [U1673] [U1674] [U1675] [U1676] [U1677] [U1678] [U1679] [U1680] [U1681] [U1682] [U1683] [U1684] [U1685] [U1686] [U1687] [U1688] [U1689].
- [X] T031 [US4] Add `preflightReport` to `src/machines/preflight.ts` (the `validator_agent` check and the note, only for `no-mistakes` mode), keep `runPreflight` returning the problems, extend `reportText` with the notes, and use `preflightReport` in the `preflight` command in `src/tools/supervisor-command.ts`. Covers [U1690] [U1691] [U1692] [U1693] [U1694] [U1695] [U1696] [U1697] [U1698].
- [X] T032 [US4] In `src/tools/report.ts`, for a `no-mistakes` ship hand-off, observe the validator agent on the task's host after the custom checks pass and append the line to the evidence of the `handoff` event; a failure inside the observation becomes the `unobserved` line. Covers [U1699] [U1700] [U1701] [U1702] [U1703] [U1704] [U1705] [U1719].
- [X] T033 [US4] Run [A1608] [A1609] [A1610] [A1611] [A1612] [A1613] and see them green. Story 4 is done only when they are.

## Phase 7: User story 6 - Scenario S9 passes on all four harnesses (P1)

**Goal**: S9 checks the first turn of a started supervisor and passes live at tier 1 and tier 1.5 on four harnesses, with no known gap left.

**Independent test**: The scenario tests below pass, and the five live runs (T038 to T042) exit 0.

- [X] T034 [US6] Write the acceptance test [A1614] in `test/acceptance/conformance-tier15.test.ts`: `main` with tier 1.5 for each of the four drivers, and tier 1, against the fake lab runs S9 to `pass`, S9 holds `S9.start-tools`, the committed gap list is empty, and the exit code is 0 with no stale gap. See it fail.
- [X] T035 [P] [US6] Write the lab-helper tests in `tools/conformance/lab-env.test.ts`, `tools/conformance/readers.test.ts`, and `test/acceptance/conformance-project-row.test.ts`: [U1706] the `supervisor start` argument list; [U1707] the thread-ID reader; [U1708] the lab project's `dispatch.json` with `roles.supervisor.profile` that the plugin's parser accepts.
- [X] T036 [P] [US6] Write the fake lab and scenario tests in `test/fixtures/conformance-lab.test.ts` and `tools/conformance/scenarios/scenarios.test.ts`: [U1709] the fake `startSupervisor` returns an ID and seeds the role at spawn; [U1710] the stamp text is the real advice; [U1711] S9 passes for the stub and the four drivers; [U1712] it fails `S9.start-command`; [U1713] it fails `S9.start-tools` for a missing tool or skill, a worker tool, or a clear needed first; [U1714] it fails `S9.unstamped-no-tools`; [U1715] it fails `S9.stamp-advice` when a harness whose step is a clear gets no clear advice and when the stamp fails; [U1716] it fails `S9.tools-after-step`.
- [X] T037 [P] [US6] Update the gap tests in `tools/conformance/gaps.test.ts` and `test/acceptance/conformance-gaps.test.ts`: [U1717] the committed `conformance/known-gaps.json` has no entry and `loadGaps` returns an empty list; keep [U1718] (the stale-gap tests `[U1305]` and `[A1309]`) passing. Record in `tdd/cycle-log.md` that the old assertion of three S9 entries is replaced, because FR-025 requires their removal.
- [X] T038 [US6] Change `startSupervisor` in `tools/conformance/port.ts` to return `threadId`; add the pure helpers (`supervisorStartArgs`, the thread-ID reader, the lab project's `dispatch.json` with `roles.supervisor.profile`) to `tools/conformance/lab-env.ts` and `readers.ts`; use them in `tools/conformance/real-lab.ts`. Covers [U1706] [U1707] [U1708].
- [X] T039 [US6] Update `tools/conformance/scenarios/s09-role-change.ts` (the check `S9.start-tools`, the strengthened stamp-advice check), update the fake lab in `test/fixtures/conformance-lab.ts` to seed the role at spawn and to use `roleAdvice`, and empty `conformance/known-gaps.json`. Covers [U1709] [U1710] [U1711] [U1712] [U1713] [U1714] [U1715] [U1716] [U1717] [A1614].

### Live runs (after the code commits at green)

- [ ] T040 [US6] [A1615] Bring up `/var/tmp/bblab-supervisor-start` with a pinned bb (reuse the pin of an earlier lab) and run `pnpm run conformance -- --tier 1 --lab-dir /var/tmp/bblab-supervisor-start`. Expect exit 0 and S9 `pass`. Keep the output outside the worktree.
- [ ] T041 [US6] [A1616] Run tier 1.5 for `claude-code`, then `codex`, then `pi`, then `omp`, offline, one after the other in the same lab directory. Expect exit 0, S9 `pass`, and isolation clean for each.
- [ ] T042 [US6] [A1617] Read the S9 evidence and the isolation block of each result file: the started supervisor's tools and skill on its first request, the stamp text for Codex and omp, `isolation.clean` true, no tripwire event. If a harness contradicts the plan (for example Codex needs a clear even with a seeded role), stop and record the conflict in `docs/DECISIONS.md` before any further change. Then run `pnpm run conformance:docs` and commit the results.
- [ ] T043 [US6] Run [A1614] [A1615] [A1616] [A1617] and see them green. Story 6 is done only when they are.

### Lab bring-up hardening (found by the first live Pi run)

- [X] T053 [US6] Write the tests in `tools/conformance/wait.test.ts`: [U1720] `waitUntil` returns true on the first read that says so, with the delay between reads and none before the first; [U1721] it returns false after the attempts run out, with one read per attempt and a sleep between them, and a read that throws counts as not yet.
- [X] T054 [US6] Create `tools/conformance/wait.ts` with `waitUntil`, and make `openRealLab` in `tools/conformance/real-lab.ts` wait up to 60 seconds for bb to list at least one model of the driver's provider before it runs a scenario, and say so when it does not. Covers [U1720] [U1721].

## Phase 8: User story 7 - The change is recorded (P2)

**Goal**: The decisions, the constitution amendment, and the text that this change makes wrong are written down.

- [ ] T044 [US7] Write the acceptance tests [A1618] in `test/acceptance/decision-log.test.ts` (the last heading is at least D-123, and `.specify/memory/constitution.md` is at 1.4.0 with Principle VI naming H4 and H12) and [A1619] in `test/acceptance/conformance-docs.test.ts` (the generated document lists S9 as `pass` for every harness and no known gap). See them fail.
- [ ] T045 [P] [US7] Write the entries D-123 onward in `docs/DECISIONS.md` (Google developer documentation style, one sentence per line): the skipped clarification and the four assumptions it left; the supervisor profile source and the refusal without `default`; admission not applied to a supervisor; the spawn environment and the default prompt; the roles schema and the single accepted validator value; the observation source, its limits, and the agent-to-provider table; the non-blocking hand-off and the blocking preflight; the S9 strengthening; the constitution amendment; and any conflict that T042 found. The decision-log guard must pass.
- [ ] T046 [P] [US7] Amend Principle VI of `.specify/memory/constitution.md` to name H4 and H12, bump the version to 1.4.0 with today's date as the last amendment, and cite the decision. Covers [A1618].
- [ ] T047 [P] [US7] Correct the text that this change makes wrong, and nothing else: the S9 row and the paragraph about the open H4 gaps in `docs/CONFORMANCE.md`; the sentence "The stamp applies from the thread's next session" in `docs/LIVE-CHECK.md` (change `test/acceptance/live-check.test.ts` only if the guide's steps change); step 5 of `docs/CUTOVER.md`. The H9 rewrite stays out of scope.
- [ ] T048 [US7] Regenerate `docs/HARNESS-SUPPORT.md` with `pnpm run conformance:docs` from the final result files. Covers [A1619].
- [ ] T049 [US7] Run [A1618] [A1619] and see them green. Then run `pnpm run check`, count the `bb-fake-plugin-host-*` directories again, and record the difference from T001 for [A1620] (expected 0). Story 7 is done only when they are.

## Phase 9: Polish and cross-cutting

- [ ] T050 Run `pnpm run check` (type check, lint, full suite). Fix every failure and every flaky test, even one that an earlier change caused.
- [ ] T051 Confirm FR-015 and FR-029 with a search: no write to no-mistakes configuration anywhere in `src/`, and no import of `@get-bb/*` under `src/machine/` or `src/harness/`. Record the commands and results in `checklist.md`.
- [ ] T052 Run the steps of `quickstart.md` in order and record each result in `checklist.md`. Write the five verdicts into a file outside the worktree for the pull request description.

## Dependencies

- Phase 1 first. Phase 2 blocks phases 4, 5, and 6.
- Phase 3 (roles) blocks phase 4 (the command reads `roles.supervisor.profile`) and the lab change in phase 7.
- Phases 4, 5, and 6 do not depend on each other after phases 2 and 3.
- Phase 7 needs phases 4, 5, and 6 complete, so that each result file names the final plugin commit.
- Phase 8 follows the live runs, because a conflict found there is recorded first. Phase 9 is last.

## Parallel opportunities

- T002 and T003; T007 and T008; T012, T013, and T014; T019 and T020; T025 to T029; T035 to T037; T045 to T047.
- The three implementation phases 4, 5, and 6 can proceed one cycle at a time, in any order.

## Implementation strategy

1. **MVP**: phases 1 to 5 (the port, the roles block, the command, and the advice). That alone closes H4 in the unit tests.
2. Add phase 6 (the observation), which closes H12.
3. Add phase 7 to prove both live. Do the live runs only when the code is committed at green.
4. Finish with the records and the full check.

Each cycle is one failing test (or one group of related tests), the smallest change that passes it, and a refactor on green, with one commit at green (decision D-099).
