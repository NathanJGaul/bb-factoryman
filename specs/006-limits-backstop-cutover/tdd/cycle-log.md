# Cycle log: Limits, backstop, and cutover

Append only.
Newest last.
Every entry's `red` block is the evidence that the test existed and failed before the implementation.
Each group commits its tests with stubs first, so git history shows the order.

## Baseline

- suite: `pnpm test` -> 80 files, 975 passed, 0 failed
- commit: `529574d`

## Group 1: caps, the queue, and budgets

Red commit: the commit before this group's implementation (`test: add worker cap, queue, and budget tests with stubs, group 1 (red)`). It holds the tests, stubs for `request`, `queue`, and `budget` that return "not implemented" or nothing, the `getThreadCost` and `listProjects` port methods as stubs, `Runtime.launching`, `Settings.maxWorkers`, and the fixtures (`costs`, `projectList`, `skewClock`, `fetch`, and `webhook` on the fake host).

- red: `pnpm vitest run src/limits src/workflow/config.test.ts src/tools/status.test.ts src/bb/adapter.test.ts test/acceptance/limits-queue.test.ts test/acceptance/limits-budget.test.ts` -> 36 failed
  - `[U1028]`, `[U1029]`: `Error: not implemented`
  - `[U1005]` to `[U1010]`: the queue stub counted nothing and started nothing
  - `[U1003]`, `[U1011]` to `[U1016]`: the request stub could not decode, the budget stub never refused
  - `[U1001]`, `[U1002]`, `[U901]`: `limits` was an unknown key, and the empty config had no `limits`
  - `[U1031]`: the `create` event rejected `request`
  - `[A1001]` to `[A1004]`, `[A1006]`, `[A1007]`, `[A1008]` to `[A1012]`: no cap, no queue, no budget
- Passed against the stubs: `[U1004]` (a stub that rejects everything), `[A1005]` (no cap means no queue), `[A1024]` (a `limits` key was an unknown key, so the strict schema already blocked). Deliberate mutants after the implementation:
  - `[A1024]`: let the schema accept any `limits` -> the three cases failed
  - `[U1004]`: accept any request -> ten cases failed
- Mutants on the new behavior, all killed unless noted:
  - a review-ready task counts as running -> `[U1005]`; a launching worker is not counted -> its test
  - the project cap ignored -> `[U1006]` and four more; the global cap off by one -> five tests
  - the queue drains newest first -> `[U1007]`, `[A1003]`, and one more; the drain ignores the caps -> four tests
  - the unreadable request stays queued -> `[U1008]`, `[A1007]`; the drain is not exclusive -> `[U1010]`
  - the machine check skipped survived at first, because a `TypeError` in the next line was caught and left the task queued by accident. The mutant that falls back to the default host instead (the real fail-open) failed `[U1008]` and `[A1007]`. Reverted.
  - the listener drains on any event survived: draining is idempotent and capacity-bound, so the condition is an optimization. It is an equivalent mutant.
  - the day cap off by one -> `[U1011]`, `[A1008]`, `[A1011]`, `[A1012]`; the date taken from nowhere -> `[U1011]`
  - the day budget strictly above -> `[U1012]`, `[U1013]`; the per-task budget on ended tasks -> `[U1014]`, `[A1010]`; the currency ignored -> `[U1012]`; costs read with no budget -> `[U1011]` and one more
- green: `request.ts`, `budget.ts`, `queue.ts` (running count, caps, `enqueue`, an exclusive `drain`, the listener), `launch.ts` (the spawn and start code that moved out of `dispatch.ts`, now shared with the queue), the dispatch order (preview, budget, cap, then create and launch), the `limits` section, `create.request`, the adapter reads, the queued description in `factoryman_status`, the `maxWorkers` setting, and the drain at start-up and when the setting changes.
  `pnpm run check` -> 85 files, 1026 passed, 0 failed. Type check and lint clean.
- the existing dispatch tests passed unchanged through the refactor, which moved the spawn, start, and early-failure code into `launchWorker`.

## Group 2: the webhook

Red commit: `test: add webhook tests with a stub, group 2 (red)`. It holds the tests and a `WebhookNotifier` stub whose `post` does nothing.

- red: `pnpm vitest run src/limits/webhook.test.ts test/acceptance/limits-webhook.test.ts` -> 5 failed
  - `[U1017]`, `[U1019]`: `expected [] to have a length of 1 but got +0`
  - `[U1018]` (http and https): `expected undefined to be 'http://localhost:9999/hook'`
  - `[A1013]`: `expected [] to deeply equal [ 't1:blocked', ... ]`; `[A1015]`: no warning
- Passed against the stub: `[U1018]` (the posts-nothing cases), `[A1014]`, `[A1016]`. Mutants after the implementation:
  - post to any scheme -> `[U1018]` (file and javascript URLs) and `[A1016]` failed
  - an attention filter that posts on every state -> `[A1013]`, `[A1014]`, `[A1015]` failed
- Mutants on the new behavior:
  - log the URL instead of the host -> `[U1019]`, `[A1015]`; rethrow a failure -> the same tests; a bad status silent -> `[U1019]`; evidence not clipped -> `[U1017]`
  - the webhook not wired in `server.ts` -> `[A1013]`, `[A1015]`
  - no timeout survived at first, because the test only checked that a signal exists. `timeoutMs` is injectable now, `[U1044]` uses a fetch that waits for the abort and a 20 ms timeout, and the mutant then failed it (it hung to the test timeout). Reverted.
  - a blank URL posts anyway: equivalent. `new URL("")` throws and the call returns, so the early return is a shortcut.
- green: `webhook.ts` and the `Notifier` call on a transition into an attention state.
  `pnpm run check` -> 87 files, 1041 passed, 0 failed. Type check and lint clean.

## Group 3: the backstop and the cutover

Red commit: `test: add protection checklist and registry import tests with stubs, group 3 (red)`. It holds the tests, a `parseRegistry` stub that returns no entries, a `protectionSteps` stub that fails, the registry fixture, and a missing `docs/BRANCH-PROTECTION.md`.

- red: `pnpm vitest run src/limits/registry.test.ts src/limits/protection.test.ts src/tools/supervisor-command.test.ts test/acceptance/limits-cutover.test.ts` -> 19 failed
  - `[U1022]` to `[U1027]`, the gerrit test: `expected undefined to match object ...` (no entries)
  - `[U1020]`, `[U1021]`: `Error: not implemented`
  - `[U1030]`, `[A1017]`, `[A1019]`, `[A1020]`, `[A1021]`, `[A1023]`: the commands printed the usage and exited 2
  - `[A1018]`: `ENOENT: no such file or directory, open '.../docs/BRANCH-PROTECTION.md'`
- Passed against the stubs: `[A1022]` (the missing command changed nothing). The first mutant that wrote a project config for every entry survived, because the last entry's `yolo` equaled the default. `[A1022]` now compares the raw rows of `project_config`, `task`, `task_event`, and `approval` before and after, and the mutant then failed it. Reverted.
- Mutants on the new behavior, all killed:
  - `yolo` ignored -> `[U1022]`, `[A1019]`; an empty `branch=` becomes `fm/` -> `[U1025]`, `[A1019]`; an unknown mode guessed -> `[U1026]`, `[A1021]`
  - `no-mistakes-prod-only` mapped to `local-only` -> `[U1024]`, `[A1020]`; the name ends at the dash only -> six tests; an extra token not flagged -> `[U1026]`, `[A1021]`; the gerrit note dropped -> its test
  - the repo, branch, or check not validated -> `[U1021]`; `enforce_admins` false -> `[U1020]`
  - `--apply` accepted -> `[U1030]`, `[A1023]`; projects matched case-sensitively -> `[A1019]`; the dry-run line dropped -> `[U1030]`, `[A1019]`
  - the command writes a project config -> `[A1022]` (after the strengthening above)
- `[U1045]` (FR-1012) passed at once. Mutant: remove `request` from the `create` schema -> `[U1045]` and six queue tests failed. Reverted.
- green: `registry.ts`, `protection.ts`, the `protection` and `import-registry` commands in `supervisor-command.ts`, and the two docs. Two tests expected a lowercase "could not read", and the message is capitalized, so the tests match with `/i` (the wording did not change).
  `pnpm run check` -> 90 files, 1062 passed, 0 failed. Type check and lint clean.
