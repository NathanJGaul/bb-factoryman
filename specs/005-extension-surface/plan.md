# Implementation plan: Extension surface

**Branch**: `fm/bb-factoryman-milestones-7-11` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

## Summary

Add `src/workflow/` (the `workflow.json` schema, loader, effective project config, and check runner), a metadata stamper, and a read RPC.
The state machine gains one event field (`checks`), one guard (`customChecksPassed`), and one reason code (`check_failed`).
Every config path is fail closed, and no config key can loosen a gate.

## Technical context

- bb facts: spike items 9 and 10 (probe plugins on a throwaway server) and the SDK's `bb.rpc.register` contract.
- No new package. `zod` validates the file and the RPC contract (Standard Schema).

## Constitution check

| Principle | How the plan complies |
| --- | --- |
| I. Gates fail closed | Invalid config blocks. A failing or unrunnable check refuses the event. Gate-like keys are rejected by name. |
| II. Machine core is pure | The machine takes `checks` as plain data and imports nothing new. |
| III. Event log is the source | The check results travel in the event payload, so replay re-checks them. |
| IV. Storage behind an interface | No storage change. The RPC reads through the `Store` interface. |
| V. Test first | Each group commits tests with stubs (red) before the implementation. |
| VI. Scope | Milestone 9 only. Skills are milestone 11. |

## Source layout

```text
src/workflow/config.ts     # zod schema for workflow.json, gate-key rejection
src/workflow/load.ts       # read and parse <checkout>/.bb/factoryman/workflow.json
src/workflow/effective.ts  # merge the file into the stored project config, tighten only
src/workflow/checks.ts     # run the custom checks and build the facts
src/wiring/stamp.ts        # thread metadata stamper (a runtime listener)
src/rpc/read.ts            # the read RPC contract and handlers
src/machine/{events,guards,table,refusal}.ts   # checks, customChecksPassed, check_failed
```

## Design

**Schema.**
`workflow.json` has `version` (1), an optional `project` object (`deliveryMode`, `branchPrefix`, `defaultMachine`), and an optional `checks` object keyed by delivery mode, each a list of `{ name, argv, timeoutSeconds? }`.
The schema is strict.
Before the schema runs, a key scan rejects the gate-like names (`yolo`, `gates`, `skip`, `skipGates`, `approval`, `approvals`, `requireApproval`, `disable`, `disabled`, `teardown`, `evidence`, `merge`) and `baseBranch`, at any depth, with a message that names hard rule 7.

**Effective project.**
`effectiveProject(stored, workflow)` returns the stored config with `branchPrefix` and `defaultMachine` filled when blank, and `deliveryMode` replaced only by an equal or stricter mode.
A looser mode returns a block.
`yolo` and `baseBranch` always come from the store.

**Checks.**
`runChecks(exec, checks, where)` runs every check with `exec(argv[0], argv.slice(1), { cwd, host, timeoutMs })`.
`passed` is `code === 0`.
It returns the facts for the event and the failure text for the worker.
The report tool calls it before it builds `handoff` or `ready`.
The guard `customChecksPassed` refuses when any fact has `passed: false`.

**Stamper.**
A runtime listener sets `{ taskId, kind, mode, state, machine }` on the worker thread after each applied event and logs a warning if bb fails.

**Read RPC.**
`registerReadRpc(bb, store)` calls `bb.rpc.register` once with four methods and `experimental_discoverable: true`.
Every answer has `apiVersion: 1`.
The handlers read through `Store` only.

## Decisions to record

- D-078: what the workflow file may set, and why `yolo` and `baseBranch` are not in it.
- D-079: checks run with the plugin process's privileges, in the worktree, with no shell.
- D-080: the check results travel in the `handoff` and `ready` events, and a caller that omits them skips the gate.
- D-081: the metadata fields, and that tool visibility still ignores them.
- D-082: the RPC surface, the version rule, and spike items 9 and 10.
