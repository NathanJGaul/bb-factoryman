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

Correction to cycle 2: the full suite after cycle 2 was 153 files and 2112 tests passed (the line above left the count open).

## Cycle 3: U1805 to U1812 the driver additions (one group, ten tests, one existing test updated)

- test: `src/validator/driver.test.ts::[U1805]`, `[U1806]` (four outcomes), `[U1807]`, `[U1808]` (two tests, the second for a remote host), `[U1809]`, `[U1810]`, `[U1811]` (two tests), `[U1812]`. `[U187]` is updated: it keeps its four old lines exactly and adds the final line `Decision key: <key>`. The old assertion is not weakened, because the old text must still match line for line, and the change is the behavior this feature adds.
- red: `pnpm vitest run src/validator/driver.test.ts` -> first run: `TypeError: driver.current is not a function` (3 tests) and `driver.rerun is not a function` (3 tests), plus the evidence assertions `expected '- review-1 [error] sum.js: auto-fix: …' to be 'Decision key: nm-r1-review-fefbf415'`. Second run with stubs that return `{ ok: false, message: "not built" }`: `expected { ok: false, message: 'not built' } to deeply equal { ok: true, … }` and `expected 1 to be greater than or equal to 2` (10 failed, 26 passed). `[U1807]` passed against the old code, because no key line existed; the verify step lists the mutant that adds a key to the five-error park.
- green: `src/validator/driver.ts` appends `Decision key: <key>` in `park`, adds `current` (the loop's `context`, then `validator.status`), adds an optional `evidence` argument to `answer`, and adds `rerun`, which shares `resolved` with `answer`. `pnpm vitest run src/validator/driver.test.ts` -> 36 passed. `pnpm test` -> 153 files, 2122 tests passed. Type check and lint clean.
- refactor: `answer` and `rerun` share the private `resolved` (apply `resolve`, clear the baseline, map the result); no test changed.
- commit: `feat(validator): add the key line, current, rerun, and answer evidence to the driver`
