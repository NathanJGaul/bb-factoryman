# Cycle log: Supervisor start command, role advice, and the dispatch roles block

Append only.
Newest last.
Every entry's `red` block is the evidence that the test existed and failed before the implementation.

## Baseline

- suite: `pnpm test` -> 143 files, 1842 passed, 0 failed (26 s)
- commit: `8578209`
- recorded: cycle 0, before any change
- leak baseline: see the entry for task T001

## Notes and deviations (opened at group 1)

- The loop runs in groups, as the earlier features did (`specs/010-conformance-followup/tdd/cycle-log.md`).
  A group is a set of closely related behaviors that share one test file and one change.
  Each entry lists the red line of every behavior in the group, the one change that made the group green, and one commit.
  This departs from the skill's "one behavior per cycle".
  Every behavior still has its own named test and its own recorded red.
- The commit `930e91f` (the specification documents) left the decision-log guard `[A1510]` red, because the documents cite D-123, D-126, and D-129 and the decision log did not have them yet.
  The first group found it when it ran the full suite.
  The decision entries D-123 to D-129 were written in the same commit as group 1, which makes the suite green again.
  No test was changed to hide it.

## Group 1: the port, the adapter, and the gate split (U1601 to U1611)

Stubs came first, so the reds are assertions: `BbPort.spawnSupervisor` and the adapter's `spawnSupervisor` threw `not implemented`, `gateReadiness` threw `not implemented`, and `ThreadInfo.providerId` existed only as a type.
The existing test `[U11]` pins the exact shape of `getThread`'s result.
The feature deliberately adds a field, so `[U11]` was updated first to expect `providerId: null` for a thread without one, and that update is part of the red (reason: the shape of the port result is the behavior under change; no assertion was loosened).

- red: `pnpm vitest run src/bb/adapter.test.ts src/dispatch/gate.test.ts` -> 13 failed, 64 passed
  - U1601 `AssertionError: expected { id: 'thr-1', …(5) } to match object { providerId: 'codex' }`
  - U1602 `AssertionError: expected { id: 'thr-1', …(5) } to match object { providerId: null }`
  - U11 (updated) `AssertionError: expected { id: 'thr-1', …(5) } to deeply equal { id: 'thr-1', …(6) }`
  - U1603 `Error: not implemented: spawnSupervisor`
  - U1604 `Error: not implemented: spawnSupervisor`
  - U1605 `AssertionError: expected [Function] to throw error matching /no host/i but got 'not implemented: spawnSupervisor'`
  - U1606 to U1610 (seven tests) `Error: not implemented: gateReadiness`
- green: the adapter has one private `spawnThread` that both `spawnWorker` (with its parent and `parentNotifications: "off"`) and `spawnSupervisor` (with neither) call, `getThread` reads `providerId` (a string, else null), and `gateProfile` is the admission rule followed by the new `gateReadiness`.
  The fakes learned the new port method and field: `FakeBbPort.spawnSupervisor`, `providerId` on `addThread`, and `providerId` on the in-memory bb's threads.
  Suite `pnpm test` -> 143 files, 1854 passed, 0 failed (25 s). `pnpm run typecheck` and `pnpm run lint` clean after one test literal gained `providerId: null` (`src/wiring/startup.test.ts`, a type-only change).
- U1611 is credited to the existing `[U1363]` and `[U1339]`, which pass before and after the split.
- refactor: none further. The extraction of `spawnThread` was the green step, because the second caller needed it.
- commit: see the commit that carries this entry.

## Group 2: the roles block in the schema (U1612 to U1622, A1606)

The existing `[U701]` compares the whole parsed config of a minimal file, so it was updated first to expect the default `roles` (reason: the parsed shape is the behavior under change; no assertion was loosened).
The invalid-roles half of `[A1606]` passed on its first run for the wrong reason, because today `roles` is an unknown key and the whole file is rejected.
It was made discriminating before the implementation: each case now has to name its own field in the message.

- red: `pnpm vitest run src/dispatch/config.test.ts src/dispatch/load.test.ts test/acceptance/roles-config.test.ts` -> 18 failed, 32 passed
  - U701 (updated) `AssertionError: expected { ok: true, …(1) } to deeply equal { ok: true, …(1) }`
  - U1612, U1620, U1622 `AssertionError: expected undefined to deeply equal { supervisor: { profile: null }, …(1) }`
  - U1613, U1616, U1619 `Error: expected the config to parse: Unrecognized key: "roles"`
  - U1614 `AssertionError: expected 'Unrecognized key: "roles"' to match /roles\.supervisor\.profile names the …/`
  - U1615 `AssertionError: expected 'Unrecognized key: "roles"' to match /at \`roles\.supervisor\.profile\`/`
  - U1617 (four tests: `inherit`, `set`, `anything`, empty) `AssertionError: expected 'Unrecognized key: "roles"' to contain 'roles.validator.agent must be "observ…'`
  - U1618 (three tests) `AssertionError: expected 'Unrecognized key: "roles"' to match /surprise/`
  - U1621 `AssertionError: expected 'dispatch.json is invalid: Unrecognize…' to match /dispatch\.json is invalid: roles\.val…/`
  - A1606 (invalid) `AssertionError: expected 'Dispatch blocked (config_invalid): di…' to contain 'roles.validator.agent must be "observ…'`
  - A1606 (valid) `AssertionError: …"supervisor":{"profile":"deep"}…: expected true to be false`
- green: `RolesConfig` and `DispatchConfig.roles` in `src/dispatch/types.ts`; a strict `roles` schema in `src/dispatch/config.ts` whose nested objects use `prefault({})`, because zod 4's `default({})` returns `{}` without parsing the inner defaults; the refinement that checks `roles.supervisor.profile` against `profiles`; the defaults in `emptyDispatchConfig`.
  Suite `pnpm test` -> 144 files, 1872 passed, 0 failed (26 s). `pnpm run typecheck` and `pnpm run lint` clean: no other `DispatchConfig` literal needed the new field.
- refactor: none needed. `defaultRoles()` is shared by `emptyDispatchConfig` and was written once.
- commit: see the commit that carries this entry.

## Group 3: the start command (U1623 to U1643, A1601 to A1605)

A stub came first: `runSupervisorStart` returned `not implemented: supervisor start` with exit 1, and `START_USAGE` existed, so the reds are assertions.
The routing tests and the registration test went red because the word `start` was read as a thread ID (`supervisor start --project ...` has extra arguments, so the old command printed the usage and exited 2).

- red: `pnpm vitest run src/tools/supervisor-start.test.ts src/tools/supervisor-command.test.ts src/server.test.ts` -> 27 failed
  - U1623 `AssertionError: expected 1 to be +0` (the stub's exit code)
  - U1624, U1625 `AssertionError: expected undefined to match object { prompt: 'Watch the repo and wait.' }` (no spawn call)
  - U1626, U1627 `AssertionError: expected undefined to match object { profile: { …(4) } }`
  - U1628, U1629, U1631 to U1637, U1640 `AssertionError: expected 'not implemented: supervisor start\n' to contain '<the contract text>'`
  - U1630 `AssertionError: expected [] to deeply equal [ [ 'proj-ctx' ] ]`
  - U1638 `AssertionError: expected 1 to be +0`
  - U1639 `AssertionError: expected [] to deeply equal [ [ undefined ] ]`
  - U1641 (six tests) `AssertionError: expected 1 to be 2`
  - U1642 `AssertionError: expected 2 to be 1`
  - U1643 (usage text) `AssertionError: expected 'Usage: bb factoryman preflight <machi…' to be 'Usage: bb factoryman supervisor start…'`
  - U1643 (registration) `AssertionError: expected 'bb factoryman supervisor <thread-id>' to contain 'bb factoryman supervisor start [--pro…'`
- red: `pnpm vitest run test/acceptance/supervisor-start.test.ts` -> 5 failed
  - A1601, A1605 `AssertionError: expected 2 to be +0`
  - A1602 `AssertionError: expected [] to deeply equal [ 'factoryman_dispatch', …(3) ]`
  - A1603 `AssertionError: expected [] to deeply equal [ 'Watch the repo and wait.', …(1) ]`
  - A1604 `AssertionError: expected 2 to be 1`
- green: `src/tools/supervisor-start.ts` parses the three flags (each once, non-blank), reads the checkout and `dispatch.json` through `loadDispatchConfig`, chooses the profile (`--profile`, then `roles.supervisor.profile`, never `default`, with `Object.hasOwn` so that `constructor` is not a profile), runs `gateReadiness` on the default host, and calls `spawnSupervisor` once with `{ role: "supervisor" }`.
  `runFactorymanCommand` routes the word `start`, the usage text gained the start line, and the registered `supervisor` command lists both usage lines.
  Suite `pnpm test` -> 146 files, 1904 passed, 0 failed (26 s). `pnpm run typecheck` and `pnpm run lint` clean.
- Observation: the fake host accepts a two-line `usage` string in the CLI registration. A real bb has not seen it yet, so the live runs (T040 to T043) are the check.
- refactor: none needed. `refuse` and `names` are the two helpers the module needed, and each has three or more callers.
- commit: see the commit that carries this entry.

## Group 4: the advice after a stamp (U1644 to U1655, A1607)

A stub came first: `roleAdvice` threw `not implemented: roleAdvice`.
Two of my own tests were wrong, and were fixed as their own step before the implementation: `[U1649]` and `[U1650]` asserted that no `getThread` call happened, but the fixture's dispatch had already read `thr-w1`, so they failed for a reason that was not the behavior (`expected [ [ 'thr-w1' ] ] to deeply equal []`).
They now compare the number of reads before and after the command.

- red: `pnpm vitest run src/harness/advice.test.ts src/tools/supervisor-command.test.ts test/acceptance/tools-supervisor-command.test.ts` -> 17 failed after the test fix, 30 passed
  - U1651 to U1655 (nine tests) `Error: not implemented: roleAdvice`
  - U1644 (Codex, omp) `AssertionError: expected 'Thread thr-new is now a factoryman su…' to be 'Thread thr-new is now a factoryman su…'` (the old one-line text)
  - U1645 (Claude Code, Pi) `AssertionError: expected 'Thread thr-new is now a factoryman su…' to contain 'on its next turn.'`
  - U1646 `AssertionError: expected 'Thread thr-new is now a factoryman su…' to contain 'The harness acp-hermes-agent has no r…'`
  - U1647 `AssertionError: null: expected 'Thread thr-new is now a factoryman su…' to contain 'bb did not say which harness the thre…'`
  - U1648 `AssertionError: codex: expected 'Thread thr-new is now a factoryman su…' not to contain 'from its next session'`
  - A1607 `AssertionError: thr-codex: expected 'Thread thr-codex is now a factoryman …' to contain 'bb thread clear thr-codex'`
- U1649 and U1650 passed on their first run, because the command already refused a worker before it read anything and already printed no advice on a rejected stamp.
  Deliberate mutants, both reverted from a copy of the file:
  - a `getThread` call before the worker check -> `[U1649]` failed (`expected [ [ 'thr-w1' ], [ 'thr-new' ] ]` ...) and `[U1650]` failed too
  - a `getThread` call between the worker check and the stamp -> `[U1650]` failed (`expected [ [ 'thr-w1' ], [ 'thr-new' ] ] to have a length of 1 but got 2`)
  They are guards of behavior that already held. They fall in the class that D-099 and D-122 record as accepted: a test that passed on first run and has a killing mutant.
- green: `roleAdvice` returns the next-turn line for a known row with `roleChange: "next-turn"`, and the clear instruction (with a reason line that names the harness, the unknown provider, or the unreadable read) for everything else.
  `supervisor <thread>` reads the thread after a successful stamp and prints the confirmation line and the advice. The old text is gone.
  Suite `pnpm test` -> 147 files, 1923 passed, 0 failed (26 s). `pnpm run typecheck` clean.
- Deviation from the plan: `src/harness/` is data only, and the lint rule forbids every import there, even a type import (`no-restricted-imports`, first lint run).
  So `roleAdvice` takes a structural type, `RoleChangeFacts` (`provider` and `roleChange`), that a contract row fits, and imports nothing.
- refactor: none needed beyond the lint fix.
- commit: see the commit that carries this entry.

## Group 5a: the validator agent module (U1656 to U1689)

A stub came first: every exported function of `src/validator/agent.ts` threw `not implemented: <name>`, and `AGENT_PROVIDERS` was an empty record, so each red is a stub signal or a table assertion.
The shape simplified from `data-model.md`: an `auto` entry is one more entry of the agent list (kind `auto`), so there is one `agents` list and no top-level `auto` or `readyProviders` field.

- red: `pnpm vitest run src/validator/agent.test.ts` -> 52 failed, 0 passed
  - U1656 to U1665 (parser, 10 tests and their rows) `Error: not implemented: parseAgentSetting`
  - U1666 `AssertionError: expected {} to deeply equal { claude: 'claude-code', …(6) }`
  - U1667 (eleven rows) `Error: not implemented: providerForAgent`
  - U1668 to U1681 (observation, 14 tests) `Error: not implemented: observeValidatorAgent`
  - U1682 to U1688 (text, 7 tests) `Error: not implemented: describeObservation`
  - U1689 `Error: not implemented: validatorProblem`
- green: `parseAgentSetting` reads the top-level `agent` key in its three shapes with a small comment and quote reader and refuses the broken shapes; `observeValidatorAgent` runs the one `sh -c` read (30 s, the host of the call), reads the same host's provider states, and builds one entry per name with `readinessProblem` of `src/dispatch/availability.ts`; `describeObservation` and `validatorProblem` write the evidence line and the preflight message.
  One test failed after the first implementation (`[U1683]`: a single not-ready line must carry bb's problem text with its period, and only list entries trim it), and one type error was in my test helper; both were fixed in the same cycle.
  Suite `pnpm test` -> 148 files, 1975 passed, 0 failed (26 s). `pnpm run typecheck` and `pnpm run lint` clean.
- refactor: none needed.
- commit: see the commit that carries this entry.

## Group 5b: the preflight and its consumers (U1690 to U1698)

A stub came first: `preflightReport` threw `not implemented: preflightReport`, and `reportText` ignored a fourth argument.
Two existing tests pin the exact `exec` calls of a `no-mistakes` preflight, and both were adapted for the new read in the same red step, with the reason: `[U838]` (the list of command lines) now expects the read between the gate checks and the gh check, and `[U856]` (every call ran in the source path) now exempts the read, which opens a file under the home directory and needs no working directory, and requires exactly one read.
No assertion was loosened: each test gained the read, and `[U856]` gained a check that exactly one read happened.

- red: `pnpm vitest run src/machines/preflight.test.ts src/tools/supervisor-command.test.ts src/tools/dispatch.test.ts src/limits/queue.test.ts` -> 10 failed, 93 passed
  - U838 (adapted) `AssertionError: expected [ 'git --version', …(3) ] to deeply equal [ 'git --version', …(4) ]`
  - U1690, U1691, U1692 (two tests), U1693 `Error: not implemented: preflightReport`
  - U1695 `AssertionError: expected [ Array(1) ] to deeply equal [ …(2) ]`
  - U1696 `AssertionError: expected +0 to be 1` (the preflight command printed a ready report for an unready agent)
  - U1697 `AssertionError: expected true to be false` (the dispatch went through)
  - U1698 `AssertionError: expected 'working' to be 'queued'` (the queued task started)
- green: `preflightReport` is the old `runPreflight` body plus, for `no-mistakes` projects only, `observeValidatorAgent` on the machine, a `validator_agent` problem when `validatorProblem` finds one and a note (`describeObservation`) when the agent is ready; `runPreflight` returns its problems, so dispatch, the queue, and `preflightOnce` are unchanged and inherit the check; `reportText` prints the notes after the headline and the problems; the `preflight` command uses `preflightReport`.
  A bad string replacement in my edit script broke the file once (the doc comment differed from what I matched), and I repaired it by hand before the first green run.
  Suite `pnpm test` -> 148 files, 1984 passed, 0 failed (26 s). `pnpm run typecheck` and `pnpm run lint` clean.
- U1694 is credited to the adapted `[U838]` and to `[U844]`, which is unchanged.
- refactor: none needed.
- commit: see the commit that carries this entry.

## Group 5c: the validator line of a hand-off (U1699 to U1705, U1719, A1608 to A1613)

No stub was needed: `report.ts` already existed and the line was simply missing, so the reds are assertions.
The fixture `execCalls` now also records `host` and `timeoutMs` of each call (a new field on a recorded object; no test compared a whole entry).
My first acceptance design for a remote hand-off was wrong and was rewritten before the implementation: once the preflight checks the validator agent, a dispatch to a machine whose agent is not ready is refused (group 5b), so that task cannot exist.
`[A1611]` now gives the server and gpu-box different answers (the server says codex and not ready, gpu-box says claude and ready), so only a read on gpu-box can produce the expected line.
`[U1699]` also found a missing behavior, `U1719`, that the plan did not list: the line must not turn blank evidence into non-blank evidence, or it would defeat hard rule 3.
It was appended to the list and to task T029, and `[U58]` (existing) already guards it.

- red: `pnpm vitest run src/tools/report.test.ts test/acceptance/validator-observe.test.ts` -> 12 failed, 20 passed
  - U1699 `AssertionError: expected 'Committed abc123.' to be 'Committed abc123.\n\nValidator agent:…'`
  - U1700 (three tests) `AssertionError: expected 'Committed abc123.' to contain 'Validator agent: codex (bb provider c…'` and the two like it
  - U1701 `AssertionError: expected 'Committed abc123.' to contain 'could not be observed'`
  - U1703 `AssertionError: expected 'Committed abc123.' to be 'Committed abc123.\n\nValidator agent:…'`
  - U1705 `AssertionError: expected [ 'pnpm' ] to deeply equal [ 'pnpm', 'sh' ]`
  - A1608, A1609 `AssertionError: expected 'Committed abc123.' to be/contain …`
  - A1610 `AssertionError: a list: expected '' to match /^Validator agents, in order: codex …/s`
  - A1611 `AssertionError: the given combination of arguments (undefined and string) is invalid` (no evidence of the remote task yet)
  - A1613 `AssertionError: expected 2 to be greater than or equal to 3` (only the dispatch preflight and the preflight command read)
- U1702, U1704, U1719 and A1612 passed on their first run, because no line was added yet and the preflight already refused (group 5b).
  Three failures of my first implementation then showed the other two sides of the behavior, and I fixed the code or the test, whichever was wrong:
  - `[U1704]` failed: the observation ran before a failing custom check ended the hand-off (the check failure is only seen by the machine, in `rt.apply`). Fixed in the code: no observation when `run.failures` is not empty.
  - `[U1701]` and `[U1703]` failed because the dispatch to gpu-box in the fixture had already made a preflight read, which the tests counted. Fixed in the tests: they count the reads before the report.
  Deliberate mutants, both reverted from a copy of the file:
  - the blank-evidence condition removed -> `[U58]` and `[U1719]` failed
  - the mode condition (`task.mode === "no-mistakes"`) removed -> `[U1702]` failed
- green: `report.ts` appends `Validator agent: ...` after a blank line to the evidence of a `no-mistakes` ship hand-off, when the evidence is not blank and no custom check failed.
  `validatorLine` places the task's host with `hostFor`, finds the machine's name through `listMachines`, calls `observeValidatorAgent`, and turns a failed placement into the `unobserved` line.
  Suite `pnpm test` -> 149 files, 2000 passed, 0 failed (27 s). `pnpm run typecheck` and `pnpm run lint` clean.
- refactor: none needed.
- commit: see the commit that carries this entry.

## Group 6: scenario S9, the lab helpers, and the empty gap list (U1706 to U1718, A1614)

Stubs came first: `supervisorPrompt`, `supervisorStartArgs`, `labDispatchJson`, and `startedThreadId` threw `not implemented`, and the `startSupervisor` type gained `threadId`.
The old S9 tests `[U1397]` and `[U1398]`, the old gap assertions `[U1520]` and `[A1507]`, and `[A1508]` (the run exits 0 when S9 fails as a known gap) pinned the three gap entries and the old set of S9 checks.
FR-025 removes the entries, so these assertions were replaced by `[U1711]` to `[U1716]`, `[U1717]`, the new `[A1507]` (the list is empty), and `[A1614]`, with the reason recorded here.
The substance of the old S9 tests survives: the late stamp that never arrives still fails only `S9.tools-after-step`, an unstamped supervisor with tools still fails only `S9.unstamped-no-tools`, and a missing command still fails `S9.start-command`.
`[U1715]` was narrowed from the plan: the stub has no contract row, so the plugin correctly gives it the generic clear advice although its tools arrive at the next turn, and S9 cannot require "no clear advice" for a next-turn driver without contradicting the plugin.
The unit and acceptance tests against the real contract table (`[U1645]`, `[A1607]`) cover that side.

- red: `pnpm vitest run tools/conformance test/fixtures test/acceptance/conformance-*.test.ts` -> 12 failed, 123 passed
  - U1706, U1707 `Error: not implemented: supervisorStartArgs` and `startedThreadId` (stubs)
  - U1708 `Error: not implemented: labDispatchJson`
  - U1709 `AssertionError: expected undefined to match /^thr_/` (the fake `startSupervisor` returned no thread ID)
  - U1710 `AssertionError: …` (the old one-line stamp text with "from its next session")
  - U1711 `AssertionError: expected [ 'S9.start-command', 'S9.unstamped-no-tools', … ] to deeply equal [ …, 'S9.start-tools', … ]` (the check did not exist)
  - U1712 `AssertionError: expected [ 'S9.start-command' ] to deeply equal [ 'S9.start-command', 'S9.start-tools' ]`
  - U1713 `AssertionError: startedLacksTool: expected [] to deeply equal [ 'S9.start-tools' ]`
  - U1715 `AssertionError: expected [] to deeply equal [ 'S9.stamp-advice', 'S9.tools-after-step' ]` (no stamp fault yet)
  - U1717, A1507 `AssertionError: expected [ …(3) ] to deeply equal []` (the three gap entries)
  - A1614 `AssertionError: --tier 1: expected 'S9  pass       Role change' to match /^S9 pass/` after the first green: a bug in my regex (the runner pads the verdict column), fixed in the test.
- U1714 and U1716 passed on their first run, because those S9 checks already existed. Deliberate mutants, all reverted from a copy of the file:
  - the unstamped check made `true` -> `[U1714]` failed
  - the after-step check made `true` -> `[U1715]` and `[U1716]` failed
  - the first-turn check made to ignore a missing skill -> `[U1713]` failed
- green: the lab project's `dispatch.json` now names the driver's profile as `roles.supervisor.profile`, `supervisorStartArgs` builds `supervisor start --project <id> --prompt <label marker>`, `startedThreadId` reads the ID from the first line, `real-lab.ts` uses the three helpers, and `S9` has the new check `S9.start-tools` (the four tools and the skill on the first request, no worker tool or skill).
  The fake lab seeds the role at spawn for a started supervisor, prints the real advice (`roleAdvice` and the contract table) after a stamp, and has the faults the tests use (`startedLacksTool`, `startedLacksSkill`, `startedSeesWorkerTool`, `startedNeedsClear`, `stampFails`).
  `conformance/known-gaps.json` lists no entry.
  Suite `pnpm test` -> 149 files, 2009 passed, 0 failed (26 s). `pnpm run typecheck` and `pnpm run lint` clean.
- U1718 is credited to the existing `[U1305]` and `[A1309]`, which pass before and after.
- The glue of `real-lab.ts` (the call to `bb`, the project setup) has no unit test. The live runs (T040 to T043) are its check.
- refactor: none needed.
- commit: see the commit that carries this entry.
