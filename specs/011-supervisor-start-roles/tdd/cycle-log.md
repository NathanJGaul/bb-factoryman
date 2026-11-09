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
