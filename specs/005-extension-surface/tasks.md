---
description: "Task list for the extension surface"
---

# Tasks: Extension surface

**Input**: `specs/005-extension-surface/spec.md`, `plan.md`, `tdd/test-list.md`
**Tests**: Mandatory. Each group commits its tests with stubs first (red), then the implementation.

## Phase 1: Spike

- [X] T901 Record spike items 9 and 10 and the workflow loading note in `spike/RESULTS.md`

## Phase 2: Group 1, the workflow config and the check gate

- [X] T910 Tests and stubs: `src/workflow/{config,load,effective,checks}.test.ts`, the `checks` event field, `customChecksPassed` guard, table, and reason code in `src/machine/*.test.ts`, the report and dispatch changes, and `test/acceptance/extension-workflow.test.ts` (A901 to A912)
- [X] T911 Implement `src/workflow/*`, the machine additions, and the report and dispatch changes

## Phase 3: Group 2, metadata and the read RPC

- [X] T920 Tests and stubs: `src/wiring/stamp.test.ts`, `src/rpc/read.test.ts`, and `test/acceptance/extension-surface.test.ts` (A913 to A917)
- [X] T921 Implement `stamp.ts`, `read.ts`, and the registrations in `server.ts`

## Phase 4: Close-out

- [X] T930 Record D-078 to D-083, update the Not checked table, and the profile helpers
- [X] T931 `/speckit.tdd.verify`, remediation, `/speckit.checklist`, `/speckit.analyze`, `/speckit.converge`

## Phase 5: Audit remediation (from `tdd/verification.md`)

- [X] R1 `[U902]` over a hand-written list, `[U936]`, and the message in `[A905]`
- [X] R2 `[U937]`: a project read that fails blocks a done report
- [X] R3 `[U938]`: a worktree lookup that fails blocks a done report
- [X] R4 `[A919]`: the `ready` path runs its checks
- [X] R5 `[U939]`: only `done` reports run checks
- [X] R6 `[A920]`, `[U940]`: the effective mode and the read limits
- [X] R7 the bookkeeping, the split tests, and the default check timeout (`[U943]`)
