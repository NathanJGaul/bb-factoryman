# Cycle log: Extension surface

Append only.
Newest last.
Every entry's `red` block is the evidence that the test existed and failed before the implementation.
Each group commits its tests with stubs first, so git history shows the order.

## Baseline

- suite: `pnpm test` -> 72 files, 873 passed, 0 failed
- commit: `6ce8bfc`

## Group 1: the workflow config and the check gate

Red commit: the commit before this group's implementation (`test: add workflow config and custom check tests with stubs, group 1 (red)`). It holds the tests, stubs for `src/workflow/*` that return "not implemented", and a `customChecksPassed` guard stub that returns null.

- red: `pnpm vitest run src/workflow src/machine test/acceptance/extension-workflow.test.ts` -> 48 failed
  - `[U901]` to `[U909]`: `AssertionError` on the stub's "not implemented" result (the empty config, the parse, the loader)
  - `[U910]` to `[U913]`: the stub returned the stored config unchanged
  - `[U914]`: `expected false to be true` (`checks` was an unknown key)
  - `[U915]`, `[U916]`: the guard stub returned null for a failing check
  - `[U917]`, `[U918]`, and the table-order test: the table lacked the guard
  - `[U919]` to `[U923]`: the stub ran nothing
  - `[A902]` to `[A911]`: the tools ignored the file
- Passed against the stubs: `[A901]`, `[A910]`, `[A912]`, `[U924]`, and the three equal-mode cases of `[U911]` (the stub returned the stored config). They describe behavior that already held or that a stub gives by accident (no file, a refused empty evidence, a scout, no checks). `[U905]` failed as a whole test. Deliberate mutants after the implementation:
  - a scout runs the checks -> `[A912]` failed
  - empty evidence accepted -> `[A910]` failed
- Mutants on the new gates, all killed:
  - the guard always passes -> `[U915]`, `[A909]`, `[A911]`
  - the report skips the checks -> `[A908]`, `[A909]`, `[A911]`
  - `ready` loses the guard in the table -> the table-order test, `[U917]`, `[U918]`
  - the `baseBranch` scan removed -> `[U903]`, `[A906]`
  - the key scan stops at the top level -> 18 failed (every `[U902]` case and the `baseBranch` tests)
  - the file beats a stored prefix -> `[U910]`, `[A903]`
  - the mode ladder reversed -> `[U911]`, `[U912]`, `[A904]`
  - checks stop at the first failure -> `[U922]`, `[U923]`
  - a check passes on any code -> `[U920]`, `[U922]`, `[U923]`, `[A909]`
  - dispatch ignores the effective config -> `[A903]`, `[A904]`
  - the report ignores a bad workflow file -> both `[A902]` cases
- Existing tests that changed with the requirement: `test/fixtures/legal-set.ts` lists the new guard on `handoff` and `ready`.
- green: `config.ts` (strict schema, the key scan, `GATE_KEYS`), `load.ts`, `effective.ts`, `checks.ts`, the `checks` event field, the `customChecksPassed` guard and `check_failed` code, the report tool's check step, and the dispatch tool's workflow step.
  `pnpm run check` -> 77 files, 943 passed, 0 failed. Type check and lint clean.

## Group 2: thread metadata and the read RPC

Red commit: the commit before this group's implementation (`test: add thread metadata and read RPC tests with stubs, group 2 (red)`). It holds the tests, a stamper stub that registers nothing, an RPC stub that registers nothing, and the fixtures `FakeBbPort.setMetadataError` and `world.failMetadata`.

- red: `pnpm vitest run src/wiring/stamp.test.ts src/rpc test/acceptance/extension-surface.test.ts` -> 13 failed
  - `[U925]`, `[U927]`, `[A913]`, `[A914]`: no metadata write
  - `[U929]` to `[U933]`, `[A915]`: `experimental_PluginRpcCallError: plugin "factoryman" has no rpc method ...`
  - `[U934]`: no call reached the store
  - `[A916]`: the `rejects` half passes against the stub because no method exists. The assertion that the log is unchanged holds either way. The test proves its point through `[A917]` and through the mutants below.
  - `[A917]`: `expected [] to deeply equal [ 'apiVersion', 'getTask', ... ]`
- Passed against the stubs: `[U926]`, `[U928]`, `[U935]` (a missing method rejects every call). Deliberate mutants after the implementation:
  - `[U926]`, `[U928]`: the stamper writes `role` -> `[U925]`, `[U928]` failed
  - `[U935]`: input schemas not strict -> `[U935]` failed
- Mutants on the new behavior, all killed:
  - skip `machine` in the stamp -> `[U925]`, `[A913]`; throw on a failed write -> `[U927]`, `[A914]`
  - not discoverable -> `[U933]`, `[A917]`; `since` ignored -> `[U931]`, `[A915]`; `limit` ignored -> `[U931]`; project filter ignored -> `[U929]`
  - version 2 -> `[U930]`, `[U932]`, `[A915]`
  - the payload leaks into an event row -> survived while the output schemas were `z.object`, because the host strips unknown keys. The output schemas are `strictObject` now, and the mutant then failed five tests.
  - `registerReadRpc` or `registerStamper` removed from `server.ts` -> `[A915]` to `[A917]`, `[A913]`, `[A914]`
- Existing tests that changed with the requirement: `[A17]` expects the four RPC methods, `[A18]` expects the stamped metadata, and `[A908]` (remote) counts only the `pnpm` runs, because the validator also runs on the machine.
- green: `src/wiring/stamp.ts`, `src/rpc/read.ts`, and their registration in `server.ts`.
  `pnpm run check` -> 80 files, 960 passed, 0 failed, then 961 with `[A918]`. Type check and lint clean.

- `[A918]` (added after the group, FR-910): no file in `src/machine/` imports from a layer above it. It passed at once. Mutant: import `../workflow/types` into `guards.ts` -> `[A918]` failed. Reverted.

## Cycle R1: audit remediation (tests added to kill surviving mutants)

The cold audit (`tdd/verification.md`, commit `4bad48e`) returned FAIL: 105 mutants, 18 survived, 11 of them real gaps. The product was right in each case, so the new tests passed at once except `[U943]` (the default check timeout, finding 10), which was red.

- R1 `[U902]` runs over a hand-written list of the 16 keys, and `[U936]` pins the whole list. `[A905]` requires the hard rule 7 message.
  Mutants: remove `skipGates` (M04), `approvals` (M05), or `disabled` (M06) from `GATE_KEYS` -> `[U902]` for that key and `[U936]` failed. Weaken the message (M103) -> six `[A905]` cases failed. Reverted.
- R2 `[U937]`: a project read that fails blocks a done report. Mutant: return the empty config from that catch (M27) -> `[U937]` failed. Reverted.
- R3 `[U938]`: a worker thread read or a worktree path read that fails blocks a done report. Mutant: return "no checks" from that catch (M58) -> both cases failed. Reverted.
- R4 `[A919]` (three tests): the `direct-PR` and `local-only` checks run on `ready`, a failing check gives `check_failed`, and another mode's check does not run. Mutant: hard-code the `no-mistakes` lookup (M56) -> two cases failed. Reverted.
- R5 `[U939]`: `blocked` and `failed` reports pass with failing checks and with an invalid file, and run no check. Mutant: run checks for any outcome (M54) -> both cases failed. Reverted.
- R6 `[A920]`: the resolver gets the effective mode. Mutant: pass the stored mode (M66) -> failed. `[U940]`: the default limit of 200 and the maximum of 1000. Mutants M76 and M78 -> `[U940]` failed (M78 also `[U935]`). Reverted.
- R7 bookkeeping: the entries above for `[A910]` and `[U911]`, the 960 and 961 counts, and the `[A918]` entry. `test-list.md` lists A917 before A918. `[A908]` and `[A911]` no longer share an ID (`[A921]`, `[A922]`), `[U905]` and `[U915]` are split, and the two untagged tests have IDs (`[U941]`, `[U942]`).
- finding 10: a check with no `timeoutSeconds` now gets a default of 600 seconds (`DEFAULT_CHECK_TIMEOUT_MS`), so a hung command cannot hang a report. `[U919]` and `[U943]` were red first. Mutant: remove the default -> both failed. Reverted. D-079 says so.
- suite: `pnpm run check` -> 80 files, 975 passed, 0 failed. Type check and lint clean.
