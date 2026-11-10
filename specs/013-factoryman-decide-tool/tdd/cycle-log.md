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

## Cycle 8: A1811, A1812 the rerun decision (one group, test-after with mutants)

- test: `test/acceptance/tools-decide.test.ts::[A1811]` (two tests), `[A1812]` (four tests); `src/tools/decide.test.ts::[A1812]` (four table rows: a running view, a failed run, a cancelled run, and `checks-passed` with a pull request, each with `rerun` and `approve`).
- red: none. All 88 tests of the two files passed on the first run, because cycle 6 wrote both branches of the flow (`rerun` and `answer`). This is a test-after group (waiver W1, D-144).
- mutants: R1 send a rerun through the answer path -> KILLED by `[U1821] sends a rerun through the decider's rerun path`; R2 `checks-passed` with a pull request counts as parked -> KILLED by `[U1818]`; R3 a finished run accepts any action -> KILLED by `[U1818] refuses approve for every finished view`; R4 `failed` counts as parked -> KILLED by `[U1818]`; R5 `fix` ignores the instructions -> KILLED by `[U1817] accepts fix with instructions`; R6 `fix` does not check the ID -> KILLED by `[U1817]`; R7 the evidence drops the owner's comment -> KILLED by `[U1820]`. All restored; `git status` showed only the test files changed.
- green: no production change in this cycle. `pnpm run typecheck`, `pnpm run lint`, and `pnpm test` (the gate script) -> 155 files, 2212 tests passed. D-144 was written in this cycle, because the cycle log cites it and the decision-log guard `[A1510]` failed until its heading existed.
- refactor: none needed
- commit: `test: cover the rerun decision and the plan refusals`

## Cycle 9: U1828, U1829, U1830, U1831, U1832 the decision form (one group)

- structural commit first: `test: share the parked world of the decide tests in a fixture` moved the builders and the parked world out of `test/acceptance/tools-decide.test.ts` into `test/fixtures/decision-world.ts` (38 tests passed before and after, no assertion changed), because the form's acceptance tests need the same world.
- test: `src/app/decision-approval-form.test.tsx` (26 tests under jsdom): `[U1828]` (the request, the findings with their five fields, a 40-finding list that scrolls, the answer sentence for four answers, the fix rows, the gate with no findings), `[U1829]` (a finished run), `[U1830]` (six unreadable payloads, each with Deny and Cancel working), `[U1831]` (Approve, Deny, Cancel, the in-flight guard, a failed submit, the labels, the expiry), `[U1832]` (markup shown as text).
- red: `pnpm vitest run src/app/decision-approval-form.test.tsx` against a component that rendered `null` -> `TestingLibraryElementError: Unable to find an element with the text: Task, which matches selector 'dt'` and `Unable to find an accessible element with the role "list" and name "Findings"` (25 failed, 1 passed). The one pass is "shows no fix rows for approve and skip", true of an empty component; the verify step lists the mutant that always shows the fix rows.
- green: `src/app/decision-approval-form.tsx` (`DecisionApprovalForm`) mirrors the merge form: the same classes, the same in-flight guard, and `answerFor`; it reads the payload with `readDecisionPayload`, shows the findings and the answer sentence from the structured answer, and offers no Approve for an unreadable payload. `pnpm vitest run src/app/decision-approval-form.test.tsx` -> 26 passed. Gate script (type check, lint, `pnpm test`) -> OK.
- refactor: none needed
- commit: `feat(app): add the decision approval form`

## Cycle 10: U1833, A1814, A1815, A1821 the decision renderer is registered (one group)

- test: `src/app.test.tsx::[U1833]`; `test/acceptance/decision-approval-form.test.tsx::[A1814]` (two tests: Approve through the registered renderer gives the reply that the tool's strict schema accepts and the validator gets one answer; Deny and Cancel send nothing), `[A1815]`, `[A1821]`; the existing `test/acceptance/merge-approval-form.test.tsx::[A1201]` is updated from "exactly one renderer" to "the merge renderer first, the decision renderer after it".
- red: `pnpm vitest run src/app.test.tsx test/acceptance/decision-approval-form.test.tsx test/acceptance/merge-approval-form.test.tsx` -> `AssertionError: expected [ [ …(2) ] ] to deeply equal [ [ …(2) ], [ …(2) ] ]` and `Error: no renderer is registered for factoryman-decision-approval` (5 failed). `[A1815]` passed on the first run, because it checks that the merge renderer is unchanged; the verify step lists the mutant that drops the merge registration.
- green: `src/app.tsx` registers `DecisionApprovalForm` under `DECISION_RENDERER_ID` after the merge renderer. 22 tests passed in the three files. Gate script -> 158 files, 2243 tests, OK.
- refactor: none needed
- commit: `feat(app): register the decision renderer`

## Cycle 11: U1834, U1835, U1837, U1838, U1839, U1843, A1817 the harness suite, the wording, and the label (one group)

- test: `src/harness/advice.test.ts` and `test/fixtures/conformance-lab.test.ts` (the two advice lines, `[U1834]`), `src/tools/supervisor-start.test.ts::[U1835]`, `src/server.test.ts::[U1835]` (the CLI summary) and `::[U1843]` (the setting label), `tools/conformance/scenarios/scenarios.test.ts::[U1837]` (two tests, S5 and S9), `::[U1838]` (S8), `test/fixtures/conformance-lab.test.ts::[U1839]`, `test/acceptance/conformance-tier15.test.ts::[A1817]`. The pins `[U1389]`, `[U1395]`, and `[U1709]` are updated to the new truth (five tools, and the fourth S8 check).
- red: `pnpm vitest run src/harness/advice.test.ts test/fixtures/conformance-lab.test.ts` -> `[U1651]` to `[U1654]` and `[U1710]` (nine tests) failed on the old wording ("four supervisor tools"). `pnpm vitest run src/tools/supervisor-start.test.ts src/server.test.ts` -> `expected 'Merge approval timeout (minutes)' to be 'Approval timeout (minutes)'`, `expected 'Started factoryman supervisor thread …' to contain 'the thread has the five supervisor to…'`, and the summary (3 failed). `pnpm vitest run tools/conformance/scenarios/scenarios.test.ts test/fixtures/conformance-lab.test.ts` -> `expected 'unknown tool factoryman_decide' to be 'Refused (illegal_transition): Task t-…'`, `expected [] to deeply equal [ 'S5.supervisor-tools' ]`, `expected [ 'S8.empty-evidence-refused', …(2) ] to deeply equal [ 'S8.decide-wrong-state', …(3) ]`, and `expected [] to deeply equal [ 'S9.start-tools', …(1) ]` (5 failed).
- green: `src/harness/advice.ts`, `src/tools/supervisor-start.ts`, `src/tools/supervisor-command.ts` (comment), and the CLI summary in `src/server.ts` say five; the setting is labelled "Approval timeout (minutes)" with a description that names merge and decision forms. `tools/conformance/scenarios/helpers.ts` lists five tools, S5 and S9 say five in their titles, and S8 gains `S8.decide-wrong-state`. The fake lab offers five tools, has the faults `supervisorLacksDecide` and `decideResolves`, and answers `factoryman_decide` with the real tool's wording. Gate script -> 158 files, 2250 tests, OK.
- `[A1817]` passed on its first run (it composes the changes above). Mutants: C1 the fake lab drops the tool -> KILLED by `[U1709]`; C2 the S8 check accepts any outcome -> KILLED by `[U1838]`; C3 the scenario list drops the tool -> KILLED by `[U1837]`.
- note: the real-lab behavior (tier 1 and tier 1.5 through a real bb) is task T025, run later in `bblab`.
- refactor: none needed
- commit: `feat(conformance): require five supervisor tools and check the decide refusal`

## Cycle 12: U1836, U1840, U1841, U1842, A1819 the documents and the skill (one group)

- test: new `test/acceptance/decide-docs.test.ts` (`[U1836]` the skill, `[U1840]` the design, `[U1841]` the constitution and the log, `[U1842]` the conformance and live-check documents, `[A1819]` no document calls the tool out of scope); the existing pins `[A1710]` (five tools), `[A1618]` (constitution 1.5.0), `[A1105]` (the supervisor's sentence about findings), and `[A1103]` (the tool list now holds `factoryman_decide`) are updated to the new truth, and the names guard `[A1116]` learns the names of `decideSchema`.
- red: `pnpm vitest run test/acceptance/decide-docs.test.ts test/acceptance/design-profiles.test.ts test/acceptance/skills.test.ts test/acceptance/decision-log.test.ts` -> `AssertionError: expected [ '`factoryman_dispatch`', …(3) ] to include '`factoryman_decide`'`, `expected '\nYou talk to one thread per bb proje…' to contain 'The plugin gives the supervisor five …'`, and `expected '# bb-factoryman Constitution…' to match /\*\*Version\*\*: 1\.5\.0 …/` (9 failed). After the skill text came in, `[A1116]` failed once on `[ 'Decision key: nm-...' ]` and once on `[ 'Decision key' ]`, which are quoted words of the plugin's own message, so they joined the guard's list of quoted words (like `[factoryman]`); that is a guard extension and not a weaker check.
- green: `skills/factoryman-supervisor/SKILL.md` (tool row, a section "Answer a finding", the `needs_decision` row, and two cannot-do lines), `docs/DESIGN.md` (five tools and a sixth, the tool row, the "Pipeline finding" gate row, the "Answering a finding" paragraph, the build-plan note, "five tools" in the supervisor-start paragraph), `docs/CONFORMANCE.md` and `docs/LIVE-CHECK.md` (the counts and the S8 text), `.specify/memory/constitution.md` 1.5.0, and `Amended by D-136` lines on D-031, D-057, D-068, and D-095. Gate script -> 159 files, 2256 tests, OK.
- covered by existing tests, no new work: `[A1820]` is `test/acceptance/tmpdir-leak.test.ts::[A1511]` (the full gate shows no new directory under the system temporary directory; T029 measures it), `[U1844]` is `driver.test.ts::[U194]`, `[U1845]` is `decision-log.test.ts::[A1509]` and `[A1510]`, `[U1846]` is `no-mistakes.test.ts::[U180]`.
- refactor: none needed
- commit: `docs: describe factoryman_decide in the design, the skill, and the constitution`

## Verification note: the leak baseline for T001

- `pnpm test` was run once on `5971817` with `TMPDIR=/home/nathanjgaul/.cache/tmp`: 3159 `bb-fake-plugin-host-*` directories before and 3159 after, and 4057 entries before and 4056 after. `/tmp` held 1672 such directories and was not touched by the run. The old directories are leftovers from before the private-`TMPDIR` fix (D-121). The feature adds none. T001 is ticked on this evidence.

## Remediation of the verification findings 2 to 8, 10, and 11 (test refactors, no behavior change)

- T039 (finding 2): `[U1821]` now compares the payload and the `resolve` evidence with literal values, not with the output of `decisionRequest` and `decisionEvidence`.
- T040 (finding 3): the wrong-state refusal text lives in `src/tools/decide-text.ts` (a leaf module with no imports, because the lab is type-checked under Node's type stripping, and the first attempt to import `decide.ts` into the lab failed `tsc6 -p tools/tsconfig.json` with TS1294). The tool and the fake lab both use it, and `[A1805]` pins the real text as a literal.
- T041 (finding 4): the `refused` helper takes `expected` as a required argument.
- T042 (finding 5): `[U1806]` is a table with an `expectedText` column. A first attempt replaced a slice of the file and removed `[U195]` to `[U199]` by mistake; the suite count (2254 instead of 2259) showed it, the file was restored from git, and the edit was redone on the one test. No existing test was lost.
- T043 (finding 6): `FakeDecider.onCurrent` may return a promise, and `[U1823]` awaits the write.
- T044 (finding 7): `[U1841]` matches `Version: 1.5.0` and the in-scope sentence only, and the stays-out check stays in `[A1819]`.
- T045 (findings 8, 10, 11): the S9 test is `[U1847]` and the unit refusal test is `[U1848]` (both are rows of the list), `[U1812]` asserts exactly two `start` calls, and the traces of the list were corrected (US5.3 now sits on `A1816`).
- Gate script -> 159 files, 2259 tests, OK.
- commit: `test: clear the HIGH smells that the verification found`

## Cycle 13: U1839 and S8 the live run finds that the lab probed with a scout (D-145)

- test: `test/fixtures/conformance-lab.test.ts::[U1839]` (now two tests: a working ship task, and a scout task refused because only a ship task has a pipeline).
- found by: the first tier 1 run in `bblab` (`pnpm run conformance -- --tier 1 --lab-dir /var/tmp/bblab-decide-tool`, commit `15de3f2`): `FAIL S8.decide-wrong-state: ... text: Refused (illegal_transition): Only a ship task has a pipeline to answer.` Every other scenario passed. The runs were stopped, the lab was brought down (tripwire: no events), and the stray result file was reverted.
- red: `pnpm vitest run test/fixtures/conformance-lab.test.ts` -> `AssertionError: expected { …(2) } to deeply equal { …(2) }` for the scout case (1 failed). After the fake lab learned task kinds, `pnpm vitest run test/fixtures/conformance-lab.test.ts tools/conformance/scenarios/scenarios.test.ts test/acceptance/conformance-tier15.test.ts test/acceptance/conformance-tier1.test.ts` -> `[A1301]`, `[A1302]`, `[A1312]`, `[A1313]`, `[A1501]`, `[A1502]`, `[A1505]`, `[A1614]`, and more failed, which is the live failure reproduced offline.
- green: S8 dispatches its own silent ship task for the decision probe. 71 tests passed in the four files. The gate follows.
- refactor: `src/tools/decide-text.ts` also holds `NOT_SHIP_TEXT`, which the tool and the fake lab share.
- commit: `fix(conformance): probe the decide refusal with a ship task`

## Live check A1818 (task T025): the five offline conformance runs on commit 1a890a9

- command: `data/bb-factoryman-decide-tool/run-conformance.sh` in the firstmate home runs `pnpm run conformance -- --tier 1` and `--tier 1.5 --harness claude-code`, `codex`, `pi`, `omp`, each with `--lab-dir /var/tmp/bblab-decide-tool`, one after the other, with no credential. The lab is `bblab` with bb 0.49.0 pinned, tier 1.5 offline.
- result: all five runs exited 0 on commit `1a890a9` with the tree clean (`dirty: false` in every result file). S1 to S12 are `pass` in all five, except S10, which is `skipped` at tier 1.5 as before. The isolation check was clean in all five (`isolation: clean.`, tripwire: no events).
- the tool: `S5.supervisor-tools` lists `factoryman_decide` among the five supervisor tools in all five files, `S9.start-tools` and `S9.tools-after-step` do too, and `S8.decide-wrong-state` passes in all five, so the real plugin refuses a decision on a working ship task on all four harnesses and with the stub. CLI versions: Claude Code 2.1.316, Codex 0.166.0, Pi 1.4.0, omp 18.18.3, stub 0.0.1.
- an earlier first run on `15de3f2` failed `S8.decide-wrong-state` (D-145, cycle 13). Its partial result was reverted, and it is not among the committed files.
- `docs/HARNESS-SUPPORT.md` was regenerated with `pnpm run conformance:docs`; it lists no known gap.
- limit (D-146): the lab has no no-mistakes pipeline, so no scenario reaches `needs_decision`, and the decision form was not opened in a real bb (T032).
