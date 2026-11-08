# Implementation plan: Limits, backstop, and cutover

**Branch**: `fm/bb-factoryman-milestones-7-11` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

## Summary

Add `src/limits/` (caps and the queue, the budget check, the webhook, the protection checklist, and the registry import), grow `workflow.json` with a `limits` section, and split `factoryman_dispatch` so that a queued task can start later through the same code.
The state machine gains one optional field (`create.request`).
No GitHub setting changes, and nothing writes to firstmate.

## Technical context

- bb facts: spike items 12 (cost data) and 13 (push notifications), plus the registry format in firstmate's `data/projects.md` and `bin/fm-project-mode.sh` header (read only).
- Outbound HTTP uses the runtime's `fetch`, injected for tests. No new package.

## Constitution check

| Principle | How the plan complies |
| --- | --- |
| I. Gates fail closed | Caps and budgets only add refusals. The webhook and the import cannot loosen a gate. A bad `limits` section blocks like any bad config. |
| II. Machine core is pure | Only the optional `create.request` field changes. |
| III. Event log is the source | The queued request lives in the `create` row's payload (`request`), so replay and recovery keep it. No new table. |
| IV. Storage behind an interface | No store change. |
| V. Test first | Each group commits its tests with stubs (red) before the implementation. |
| VI. Scope | Milestone 10 only. The apply path of the import and `factoryman_decide` stay out. |

## Source layout

```text
src/limits/queue.ts       # running count, caps, enqueue, drain
src/limits/request.ts     # the queued request: zod schema, encode, decode
src/limits/budget.ts      # day cap, daily and per-task spend, the cost fallback
src/limits/webhook.ts     # post attention states
src/limits/protection.ts  # the branch-protection checklist text
src/limits/registry.ts    # parse firstmate's registry lines
src/tools/launch.ts       # spawn the worker and record start (shared by dispatch and the queue)
docs/BRANCH-PROTECTION.md
docs/CUTOVER.md
```

## Design

**Limits.**
`workflow.json` gains `limits: { maxWorkers, perTaskBudget, perDayBudget, maxTasksPerDay, budgetCurrency }`, all optional.
The plugin setting `maxWorkers` is the global cap, and `0` or absent means no cap.
Both default to no cap, because a cap is a resource limit and not an authority gate.

**Dispatch order.**
Parse, load config, resolve the profile, place the machine, check providers, run the preflight, preview `start`, then check the budget, then the cap.
A budget refusal creates nothing.
At a cap, the tool creates the task with the request in the `create` evidence and returns a queued result.
Under the cap, it launches the worker as before.

**Queue.**
`drain(rt)` lists `queued` tasks that have a request, oldest first, and launches each while both caps allow.
It runs from a runtime listener when a task leaves the running states, from the start-up service, and from a settings change.
It re-checks the machine and the providers, and leaves the task queued when the machine is offline.
An unreadable request fails the task with evidence.

**Budget.**
`BbPort.getThreadCost` reads `threads.context().usage.cost`.
Spend is the sum over tasks created today (the UTC date of the injected clock).
A cost in another currency, or none, is unknown.
If any cost is unknown the budget is not enforced for those tasks, and the dispatch text says so.

**Webhook.**
`WebhookNotifier.post(task, event)` runs from the notifier on a transition into an attention state.

**Protection and import.**
Both are `bb factoryman` commands that print.
`protection` builds text from `owner/repo`, `--branch`, and `--check`.
`import-registry --file` reads the registry through `Files`, parses each line with the rules of `fm-project-mode.sh`, and matches names to bb projects.

## Decisions to record

- D-084: caps count which states, and default to no cap.
- D-085: the queued request lives in the `create` payload.
- D-086: budgets, the currency rule, and the cost fallback.
- D-087: the webhook payload, scheme rule, timeout, and no URL in logs; spike item 13.
- D-088: the registry import is a dry run only, its format, and its mode mapping.
- D-089: the branch-protection command prints and never runs.
