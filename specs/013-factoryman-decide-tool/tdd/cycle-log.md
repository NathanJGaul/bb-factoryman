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

## Cycle 4: A1816, U1824, U1825 the tool is registered for supervisors (one group)

- test: `test/acceptance/tools-visibility.test.ts::[A1816]` (replaces `[A1]`, which said four tools), `src/tools/register.test.ts::[U1824]`, `[U1825]`. The pins `[U33]`, `[U36]`, `[A17]`, and `[U123]` are updated from the old counts to the new ones, with the same checks (the exact name lists are longer by `factoryman_decide`). `test/fixtures/decider.ts` is new (`FakeDecider`).
- red: `pnpm vitest run src/tools/register.test.ts test/acceptance/tools-visibility.test.ts test/acceptance/plugin.test.ts src/server.test.ts` -> `AssertionError: expected [ 'factoryman_dispatch', …(3) ] to deeply equal [ 'factoryman_decide', …(4) ]` and `expected [ { …(7) }, … ] to have a length of 6 but got 5` (7 failed, 22 passed)
- green: `src/tools/decide.ts` holds the `Decider` interface, the flat `decideSchema`, and a first `decide` that checks the worker and parses the arguments (the answer path comes in the next cycles); `src/tools/register.ts` adds the tool last in the supervisor list and takes the decider; `src/server.ts` passes the driver. The full run then showed four more old pins: `[U1312]` and `[U121]` (updated) and `[A1602]` and `[A1313]` (updated). `pnpm test` -> 153 files, 2124 tests passed. Type check and lint clean.
- U1826 is DROPPED: the test "the plugin passes its driver to the registration" cannot be written before the flow uses the driver, and A1801 (through `createPlugin` with the real driver) is the stronger proof.
- refactor: none needed
- commit: `feat(tools): register factoryman_decide for supervisors`

## Cycle 5: U1816, U1817, U1818, U1819, U1820 the pure parts of the tool (one group)

- test: `src/tools/decide.test.ts::[U1816]` (schema, nine cases), `[U1817]` (gate answers: seven accepted, seven refused, and the empty gate), `[U1818]` (finished views: four accepted, four refused for `rerun`, and `approve`, `skip`, and `fix` refused for every finished view), `[U1819]` (three payload tests), `[U1820]` (three evidence tests). U1818 is built here and not in task T020, because the plan puts the finished-run rules in the same function; T020 stays open for the flow through the tool (A1811, A1812).
- red: `pnpm vitest run src/tools/decide.test.ts` -> first run: `TypeError: planAnswer is not a function`. With stubs: `AssertionError: expected { ok: false, message: '' } to deeply equal { ok: true, … }` (6), `expected {} to deeply equal { taskId: 't1', … }` (2), `expected '' to match /skip takes no finding IDs and no inst…/`, and the others (32 failed, 9 passed)
- green: `src/tools/decide.ts` has `planAnswer` (gate and finished-run rules, each refusal with its reason), `decisionRequest`, and `decisionEvidence`. `pnpm vitest run src/tools/decide.test.ts` -> 41 passed. `pnpm test` -> all files passed. Type check and lint clean.
- refactor: none needed
- commit: `feat(tools): add the decide answer rules, payload, and evidence`

Correction to cycle 5: the full run on that cycle's code had one red, `test/acceptance/lint-isolation.test.ts` "fails lint on an @get-bb import and names the restricted module" (8244 ms, over the 5 s test budget). The commit went in before the red was read, because the shell chained the commit after the output filter and not after the test result, and the entry above wrongly says "all files passed". The test passed alone (84 passed in 3.9 s) and a second full run passed (154 files, 2165 tests). The cause is a cold start: the first lint in the file loads the ESLint config and the type-aware parser, and under full-suite load that exceeded the first test's budget. The test was flaky before this feature too. Cycle 5a-fix below adds a warm-up in `beforeAll` with its own budget; no assertion changed. From here the shell checks the exit status of `pnpm test` before it commits.

## Cycle 5a-fix: the lint-isolation test no longer fails at random (flake fix, no behavior change)

- test: `test/acceptance/lint-isolation.test.ts` (existing, 84 tests). A `beforeAll` lints one empty file with a 60 s budget before the first test runs.
- red: the full run on `18820f6` failed the first test of the file once (8244 ms). A repeat could not reproduce it, so there is no deterministic red; the evidence is the one recorded failure and its timing.
- green: `pnpm vitest run test/acceptance/lint-isolation.test.ts` -> 84 passed. The full gate follows with the next cycle.
- commit: `test: warm up ESLint before the lint-isolation tests`

## Cycle 6: A1801, A1802, A1803, A1804, A1813, U1821, U1822, U1823 the answer path (one group)

- test: `test/acceptance/tools-decide.test.ts::[A1801]`, `[A1802]` (approve and skip), `[A1803]`, `[A1804]` (the real `NoMistakesValidator` over the recorded gate output and a recording command runner), `[A1813]`; `src/tools/decide.test.ts::[U1821]` (two tests), `[U1822]` (two), `[U1823]` with `FakeDecider`.
- red: `pnpm vitest run src/tools/decide.test.ts test/acceptance/tools-decide.test.ts` -> the first `decide` answered every valid call with `factoryman_decide does not answer yet.`, so each test failed on its assertion (`expect(result.ok).toBe(true)`, `expected [] to deeply equal [ { operation: 'answer', … } ]`, and the others): 10 failed, 42 passed. `[A1813]` passed on the first run, because cycle 3 already put the key line in the evidence. The deliberate mutant that removes `Decision key` from `driver.ts` failed it with `expected '- review-2 [error] sum.js: ask-user: …' to be 'Decision key: nm-r1-review-5e7ee5c6'`, and the restored code passed again.
- green: `decide` in `src/tools/decide.ts` now checks the caller, the arguments, the task and its state, reads the live view, compares the key, plans the answer, opens the form with `DECISION_RENDERER_ID`, reads the reply with the merge tool's strict `approvalAnswerSchema`, reads the view again, asks the machine to preview `resolve`, and sends through `decider.answer` or `decider.rerun`. `pnpm vitest run src/tools/decide.test.ts test/acceptance/tools-decide.test.ts` -> 52 passed. `pnpm test` -> 155 files, 2176 tests passed (exit 0). Type check and lint clean after three unused declarations in the new test file were removed (they return with the rerun tests).
- note: the rerun branch and the `Decider.rerun` path are written here because `planAnswer` already returns the plan; their acceptance tests (A1811, A1812) are the next cycles. `[U1821]` (rerun) covers the branch through the fake decider.
- refactor: none needed
- commit: `feat(tools): answer a pipeline gate through factoryman_decide`

## Cycle 7: A1805, A1806, A1807, A1808, A1809, A1810 the refusals (one group; one test red, the rest test-after with mutants)

- test: `test/acceptance/tools-decide.test.ts::[A1805]` (11 table rows, plus the worker, the other project, the working task, and the scout task), `[A1806]` (two tests), `[A1807]` (five table rows, plus cancel and timeout), `[A1808]` (two tests), `[A1809]`, `[A1810]`.
- red: `pnpm vitest run test/acceptance/tools-decide.test.ts` -> only `[A1809]` failed: `Test timed out in 5000ms` (the second call opened a second form, so the cancel never reached the first). 1 failed, 31 passed.
- test-after (waiver W1, recorded as D-144): the other 31 tests passed on their first run, because cycle 6 wrote the whole flow with its checks in one function. They are not test-first. Each check was then proved by a deliberate mutant (below), so the tests can fail. Mutants, each applied to `src/tools/decide.ts`, the tests run, then restored: M1 drop the key comparison -> KILLED by `[A1805] refuses a key that does not match the live gate`; M2 drop the state check -> KILLED by `[A1805] refuses a task that is not in needs_decision, and a scout task`; M3 drop the worker refusal -> KILLED by `[A1805] refuses a worker caller`; M4 drop the post-approval key check -> KILLED by `[A1808] sends nothing when the gate has another key`; M5 drop the post-approval machine preview -> KILLED by `[U1823]`; M6 drop the same-project check -> KILLED by `[A1805] refuses a task of another project`; M7 drop the ship check -> KILLED by `[A1805] ... a scout task`; M8 treat a denial as an approval -> KILLED by `[A1806] sends nothing under yolo when the owner denies`; M9b go on when the live view cannot be read -> KILLED by `[A1810]`; M10 ignore the plan refusal -> KILLED by `[A1805] refuses a fix that names a finding that is not in the gate`; M11 send when the form was cancelled -> KILLED by `[A1807]`; M12 never release the open-form claim, M13 ignore an open form -> KILLED by `[A1809]`. All 13 killed.
- green: `Runtime.openDecisionForms` and the claim in `decide` (as `factoryman_merge` does for its forms). `pnpm vitest run test/acceptance/tools-decide.test.ts` -> 32 passed. `pnpm test` -> exit 0. Type check and lint clean.
- refactor: none needed
- commit: `feat(tools): refuse a second decision form for one task`
