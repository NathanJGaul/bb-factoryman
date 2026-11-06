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
