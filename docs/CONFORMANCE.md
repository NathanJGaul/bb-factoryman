# Conformance suite

The conformance suite shows which agent harnesses work with bb-factoryman, and shows it without a credential.
It runs one list of scenarios, S1 to S12, against two kinds of brain.
The scenarios look at the plugin's event log, the plugin's task rows, bb's thread state, the git state of the clone, and the process list of the lab.
They never look at model text.

The design comes from the harness-independence report, sections 6 and 7.
This file explains how to run the suite.
`docs/HARNESS-SUPPORT.md` shows the latest results.
It is generated, so do not edit it.

## Tiers

| Tier | Brain | Needs | Spend |
| --- | --- | --- | --- |
| 1 | The stub ACP agent in `tools/stub-agent` | `bwrap`, a pinned bb | none |
| 1.5 | The real harness command-line tool behind the fake model in `tools/fake-model` | `bwrap`, a pinned bb, the harness CLI | none |
| 2 | The real harness and a real model | a credential that the captain holds | real model spend |

This repository runs tiers 1 and 1.5.
Tier 2 needs a credential, and no worker receives one.

Passing tier 1 means the plugin is correct.
Passing tier 1.5 means the harness plumbing is correct: spawn, tool delivery, skill delivery, role confinement, report, wake, and failure.
It cannot show that a model behaves well.

## Prerequisites

1. Install `bwrap` (bubblewrap).
2. Install the dependencies with `pnpm install --frozen-lockfile`.
   The lab copies `node_modules` into the lab, because an offline lab cannot install it.
3. Install the harness command-line tools that you want to test.
   The runner binds each one read-only into the lab and installs no copy.
4. Pick a lab directory outside `/tmp` and outside any path that contains `firstmate`.
   The default is `/var/tmp/bblab-conformance`.
   `/tmp` is a small quota that every process of one user shares, and a lab can fill it.

The first run installs `bb-app@0.49.0` into `<lab>/pin` and installs bb's build toolchain into `<lab>/data/plugins`.
Both steps need the network.
Later runs reuse them.

## Run the suite

```sh
pnpm run conformance -- --tier 1
pnpm run conformance -- --tier 1.5 --harness pi
pnpm run conformance -- --tier 1.5 --harness codex
pnpm run conformance -- --tier 1.5 --harness claude-code
pnpm run conformance -- --tier 1.5 --harness omp
pnpm run conformance:docs
```

Useful options:

| Option | Meaning |
| --- | --- |
| `--lab-dir <path>` | The lab directory. |
| `--scenario S3,S4` | Run only these scenarios. A partial run writes no result file. |
| `--offline`, `--no-offline` | Run the lab with no network, or share the network. Tier 1.5 is offline by default. |
| `--server-port`, `--daemon-port`, `--model-port` | Fixed ports. The default is free ports. |

A run takes about 8 minutes at tier 1.
Each run starts from a clean lab directory and keeps only the pinned bb and its toolchain.
Never run two labs at once on one machine without different lab directories and ports.

## Read the output

Each scenario prints one line with a verdict.

| Verdict | Meaning |
| --- | --- |
| `pass` | Every check passed. |
| `known-gap` | Only checks that `conformance/known-gaps.json` lists failed. The output names the report task that closes the gap. |
| `fail` | A check that is not a known gap failed. |
| `skipped` | The scenario does not run at this tier. |

The exit code is 0 only when no scenario failed, no known gap started to pass, and the isolation check found no change.
A known gap that starts to pass fails the run until you remove its entry.
The list therefore cannot outlive the work that closes it.

Each full run writes `conformance/results/<tier>-<harness>.json`.
The file names the CLI version, the bb version, the plugin commit, and every check with its evidence.
Run `pnpm run conformance:docs` to regenerate `docs/HARNESS-SUPPORT.md` from these files.

## Scenarios

| Id | What it checks |
| --- | --- |
| S1 | A ready provider dispatches. A provider in another state is refused, with bb's reason, and creates no task. |
| S2 | The thread row shows the requested provider, model, level, and mode. A profile the provider cannot take is refused before anything spawns. |
| S3 | A scout goes `queued`, `working`, `report_ready`, keeps its evidence, and wakes the supervisor once. |
| S4 | A ship task leaves its commit on the task branch and reaches `review_ready`, in the delivery mode of the driver's lab project (`local-only`, or `direct-PR` for Pi). |
| S5 | A worker sees the report tool and its own skill only. A supervisor sees its five tools and its own skill only. |
| S6 | A turn that ends with no report leaves the task `working` and wakes the supervisor once. |
| S7 | A failing model turn fails the task, wakes the supervisor once, and keeps the cause in the evidence. |
| S8 | An empty report, a second report, and a teardown in the wrong state are each refused and logged, and a decision in the wrong state is refused. |
| S9 | A supervisor started with `bb factoryman supervisor start` has its five tools and its skill on its first turn. One stamped late gets them after the documented step, and the stamp command says to clear the thread when the harness needs it. |
| S10 | A plugin reload keeps every task and state and adds no event. Tier 1 only. |
| S11 | Teardown is refused for a dirty worktree, removes a clean one, and leaves no process behind. |
| S12 | A wake that reaches a busy supervisor arrives exactly once. |

A check can wait for a plugin change that is still open.
It is written to the behavior that the report asks for, and `conformance/known-gaps.json` lists the ones that fail today.
The list is empty now.
The checks that waited for report tasks H1 and H3 passed once the harness contracts landed.
The S9 checks passed once `bb factoryman supervisor start` and the stamp advice landed (report task H4).

## Add a harness

1. Write `tools/conformance/drivers/<id>.ts` that implements the `Driver` interface.
   It says how to bind the CLI, which files to write into the lab home so the CLI talks to the fake model, which profile to dispatch, and which tool route the harness shows its model.
   It also says which delivery mode the lab project uses, in the optional field `deliveryMode`.
   The default is `local-only`.
   Name `direct-PR` for a harness that the plugin refuses in `local-only` mode, as it does for Pi (`src/harness/contracts.ts`), and scenario S4 follows the mode.
   The reasoning level of the profile must be one that the lab model lists, because dispatch refuses any other.
2. Register the driver in `tools/conformance/drivers/index.ts`.
3. If the harness uses a new request format, add a module under `tools/fake-model/wire/`.
4. Run `pnpm run conformance -- --tier 1.5 --harness <id>` and `pnpm run conformance:docs`.

A harness is listed as supported only with a result file that names the CLI and bb versions it passed on.

## What the lab guarantees

`bblab` runs bb, the plugin, and the harness in one bubblewrap sandbox with an empty home, no systemd bus, no ssh agent, and a private process namespace.
Canary credential files sit at the real credential paths inside the sandbox, and a tripwire records any read.
The keys in a lab are the literal `mock-not-a-credential`.
`bblab-evidence` snapshots the real machine before and after a run, and the runner fails the run when a credential file, a real-home file name, or a process outside the lab changed.

With `--offline`, the sandbox has its own network namespace with a loopback only.
The host cannot reach the lab's ports, so every call goes through `bblab x`.
The fake model listens inside the sandbox on the loopback.
