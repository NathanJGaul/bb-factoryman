---
feature: 013-factoryman-decide-tool
verdict: FAIL
standard: .specify/extensions/tdd/templates/tdd-test-quality-rubric.md
verified_at: 689ab24 # the first audit read 5971817; the addendum below re-checks 689ab24
behaviors: 66
proven: 48
likely: 0
test_after: 11
no_test: 0
not_applicable: 5
dropped: 1
live_pending: 0
high_smells: 0 # 4 found, cleared by T039 to T042 (see the addendum)
criteria_total: 39
criteria_covered: 39
mutation_score: n/a (no mutation tool in the profile)
mutants_survived: 0 of 41 deliberate mutants
suite: 2260 passed, 0 failed, 159 files, 46 s
---

# TDD verification: The `factoryman_decide` tool

**Verdict: FAIL.** Eleven behaviors have no red recorded before their code (test-after), and four test lines carry a HIGH smell.
Every one of the 41 deliberate mutants was killed, no existing test was weakened, and 38 of 39 criteria have a test through the real entry point.
The 39th (US5.6, the five offline conformance runs) is a live check that `/speckit.implement` runs next (task T025).

**This audit was not independent.**
The session that wrote the tests also ran this audit, so the audit re-read every file from disk.
The smell pass was delegated to a fresh-context subagent that read the new test files cold and returned findings only.
Every line it cited was opened and checked here before it reached this report.
Where the subagent and this session disagree, the finding says so.

## Test-first evidence

The history is one commit per green cycle, with the test and its code in the same commit (the repository's commit-at-green rule, D-099), so history can show the order of a cycle and the cycle log carries the red.
The cycle log and the history agree for every cycle: no log entry claims a red that the history contradicts.
One log entry was wrong and was corrected by a later entry (cycle 5 said "all files passed" when one flaky test had failed; the correction is in the log).

| Behaviors | Class | Evidence |
| --- | --- | --- |
| U1801 to U1803 | PROVEN | cycle 1: red against a stub, `a73dc72` adds the tests and the code together |
| U1813 to U1815 | PROVEN | cycle 2: red against a null stub and a permissive stub, `4bcc13f` |
| U1805, U1806, U1808 to U1812 | PROVEN | cycle 3: red against the old driver and a stub, `0d69850` |
| U1807 | TEST_AFTER | cycle 3: passed on its first run; mutant V21 kills it |
| A1816, U1824, U1825 | PROVEN | cycle 4: red on the old counts, `3f8c243` |
| U1816 to U1820 | PROVEN | cycle 5: red against stubs, `18820f6` |
| A1801 to A1804, U1821 to U1823 | PROVEN | cycle 6: red against the first `decide`, `247888b` |
| A1813 | TEST_AFTER | cycle 6: passed on its first run (the key line was cycle 3); mutant kills it |
| A1809 | PROVEN | cycle 7: red (`Test timed out in 5000ms`), `168de94` |
| A1805, A1806, A1807, A1808, A1810 | TEST_AFTER | cycle 7: passed on first run; 13 mutants (D-144) |
| A1811, A1812 | TEST_AFTER | cycle 8: passed on first run; 7 mutants (D-144) |
| U1828 to U1832 | PROVEN | cycle 9: red against an empty component, `ee4bd4b` (the one trivial pass, "no fix rows", is killed by V23) |
| U1833, A1814, A1821 | PROVEN | cycle 10: red, `0ad88a7` |
| A1815 | TEST_AFTER | cycle 10: passed on first run; mutant V22 kills it |
| U1834, U1835, U1837 to U1839, U1843 | PROVEN | cycle 11: red, `9380d1a` |
| A1817 | TEST_AFTER | cycle 11: passed on first run (it composes cycle 11); mutants C1 to C3 kill the parts |
| U1836, U1840 to U1842, A1819 | PROVEN | cycle 12: red, `5971817` |
| U1804 | NOT_APPLICABLE | characterization baseline, `driver.test.ts` `[U188]`, `[U189]`, `[U207]` |
| A1820, U1844, U1845, U1846 | NOT_APPLICABLE | covered by tests that existed before the feature |
| U1826 | DROPPED | merged into A1801 (reason in the list) |
| A1818 | PENDING | live check, T025 |

Totals: 48 PROVEN, 11 TEST_AFTER, 5 NOT_APPLICABLE (1 baseline and 4 covered by tests that existed before), 1 DROPPED, 1 PENDING (66 rows).

### Tests that existed before the feature

I diffed every existing test file against `9f87647` (`git diff -U0`, removed lines only).
Twenty tests and pins changed, all to a new truth that the feature creates: the tool counts (`[U33]`, `[U36]`, `[A17]`, `[U123]`, `[U121]`, `[U1312]`, `[A1313]`, `[A1602]`, `[A1]`), the wording ("four supervisor tools" to "five"), the renderer list `[A1201]`, the scenario lists `[U1389]`, `[U1395]`, `[U1709]`, `[U1651]` to `[U1654]`, `[U1710]`, the design and constitution pins `[A1710]`, `[A1618]`, the skill sentence `[A1105]`, and the evidence text `[U187]`.
In each, the new assertion is at least as strict as the old (a longer exact list, a sentence that contains the old one, or the old lines plus a final line).
No assertion was removed, loosened, skipped, renamed out of a filter, or excluded.
`vitest.config.ts`, `eslint.config.js`, `package.json`, and `tsconfig.json` did not change.
`test/acceptance/lint-isolation.test.ts` gained a `beforeAll` warm-up (the flake fix), and no assertion changed.

### Task checkboxes against the list

- T001 and T029 were ticked by the bookkeeping because their behavior ID (A1820) was `DONE`, but the leak measurement they ask for had not been made. Finding 9. It was made during this audit (below), and T029 is reopened in the remediation phase for the final `pnpm run check`.
- T026 shows a ticked task that names `[A1710]` and `[A1618]`, which are updates of existing tests and not rows of the list. The work is done; this is not a defect.
- No behavioral task is unticked with its behavior `DONE`.

Leak measurement: `${TMPDIR}` held 3159 `bb-fake-plugin-host-*` directories before one full `pnpm test` and 3159 after, and the count of entries went from 4057 to 4056. The feature adds none. The 3159 (and 1672 in `/tmp`) are old leftovers from before the private-`TMPDIR` fix (D-121) and are not this feature's.

## Findings

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | HIGH | Eleven behaviors are test-after: no red was recorded before the code that satisfies them. Each is proved able to fail by a deliberate mutant, and D-144 records the deviation. The rubric fails the feature for it, and the owner decides whether to waive it, as in D-099, D-107, D-116, D-122, D-133, and D-135. | A1805 to A1808, A1810 to A1813, A1815, A1817, U1807; cycle log cycles 6 to 11 |
| 2 | HIGH | Re-implemented expectation: the test compares the form payload and the `resolve` evidence with the output of `decisionRequest` and `decisionEvidence`, the functions that built them. A wrong function makes both sides wrong. Mitigated: `[U1819]` and `[U1820]` pin both functions with literals. It should assert literals too. | `src/tools/decide.test.ts:187`, `:189` |
| 3 | HIGH | Tautological assertion: `[U1839]` claims to pin the fake lab to "the real tool's wording" but checks that the lab returns the literal string it was written to return. S8 reads only `needs_decision` in the real text. If the real wording drifts, the fake lab and `[U1839]` stay green. The fix is in the lab (build the text from one exported function that the tool also uses) and in a literal assertion on the real tool. | `test/fixtures/conformance-lab.test.ts:146`, `test/fixtures/conformance-lab.ts` (`decide`) |
| 4 | HIGH | Conditional logic in a test: the shared `refused` helper checks the message only when `expected` is given. Every caller passes one today, so no run skips the check, but the rubric fixes the severity. | `test/acceptance/tools-decide.test.ts:144` |
| 5 | HIGH | Conditional logic in a test: a ternary picks the expected text inside a four-case loop. Every case still asserts. | `src/validator/driver.test.ts:89` |
| 6 | MED | `onCurrent` starts `apply("resolve")` with `void` and does not await it. It works because the in-memory store applies the event before its first await. | `src/tools/decide.test.ts:244` |
| 7 | MED | The test pins the constitution's whole version line, including the amendment date, so the next amendment breaks it. `[U1841]` and `[A1819]` also pin the same two facts twice. | `test/acceptance/decide-docs.test.ts:55`, `:57`, `:83` |
| 8 | LOW | Two tests share the ID `[U1837]` (S5 and S9), and a unit test uses the acceptance ID `[A1812]`. The ID no longer names one behavior. | `tools/conformance/scenarios/scenarios.test.ts:112`, `:174`; `src/tools/decide.test.ts:209` |
| 9 | MED | Two tasks (T001, T029) were ticked with no evidence for their own content (the leak measurement), because a behavior ID in their text was `DONE`. | `tasks.md` T001, T029; measured above |
| 10 | LOW | `[U1812]` asserts "at least two" `start` calls, which is weak but not vacuous: a `rerun` that did not apply `resolve` leaves the task in `needs_decision`, and the next step calls `status`, so the assertion on the state fails. The subagent called it vacuous; that is wrong, and the finding stays LOW. | `src/validator/driver.test.ts:326` |
| 11 | LOW | The list traces US5.3 (the factory registers six tools) to `A1818`, the live check. The tests that cover it are `[A17]`, `[U123]`, and `[U1825]`. | `tdd/test-list.md` row A1818 |
| 12 | LOW | Smaller items from the subagent, all verified: eager tests that join two behaviors with `cleanup()` and a second mount (`decision-approval-form.test.tsx:81`, `:123`; `test/acceptance/decision-approval-form.test.tsx:78`, `:108`); a `toBeTruthy` on a `getByText` result that already throws (`decision-approval-form.test.tsx:95`); `[U1825]` pins the key order of a schema (`register.test.ts:61`); `[A1804]` pins the full command string (`tools-decide.test.ts:131`). | as listed |

Items the subagent flagged that this audit judged consistent with the repository's own convention, so not findings:

- Class-name assertions in the form test (`font-mono`, `overflow-y-auto`): the merge form's exemplar test (`merge-approval-form.test.tsx` `[U1220]`, `[U1224]`) does the same, and jsdom cannot see styles, so the live check covers the look.
- A 30 ms real timeout through `approvalTimeoutMinutes: 0.0005`: the merge tests (`tools-merge.test.ts` `[A10]`) use the same device.
- `[U1813]` checks a constant against its literal: the merge exemplar does it for `MERGE_RENDERER_ID` (`[U1212]`), because the string is a contract with bb.
- Builders repeated in four test files: the existing driver test builds its own views the same way.

Checked and clean: no assertion-free test, no snapshot, no skipped or empty test, no credential, no `Date.now()` or random value in a test, no instruction addressed to an auditor in any file.

## Mutation results

The profile has no mutation tool, so the evidence is deliberate mutants.
Each mutant changes one thing in one source file, runs the tests of that area, and restores the file.
The cycle log holds the 24 mutants of cycles 6 to 11 (M1 to M13, R1 to R7, C1 to C3, and the A1813 mutant).
This audit ran 17 fresh ones, in a copy of the repository under the scratchpad, so the audited tree was never touched.

| Mutant | Behavior | Survived | Killed by |
| --- | --- | --- | --- |
| V1 skip the form when the project has `yolo` | A1806 | No | `[A1806]` |
| V2 add `--yes` to the answer command | A1804 | No | `[A1804]` |
| V3 offer Approve for an unreadable payload | U1830 | No | `[U1830]` |
| V4 offer the tool to a worker | A1816 | No | `[U34]` |
| V5 the key covers only the run ID | U1803 | No | `[A1808]` |
| V6 Deny submits an approval | U1831 | No | `[U1830]` |
| V7 the reader accepts an ID that no finding shows | U1815 | No | `[U1830]` |
| V8 the app drops the decision renderer | A1814 | No | `[A1814]` |
| V9 `current` reads the clone host and not the task's host | U1808 | No | `[U1808]` |
| V11 `resolve` is recorded when the validator rejects the answer | A1803 | No | `[U193]` |
| V16 the loop answers a gate by itself | U1844 | No | `[U192]` |
| V18 a thread with no role is offered the tool | A1816 | No | `[U35]` |
| V19 the rerun evidence loses the owner's approval | A1811 | No | `[A1811]` |
| V20 an unknown run ID is named `running` | U1802 | No | `[U1802]` |
| V21 the five-error park carries a key line | U1807 | No | `[U1807]` |
| V22 the app drops the merge renderer | A1815 | No | `[A1201]` |
| V23 the fix rows show for every answer | U1828 | No | `[U1828]` |

Sampled behaviors: the gates a criterion depends on (the form before an answer, `yolo`, `--yes`, the denial and the stale key), the registration, the key, the driver's three new paths, and the form's fail-closed rule.
Not sampled: the answer rules' every branch (the cycle log's R1 to R7 cover most), the document tests, and the conformance fake lab beyond C1 to C3.
Mutants sampled: 41 in total. Survived: 0. Coverage was not measured (the profile has no coverage tool).

## Traceability

| Criterion | Tests | End to end |
| --- | --- | --- |
| US1.1, US1.2, US1.4 | `A1801`, `U1821` | Yes (plugin factory) |
| US1.3 | `A1802` | Yes |
| US1.5 | `A1803`, `U1822` | Yes |
| US1.6 | `A1804`, `U180` (existing) | Yes (real adapter, recording runner) |
| US2.1, US2.3 | `A1814`, `U1828`, `U1831` | Yes (registered renderer) |
| US2.2, US2.4 | `A1821`, `U1830`, `U1832` | Yes |
| US3.1 to US3.5, US3.9, US3.10 | `A1805`, `U1816`, `U1817` | Yes |
| US3.6 | `A1806` | Yes |
| US3.7 | `A1807` | Yes |
| US3.8 | `A1808`, `U1823` | Yes |
| US3.11 | `A1809` | Yes |
| US3.12 | `A1810`, `U1809` | Yes |
| US4.1, US4.2 | `A1811`, `U1811`, `U1812` | Yes |
| US4.3 to US4.5 | `A1812`, `U1818` | Yes |
| US4.6 | `A1819` (D-141) | Yes (the log) |
| US5.1, US5.2 | `A1816`, `U1824` | Yes |
| US5.3 | `[A17]`, `[U123]`, `U1825` (finding 11: the list names A1818) | Yes |
| US5.4, US5.5 | `A1817`, `U1837`, `U1838`, `U1839` | Yes (conformance runner, fake lab) |
| US5.6 | `A1818` (live) | Pending: T025 |
| US6.1 to US6.4 | `U1836`, `U1840`, `U1841`, `U1842`, `A1819` | Yes (the tracked documents) |
| US6.5 | `A1820` (existing leak test, plus the measurement above) | Yes |

Untested criteria: US5.6 until the live runs happen.
Tests tracing to nothing: none; `U1844` to `U1846` trace to FR-015 and FR-023 through tests that existed before.

Real entry points: the plugin factory in the fake host (the tool), the registered renderer through `renderSlot` (the form), the conformance runner's `main` (the harness suite), and the tracked files (the documents).
This is an in-process integration layer. It does not show how the form looks, that a real bb draws the custom renderer, or what a real no-mistakes install does after a finished run (D-141, D-134).

## What was not audited

- The live conformance runs (T025) and the form in the isolated lab (T032) have not happened yet. A1818 is pending, and the look of the form is unseen.
- Mutation testing and coverage: the profile has neither tool. The deliberate mutants are a sample (41), not exhaustive.
- The answer rules' every branch and the document tests were not mutated beyond the cycle log's sample.
- Performance and load: no criterion and no test. The suite runs in about 70 s, and the new tests add under 5 s.
- Tests of other features were not re-audited. Only their changes were read.
- The subagent ran three of the audited files; this session ran the whole suite (2256 passed).

## Addendum: re-check after remediation and the live runs (commit 689ab24)

This addendum was written by the session that wrote the tests, so it is not independent.
The first audit above stays as it was, and its verdict is the one of record until the owner answers finding 1.

- Findings 2 to 8, 10, and 11 are fixed by T039 to T045 (commit `15de3f2`, and cycle 13 for the shared wording). Each fix keeps the suite green, and the suite grew from 2256 to 2260 tests. The four HIGH smells are cleared: the payload and evidence expectations are literals, the fake lab's text and the real tool's text come from one leaf module and are both pinned, the `refused` helper has a required `expected`, and the `[U1806]` loop is a table. The re-read of those lines is in the cycle log.
- Finding 9 is closed: the leak measurement was made (3159 before and 3159 after, twice), T001 and T029 are ticked on that evidence.
- US5.6 is covered: the five offline conformance runs exited 0 on commit `1a890a9` with a clean tree and a clean isolation check (cycle log, "Live check A1818"). They also found a defect that no offline test could see (D-145): S8 probed with a scout task. It is fixed.
- A mistake made while fixing finding 5 removed `[U195]` to `[U199]` for a few minutes; the suite count caught it, and the file was restored from git before any commit. No existing test is missing at `689ab24`: the removed-lines diff against `9f87647` lists only the tests that changed to a new truth.
- Finding 1 is open. Eleven behaviors are test-after (D-144). Each was proved able to fail by a deliberate mutant, and the audit ran 17 more. The rubric fails the feature for this, and the repository has accepted the same position as a waiver before (D-099, D-122, D-133, D-135). Task T047 stays open until Firstmate relays the owner's answer.
- Not audited again: the form's look in a real bb (D-146), and mutation beyond the 41 deliberate mutants.

**Verdict of record: FAIL, with one blocking finding (the test-after waiver), and every other finding cleared.**
