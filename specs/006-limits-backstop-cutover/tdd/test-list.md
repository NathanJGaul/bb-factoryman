---
feature: 006-limits-backstop-cutover
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 24
planned_at: 529574d
updated_at: 529574d
suite_baseline: green
---

# Test list: Limits, backstop, and cutover

The acceptance layer is an in-process integration test through the bb fake plugin host and the public factory.
The webhook goes to an injected `fetch`, and cost comes from the fake `threads.context`.
No real forge, webhook receiver, or cost-reporting provider is involved, so the live check in milestone 11 is the first time those meet real bb.
The suite baseline was 80 files and 975 tests, all passing.

## Outer loop: acceptance behaviors

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| A1001 | A project cap queues the next task: the task is `queued`, no worker spawns, and the result says so | AC-1.1, FR-1002, FR-1003, SC-1001 | example | DONE | `test/acceptance/limits-queue.test.ts::[A1001]` |
| A1002 | The global cap in the settings queues across projects | AC-1.2, FR-1002 | example | DONE | `test/acceptance/limits-queue.test.ts::[A1002]` |
| A1003 | When a worker leaves the running states, the oldest queued task starts, in order | AC-1.3, FR-1004, SC-1001 | example | DONE | `test/acceptance/limits-queue.test.ts::[A1003]` |
| A1004 | `factoryman_status` shows a queued task with its description, and the supervisor can fail it | AC-1.4 | example | DONE | `test/acceptance/limits-queue.test.ts::[A1004]` |
| A1005 | With no cap, or a cap of 0, nothing queues | AC-1.5, FR-1002 | example | DONE | `test/acceptance/limits-queue.test.ts::[A1005]` |
| A1006 | A restart with queued tasks and free slots starts them | AC-1.6, FR-1004 | example | DONE | `test/acceptance/limits-queue.test.ts::[A1006]` |
| A1007 | An unreadable queued request fails the task with evidence, and a task whose machine is offline stays queued | AC-1.7 | error | DONE | `test/acceptance/limits-queue.test.ts::[A1007]` |
| A1008 | `maxTasksPerDay` refuses the next dispatch with the reason, and a new UTC day resets it | AC-2.1, FR-1005 | example | DONE | `test/acceptance/limits-budget.test.ts::[A1008]` |
| A1009 | `perDayBudget` refuses a dispatch when the recorded spend reaches it | AC-2.2, FR-1005, FR-1006, SC-1002 | example | DONE | `test/acceptance/limits-budget.test.ts::[A1009]` |
| A1010 | `perTaskBudget` refuses a dispatch while a running task is over it, and allows it after that task stops | AC-2.3, FR-1005 | example | DONE | `test/acceptance/limits-budget.test.ts::[A1010]` |
| A1011 | With no cost data, a budget is not enforced, `maxTasksPerDay` still is, and the result says so | AC-2.4, FR-1006 | example | DONE | `test/acceptance/limits-budget.test.ts::[A1011]` |
| A1012 | A budget refusal creates no task and leaves the log unchanged | AC-2.5, FR-1005 | example | DONE | `test/acceptance/limits-budget.test.ts::[A1012]` |
| A1013 | A transition into each attention state posts one JSON body to the webhook | AC-3.1, FR-1008, SC-1003 | example | DONE | `test/acceptance/limits-webhook.test.ts::[A1013]` |
| A1014 | Other states post nothing | AC-3.2, FR-1008 | example | DONE | `test/acceptance/limits-webhook.test.ts::[A1014]` |
| A1015 | A failing post leaves the transition in place and logs the host and not the URL | AC-3.3, FR-1008, FR-1009 | error | DONE | `test/acceptance/limits-webhook.test.ts::[A1015]` |
| A1016 | No URL, or a URL that is not http or https, posts nothing | AC-3.4, FR-1008 | example | DONE | `test/acceptance/limits-webhook.test.ts::[A1016]` |
| A1017 | `bb factoryman protection` prints the checklist and the `gh api` commands, runs nothing, and says it changed nothing | AC-4.1, FR-1010 | example | DONE | `test/acceptance/limits-cutover.test.ts::[A1017]` |
| A1018 | `docs/BRANCH-PROTECTION.md` names the required check, scoped tokens, the verification, and the approval form gap | AC-4.2 | example | DONE | `test/acceptance/limits-cutover.test.ts::[A1018]` |
| A1019 | The import dry run reports every project of a fixture registry with mode, yolo, prefix, and forge, and matches bb projects by name | AC-5.1, FR-1011, SC-1004 | example | DONE | `test/acceptance/limits-cutover.test.ts::[A1019]` |
| A1020 | Legacy and prod-only lines map to `no-mistakes`, the second with a note | AC-5.2, FR-1011 | example | DONE | `test/acceptance/limits-cutover.test.ts::[A1020]` |
| A1021 | An unknown mode or token is flagged and not guessed | AC-5.3, FR-1011 | example | DONE | `test/acceptance/limits-cutover.test.ts::[A1021]` |
| A1022 | The import changes no project config and the registry file is only read | AC-5.4, FR-1011 | example | DONE | `test/acceptance/limits-cutover.test.ts::[A1022]` |
| A1023 | `--apply` is refused | AC-5.5, FR-1011 | example | DONE | `test/acceptance/limits-cutover.test.ts::[A1023]` |
| A1024 | A bad `limits` section blocks dispatch like any bad workflow file | FR-1007 | error | DONE | `test/acceptance/limits-queue.test.ts::[A1024]` |

## Inner loop: unit behaviors

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1001 | `limits` accepts the five optional fields and rejects non-positive numbers, non-integers for counts, and unknown keys. | FR-1007 | example | DONE | `src/workflow/config.test.ts::[U1001]` |
| U1002 | The effective limits come from the file, and an absent section gives no limits. | FR-1007 | example | DONE | `src/workflow/config.test.ts::[U1002]` |
| U1003 | A request encodes to JSON text and decodes back to an equal value. | FR-1003 | example | DONE | `src/limits/request.test.ts::[U1003]` |
| U1004 | Decoding rejects text that is not JSON, has the wrong version, or lacks a field. | FR-1003 | example | DONE | `src/limits/request.test.ts::[U1004]` |
| U1005 | The running count includes `working`, `blocked`, `validating`, and `needs_decision` and nothing else. | FR-1001 | example | DONE | `src/limits/queue.test.ts::[U1005]` |
| U1006 | A project cap and the global cap each decide, and `0` or absent means none. | FR-1002 | example | DONE | `src/limits/queue.test.ts::[U1006]` |
| U1007 | `drain` starts queued tasks oldest first until a cap is reached. | FR-1004 | example | DONE | `src/limits/queue.test.ts::[U1007]` |
| U1008 | `drain` leaves a task queued when its machine is offline, and fails a task whose request is unreadable. | AC-1.7 | example | DONE | `src/limits/queue.test.ts::[U1008]` |
| U1009 | The runtime listener drains when a task leaves the running states and not otherwise. | FR-1004 | example | DONE | `src/limits/queue.test.ts::[U1009]` |
| U1010 | `drain` is safe to call twice at once (it starts a task once). | FR-1004 | example | DONE | `src/limits/queue.test.ts::[U1010]` |
| U1011 | The day count uses the UTC date of the injected clock. | FR-1005 | example | DONE | `src/limits/budget.test.ts::[U1011]` |
| U1012 | Spend sums known costs in the budget currency and counts the rest as unknown. | FR-1006 | example | DONE | `src/limits/budget.test.ts::[U1012]` |
| U1013 | A per-day budget refuses at or above the budget and not below it. | FR-1005 | example | DONE | `src/limits/budget.test.ts::[U1013]` |
| U1014 | A per-task budget refuses while a running task is over it. | FR-1005 | example | DONE | `src/limits/budget.test.ts::[U1014]` |
| U1015 | A cost read that fails counts as unknown. | FR-1006 | example | DONE | `src/limits/budget.test.ts::[U1015]` |
| U1016 | The note for unknown cost names the budgets that could not be checked. | AC-2.4 | example | DONE | `src/limits/budget.test.ts::[U1016]` |
| U1017 | The body holds event name, task facts, and clipped evidence. | FR-1008 | example | DONE | `src/limits/webhook.test.ts::[U1017]` |
| U1018 | Only http and https URLs post, with a timeout, and a blank URL posts nothing. | FR-1008 | example | DONE | `src/limits/webhook.test.ts::[U1018]` |
| U1019 | A failure or a non-2xx answer logs a warning with the host only. | FR-1008 | example | DONE | `src/limits/webhook.test.ts::[U1019]` |
| U1020 | The text names the repo, the branch, the check, and the `gh api` commands. | FR-1010 | example | DONE | `src/limits/protection.test.ts::[U1020]` |
| U1021 | The text says it ran nothing, and it rejects a repo that is not `owner/name`. | FR-1010 | example | DONE | `src/limits/protection.test.ts::[U1021]` |
| U1022 | A line parses into name, mode, yolo, prefix, forge, and description, in any bracket order. | FR-1011 | example | DONE | `src/limits/registry.test.ts::[U1022]` |
| U1023 | A line with no bracket is `no-mistakes` with yolo off and prefix `fm/`. | FR-1011 | example | DONE | `src/limits/registry.test.ts::[U1023]` |
| U1024 | `no-mistakes-prod-only` maps to `no-mistakes` with a note. | FR-1011 | example | DONE | `src/limits/registry.test.ts::[U1024]` |
| U1025 | An empty `branch=` gives an empty prefix. | FR-1011 | example | DONE | `src/limits/registry.test.ts::[U1025]` |
| U1026 | A line with an unknown token or mode is flagged, and a non-registry line is skipped with a count. | FR-1011 | example | DONE | `src/limits/registry.test.ts::[U1026]` |
| U1027 | Names may contain spaces and end at the first ` [` or ` - `. | FR-1011 | example | DONE | `src/limits/registry.test.ts::[U1027]` |
| U1028 | `getThreadCost` reads `usage.cost` and gives null for none or on error. | FR-1006 | example | DONE | `src/bb/adapter.test.ts::[U1028]` |
| U1029 | `listProjects` maps ID and name. | FR-1011 | example | DONE | `src/bb/adapter.test.ts::[U1029]` |
| U1030 | The commands `protection` and `import-registry` parse their arguments and print usage for a bad call. | FR-1010, FR-1011 | example | DONE | `src/tools/supervisor-command.test.ts::[U1030]` |
| U1031 | The status of a queued task shows its description. | AC-1.4 | example | DONE | `src/tools/status.test.ts::[U1031]` |
| U1045 | A `create` event accepts an optional request object and nothing else new | FR-1012 | example | DONE | `src/machine/events.test.ts::[U1045]` |
| U1044 | The webhook gives up after its timeout and logs the host | FR-1008 | example | DONE | `src/limits/webhook.test.ts::[U1044]` |

Tests added while closing the group, with IDs in the same range:

- `[A1005]` has two tests, `[A1006]` two, and `[A1019]` to `[A1023]` run on the real command through `runCli`.

## Cycle plan

Group 1: caps, the queue, and budgets (`U1001` to `U1016`, `U1028`, `U1031`, `A1001` to `A1012`, `A1024`).
Group 2: the webhook (`U1017` to `U1019`, `U1044`, `A1013` to `A1016`).
Group 3: the protection checklist and the registry import (`U1020` to `U1027`, `U1029`, `U1030`, `A1017` to `A1023`).

## Property and mutation notes

No property tool is installed (profile).
`/speckit.tdd.verify` runs deliberate mutants on the cap and queue logic, the budget arithmetic, the webhook filter, and the registry parser.
