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
