# Cycle Log: Tools and approval, event wiring, and the validator

Append only.
Newest last.
Every entry's `red` block is the evidence that the test existed and failed before the implementation.

Batching rule: behaviors on one function or file share a cycle, as the cycle plan in `test-list.md` lists.
Each behavior in a batch still has its own test, and each entry records the failing output for each behavior id.

## Baseline

- suite: `pnpm test` -> 20 files, 354 passed, 0 failed
- commit: `2f108b0`
- recorded: cycle 0, before any feature change

## Cycle L0: U208 layout rule follows the scope amendment (test change, taken first)

- reason: the milestone 1 test `has the milestone 1 to 3 directories and none for later milestones` asserted that `src/tools` must not exist.
  The captain's intent for this task and constitution 1.1.0 (D-032) put milestones 4 to 6 in scope, so that assertion encoded an outdated rule.
  The test is not weakened to hide a failure: it still forbids `src/dispatch` and `skills` (milestones 7 to 11) and still requires the milestone 1 to 3 directories.
- test: `test/acceptance/layout.test.ts::[U208] has the milestone 1 to 3 directories and none for milestones 7 to 11` (changed, U208)
- red: with an empty `src/tools` directory on disk from the planned layout, `pnpm test`
  -> `AssertionError: src/tools should not exist yet: expected true to be false` (1 failed, 358 passed).
  That is the old rule failing.
- new rule, first run: `pnpm vitest run test/acceptance/layout.test.ts` passed at once.
  Deliberate mutant: `mkdir src/dispatch`
  -> `AssertionError: src/dispatch should not exist yet: expected true to be false` (1 failed).
  Removed the directory, then 1 passed.
- green: suite `pnpm test` -> 21 files, 359 passed, 0 failed.
- refactor: none needed
- commit: see git log, message `test: allow the milestone 4 to 6 directories (D-032)`

## Cycle C1: U1 to U5 exec runner (`src/exec.ts`)

- tests: `src/exec.test.ts` `[U1]` to `[U5]` (new)
- red: a stub `runCommand` that returns `{ code: -1, stdout: "", stderr: "" }`, then `pnpm vitest run src/exec.test.ts`
  -> `U1 AssertionError: expected { code: -1, stdout: '', stderr: '' } to deeply equal { code: +0, stdout: 'out\n', …(1) }`
  -> `U2 AssertionError: expected -1 to be 3`
  -> `U3 AssertionError: expected '' to be '/tmp/exec-6WdHlH'`
  -> `U4 AssertionError: expected -1 to be null`
  -> `U5 AssertionError: expected '' to be 'a; echo $(whoami) \`id\` | cat'` (5 failed)
- green: `src/exec.ts` runs `spawn` with `shell: false`, collects both streams, and resolves on `close` or `error`.
  Suite `pnpm test` -> 21 files, 359 passed, 0 failed (after the layout fix). Lint and type-check clean.
- refactor: none needed
- commit: see git log, message `feat: add the command runner (U1-U5)`

## Cycle C2: U6 to U9 runtime apply path (`src/runtime.ts`)

- tests: `src/runtime.test.ts` `[U6]` to `[U9]` (new), plus the fixtures `test/fixtures/bb-port.ts` and `test/fixtures/runtime.ts` and the types-only `src/bb/port.ts` (T001 to T004, T016: no behavior)
- red: a `Runtime` stub whose `apply` throws, then `pnpm vitest run src/runtime.test.ts`
  -> `Error: not implemented` for U6, U7, U8, and U9 (4 failed)
- green: `Runtime.apply` calls `TaskLog.apply`, then awaits each listener in order inside its own `try`, and logs a listener error.
  Suite `pnpm test` -> 22 files, 363 passed, 0 failed. Lint and type-check clean.
- refactor: none needed
- note: the red is a stub that throws, not an assertion on values, because the behavior is a method that does not exist yet.

## Cycle C3: U10 to U18 bb adapter (`src/bb/adapter.ts`)

- tests: `src/bb/adapter.test.ts` `[U10]` to `[U18]` (new), through `createFakePluginHost` with `sdk` stubs and the fake host's form controls
- red: an adapter stub whose methods throw, then `pnpm vitest run src/bb/adapter.test.ts`
  -> `Error: not implemented` for the SDK-call behaviors, `AssertionError: expected undefined to match object { threadId: 'thr-sup', …(4) }` for the form request,
  and `TypeError: Cannot read properties of undefined (reading 'id')` for the cancelled form (11 failed)
- green: `createBbPort` maps each port method to its SDK call.
  First green run: 10 passed, 1 failed. U10 expected 10 keys and the fake host's plugin-bound normalization sent 12 (`origin: "plugin"` and `originPluginId`).
  The test was corrected to the real normalization, which `spike/RESULTS.md` item 22 mentions for `threads.spawn`. No assertion was loosened.
  Suite `pnpm test` -> 23 files, 374 passed, 0 failed. Lint and type-check clean.
- refactor: none needed
- note: `getThread` reads either a thread or `{ thread }` and maps a `status: 404` error or an `HTTP 404` message to null.
  The real bb 404 shape is not recorded, so U12 covers both forms. The live smoke test in the close-out checks the real one.

## Cycle C4: U19 to U22 caller identity (`src/tools/access.ts`)

- tests: `src/tools/access.test.ts` `[U19]` to `[U22]` (new)
- red: a stub `identify` that always returns `{ role: "other" }` and a `sameProject` that always returns true, then `pnpm vitest run src/tools/access.test.ts`
  -> `U19 AssertionError: expected 'other' to be 'worker'`
  -> `U21 AssertionError: expected 'other' to be 'worker'`
  -> `U22 AssertionError: expected true to be false` (3 failed, 1 passed)
- U20 passed on the first run because the stub already returns `other`.
  Deliberate mutant: `identify` returns a worker for every thread
  -> `U20 AssertionError: expected { role: 'worker', task: undefined } to deeply equal { role: 'other' }` (1 failed).
  Restored the code exactly, then 4 passed.
- green: `identify` finds the task whose `workerThreadId` equals the thread ID, and `sameProject` compares project IDs.
  Suite `pnpm test` -> 24 files, 378 passed, 0 failed. Lint and type-check clean.
- refactor: none needed

## Cycle C5: U23 to U25 preview (`src/tools/preview.ts`)

- tests: `src/tools/preview.test.ts` `[U23]` to `[U25]` (new)
- red: a stub `wouldAccept` that returns `{ ok: true, to: "queued" }`, then `pnpm vitest run src/tools/preview.test.ts`
  -> `U23 AssertionError: expected { ok: true, to: 'queued' } to deeply equal { ok: true, to: 'merged' }`
  -> `U24 AssertionError: expected true to be false`
  -> `U25 AssertionError: expected true to be false` (3 failed)
- green: `wouldAccept` replays the task and runs the pure `transition`, mapping a missing task to `unknown_task`.
  Suite `pnpm test` -> 25 files, 381 passed, 0 failed. Lint and type-check clean.
- refactor: none needed

## Cycle C6: U26 to U32 tool results and worker prompt (`src/tools/results.ts`, `src/tools/prompt.ts`)

- tests: `src/tools/results.test.ts` `[U26]` to `[U28]` and `src/tools/prompt.test.ts` `[U29]` to `[U32]` (new)
- red: stub helpers that return empty or wrong values, then `pnpm vitest run src/tools/results.test.ts src/tools/prompt.test.ts`
  -> `U29 AssertionError: expected '' to contain 'k1'`
  -> `U30 AssertionError: expected '' to match /never push/i`
  -> `U31 AssertionError: expected '' to match /pull request URL/`
  -> `U32 AssertionError: expected '' to match /do not contact the owner/i`
  -> `U26 AssertionError: expected { ok: true, text: '' } to deeply equal { ok: false, …(1) }`
  -> `U27 AssertionError: expected '' to be 'Task k1 is now validating.'`
  -> `U28 AssertionError: expected 'aaaaaaaaaaa' to be 'aaaaaaaaa…'` (7 failed)
- green: `results.ts` builds the outcomes and `clip`, and `prompt.ts` assembles the prompt from a per-mode handoff paragraph.
  Suite `pnpm test` -> 27 files, 388 passed, 0 failed. Lint and type-check clean.
- refactor: none needed
- note: two small behaviors in one cycle because both files are text builders with no collaborators.
  The clip boundary is tested at limit minus one, at the limit, and at limit plus one.

## Cycle C7: U69 to U77 worktree report (`src/git/report.ts`)

- tests: `src/git/report.test.ts` `[U69]` to `[U77]` (new), against temporary git repositories built by `test/fixtures/git-repo.ts` (T002)
- red: a stub `worktreeReport` that returns a clean report, then `pnpm vitest run src/git/report.test.ts`
  -> `U70 AssertionError: expected false to be true` (modified file)
  -> `U71 AssertionError: expected false to be true` (untracked file)
  -> `U72 AssertionError: expected { ok: true, report: { …(2) } } to deeply equal { ok: true, report: { …(2) } }`
  -> `U74 AssertionError: expected +0 to be 2`
  -> `U75 AssertionError: expected { ok: true, report: { …(2) } } to deeply equal …`
  -> `U76 AssertionError: expected true to be false`
  -> `U77 AssertionError: expected true to be false` (7 failed, 2 passed)
- U69 and U73 passed on the first run because the stub returns a clean report. Deliberate mutants:
  - `uncommittedChanges: true` -> U69, U72, U73, U75 failed (4 failed, 5 passed).
  - count with `rev-list --count HEAD` (no `--not --remotes`) -> U69, U72, U73 failed (3 failed, 6 passed).
  Restored the code exactly, then 9 passed.
- green: `worktreeReport` runs `git status --porcelain` and `git rev-list --count`, with the remote-ref rule for the pull request modes and the base-branch rule for `local-only`.
  A failed command, a missing base branch, or an unreadable count is an error result.
  Suite `pnpm test` -> 28 files, 397 passed, 0 failed. Lint and type-check clean.
- refactor: none needed

## Cycle C8: U78 to U88 merge executors (`src/git/merge.ts`)

- tests: `src/git/merge.test.ts` `[U78]` to `[U88]` (new): the `gh` command lines with a recording fake runner, and the local executor against temporary git repositories
- red: a stub executor whose preflight returns `not implemented` and whose merge returns a failure, then `pnpm vitest run src/git/merge.test.ts`
  -> 10 failed, 1 passed: the `gh` tests saw no `gh` call, the preflight tests saw `not implemented` where they expected `null` or a specific refusal, and the local merge test saw `{ ok: false }`.
- U87 passed on the first run because the stub already fails the merge and leaves the checkout clean.
  Deliberate mutant: remove the `git merge --abort` call
  -> `U87` failed (1 failed, 10 passed): the conflicted checkout was not clean.
  Restored the code exactly, then 11 passed.
- green: `createMergeExecutor` picks the `gh` executor or the `git` executor by mode.
  The local preflight checks the base branch, the checkout path, a clean tree, the current branch, and the task branch.
  An unknown merge method falls back to `--squash`.
  Suite `pnpm test` -> 29 files, 408 passed, 0 failed. Lint and type-check clean.
- refactor: none needed
- note: no test merges a real pull request (D-042).

## Cycle C9: U41 to U51 dispatch (`src/tools/dispatch.ts`)

- tests: `src/tools/dispatch.test.ts` `[U41]` to `[U51]` (new), over the memory store and the fake `BbPort`
- red: a stub `dispatch` that returns `{ ok: false, text: "not implemented" }`, then `pnpm vitest run src/tools/dispatch.test.ts`
  -> `U41`, `U42`, `U43`, `U44`, `U45`, `U46`, `U47`, `U49`, `U50`, `U51` failed on assertions about the task row, the log, the spawn request, or the result text (10 failed, 1 passed)
- U48 passed on the first run because the stub refuses everything and creates nothing.
  Deliberate mutant: the description schema accepts a blank string
  -> `U48` failed (1 failed, 10 passed): a blank description created a task.
  Restored the code exactly, then 11 passed.
- green: `dispatch` refuses a worker caller, validates with a strict schema, creates the task, spawns the worker, records `start` with the description as evidence, and re-reads the thread once.
  A spawn error records `fail` with the error.
  Suite `pnpm test` -> 30 files, 419 passed, 0 failed. Lint and type-check clean.
- refactor: none needed

## Cycle C10: U52 to U68 report and status (`src/tools/report.ts`, `src/tools/status.ts`)

- tests: `src/tools/report.test.ts` `[U52]` to `[U61]` and `src/tools/status.test.ts` `[U62]` to `[U68]` (new), plus the `withDispatchedTask` fixture in `test/fixtures/runtime.ts`
- red: stubs that return `{ ok: false, text: "not implemented" }`, then `pnpm vitest run src/tools/report.test.ts src/tools/status.test.ts`
  -> `U52` to `U66` and `U68` failed on the recorded events, the task states, the refusal codes, or the result text (16 failed, 1 passed)
- U67 passed on the first run because the stub writes nothing.
  Deliberate mutant: `status` appends one log row
  -> `U67` failed (1 failed, 6 passed).
  Restored the code exactly, then 17 passed.
- green: `report` reads the worker from the store, maps outcome, kind, and mode to one machine event, and applies it as actor `worker`.
  `status` reads the store and formats one block per task, scoped to the caller's project.
  Suite `pnpm test` -> 32 files, 436 passed, 0 failed. Lint and type-check clean.
- refactor: none needed
- note: the report tool leaves blank evidence to the machine, so the refusal is logged as a refused row (U58).

## Cycle C12: U89 to U106 merge and approval (`src/tools/merge.ts`)

- tests: `src/tools/merge.test.ts` `[U89]` to `[U106]` (new), over the fake `BbPort`, a fake `MergeExecutor`, and the memory store.
  One more test without an id covers the worker caller, the scout, and the wrong-state refusals that acceptance behavior A14 will cover through the plugin.
- red: a stub `merge` that returns `{ ok: false, text: "not implemented" }`, then `pnpm vitest run src/tools/merge.test.ts`
  -> all 19 tests failed on assertions about the form request, the recorded events, the executor calls, the task state, or the result text (19 failed)
- green: `merge` refuses a worker, a scout, a wrong state, another project, and an open form; runs the executor preflight; records `request_approval`; opens the form unless `yolo`;
  accepts only the strict answer schema; records the owner's approval or denial; previews the `merge` event; runs the executor; and records `merge` only after the executor succeeds.
  `Runtime` gained `openMergeForms` and `Caller` gained an optional `signal`.
  Suite `pnpm test` -> 33 files, 455 passed, 0 failed. Lint and type-check clean.
- deliberate mutants on the gate (hard rule 1), each restored exactly:
  - a denial falls through to the merge -> U93 failed (1 failed, 18 passed)
  - no open-form guard -> U103 failed (1 failed, 18 passed)
  - the form is always asked, even under `yolo` -> U98 failed (1 failed, 18 passed)
  - the merge event always records `yolo: false` -> U98 failed (1 failed, 18 passed)
- refactor: none needed

## Cycle C13: U107 to U116 teardown (`src/tools/teardown.ts`)

- tests: `src/tools/teardown.test.ts` `[U107]` to `[U116]` (new), with the `toMerged` and `scriptGit` fixtures in `test/fixtures/runtime.ts`
- red: a stub `teardown` that returns `{ ok: false, text: "not implemented" }`, then `pnpm vitest run src/tools/teardown.test.ts`
  -> all 10 tests failed on assertions about the recorded events, the task state, the retire call, or the result text (10 failed)
- green: `teardown` reads the worker's environment path, reads the worktree report from git, applies `teardown` as actor `supervisor`, and only then retires the worker.
  Suite `pnpm test` -> 34 files, 465 passed, 0 failed. Lint and type-check clean.
- deliberate mutants on the gate (hard rule 2), each restored exactly:
  - retire the worker before recording the event -> U107, U108, U109, U112, U113 failed (5 failed, 5 passed)
  - ignore the git report and send a clean one -> U108, U109, U111 failed (3 failed, 7 passed)
- refactor: none needed

## Cycle C14: U117 to U119 supervisor command (`src/tools/supervisor-command.ts`)

- tests: `src/tools/supervisor-command.test.ts` `[U117]` to `[U119]` (new)
- red: a stub `runFactorymanCommand` that returns `{ exitCode: 0 }`, then `pnpm vitest run src/tools/supervisor-command.test.ts`
  -> `U117`, `U118`, and `U119` failed on the stamped metadata, the exit code, and the usage text (3 failed)
- green: the command checks its arguments, refuses a recorded worker, and stamps `{ role: "supervisor" }` through the port.
  Suite `pnpm test` -> 35 files, 468 passed, 0 failed. Lint and type-check clean.
- deliberate mutant: skip the worker check -> U118 failed (1 failed, 2 passed). Restored exactly.
- refactor: none needed

## Cycle C15: U33 to U39 tool registration (`src/tools/register.ts`)

- tests: `src/tools/register.test.ts` `[U33]` to `[U39]` (new), through `createFakePluginHost`, `resolveAgentConfiguration`, and `callAgentTool`
- red: a stub `registerTools` that registers nothing, then `pnpm vitest run src/tools/register.test.ts`
  -> `U33`, `U34`, `U36`, `U37`, `U38`, and `U39` failed on the offered tool names, the registered tools, the advertised schema, or the call result (6 failed, 1 passed)
- U35 passed on the first run because the stub offers no tool to any role.
  Deliberate mutant: any role string other than `worker` gets the supervisor tools
  -> `U35` failed (1 failed, 6 passed). Restored exactly, then 7 passed.
- green: `registerTools` registers the five tools with raw JSON schemas from `z.toJSONSchema`, so a bad call reaches the tool and gets its own refusal text, and `bb.agents.configure` picks tools from the metadata role.
  Suite `pnpm test` -> 36 files, 475 passed, 0 failed. Lint and type-check clean.
- refactor: none needed
- note: U40 (no `bb.sdk.plugins` call in a full flow) needs the factory and moves to the server cycle.

## Cycle H0: A1 to A18 acceptance through the plugin factory, with the factory and server unit tests (milestone 4)

- tests: `test/acceptance/tools-visibility.test.ts` (A1), `tools-authority.test.ts` (A2), `tools-dispatch.test.ts` (A3 to A5), `tools-report.test.ts` (A6), `tools-status.test.ts` (A7), `tools-merge.test.ts` (A8 to A14), `tools-teardown.test.ts` (A15, A16), `plugin.test.ts` (A17, replacing the milestone 1 load test), `tools-supervisor-command.test.ts` (A18),
  and `src/server.test.ts` (U40, U120 to U122), over `loadWorld` in `test/fixtures/plugin-host.ts` (the real factory, the real adapter, `bb.sdk` stubs, and the real SQLite store on the fake host's database)
- red (acceptance, written before the factory): with `createPlugin` as a stub that only logs, `pnpm vitest run test/acceptance/<each file>`
  -> `Error: no agent tool "factoryman_dispatch" is registered` for A1 to A7 and A8 to A16 (the tool calls), and assertion failures for A17 and A18 (18 failed)
- green: `createPlugin` defines the settings, opens the store on `bb.storage.database()`, runs `recover`, logs a corrupt task, builds the runtime, registers the five tools and the `factoryman` command.
  `pnpm vitest run test/acceptance` -> 128 passed. Suite `pnpm test` -> 45 files, 496 passed, 0 failed. Lint and type-check clean.
- test-after admission: the server unit tests U120, U121, U122, and U40 were written after the factory, because the acceptance tests drove it.
  Deliberate mutants prove they bite:
  - no `recover` call -> U120, U121, and U40 failed (3 failed, 1 passed)
  - corrupt tasks not logged -> U121 and U40 failed (2 failed, 2 passed)
  U40 first failed for the right reason: with an empty `git rev-list` output the teardown refused (D-046).
  The test then scripted the count as `0`. Restored the code exactly after each mutant.
- note: A10 covers the timed-out form with `approvalTimeoutMinutes: 0.0005` (30 ms), and the fake host returns `cancelled` with reason `timeout` as the real bb did in the spike.
- note: the milestone 1 test `A1` (plugin load registers nothing) is replaced by the new A17 (D-045).
- refactor: none needed

## Cycle C17: U125 to U134 wake messages (`src/wiring/wake.ts`), plus the injected `sleep` dependency

- tests: `src/wiring/wake.test.ts` `[U125]` to `[U134]` (new). `Runtime` gained an injected `sleep` (FR-314), and the fixture records every delay.
- red: a `Notifier` stub whose methods do nothing, then `pnpm vitest run src/wiring/wake.test.ts`
  -> all 10 tests failed on the messages the supervisor thread received, the warning lines, or the task state (10 failed)
- green: `Notifier.onApplied` wakes for the five attention states, and `wake` reads the worker's parent through the port and sends one message.
  Evidence is cut to 600 characters, except for `needs_decision`, where it carries the findings and the limit is 8000.
  Suite `pnpm test` -> 46 files, 506 passed, 0 failed. Lint and type-check clean.
- deliberate mutants, each restored exactly:
  - wake for every state -> U126 and U132 failed (2 failed, 8 passed)
  - evidence limit 599 -> U128 failed (1 failed, 9 passed)
- refactor: none needed
- note: findings reach the supervisor as lines in the `finding` event's evidence, which the validator driver builds (milestone 6).

## Cycle C18: U135 to U152 thread event handlers (`src/wiring/handlers.ts`)

- tests: `src/wiring/handlers.test.ts` `[U135]` to `[U152]` (new), over the memory store, the fake `BbPort`, a `Notifier`, and (for U151) the fake plugin host
- red: an `EventHandlers` stub whose methods do nothing and a `registerHandlers` that registers nothing, then `pnpm vitest run src/wiring/handlers.test.ts`
  -> `U135`, `U136`, `U137`, `U138`, `U140`, `U141`, `U143`, `U145`, `U146`, `U150`, `U151`, and `U152` failed on the task state, the evidence text, the messages, the turn-failure memory, the registered events, or the logged error (12 failed, 6 passed)
- U139, U142, U144, U147, U148, and U149 passed on the first run, because each asserts that nothing happens and the stub does nothing.
  Deliberate mutants, each restored exactly:
  - `thread.failed` fails any non-terminal state -> U139 failed (1 failed, 17 passed)
  - idle wakes in any state -> U144 failed (1 failed, 17 passed)
  - this plugin's own form wakes -> U147 failed (1 failed, 17 passed)
  - handlers match any thread -> U148 failed (1 failed, 17 passed)
  - a deletion also fails a `torn_down` task -> U142 and U145 failed (2 failed, 16 passed)
  U149 has no mutant: `workerThreadId` is null for a queued task, and no thread ID equals null.
- green: each handler loads the recorded worker through `identify`, applies the rule in `contracts/events.md`, and runs inside `guarded`, which logs and swallows an error.
  An empty error text waits 500 ms through the injected `sleep`, because the recorded `turn.failed` follows `thread.failed` by about 20 ms.
  Suite `pnpm test` -> 47 files, 524 passed, 0 failed. Lint and type-check clean.
- refactor: none needed
- note: the recorded order (`thread.failed` before `turn.failed`) changed the design from "read the last turn failure" to "wait briefly for it". D-047 records it.

## Cycle C19: U153 to U160 start-up observation and reconcile (`src/wiring/startup.ts`), with the `deleted` flag on `ThreadInfo`

- tests: `src/wiring/startup.test.ts` `[U153]` to `[U160]` (new), and a changed `[U11]` plus a new second `[U11]` case in `src/bb/adapter.test.ts`
- design change found while writing the tests: a deleted worker thread must still reveal its parent, or the supervisor cannot be told.
  `ThreadInfo` gained `deleted`, set from the thread's `deletedAt`, and `getThread` returns `null` only for a 404 (D-047).
  The adapter tests were changed first, then the code.
- red: stubs for `observe` and `reconcileOnStart`, then `pnpm vitest run src/bb/adapter.test.ts src/wiring/startup.test.ts`
  -> `U11` (both cases), `U153`, `U154`, `U156`, `U157`, `U158`, `U159`, and `U160` failed on the thread info, the observed state, the reconcile rows, or the messages (9 failed, 11 passed)
- U155 passed on the first run because the stub returns the logged state.
- green: `observe` maps a missing or deleted thread to `missing` and a thread in `error` to `failed`.
  `reconcileOnStart` replays each live task, logs a corrupt one, reads the worker thread (logging a read failure and moving on), calls `reconcile`, and wakes the supervisor once per written row.
  First green run: 18 passed, 2 failed.
  - U156 expected `getThread` once per task, but the notifier reads the thread again to find the parent. The test now checks the set of IDs read.
  - U159 expected the start-up pass to log a corrupt task, which the first implementation did not do. The implementation now logs it.
- deliberate mutants, each restored exactly:
  - an errored thread observes as the logged state -> U154, U158, and U160 failed (3 failed, 5 passed)
  - no wake for a written row -> U157 failed (1 failed, 7 passed)
  - terminal tasks are observed -> no test failed (8 passed), so a second `[U159]` test was added for a `torn_down` task whose thread is gone; with that test the mutant fails U159 (1 failed, 8 passed)
- suite `pnpm test` -> 48 files, 534 passed, 0 failed. Lint and type-check clean.
- refactor: none needed
- note: an earlier mutant run with a mistyped path applied three mutants without restoring them.
  I rewrote `src/wiring/startup.ts` from the intended implementation and re-ran the tests before this cycle counted. No mutated code was committed.

## Cycle H1: A19 to A28 acceptance through the plugin factory, and the wiring in `src/server.ts` (milestone 5)

- tests: `test/acceptance/wiring-events.test.ts` (A19 to A26), `wiring-startup.test.ts` (A27), `wiring-recorded.test.ts` (A28), and `src/server.test.ts` (U123, U124).
  The world fixture gained `emit`, `restart`, `runStartup`, a sleep hook, injected thread IDs, and a failing send.
  `test/fixtures/recorded.ts` loads the real bb payloads from `test/fixtures/recorded/bb-0.48.1/`.
- red (acceptance, written before the wiring): with the factory registering only the tools, `pnpm vitest run test/acceptance/wiring-events.test.ts test/acceptance/wiring-startup.test.ts test/acceptance/wiring-recorded.test.ts`
  -> `AssertionError: expected 'working' to be 'failed'` (A19, A21, A25, A28), `AssertionError: expected [] to deeply equal [ StringContaining{…} ]` (A20, A22, A23, A26, A27) (9 failed, 1 passed)
- A24 passed on the first run because nothing happens without handlers. Deliberate mutant: handlers match any thread
  -> `A24` failed (1 failed, 137 passed). Restored exactly.
- green: `createPlugin` builds the `Notifier` and registers it as a runtime listener, registers the six event handlers, and registers the `factoryman-startup` service.
  The service runs `reconcileOnStart` and then waits for the abort signal.
  `pnpm vitest run test/acceptance src/server.test.ts` -> 144 passed. Suite `pnpm test` -> 51 files, 546 passed, 0 failed. Lint and type-check clean.
- test-after admission: U123 and U124 were written after the wiring, because the acceptance tests drove it.
  U124 is a seeded random walk of 300 tool calls and thread events. It asserts at least 40 applied and 10 refused rows, and that `recover` finds no corrupt task and repairs no cache row.
  Deliberate mutant: the notifier is not registered as a listener
  -> `A19`, `A23`, `A25`, `A26`, and `A28` failed (5 failed, 133 passed). Restored exactly.
- note: A28 replays the real recorded payloads. A sleep hook emits the recorded `turn.failed` while `thread.failed` waits, as the real server did within about twenty milliseconds (D-047).
- refactor: none needed

## Cycle C20: U161 to U163 validator types and fake (`src/validator/types.ts`, `src/validator/fake.ts`), with the `@toon-format/toon` dependency (T080)

- tests: `src/validator/fake.test.ts` `[U161]` to `[U163]` (new)
- setup: `pnpm add --save-exact @toon-format/toon@4.4.0` added the dependency and the lockfile entry. No behavior changed.
- red: a `FakeValidator` whose operations throw `not implemented`, then `pnpm vitest run src/validator/fake.test.ts`
  -> `Error: not implemented` for U161, U162, and U163 (3 failed)
- green: `FakeValidator` queues scripted results per operation, repeats the last one, records each call, and returns a `no_run` error for an operation with no script.
  Suite `pnpm test` -> 52 files, 549 passed, 0 failed. Lint and type-check clean.
- refactor: none needed
- note: the interface in `types.ts` has no behavior of its own; U161 checks that the fake and the adapter offer the five operations.

## Cycle C21: U164 to U175 TOON decoder (`src/validator/toon.ts`)

- tests: `src/validator/toon.test.ts` `[U164]` to `[U175]` (new), over the six recorded no-mistakes files in `test/fixtures/recorded/no-mistakes-1.84.0/` and synthetic inputs for the shapes the CLI documents but I could not record
- red: stub `parseRun` and `parseAbort` that always return an `unreadable` error, then `pnpm vitest run src/validator/toon.test.ts`
  -> `U164`, `U165`, `U166`, `U167`, `U168`, `U169`, `U171`, `U172`, `U173`, `U174`, and `U175` failed on the decoded phase, gate, findings, outcome, pull request, or error (11 failed, 1 passed)
- U170 passed on the first run because the stub is unreadable for everything.
  Deliberate mutant: empty output decodes as a running run -> U170 failed (1 failed, 11 passed). Restored exactly.
- green: `parseRun` decodes stdout with `@toon-format/toon`, reads `run` or `other_branch_run`, reads the gate as an object or as a bare step name with top-level findings, checks the outcome against the six known values, and maps a top-level `error` with no run to a command failure.
  `parseAbort` reads `aborted: true`.
  First run: 12 passed. Suite `pnpm test` -> 53 files, 561 passed, 0 failed. Lint and type-check clean.
- deliberate mutants, each restored exactly:
  - an unknown outcome is accepted -> U171 failed (1 failed, 11 passed)
  - a gate is reported as phase running -> U164, U165, and U173 failed (3 failed, 9 passed)
- refactor: none needed

## Cycle C22: U176 to U184 no-mistakes adapter (`src/validator/no-mistakes.ts`)

- tests: `src/validator/no-mistakes.test.ts` `[U176]` to `[U184]` (new), with a recording fake runner that replies with the recorded stdout
- red: a `NoMistakesValidator` whose operations return a `no_run` error, then `pnpm vitest run src/validator/no-mistakes.test.ts`
  -> all 9 tests failed on the recorded command lines or the decoded results (9 failed)
- green: the adapter builds the `axi` command lines in the given `cwd`, decodes standard output with `parseRun` or `parseAbort`, and turns a missing binary or exit code 2 into a command failure.
  Exit code 1 still decodes, because a failed or cancelled final outcome prints with code 1.
  First run: 9 passed. Suite `pnpm test` -> 54 files, 570 passed, 0 failed. Lint and type-check clean.
- deliberate mutants, each restored exactly:
  - `respond` passes `--yes` -> U179 and U180 failed (2 failed, 7 passed)
  - decode standard error when standard output is empty -> U182 failed (1 failed, 8 passed)
  - exit code 1 is always a failure -> U183 failed (1 failed, 8 passed)
- refactor: none needed
