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
