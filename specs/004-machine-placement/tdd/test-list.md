---
feature: 004-machine-placement
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 24
planned_at: 5028c96
updated_at: 9e765f8
suite_baseline: green
---

# Test list: Machine placement

The acceptance layer is an in-process integration test through the bb fake plugin host and the public factory.
No process-level runner drives a real remote machine, so every `A` behavior is weaker than an end-to-end test.
Spike items 6, 7, and 8 pin the real bb facts, and the live check in milestone 11 is the first run against a second machine.
The suite baseline was 63 files and 708 tests, all passing.

## Outer loop: acceptance behaviors

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| A801 | An explicit `machine` spawns the worker on that host, records the host ID on the task, and the `start` event carries the clone host | AC-1.1, FR-801, FR-805 | example | DONE | `test/acceptance/machine-placement.test.ts::[A801]` |
| A802 | With no explicit machine, the matching rule's machine applies | AC-1.2, FR-801 | example | DONE | `test/acceptance/machine-placement.test.ts::[A802]` |
| A803 | With neither, the project's default machine applies | AC-1.3, FR-801 | example | DONE | `test/acceptance/machine-placement.test.ts::[A803]` |
| A804 | With none of the three, the worker spawns on the project's default host and the task records no machine | AC-1.4, FR-801 | example | DONE | `test/acceptance/machine-placement.test.ts::[A804]` |
| A805 | A machine name resolves to its host ID, and an unknown or ambiguous name blocks with no task | AC-1.5, FR-802, FR-803 | example | DONE | `test/acceptance/machine-placement.test.ts::[A805]` |
| A806 | A host with no source of the project blocks dispatch | AC-1.6, FR-803 | example | DONE | `test/acceptance/machine-placement.test.ts::[A806]` |
| A807 | Two matching rules with equal profiles and different machines are `ambiguous` | AC-1.7, FR-811 | example | DONE | `test/acceptance/machine-placement.test.ts::[A807]` |
| A808 | A pinned machine that is disconnected or not active blocks with `machine_offline`, tries no other machine, and creates no task | AC-2.1, FR-803, FR-804, SC-802 | example | DONE | `test/acceptance/machine-placement.test.ts::[A808]` |
| A809 | A `working` task whose machine goes offline becomes `blocked` with system evidence, and the supervisor gets one wake message | AC-2.2, FR-806, SC-801 | example | DONE | `test/acceptance/machine-monitor.test.ts::[A809]` |
| A810 | A task that the monitor blocked returns to `working` when its machine is back, and a task that its worker blocked does not | AC-2.3, FR-806 | example | DONE | `test/acceptance/machine-monitor.test.ts::[A810]` |
| A811 | A deleted machine blocks its `working` tasks at once, and nothing unblocks them | AC-2.4, FR-807 | example | DONE | `test/acceptance/machine-monitor.test.ts::[A811]` |
| A812 | After `start`, no event type changes the task's machine | AC-2.5, FR-804 | example | DONE | `test/acceptance/machine-placement-gates.test.ts::[A812]` |
| A813 | A task in a state other than `working` on an offline machine only logs a warning | AC-2.6, FR-806 | example | DONE | `test/acceptance/machine-monitor.test.ts::[A813]` |
| A814 | A `local-only` dispatch to a machine other than the clone host is refused by the state machine, spawns nothing, and creates no task | AC-3.1, FR-805 | example | DONE | `test/acceptance/machine-placement.test.ts::[A814]` |
| A815 | A `local-only` dispatch to the clone host succeeds | AC-3.2, FR-805 | example | DONE | `test/acceptance/machine-placement.test.ts::[A815]` |
| A816 | A `local-only` dispatch with no machine succeeds on the clone host | AC-3.3, FR-805 | example | DONE | `test/acceptance/machine-placement.test.ts::[A816]` |
| A817 | `bb factoryman preflight` reports an agent CLI that is not available on the machine | AC-4.1, FR-808, FR-812 | example | DONE | `test/acceptance/machine-remote.test.ts::[A817]` |
| A818 | The preflight reports `no-mistakes` missing, and not initialized in the project's source | AC-4.2, FR-808 | example | DONE | `test/acceptance/machine-remote.test.ts::[A818]` |
| A819 | The preflight reports missing `gh` credentials for the pull request modes and not for `local-only` | AC-4.3, FR-808 | example | DONE | `test/acceptance/machine-remote.test.ts::[A819]` |
| A820 | A failed preflight blocks dispatch to a remote machine and spawns no worker | AC-4.4, FR-808 | example | DONE | `test/acceptance/machine-remote.test.ts::[A820]` |
| A821 | The preflight is skipped for the clone host | AC-4.5, FR-808 | example | DONE | `test/acceptance/machine-remote.test.ts::[A821]` |
| A822 | Teardown of a task on a remote machine runs its git commands on that machine through a host terminal | AC-5.1, FR-809, FR-810 | example | DONE | `test/acceptance/machine-remote.test.ts::[A822]` |
| A823 | A host terminal that fails, times out, or truncates makes teardown refuse | AC-5.2, FR-809 | error | DONE | `test/acceptance/machine-remote.test.ts::[A823]` |
| A824 | A task with no machine runs its commands on the server as before | AC-5.3, FR-810 | example | DONE | `test/acceptance/machine-remote.test.ts::[A824]` |

## Inner loop: unit behaviors

### `src/dispatch/placement.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U801 | The explicit value wins over the rule, which wins over the project default, which wins over none | FR-801 | example | DONE | `src/dispatch/placement.test.ts::[U801]` |
| U802 | A name or an ID resolves to the host, case-insensitively for names | FR-802 | example | DONE | `src/dispatch/placement.test.ts::[U802]` |
| U803 | A value that matches no host is blocked with `machine_unknown` | FR-803 | example | DONE | `src/dispatch/placement.test.ts::[U803]` |
| U804 | A name that two hosts share is blocked with `machine_ambiguous`, and an ID wins over a name | FR-802, FR-803 | boundary | DONE | `src/dispatch/placement.test.ts::[U804]` |
| U805 | A disconnected host is blocked with `machine_offline` | FR-803 | example | DONE | `src/dispatch/placement.test.ts::[U805]` |
| U806 | A connected host in a phase other than `active` is blocked with `machine_offline` | FR-803 | boundary | DONE | `src/dispatch/placement.test.ts::[U806]` |
| U807 | A host with no source of the project is blocked with `machine_no_source` | FR-803 | example | DONE | `src/dispatch/placement.test.ts::[U807]` |
| U808 | A blocked result names no other host, so a caller cannot fall back | FR-804 | example | DONE | `src/dispatch/placement.test.ts::[U808]` |
| U809 | With no value at all the result is `none` and reads no host | FR-801 | example | DONE | `src/dispatch/placement.test.ts::[U809]` |

### `src/dispatch/config.ts` and `resolver.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U810 | A rule accepts an optional `machine`, and a blank machine is rejected | FR-801 | example | DONE | `src/dispatch/config.test.ts::[U810]` |
| U811 | A clear result from a rule carries the rule's machine, and other sources carry none | FR-801 | example | DONE | `src/dispatch/resolver.test.ts::[U811]` |
| U812 | Matching rules with equal profiles and different machines are ambiguous | FR-811 | example | DONE | `src/dispatch/resolver.test.ts::[U812]` |

### `src/machine/` (events, guards, table)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U813 | A `start` event accepts `cloneMachine` | FR-805 | example | DONE | `src/machine/events.test.ts::[U813]` |
| U814 | A `local-only` start with a machine that differs from the clone machine is refused with `machine_mismatch` | FR-805 | example | DONE | `src/machine/guards.test.ts::[U814]` |
| U815 | A `local-only` start with the clone machine, or with no machine, passes | FR-805 | boundary | DONE | `src/machine/guards.test.ts::[U815]` |
| U816 | A `local-only` start with a machine and no clone machine is refused | FR-805 | boundary | DONE | `src/machine/guards.test.ts::[U816]` |
| U817 | A task in another mode ignores the clone machine | FR-805 | example | DONE | `src/machine/guards.test.ts::[U817]` |
| U818 | The `start` event records the machine in the task context, in both lanes | FR-801 | example | DONE | `src/machine/transition.test.ts::[U818]` |

### `src/bb/adapter.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U819 | `listMachines` maps ID, name, status, phase, and an `online` flag | FR-803, FR-806 | example | DONE | `src/bb/adapter.test.ts::[U819]` |
| U820 | `getProjectSources` returns each source with host ID, path, and default flag | FR-803, FR-805 | example | DONE | `src/bb/adapter.test.ts::[U820]` |
| U821 | `listProviders(hostId)` passes the host ID to bb, and without one passes none | FR-808 | example | DONE | `src/bb/adapter.test.ts::[U821]` |
| U822 | `spawnWorker` with a host ID spawns on that host and with none uses the project's default host | FR-801 | example | DONE | `src/bb/adapter.test.ts::[U822]` |
| U823 | The terminal methods start a `host_path` terminal in `argv` mode, read decoded output, and close it | FR-809 | example | DONE | `src/bb/adapter.test.ts::[U823]` |

### `src/machines/remote-exec.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U824 | The runner starts one terminal with `sh -c <wrapper> sh <command> <args>` in the given directory on the given host | FR-809 | example | DONE | `src/machines/remote-exec.test.ts::[U824]` |
| U825 | A `FMX1` frame decodes into exit code, standard output, and standard error | FR-809 | example | DONE | `src/machines/remote-exec.test.ts::[U825]` |
| U826 | The runner polls until the terminal leaves `running`, sleeping between reads | FR-809 | example | DONE | `src/machines/remote-exec.test.ts::[U826]` |
| U827 | A terminal that never exits is closed and reported as a timeout | FR-809 | error | DONE | `src/machines/remote-exec.test.ts::[U827]` |
| U828 | Output with no frame is reported as an error that quotes its tail | FR-809 | error | DONE | `src/machines/remote-exec.test.ts::[U828]` |
| U829 | Truncated output is an error | FR-809 | error | DONE | `src/machines/remote-exec.test.ts::[U829]` |
| U830 | A terminal that cannot start is an error result and not a throw | FR-809 | error | DONE | `src/machines/remote-exec.test.ts::[U830]` |
| U831 | The terminal is closed after a result and after an error | FR-809 | example | DONE | `src/machines/remote-exec.test.ts::[U831]` |
| U832 | `routeExec` runs locally with no host and remotely with a host | FR-810 | example | DONE | `src/machines/remote-exec.test.ts::[U832]` |

### `src/machines/route.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U833 | `hostFor` returns null for a task with no machine and for a machine that is the clone host | FR-810 | example | DONE | `src/machines/route.test.ts::[U833]` |
| U834 | `hostFor` returns the machine ID for a remote machine | FR-810 | example | DONE | `src/machines/route.test.ts::[U834]` |

### `src/validator`, `src/git/report.ts`, `src/tools/teardown.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U835 | Every `no-mistakes` command passes the host option to `exec` | FR-810 | example | DONE | `src/validator/no-mistakes.test.ts::[U835]` |
| U836 | The validation driver passes the task's remote host to the validator | FR-810 | example | DONE | `src/validator/driver.test.ts::[U836]` |
| U837 | The worktree report passes the host option to each git command | FR-810 | example | DONE | `src/git/report.test.ts::[U837]` |

### `src/machines/preflight.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U838 | A machine that passes every check gives an empty problem list | FR-808 | example | DONE | `src/machines/preflight.test.ts::[U838]` |
| U839 | A provider that is not available on the host is reported | FR-808 | example | DONE | `src/machines/preflight.test.ts::[U839]` |
| U840 | `no-mistakes` not found is reported for `no-mistakes` mode only | FR-808 | example | DONE | `src/machines/preflight.test.ts::[U840]` |
| U841 | A missing `no-mistakes` remote in the source is reported for `no-mistakes` mode | FR-808 | example | DONE | `src/machines/preflight.test.ts::[U841]` |
| U842 | A failing `gh auth status` is reported for `no-mistakes` and `direct-PR` and not for `local-only` | FR-808 | example | DONE | `src/machines/preflight.test.ts::[U842]` |
| U843 | A command that cannot run (code null) counts as a failed check | FR-808 | error | DONE | `src/machines/preflight.test.ts::[U843]` |
| U844 | A pass is cached per host, project, and mode until restart, and a failure is not | FR-808 | example | DONE | `src/machines/preflight.test.ts::[U844]` |
| U845 | The report text names each problem and the fix | FR-808, FR-812 | example | DONE | `src/machines/preflight.test.ts::[U845]` |

### `src/machines/monitor.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U846 | `tick` blocks a `working` task whose host is offline, with evidence that starts `machine offline:` | FR-806 | example | DONE | `src/machines/monitor.test.ts::[U846]` |
| U847 | A second `tick` with the same host state applies nothing more | FR-806 | example | DONE | `src/machines/monitor.test.ts::[U847]` |
| U848 | `tick` unblocks a task whose latest applied row is the monitor's own block, once the host is online | FR-806 | example | DONE | `src/machines/monitor.test.ts::[U848]` |
| U849 | `tick` leaves a worker's own block alone | FR-806 | example | DONE | `src/machines/monitor.test.ts::[U849]` |
| U850 | `tick` ignores tasks with no machine, terminal tasks, and tasks on online hosts | FR-806 | example | DONE | `src/machines/monitor.test.ts::[U850]` |
| U851 | A host that `listMachines` omits counts as offline | FR-806 | boundary | DONE | `src/machines/monitor.test.ts::[U851]` |
| U852 | A tick that cannot list machines logs and changes nothing | FR-806 | error | DONE | `src/machines/monitor.test.ts::[U852]` |
| U853 | `hostDeleted` blocks `working` tasks on that host and never unblocks them | FR-807 | example | DONE | `src/machines/monitor.test.ts::[U853]` |
| U854 | A task in `validating`, `review_ready`, or another state on an offline host logs a warning and applies nothing | FR-806 | example | DONE | `src/machines/monitor.test.ts::[U854]` |

### `src/tools/status.ts`, `src/tools/supervisor-command.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U855 | `factoryman_status` shows the machine of a task that has one | FR-801 | example | DONE | `src/tools/status.test.ts::[U855]` |
| U856 | `bb factoryman preflight <machine> --project <id>` runs the preflight and prints the report, and a bad call prints usage | FR-812 | example | DONE | `src/tools/supervisor-command.test.ts::[U856]` |

## Added by the audit (cycle R1)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| A825 | After a pass, the next dispatch to the same machine does not repeat the preflight | AC-4.4 | example | DONE | `test/acceptance/machine-remote.test.ts::[A825]` |
| A826 | A `local-only` dispatch to a machine is refused when the project has no default source, even if the machine is the first source | AC-3.1 | boundary | DONE | `test/acceptance/machine-placement.test.ts::[A826]` |
| A827 | A machine list that bb cannot return stops the dispatch with no task and no worker | AC-1.5, AC-2.1 | error | DONE | `test/acceptance/machine-placement.test.ts::[A827]` |
| U857 | A machine list or a source list that bb cannot return stops the dispatch with no task and no worker | AC-2.1 | error | DONE | `src/tools/dispatch.test.ts::[U857]` |
| U858 | A preflight that cannot run stops the dispatch | AC-4.4 | error | DONE | `src/tools/dispatch.test.ts::[U858]` |
| U859 | The provider is checked on the target host | AC-4.4 | example | DONE | `src/tools/dispatch.test.ts::[U859]` |
| U860 | The provider is still checked after a preflight pass is cached | AC-4.4 | example | DONE | `src/tools/dispatch.test.ts::[U860]` |
| U861 | Teardown refuses, records nothing, and removes nothing when the project sources cannot be read | AC-5.2 | error | DONE | `src/tools/teardown.test.ts::[U861]` |
| U862 | A worker's block after a monitor block and unblock stays | AC-2.3 | example | DONE | `src/machines/monitor.test.ts::[U862]` |
| U863 | A refused row after the monitor's block does not stop the unblock | AC-2.3 | boundary | DONE | `src/machines/monitor.test.ts::[U863]` |
| U864 | A system block without the monitor's prefix stays | AC-2.3 | example | DONE | `src/machines/monitor.test.ts::[U864]` |
| U865 | A deleted machine's task is never unblocked, even when the list still shows the host online | AC-2.4 | example | DONE | `src/machines/monitor.test.ts::[U865]` |
| U866 | The warning for a task in another state repeats after an outage ends and a new one begins | AC-2.6 | example | DONE | `src/machines/monitor.test.ts::[U866]` |
| U867 | A torn down task on an offline machine is ignored without a warning | AC-2.6 | example | DONE | `src/machines/monitor.test.ts::[U867]` |
| U868 | `pickMachine` marks the host that holds the clone | FR-805 | example | DONE | `src/dispatch/placement.test.ts::[U868]` |
| U869 | `hostFor` reads nothing from bb for a task with no machine | FR-810 | example | DONE | `src/machines/route.test.ts::[U869]` |
| U870 | The preflight reports every failed check together | FR-808 | example | DONE | `src/machines/preflight.test.ts::[U870]` |
| U871 | The report says so when nothing is missing | FR-808 | example | DONE | `src/machines/preflight.test.ts::[U871]` |
| U872 | A disconnected terminal is an error | FR-809 | error | DONE | `src/machines/remote-exec.test.ts::[U872]` |
| U873 | The preflight command skips checks the mode does not need and reports an offline machine | FR-812 | example | DONE | `src/tools/supervisor-command.test.ts::[U873]` |
| U874 | The preflight command says that the clone host needs no remote preflight and runs nothing | AC-4.5 | example | DONE | `src/tools/supervisor-command.test.ts::[U874]` |
| U875 | `pollMsFrom` turns seconds into milliseconds with a floor of one second | FR-806 | boundary | DONE | `src/machines/monitor.test.ts::[U875]` |
| U876 | The machine check interval setting has a default of 30 seconds | FR-806 | example | DONE | `src/server.test.ts::[U876]` |
| U877 | A worker's block that copies the monitor's evidence prefix stays | AC-2.3 | example | DONE | `src/machines/monitor.test.ts::[U877]` |
| U878 | The `FMX1` wrapper, run by a real shell, reports exit codes, both streams, and non-ASCII text | FR-809 | example | DONE | `src/machines/remote-exec.test.ts::[U878]` |
| U879 | The remote host reaches the validator when it answers a finding | FR-810 | example | DONE | `src/validator/driver.test.ts::[U879]` |
| U880 | The remote host reaches the validator while it waits for a person | FR-810 | example | DONE | `src/validator/driver.test.ts::[U880]` |
| U881 | A `starting` terminal is polled again | FR-809 | example | DONE | `src/machines/remote-exec.test.ts::[U881]` |
| U882 | A second host gets its own preflight | FR-808 | example | DONE | `src/machines/preflight.test.ts::[U882]` |
| U883 | A second provider gets its own preflight | FR-808 | example | DONE | `src/machines/preflight.test.ts::[U883]` |
| U884 | A pass for the same host, project, mode, and provider is cached | FR-808 | example | DONE | `src/machines/preflight.test.ts::[U884]` |

`[A812]` is now one case per move of both lanes (33), with no skipped row.
`[U856]`, `[A805]`, and `[U844]` are split into one behavior per test.

## Cycle plan

Group 1: U801 to U823 and A801 to A808, A814 to A816, A812.
Group 2: U824 to U845, U855, U856, and A817 to A824.
Group 3: U846 to U854 and A809 to A811, A813.

## Property and mutation notes

No property tool is installed (profile).
`[A812]` is a table over every event type, which stands in for a property.
`/speckit.tdd.verify` runs deliberate mutants on the placement checks, the guard, the frame decoding, and the monitor.
