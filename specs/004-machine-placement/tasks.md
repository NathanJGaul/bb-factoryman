---
description: "Task list for machine placement"
---

# Tasks: Machine placement

**Input**: `specs/004-machine-placement/spec.md`, `plan.md`, `tdd/test-list.md`
**Tests**: Mandatory. Each group commits its tests with stubs first (red), then the implementation.

## Phase 1: Spike

- [X] T801 Record spike items 6, 7, and 8 in `spike/RESULTS.md` (done before this spec)

## Phase 2: Group 1, choosing a machine and the `local-only` gate

- [X] T810 Tests and stubs: `src/dispatch/placement.test.ts`, the rule `machine` in `config.test.ts` and `resolver.test.ts`, the `cloneMachine` event and `localOnlyStaysOnClone` guard in `src/machine/*.test.ts`, port and adapter tests, and `test/acceptance/machine-placement.test.ts` (A801 to A808, A814 to A816)
- [X] T811 Implement `placement.ts`, the rule `machine`, the event field and guard, `listMachines`, `getProjectSources`, `listProviders(hostId)`, the spawn `hostId`, the dispatch `machine` argument and flow, and the status line

## Phase 3: Group 2, remote commands and the preflight

- [X] T820 Tests and stubs: `src/machines/remote-exec.test.ts`, `src/machines/preflight.test.ts`, the exec routing in the validator, the driver, and teardown, the `preflight` command, and `test/acceptance/machine-remote.test.ts` (A817 to A824)
- [X] T821 Implement `remote-exec.ts`, `route.ts`, `preflight.ts`, the terminal methods of the port, the host option of `Exec`, the validator and report changes, and the command

## Phase 4: Group 3, the machine monitor

- [X] T830 Tests and stubs: `src/machines/monitor.test.ts` and `test/acceptance/machine-monitor.test.ts` (A809 to A813)
- [X] T831 Implement `monitor.ts`, the `machinePollSeconds` setting, the service, and the `experimental_host.deleted` handler

## Phase 5: Close-out

- [X] T840 Record D-069 to D-077 in `docs/DECISIONS.md`, update `spike/RESULTS.md` (Not checked table), and update the profile helpers
- [X] T841 `/speckit.tdd.verify`, remediation, `/speckit.checklist`, `/speckit.analyze`, `/speckit.converge`

## Phase 6: Audit remediation (from `tdd/verification.md`)

- [X] R1 `[U857]`, `[A827]`: a `bb` read failure during placement stops the dispatch
- [X] R2 `[U861]`: teardown refuses when the sources cannot be read
- [X] R3 `[U882]` to `[U884]`: the preflight cache key holds host, project, mode, and provider
- [X] R4 `[U878]`: the `FMX1` wrapper runs under a real shell
- [X] R5 `[A826]`: `local-only` with a machine and no default source is refused
- [X] R6 `[U858]` to `[U860]`: the provider check on the target host, and a preflight that cannot run
- [X] R7 `[U879]`, `[U880]`: the remote host reaches `answer` and the status poll
- [X] R8 `[U862]` to `[U864]`, `[U877]`: the monitor unblocks only its own blocks
- [X] R9 `[U865]`: a deleted machine's task is never unblocked (the monitor remembers removed hosts)
- [X] R10 `[A812]` per move, and the three eager tests split
- [X] R11 `[U868]` to `[U876]`, `[U881]`, `[A825]`: the smaller survivors and the bookkeeping
