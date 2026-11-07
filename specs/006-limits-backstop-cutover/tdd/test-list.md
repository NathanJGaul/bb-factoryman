---
feature: 006-limits-backstop-cutover
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 23
planned_at: 529574d
updated_at: 8e2ecb0 + remediation
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
| A1004 | `factoryman_status` shows a queued task with its description (no tool cancels a queued task) | AC-1.4 | example | DONE | `test/acceptance/limits-queue.test.ts::[A1004]` |
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
| A1025 | A queued task keeps its pinned machine, profile, branch prefix, base branch, and parent, and starts on that machine once a slot frees | AC-1.3, AC-1.7, FR-1003 | example | DONE | `test/acceptance/limits-queue.test.ts::[A1025]` |
| A1026 | A pinned task stays queued while its machine is offline, and starts there when the machine is back | AC-1.7, hard rule 5 | error | DONE | `test/acceptance/limits-queue.test.ts::[A1026]` |
| A1027 | A fractional global cap is floored | FR-1002 | example | DONE | `test/acceptance/limits-queue.test.ts::[A1027]` |
| A1028 | A dispatch over budget is refused even at a cap, and no queued task exists | AC-2.5, FR-1005 | error | DONE | `test/acceptance/limits-budget.test.ts::[A1028]` |
| A1029 | A queued dispatch result keeps the unknown-cost note | AC-2.4 | example | DONE | `test/acceptance/limits-budget.test.ts::[A1029]` |
| A1030 | The global cap of 0 queues nothing (second test of the old `A1005` label) | AC-1.5, FR-1002 | example | DONE | `test/acceptance/limits-queue.test.ts::[A1030]` |
| A1031 | Raising the global cap setting starts queued tasks (second test of the old `A1006` label) | AC-1.6, FR-1004 | example | DONE | `test/acceptance/limits-queue.test.ts::[A1031]` |

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
| U1028 | `getThreadCost` reads `usage.cost`, passes the currency through, and gives null for none or on error. | FR-1006 | example | DONE | `src/bb/adapter.test.ts::[U1028]` |
| U1029 | `listProjects` maps ID and name. | FR-1011 | example | DONE | `src/bb/adapter.test.ts::[U1029]` |
| U1030 | The commands `protection` and `import-registry` parse their arguments and print usage for a bad call. | FR-1010, FR-1011 | example | DONE | `src/tools/supervisor-command.test.ts::[U1030]` |
| U1031 | The status of a queued task shows its description. | AC-1.4 | example | DONE | `src/tools/status.test.ts::[U1031]` |
| U1045 | A `create` event accepts an optional request object and nothing else new | FR-1012 | example | DONE | `src/machine/events.test.ts::[U1045]` |
| U1044 | The webhook gives up after its timeout and logs the host | FR-1008 | example | DONE | `src/limits/webhook.test.ts::[U1044]` |
| U1046 | The wake goes to the supervisor before the webhook post | FR-1008 | example | DONE | `src/wiring/wake.test.ts::[U1046]` |
| U1047 | The webhook posts for the five attention states and no other state | FR-1008 | example | DONE | `src/wiring/wake.test.ts::[U1047]` |
| U1048 | The webhook log holds no part of the URL, such as its credentials, even when the error message repeats it | FR-1008, FR-1009 | example | DONE | `src/limits/webhook.test.ts::[U1048]` |
| U1049 | A 4xx or 5xx answer logs a warning | FR-1008 | example | DONE | `src/limits/webhook.test.ts::[U1049]` |
| U1050 | An unclosed bracket gives an entry with a flag and is not skipped | FR-1011 | error | DONE | `src/limits/registry.test.ts::[U1050]` |
| U1051 | A bare `yolo` token is an unknown mode and never the bypass flag | FR-1011 | error | DONE | `src/limits/registry.test.ts::[U1051]` |
| U1052 | An empty `forge=` is `none`, and a token after the mode is flagged | FR-1011 | example | DONE | `src/limits/registry.test.ts::[U1052]` |
| U1053 | A dash and a word with no separator is skipped | FR-1011 | example | DONE | `src/limits/registry.test.ts::[U1053]` |
| U1054 | Shell metacharacters are rejected in the repo owner, repo name, branch, and check | FR-1010 | error | DONE | `src/limits/protection.test.ts::[U1054]` |
| U1055 | A double dot is rejected in the repo and the branch | FR-1010 | error | DONE | `src/limits/protection.test.ts::[U1055]` |
| U1056 | The printed here-document runs in a shell: the end marker starts its line and `gh` receives the whole JSON | FR-1010 | example | DONE | `src/limits/protection.test.ts::[U1056]` |
| U1057 | A task stays queued, and nothing spawns, when the preflight of its remote machine fails at the drain | AC-1.7 | error | DONE | `src/limits/queue.test.ts::[U1057]` |
| U1058 | A drain asked for during a drain scans again | FR-1004 | example | DONE | `src/limits/queue.test.ts::[U1058]` |
| U1059 | A queued task with no stored request is left alone, with no warning | AC-1.7 | example | DONE | `src/limits/queue.test.ts::[U1059]` |
| U1060 | The launching entry clears after a start and after a failed spawn | FR-1001 | example | DONE | `src/limits/queue.test.ts::[U1060]` |
| U1061 | The day cap counts only the project's own tasks | FR-1005 | example | DONE | `src/limits/budget.test.ts::[U1061]` |
| U1062 | A running task from an earlier day counts for the per-task budget, and earlier days stay out of the day spend | FR-1005 | example | DONE | `src/limits/budget.test.ts::[U1062]` |
| U1063 | A failed cost read counts as zero spend and the result says the cost is unknown | FR-1006 | error | DONE | `src/limits/budget.test.ts::[U1063]` |
| U1064 | A queued task with no worker thread has no cost read | FR-1006 | example | DONE | `src/limits/budget.test.ts::[U1064]` |
| U1065 | A failing `listProjects` shows a note and still prints the table | FR-1011 | error | DONE | `src/tools/supervisor-command.test.ts::[U1065]` |
| U1066 | An unknown flag next to a good `--file` prints usage and reads nothing | FR-1011 | error | DONE | `src/tools/supervisor-command.test.ts::[U1066]` |

Notes:

- `[A1019]` to `[A1023]` run on the real command through `runCli`.
- The audit remediation added `A1025` to `A1031` and `U1046` to `U1066`. See `tdd/cycle-log.md`, entry R1.
- `A1030` and `A1031` were the second tests under the labels `A1005` and `A1006`. They have their own IDs now.

## Cycle plan

Group 1: caps, the queue, and budgets (`U1001` to `U1016`, `U1028`, `U1029`, `U1031`, `A1001` to `A1012`, `A1024`).
The `listProjects` mapping `U1029` landed with the port stubs in the group 1 red commit.
Group 2: the webhook (`U1017` to `U1019`, `U1044`, `A1013` to `A1016`).
Group 3: the protection checklist and the registry import (`U1020` to `U1027`, `U1030`, `A1017` to `A1023`).

## Property and mutation notes

No property tool is installed (profile).
`/speckit.tdd.verify` runs deliberate mutants on the cap and queue logic, the budget arithmetic, the webhook filter, and the registry parser.
