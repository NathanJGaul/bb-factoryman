# Cycle log: The `factoryman_decide` tool

Append only. Newest last. Every entry's `red` block is the evidence that the test existed and failed before the implementation.

## Baseline

- suite: `pnpm run check` -> type check and lint clean, 152 files, 2076 tests passed, 0 failed (about 85 s of test wall time)
- commit: `c275f91` plus the decision-log commit that adds D-136 to D-143
- recorded: cycle 0, before any change
- note: the first run of `pnpm test` on `c275f91` had one red, `test/acceptance/decision-log.test.ts [A1510]`, because the new spec files cited D-136 to D-143 and the log had no such headings. The headings were written as plan-time decisions, and the suite was green again. This was a red caused by this feature's own documents, not a pre-existing failure.

## Cycle 1: U1801, U1802, U1803 the decision key (one group, three tests)

- test: `src/validator/key.test.ts::[U1801]`, `[U1802]`, `[U1803]` (new; the file has a fourth test, a second `[U1803]` case that the driver's ignored fields do not change the key)
- red: `pnpm vitest run src/validator/key.test.ts` with a stub that returns `""` -> `AssertionError: expected '' to match /^nm-r1-review-[0-9a-f]{8}$/` (3 failed, 1 passed)
- note: the fourth test passed against the stub, because two empty strings are equal. It is a real check once the key exists (a mutant that hashes the PR URL breaks it); the verify step lists that mutant.
- green: `src/validator/key.ts` holds `viewSignature` (moved unchanged from `driver.ts`) and `decisionKey` (SHA-256 prefix of the signature). `pnpm vitest run src/validator/key.test.ts src/validator/driver.test.ts` -> 30 passed. `pnpm test` -> 153 files, 2080 tests passed (4 new)
- U1804 (characterization): `driver.test.ts` `[U188]`, `[U189]`, `[U207]` pass unchanged after `viewSignature` moved, so the row is `BASELINE`
- refactor: none needed; the move was the refactor and ran under the existing driver tests
- commit: see `git log` (message `feat(validator): add the decision key`)

## Cycle 2: U1813, U1814, U1815 the decision payload contract (one group)

- test: `src/approval/contract.test.ts::[U1813]`, `[U1814]` (four cases), `[U1815]` (26 cases)
- red: `pnpm vitest run src/approval/contract.test.ts` with stubs -> `AssertionError: expected '' to be 'factoryman-decision-approval'` and `expected null to deeply equal { taskId: 't1', ... }` (5 failed). A second run with a stub reader that returned its input unchanged -> `AssertionError: expected { taskId: 't1', ... } to be null` (25 failures, one per `[U1815]` case that the permissive reader accepted). Both runs are the evidence, because the null stub would pass every `[U1815]` case.
- green: `readDecisionPayload` checks exact keys at three levels, the string types, the two sets, that every answered ID is shown and distinct, `fix` needs IDs and `kind: "gate"`, IDs and instructions belong to `fix`, and `rerun` belongs to a finished run with no findings. `pnpm vitest run src/approval/contract.test.ts` -> 77 passed. `pnpm test` -> 153 files, 2080 + 73 = see the next line.
- refactor: the first draft of the tests used `any` for mutable drafts and failed lint; the cases now build their input with `withFields`, `withAnswer`, `withFinding`, and `without` (no behavior change, same 26 cases). Lint and type check clean.
- commit: `feat(approval): add the decision payload contract`
