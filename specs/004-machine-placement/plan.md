# Implementation plan: Machine placement

**Branch**: `fm/bb-factoryman-milestones-7-11` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

## Summary

Add placement to `factoryman_dispatch`, a host terminal command runner, a remote preflight, a machine monitor, and one new state machine guard.
The machine change is small: `start` gains an optional `cloneMachine`, and a new guard refuses a `local-only` start on another machine.
Everything else sits outside `src/machine/`.

## Technical context

- bb facts: spike items 6, 7, and 8 (`spike/RESULTS.md`).
- The host terminal API runs one command and returns its exit code and output. The runner wraps the command so that standard output, standard error, and the exit code come back separately.
- No new package.

## Constitution check

| Principle | How the plan complies |
| --- | --- |
| I. Gates fail closed | Unknown, ambiguous, offline, or unprepared machines block. Terminal failures fail the command. `local-only` is a machine guard. |
| II. Machine core is pure | The guard and the event field use plain data. No import changes. |
| III. Event log is the source | Offline blocks and unblocks are events with system evidence. The monitor derives its own memory from the log. |
| IV. Storage behind an interface | No storage change. |
| V. Test first | `tasks.md` orders tests first. |
| VI. Scope | Milestone 8 only. |

## Source layout

```text
src/dispatch/placement.ts   # pure: pick a machine, check it is usable
src/dispatch/types.ts       # Rule.machine, Resolution.machine
src/machines/monitor.ts     # MachineMonitor: tick, block, unblock, host deleted
src/machines/preflight.ts   # runPreflight and the report text
src/machines/remote-exec.ts # terminal-backed Exec
src/bb/port.ts              # + listMachines, listProviders(hostId), runOnHost helpers
src/machine/events.ts       # start.cloneMachine
src/machine/guards.ts       # localOnlyStaysOnClone
```

## Design

**Machine choice (`placement.ts`).**
`pickMachine({ explicit, rule, projectDefault }, hosts, sourceHostIds)` returns the chosen host or a blocker.
The host list comes from `bb.sdk.hosts.list()`.
A name resolves case-insensitively and must match one ID or one name.
A host is usable when `status` is `connected` and `lifecycle.phase` is `active`.
The project must have a source on the host.
There is no fallback: a blocker stops the dispatch.

**Clone host.**
The clone host is the `hostId` of the project's default `local_path` source.
`BbPort.getProjectSources` returns every source with its host.
`dispatch` passes it as `cloneMachine` in the `start` event, and the worker spawns on `machine ?? cloneHost`.

**State machine guard.**
`localOnlyStaysOnClone` runs on `start` for both lanes.
It passes when the mode is not `local-only`, or `machine` is absent, or `machine === cloneMachine`.
Otherwise it refuses with `machine_mismatch`.

**Remote runner.**
`createRemoteExec` returns an `Exec`.
With a host in the options it creates a `host_path` terminal in `argv` mode, runs `sh -c <wrapper> sh <command> <args>`, polls `terminals.get` until the status is not `running`, reads `terminals.output`, closes the terminal, and decodes a `FMX1 <code> <stdout64> <stderr64>` line.
A timeout, a missing frame, truncated output, or a terminal error returns `{ code: null, error }`, which every caller already treats as a failure.
Without a host it calls the local runner.

**Monitor.**
`MachineMonitor.tick()` lists hosts and tasks that have a machine and are not terminal.
A `working` task on an offline host gets `block` with evidence starting `machine offline:`.
A `blocked` task whose latest applied row is a system `block` with that prefix gets `unblock` when its host is online again.
The service loops `tick()` every `machinePollSeconds`.
`experimental_host.deleted` runs the block half at once.

**Preflight.**
`runPreflight` takes the host, the project, and the mode.
It reports each check as `ok` or `missing` with a fix hint.
`dispatch` runs it for any machine that is not the clone host and blocks on any `missing` check.
A passing result is cached per host and project until restart.

## Decisions to record

- D-069: a pre-start offline machine blocks the dispatch and creates no task (resolves D-008).
- D-070: the clone host is the project's default source host.
- D-071: commands on remote machines run through host terminals with a framed result.
- D-072: the monitor only blocks `working` tasks and only unblocks its own blocks.
- D-073: `start` gains `cloneMachine`, and the `local-only` guard.
