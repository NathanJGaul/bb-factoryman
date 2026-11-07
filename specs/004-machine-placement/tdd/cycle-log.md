# Cycle log: Machine placement

Append only.
Newest last.
Every entry's `red` block is the evidence that the test existed and failed before the implementation.
From this milestone on, each group commits its tests with stubs first, so git history shows the order.

## Baseline

- suite: `pnpm test` -> 63 files, 708 passed, 0 failed
- commit: `5028c96`

## Group 1: choosing a machine and the `local-only` gate

Red commit: `b6303bd` (`test: add machine placement tests and stubs, group 1 (red)`). It holds the tests, the type-only additions to `src/bb/port.ts`, a stub `pickMachine` that returns `none`, and a guard stub that returns null.

- red: `pnpm vitest run src/dispatch/placement.test.ts src/machine src/dispatch src/bb/adapter.test.ts test/acceptance/machine-placement.test.ts`
  - `[U801]` to `[U808]`: `AssertionError` on `status` (the stub returned `none`), 8 failed
  - `[U810]`: `AssertionError` (a rule with `machine` was rejected as an unknown key)
  - `[U811]`, `[U812]`: `machine` missing from the result
  - `[U813]`: `expected false to be true` (`cloneMachine` was an unknown key)
  - `[U814]` to `[U818]`: `Error: fixture event start is invalid: Unrecognized key: "cloneMachine"`
  - `[U819]` to `[U822]`: `TypeError: port.listMachines is not a function` and the same for `getProjectSources`
  - `[A801]` to `[A808]`, `[A814]`, `[A815]`: the tool ignored `machine` (11 failed)
- Existing tests whose expectations grew with the result shape (not weakened): `[U710]`, `[U711]`, `[U712]`, `[U714]`, `[U716]`, `[U717]` now expect `machine: null` in each result and candidate.
  `[U45]` expects `machine` and `cloneMachine` in the `start` payload. `test/fixtures/legal-set.ts` lists the new `localOnlyStaysOnClone` guard on `queued` `start` in both lanes.
- Passed against the stubs: `[U809]`, `[A816]`, `[A812]`, and the second half of `[U815]`. Deliberate mutants after the implementation:
  - `[U809]`: return the first host for no value -> `[U801]` and `[U809]` failed. Reverted.
  - `[A816]`: remove the "no machine" early return from the guard -> `[U815]` and `[A816]` failed. Reverted.
  - `[A812]`: make `request_changes` clear the machine -> `[A812]` failed. Reverted.
- Mutants on the new gates, all killed:
  - compare `machine !== cloneMachine` -> `[U814]`, `[U815]`, `[A814]`, `[A815]` failed
  - remove the preview of `start` -> `[A814]` failed (a worker would have spawned)
  - skip the offline check -> `[U805]`, `[U806]`, `[U808]`, both `[A808]` cases failed
  - drop `cloneMachine` from the event -> `[A801]`, `[A804]`, `[A815]` failed
- green: `placement.ts`, the rule `machine`, ambiguity on profile and machine (`sameChoice`), `cloneMachine` on the event, the `localOnlyStaysOnClone` guard, the adapter methods, and the dispatch flow (`place`, the preview, and the host on the spawn).
  `pnpm run check` -> 66 files, 746 passed, 0 failed. Type check and lint clean.
- one lint finding fixed on the way (`no-useless-assignment`): the machine choice moved into the `place` helper.
