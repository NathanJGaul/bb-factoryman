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

## Group 2: remote commands and the preflight

Red commit: `48c2e3d` (`test: add remote command, preflight, and host routing tests with stubs, group 2 (red)`). It holds the tests, the type-only additions (`TerminalRead`, the terminal methods on `BbPort`, `ExecOptions.host`), a stub runner that returns "not implemented", a stub `hostFor` that returns null, and a stub preflight that returns no problems.

- red: `pnpm vitest run src/machines src/git src/validator src/tools/status.test.ts src/tools/supervisor-command.test.ts src/bb test/acceptance/machine-remote.test.ts`
  - `[U824]` to `[U832]`, and the disconnected case: `AssertionError` on the decoded result (the stub returned "not implemented"), 10 failed
  - `[U834]`: `expected null to be 'host_gpu'`
  - `[U835]`: the hosts array was `[undefined x5]`
  - `[U837]`: the `host` option was missing from each git command
  - `[U838]` to `[U845]` and two more: the stub returned no problems and an empty report
  - `[U855]`: no `machine:` line
  - `[U856]`: `bb factoryman preflight` printed the usage and exited 2
  - `[U823]`: `Error: not implemented`
  - `[U836]`: `expected [ null, null ] to deeply equal [ null, 'host_gpu' ]`
  - `[A817]` to `[A820]`, `[A822]`: the command did not exist and the checks never ran (7 failed)
- Passed against the stubs: `[A821]` and `[A824]` (the existing behavior), and `[A823]`, whose three cases failed teardown for the wrong reason (the server's default git output is empty, which D-046 already refuses).
  - `[A821]`: dispatch also checks the clone host -> `[A821]` failed (1 failed). Reverted.
  - `[A823]`: the "truncated" case was strengthened after the implementation. The fake now marks a correct answer as truncated (`remote.truncate`), so only the truncation check can refuse it.
    Mutant: ignore `truncated` -> `[A823]` failed and `[U829]` failed. Reverted. The first version of this mutant survived the acceptance test and died only in `[U829]`.
- Existing tests whose expectations grew with the shape: `[U186]` and `[U192]` expect `host: null` in the validator input.
- Mutants after the implementation, all killed unless noted:
  - ignore `truncated` -> `[U829]`; accept a missing frame as success -> `[U828]`; ignore a disconnected terminal -> the disconnected test
  - `routeExec` always local -> `[U832]` and six acceptance tests; never close the terminal -> `[U827]`, `[U831]`
  - `hostFor` ignores the clone host -> `[U833]`; teardown drops the host -> `[A822]`
  - dispatch skips the preflight -> `[A820]`; dispatch preflights the clone host -> `[A821]`
  - `gh` checked for `local-only` -> `[U842]`; a failure is cached -> `[U844]`
  - the driver drops the host -> `[U836]`; `cancel` drops the host -> `[U835]`; the second git command drops the host -> `[U837]`
  - the terminal closes with `if-clean` -> `[U823]`
  - "any provider" instead of the named provider survived `[U839]`. The test gained a case with another provider available. The same mutant then failed `[U839]`. Reverted.
- green: `remote-exec.ts` (the `FMX1` wrapper, polling by count with the injected sleep, the frame decoder), `route.ts`, `preflight.ts`, the adapter terminal methods, the `host` field on the validator inputs, the report, the driver, teardown, the routed `exec` in `server.ts`, the status line, the `preflight` command, and the dispatch preflight step.
  `pnpm run check` -> 70 files, 788 passed, 0 failed. Type check and lint clean.

## Group 3: the machine monitor

Red commit: the commit before this group's implementation (`test: add machine monitor tests and a stub, group 3 (red)`). It holds the tests and a stub monitor whose `tick` and `hostDeleted` do nothing.

- red: `pnpm vitest run src/machines/monitor.test.ts test/acceptance/machine-monitor.test.ts`
  - `[U846]`, `[U848]`, `[U851]`, `[U853]`: `AssertionError: expected 'working' to be 'blocked'`
  - `[U852]`: `expected false to be true` (no warning logged)
  - `[U854]`: `expected [] to have a length of 1 but got +0`
  - `[A809]` to `[A813]`: `Error: no background service "factoryman-machines" is registered`, and `expected 'working' to be 'blocked'` (10 failed)
- Passed against the stub: `[U847]`, `[U849]`, `[U850]` (the stub changes nothing). Deliberate mutants after the implementation:
  - block again on every tick -> `[U847]` and `[U853]` failed
  - unblock any block -> `[U849]` and `[A810]` failed
  - act on a task with no machine -> `[U850]` failed
  - act on ended tasks: this survived. The warning path ran instead of an event. `[U850]` gained an assertion that no warning names the failed task, and the mutant then failed it.
- More mutants, all killed: drop the `machine offline:` prefix -> `[U846]`, `[U848]`, `[U853]`; ignore the host-deleted event -> `[A811]`; block in any state -> `[U854]`, `[A813]`.
- `[U123]` changed with the requirement: two services and seven event handlers (D-077).
- green: `monitor.ts` (`tick`, `hostDeleted`, the warn-once set, and unblock only for the monitor's own latest block), the `machinePollSeconds` setting, the `factoryman-machines` service, and the `experimental_host.deleted` handler.
  `pnpm run check` -> 72 files, 801 passed, 0 failed. Type check and lint clean.
