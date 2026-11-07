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
| A1001 | A project cap queues the next task: the task is `queued`, no worker spawns, and the result says so | AC-1.1, FR-1002, FR-1003, SC-1001 | example | TODO | `test/acceptance/limits-queue.test.ts::[A1001]` |
| A1002 | The global cap in the settings queues across projects | AC-1.2, FR-1002 | example | TODO | `test/acceptance/limits-queue.test.ts::[A1002]` |
| A1003 | When a worker leaves the running states, the oldest queued task starts, in order | AC-1.3, FR-1004, SC-1001 | example | TODO | `test/acceptance/limits-queue.test.ts::[A1003]` |
| A1004 | `factoryman_status` shows a queued task with its description, and the supervisor can fail it | AC-1.4 | example | TODO | `test/acceptance/limits-queue.test.ts::[A1004]` |
| A1005 | With no cap, or a cap of 0, nothing queues | AC-1.5, FR-1002 | example | TODO | `test/acceptance/limits-queue.test.ts::[A1005]` |
| A1006 | A restart with queued tasks and free slots starts them | AC-1.6, FR-1004 | example | TODO | `test/acceptance/limits-queue.test.ts::[A1006]` |
| A1007 | An unreadable queued request fails the task with evidence, and a task whose machine is offline stays queued | AC-1.7 | error | TODO | `test/acceptance/limits-queue.test.ts::[A1007]` |
| A1008 | `maxTasksPerDay` refuses the next dispatch with the reason, and a new UTC day resets it | AC-2.1, FR-1005 | example | TODO | `test/acceptance/limits-budget.test.ts::[A1008]` |
| A1009 | `perDayBudget` refuses a dispatch when the recorded spend reaches it | AC-2.2, FR-1005, FR-1006, SC-1002 | example | TODO | `test/acceptance/limits-budget.test.ts::[A1009]` |
| A1010 | `perTaskBudget` refuses a dispatch while a running task is over it, and allows it after that task stops | AC-2.3, FR-1005 | example | TODO | `test/acceptance/limits-budget.test.ts::[A1010]` |
| A1011 | With no cost data, a budget is not enforced, `maxTasksPerDay` still is, and the result says so | AC-2.4, FR-1006 | example | TODO | `test/acceptance/limits-budget.test.ts::[A1011]` |
| A1012 | A budget refusal creates no task and leaves the log unchanged | AC-2.5, FR-1005 | example | TODO | `test/acceptance/limits-budget.test.ts::[A1012]` |
| A1013 | A transition into each attention state posts one JSON body to the webhook | AC-3.1, FR-1008, SC-1003 | example | TODO | `test/acceptance/limits-webhook.test.ts::[A1013]` |
| A1014 | Other states post nothing | AC-3.2, FR-1008 | example | TODO | `test/acceptance/limits-webhook.test.ts::[A1014]` |
| A1015 | A failing post leaves the transition in place and logs the host and not the URL | AC-3.3, FR-1008, FR-1009 | error | TODO | `test/acceptance/limits-webhook.test.ts::[A1015]` |
| A1016 | No URL, or a URL that is not http or https, posts nothing | AC-3.4, FR-1008 | example | TODO | `test/acceptance/limits-webhook.test.ts::[A1016]` |
| A1017 | `bb factoryman protection` prints the checklist and the `gh api` commands, runs nothing, and says it changed nothing | AC-4.1, FR-1010 | example | TODO | `test/acceptance/limits-cutover.test.ts::[A1017]` |
| A1018 | `docs/BRANCH-PROTECTION.md` names the required check, scoped tokens, the verification, and the approval form gap | AC-4.2 | example | TODO | `test/acceptance/limits-cutover.test.ts::[A1018]` |
| A1019 | The import dry run reports every project of a fixture registry with mode, yolo, prefix, and forge, and matches bb projects by name | AC-5.1, FR-1011, SC-1004 | example | TODO | `test/acceptance/limits-cutover.test.ts::[A1019]` |
| A1020 | Legacy and prod-only lines map to `no-mistakes`, the second with a note | AC-5.2, FR-1011 | example | TODO | `test/acceptance/limits-cutover.test.ts::[A1020]` |
| A1021 | An unknown mode or token is flagged and not guessed | AC-5.3, FR-1011 | example | TODO | `test/acceptance/limits-cutover.test.ts::[A1021]` |
| A1022 | The import changes no project config and the registry file is only read | AC-5.4, FR-1011 | example | TODO | `test/acceptance/limits-cutover.test.ts::[A1022]` |
| A1023 | `--apply` is refused | AC-5.5, FR-1011 | example | TODO | `test/acceptance/limits-cutover.test.ts::[A1023]` |
| A1024 | A bad `limits` section blocks dispatch like any bad workflow file | FR-1007 | error | TODO | `test/acceptance/limits-queue.test.ts::[A1024]` |

## Inner loop: unit behaviors

(Listed per component in the file; the IDs run U1001 upward.)

### `src/workflow/config.ts` (limits)

- U1001 `limits` accepts the five optional fields and rejects non-positive numbers, non-integers for counts, and unknown keys.
- U1002 The effective limits come from the file, and an absent section gives no limits.

### `src/limits/request.ts`

- U1003 A request encodes to JSON text and decodes back to an equal value.
- U1004 Decoding rejects text that is not JSON, has the wrong version, or lacks a field.

### `src/limits/queue.ts`

- U1005 The running count includes `working`, `blocked`, `validating`, and `needs_decision` and nothing else.
- U1006 A project cap and the global cap each decide, and `0` or absent means none.
- U1007 `drain` starts queued tasks oldest first until a cap is reached.
- U1008 `drain` leaves a task queued when its machine is offline, and fails a task whose request is unreadable.
- U1009 The runtime listener drains when a task leaves the running states and not otherwise.
- U1010 `drain` is safe to call twice at once (it starts a task once).

### `src/limits/budget.ts`

- U1011 The day count uses the UTC date of the injected clock.
- U1012 Spend sums known costs in the budget currency and counts the rest as unknown.
- U1013 A per-day budget refuses at or above the budget and not below it.
- U1014 A per-task budget refuses while a running task is over it.
- U1015 A cost read that fails counts as unknown.
- U1016 The note for unknown cost names the budgets that could not be checked.

### `src/limits/webhook.ts`

- U1017 The body holds event name, task facts, and clipped evidence.
- U1018 Only http and https URLs post, with a timeout, and a blank URL posts nothing.
- U1019 A failure or a non-2xx answer logs a warning with the host only.

### `src/limits/protection.ts`

- U1020 The text names the repo, the branch, the check, and the `gh api` commands.
- U1021 The text says it ran nothing, and it rejects a repo that is not `owner/name`.

### `src/limits/registry.ts`

- U1022 A line parses into name, mode, yolo, prefix, forge, and description, in any bracket order.
- U1023 A line with no bracket is `no-mistakes` with yolo off and prefix `fm/`.
- U1024 `no-mistakes-prod-only` maps to `no-mistakes` with a note.
- U1025 An empty `branch=` gives an empty prefix.
- U1026 A line with an unknown token or mode is flagged, and a non-registry line is skipped with a count.
- U1027 Names may contain spaces and end at the first ` [` or ` - `.

### `src/bb/adapter.ts`, `src/tools/`

- U1028 `getThreadCost` reads `usage.cost` and gives null for none or on error.
- U1029 `listProjects` maps ID and name.
- U1030 The commands `protection` and `import-registry` parse their arguments and print usage for a bad call.
- U1031 The status of a queued task shows its description.
