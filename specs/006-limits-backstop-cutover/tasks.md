---
description: "Task list for limits, backstop, and cutover"
---

# Tasks: Limits, backstop, and cutover

**Input**: `specs/006-limits-backstop-cutover/spec.md`, `plan.md`, `tdd/test-list.md`
**Tests**: Mandatory. Each group commits its tests with stubs first (red), then the implementation.

## Phase 1: Spike

- [X] T1001 Record spike items 12, 13, 18, and 19 in `spike/RESULTS.md`

## Phase 2: Group 1, caps, the queue, and budgets

- [X] T1010 Tests and stubs: `src/limits/{request,queue,budget}.test.ts`, the `limits` section tests, the port and status tests, and `test/acceptance/limits-{queue,budget}.test.ts`
- [X] T1011 Implement `request.ts`, `queue.ts`, `budget.ts`, `tools/launch.ts`, the dispatch order, the `limits` section, `create.request`, and the settings

## Phase 3: Group 2, the webhook

- [X] T1020 Tests and a stub: `src/limits/webhook.test.ts` and `test/acceptance/limits-webhook.test.ts`
- [X] T1021 Implement `webhook.ts` and the notifier call

## Phase 4: Group 3, the backstop and the cutover

- [X] T1030 Tests and stubs: `registry`, `protection`, the two commands, and `test/acceptance/limits-cutover.test.ts`
- [X] T1031 Implement the parser, the checklist text, the commands, `docs/BRANCH-PROTECTION.md`, and `docs/CUTOVER.md`

## Phase 5: Close-out

- [X] T1040 Record D-084 to D-089 in `docs/DECISIONS.md` and the profile helpers
- [ ] T1041 `/speckit.tdd.verify`, remediation, `/speckit.checklist`, `/speckit.analyze`, `/speckit.converge`
