---
feature: 002-tools-events-validator
verdict: FAIL
standard: .specify/extensions/tdd/templates/tdd-test-quality-rubric.md # resolved from the extension copy; no override or preset file exists
verified_at: 495c1cb # short SHA audited (branch fm/bb-factoryman-milestones-4-6, range 2f108b0..495c1cb)
behaviors: 246 # 38 acceptance (A1-A38) and 208 unit (U1-U208)
proven: 235 # includes 17 whose "red" is a deliberate mutant, because the stub already satisfied the test
likely: 0
test_after: 11 # 6 admitted by the cycle log, 5 with no red and no discriminating mutant
no_test: 0
high_smells: 0 # by the smell catalogue; the can't-fail tests are reported as findings 3 and 4
criteria_total: 38
criteria_covered: 38 # every AC reaches a test through the plugin factory; AC-3.1 (A29) only weakly, and one spec edge case is uncovered (finding 1)
mutation_score: 47 # scope: 19 hand-picked deliberate mutants in 12 changed source files, no tool; 56 if the 3 equivalent mutants are excluded. Not a representative sample
mutants_survived: 10 # 3 equivalent, 7 not equivalent (findings 1, 2, 5, 6, 7, 11, 12)
suite: 604 passed, 0 failed, 10.7 s wall, 57 files; five runs green; lint and typecheck clean
---

# TDD verification: Tools and approval, event wiring, and the validator

**Verdict: FAIL.**
Two mutants that remove real guards survive the whole 604-test suite (cross-project teardown and the blank local-only base branch, which is a hard rule 2 fail-open), and 11 behaviors have no recorded red.

Everything else about the discipline is better than the verdict suggests.
The cycle log is contemporaneous (each commit carries its own log entry), every behavior in the list has a tagged test that exists and runs, and I reproduced the three outer-loop reds independently.
The failures are specific and cheap to fix, and they are listed as remediation tasks below.
I did not fix anything.

## Audit conditions

- Auditor: a fresh-context session that did not write these tests.
  I re-read the source and tests named in each finding.
  I read the cycle log and test list as claims and checked them against git and the files.
- The profile (`.specify/memory/tdd-profile.md`) has `coverage: null` and `mutation: null`.
  Test strength is measured with deliberate mutants only.
- `FEATURE_DIR` came from `.specify/scripts/bash/check-prerequisites.sh --json --paths-only`.
- Phase 7 deviation: the skill appends a remediation section to `tasks.md`.
  The invoker told me to change only this file, so I did not touch `tasks.md`.
  The remediation tasks are in the section below, ready to append.
  This is equivalent to `--no-tasks`.

## Test-first evidence

### What git shows

- All 25 feature commits from `f0206bb` to `3fb0598` add the test file and the source file in the same commit.
  No commit holds tests alone, and no commit holds a stub.
  The stub-then-red stage that the log describes for every cycle never reached history.
  Under the rubric this is still `PROVEN` when the log records a red, but git alone cannot show test-first order for any unit behavior.
- The only test-first commit pair is `64c4cba` (the layout test change, with the same author time, 17:57:28, as the C1 commit `f0206bb` that follows it).
- Commit times run from 17:57:28 to 18:33:08 on 2026-11-06 (about one commit per 1 to 2 minutes).
  Several cycles claim a red run, a green run, a full suite of about 10 s, a log entry, and 3 to 9 hand-run mutants each.
  That cadence is hard to square with the narrative cycle by cycle (finding 9).
- `git reflog` shows three amended commits: `4ede3b5` to `78afb4d`, `c362b44` to `5ca53d0`, and `cc53fce` to `eb552ec`.
  I diffed each pair.
  Each amend changed one line of `cycle-log.md` (a corrected mutant count) and nothing else.
  No test or source file changed in an amend.
- The cycle log and the test list state are committed with each cycle, not added at the end.
  That supports the claim that the log is contemporaneous.

### Independent reproduction of the outer-loop reds

I extracted each acceptance commit into a scratch directory (`git archive`, read only), swapped `src/server.ts` for the parent commit's version, and ran the acceptance files.

| Group | Commit tested against its parent `server.ts` | Log claim | Reproduced |
| --- | --- | --- | --- |
| H0, A1-A18 | `69c65cc` against `b39cf0d` | 18 failed | 18 failed, 0 passed |
| H1, A19-A28 | `551d2d2` against `5ca53d0` | 9 failed, 1 passed (A24 passes) | 9 failed, 1 passed |
| H2, A29-A38 | `a31278b` against `eb552ec` | 8 failed, 2 passed (A29, A38 pass) | 8 failed, 2 passed |

The counts match the log exactly.
This proves the committed tests were red against the previous code.
It does not prove they were written before the code, since both arrive in one commit.

### Classification

| Behaviors | Class | Evidence |
| --- | --- | --- |
| A1-A18 | PROVEN | H0 red recorded (cycle-log.md:236) and reproduced; tests and `server.ts` in `69c65cc` |
| A19-A23, A25-A28 | PROVEN | H1 red recorded (cycle-log.md:310-311) and reproduced; `551d2d2` |
| A24 | PROVEN (mutant) | Passed first run; "handlers match any thread" mutant fails A24 (cycle-log.md:312-313) |
| A30-A37 | PROVEN | H2 red recorded (cycle-log.md:394-395) and reproduced; `a31278b` |
| A29, A38 | TEST_AFTER | Passed on the first run; no mutant can break them (cycle-log.md:396, 403). See finding 4 |
| Every other unit behavior (U1-U208 except the rows below and the 17 mutant-as-red and 11 test-after behaviors named here) | PROVEN | Red recorded per cycle (C1-C23, L0); test and source in one commit each. Red is a stub that returns a wrong value or throws `not implemented` (C2, C3, C20 are "throws" reds, weaker) |
| U20, U35, U48, U67, U69, U73, U87, U139, U142, U144, U147, U148, U170, U200, U204, U205 | PROVEN (mutant) | Passed against the stub; a deliberate mutant makes the test fail (cycle-log.md lines 78-81, 125-128, 139-142, 156-158, 169-172, 223-225, 268-274, 340-341, 376-385). A mutant shows the test can fail. It does not show it failed before the code existed |
| U40, U120, U121, U122, U123, U124 | TEST_AFTER | Admitted: "written after the factory" (cycle-log.md:239, 307). Mutants were added later |
| U149, U155, U203 | TEST_AFTER | Passed first run, no mutant recorded (cycle-log.md:275 "U149 has no mutant"; line 290 for U155; line 386 "U203 has no mutant") |
| U10 (3 cases), U11 (2 cases), U208 | PROVEN | Existing or new tests changed first, red recorded (C19, L0, L1) |

Totals: 246 behaviors, 235 `PROVEN`, 0 `LIKELY`, 11 `TEST_AFTER`, 0 `NO_TEST`.
The `U35`-style mutant-as-red rows are counted `PROVEN` because the rubric accepts a recorded failure output, and a stub that already satisfies the test leaves no other red to record.
They are weaker than a true red and the log says so honestly.

### What the change did to tests that already existed

I diffed `2f108b0..495c1cb` for modified, deleted, or skipped tests.
Only two pre-existing test files changed.
No `.skip`, `.only`, `.todo`, config exclusion, threshold, or `vitest.config` or `eslint.config` change appears anywhere in the range.

1. `test/acceptance/layout.test.ts:12-17` (commit `64c4cba`, committed alone and first).
   Before: the forbidden list was `["src/tools", "src/dispatch", "skills"]`.
   After: `["src/dispatch", "skills"]`, and the test name gained `[U208]`.
   The removal is a rule change authorised by constitution 1.1.0 and D-032, listed as behavior U208, and the cycle log records the old rule failing.
   I do not count it as a weakening, but the rubric says to report it whatever the reason (finding 10).
2. `test/acceptance/plugin.test.ts` (commit `69c65cc`, the old A1 became A17).
   Removed assertions: `services` is empty, `settingsDescriptors` is `{}`, every hook is null, every thread-event handler count is 0, `cli` is null, and the log entries equal exactly one line.
   Added: the five tool names, the `factoryman` command, the four tables, and `user_version` 1.
   Services, settings, and handlers are now positively covered in `src/server.test.ts` (U122, U123).
   The "no hooks registered" assertion was dropped and has no replacement (finding 10).
   D-045 records the replacement.
3. `src/bb/adapter.test.ts` changed twice (`5ca53d0` for U11, `3fb0598` for U10).
   Both changes are in the log with red recorded.
   Each adds fields or a case and removes no assertion.

`tasks.md` against the list: every behavioral task is `[X]` and every behavior is `DONE`.
`T104` (this audit and its siblings) is correctly unticked.
No ticked task lacks a `DONE` behavior, and no `DONE` behavior has an unticked task.
Two task descriptions drift from the files (finding 13).

## Findings

Ordered by severity.

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | HIGH | Cross-project teardown is untested at every level. Removing the project check from `teardown` leaves all 604 tests green (mutant M13). A supervisor in project B can tear down project A's merged or failed task. The spec edge case "a tool call that names a task in another project is refused" (`spec.md:178`) and the contract (`contracts/tools.md:119`) require the refusal. `T031` says the authority test covers it; `A2` does not. Status (U66), merge (U105), and access (U22) each have their own cross-project test, so the gap is specific to teardown | `src/tools/teardown.ts:113`; `test/acceptance/tools-authority.test.ts:5-26`; `src/tools/teardown.test.ts` has no `proj-2` case |
| 2 | HIGH | The `local-only` base-branch guard for the landed-work check is only half tested. The guard rejects a null, blank, or `-`-prefixed base branch. Only the null case has a test (U76). Removing the blank and dash cases survives the full suite (mutant M7). This is a hard rule 2 fail-open: I confirmed in a scratch repository that `git rev-list --count ..HEAD` prints `0` while `main..HEAD` prints `1` for a branch with one unlanded commit. With a blank base, teardown would report zero unlanded commits. A `-x` base would reach `rev-list` as an option | `src/git/report.ts:191`; `src/git/report.test.ts:219-224` |
| 3 | HIGH | Six behaviors are test-after, by the log's own admission: U40, U120, U121, U122 (`cycle-log.md:239`) and U123, U124 (`cycle-log.md:307`). The rubric makes any `TEST_AFTER` behavior a `FAIL`. The later mutants show these tests bite, but they do not change the class. U124 (the 300-step random walk) is the only test that checks the replay-equals-cache invariant across tools and events together | `src/server.test.ts:12-135`; `cycle-log.md:239-244, 307-320` |
| 4 | HIGH | Five behaviors have no recorded red and no mutant that can break them: A29, A38, U149, U155, U203. A29 only asserts `typeof validator[op] === "function"` on values already typed as `Validator`, so the compiler gives the same assurance. A38 and U203 assert that the validator is never called after a fixed real sleep. They pass with the driver deleted. The log says no wiring mutant exists for them (`cycle-log.md:386, 403`). I confirmed the redundancy: removing the `WATCHED` check in `ensure` (mutant M19) survives all 604 tests, because `step` repeats the same check. U149 states it has no mutant (`cycle-log.md:275`). These tests are harmless regression guards, but they are not evidence that any code satisfies a requirement | `test/acceptance/validator-fake.test.ts:34-39, 134-146`; `src/validator/driver.test.ts:285-297`; `src/validator/driver.ts:62, 92` |
| 5 | MED | The merge method setting never reaches the executor under test. Replacing `rt.deps.settings().mergeMethod` with the constant `"squash"` survives the full suite (mutant M18). U122 only checks the setting is declared. U79/U80 give the executor its method directly. An owner who sets `rebase` would get a squash merge, silently. `T053` claims the tool reads the setting. The approval timeout has the equivalent test (U90 sets 4321 and reads it back), so the pattern exists | `src/tools/merge.ts:194`; `src/tools/merge.test.ts:50-53`; `src/git/merge.test.ts:60-76` |
| 6 | MED | A gate with no step name is meant to be unreadable (fail closed). Removing `step === ""` survives the full suite (mutant M12). The adjacent unreadable cases (empty output, bad TOON, unknown outcome, finding without ID) are tested; this branch is not. FR-304 and A35 say unreadable output advances nothing | `src/validator/toon.ts:40`; `src/validator/toon.test.ts:55-58` |
| 7 | MED | The merge form shows "the latest evidence that put the task in review". Replacing `findLast` with `find` survives the full suite (mutant M10). Every test has exactly one `validated` or `ready` row, so first and last are the same. After `request_changes` and a second validation, the owner would approve against stale evidence | `src/tools/merge.ts:163`; `src/tools/merge.test.ts:41-48` (U89 expects `"Pipeline finished."` with one candidate row) |
| 8 | MED | Sleepy and real-timer tests. Fixed real sleeps: `src/validator/driver.test.ts:292` (10 ms), `:308` and `:310` (15 ms each), `test/acceptance/validator-fake.test.ts:142` (20 ms), `src/tools/merge.test.ts:200` (0 ms tick). `test/acceptance/tools-merge.test.ts:62` uses a real 30 ms form timeout. `driver.test.ts:39` polls up to 400 times at 2 ms. The suite was stable over five full runs and the Notifier and driver take an injected `sleep`, so the risk is low today. The negative assertions after these sleeps (U203, A38, U204) pass vacuously if the sleep is too short | listed locations |
| 9 | MED | The unit-level red evidence rests on the self-reported cycle log. Git cannot show test-first for any unit cycle, since test and source land together (see "What git shows"). The cadence of one commit per 1 to 2 minutes, with each cycle claiming red, green, a full suite, several mutants, and a log entry, makes batching after the fact plausible. The log's reds could not be corroborated except for H0-H2. I found no contradiction, and the sample reproduction of H0-H2 matches to the digit, so this is a limit on trust and not a proven discrepancy | `git log --format='%h %ad' 2f108b0..HEAD`; reflog amends |
| 10 | LOW | Changed existing tests, reported as the skill requires. `layout.test.ts:12-17` shrank its forbidden list (justified by D-032 and own commit `64c4cba`). `plugin.test.ts` dropped `hooks` all null, `services` empty, `settingsDescriptors` empty, `threadEventHandlers` zero, and `cli` null. The hooks assertion has no replacement anywhere (`grep hooks src/server.test.ts` finds nothing). I did not count these as weakening because the old behavior ("registers nothing") no longer holds. The owner should confirm that reading, because the rubric makes a weakened existing test a `FAIL` on its own | `test/acceptance/layout.test.ts:12-17`; `test/acceptance/plugin.test.ts:5-30`; `cycle-log.md:3-27` |
| 11 | LOW | The 8000-character findings limit is unpinned. Setting `FINDINGS_LIMIT` to 1000 survives the full suite (mutant M8). U132 only proves limits above about 850 characters. A real review gate with many findings could exceed 1000 and be cut | `src/wiring/wake.ts:10`; `src/wiring/wake.test.ts:98-104` |
| 12 | LOW | The description line in `status` should come from an applied `start` row. Dropping the `outcome === "applied"` filter survives the full suite (mutant M9). No test has a refused `start` row with different evidence | `src/tools/status.ts:64`; `src/tools/status.test.ts:146-152` |
| 13 | LOW | Cycle log and tasks drift. The log's cycle names (C1-C23) do not match the plan's cycle table in `test-list.md:420-451` (the plan has C1-C24; for example the plan's C12 is `src/git/report.ts`, the log's C7). The log has no C11 or C16. `T087` names `src/validator/types.test.ts`, which does not exist (A29 lives in `validator-fake.test.ts`). `T031` promises a cross-project case that is not there (finding 1). Both tasks are ticked | `tasks.md` T031, T087; `cycle-log.md` headings |
| 14 | LOW | Test hygiene. Dead references kept to silence unused-import lint: `void defaultProjectConfig;` (`driver.test.ts:295`) and `void testRuntime;` (`driver.test.ts:339`). Needless `as never` casts on a parameter typed `unknown` (`report.test.ts:38, 41`). A fixture loop in `handlers.test.ts:7-25` branches on the requested state (it asserts the reached state, so it cannot hide a failure) | listed locations |
| 15 | LOW | Process note from the log. Cycle C19 records that a mutant run with a mistyped path left three mutants applied, and the author "rewrote `src/wiring/startup.ts` from the intended implementation" (`cycle-log.md:302-303`). That breaks the restore-exactly rule. The file now passes its tests and the acceptance tests, and git has only the final version, so I cannot check what the rewrite changed | `cycle-log.md:302-303` |
| 16 | LOW | The acceptance world replaces `exec` and the bb SDK with scripts. No acceptance test runs the real `runCommand`, a real git repository, or `gh`. Hard rule 2 and the local merge are verified in two halves: real git in `src/git/*.test.ts` and scripted git in the tool and acceptance tests. The profile already says the acceptance layer is in-process, and finding 2 shows what the seam can hide | `test/fixtures/plugin-host.ts:20-50`; `test/acceptance/tools-teardown.test.ts:6-11` |

Smell pass: I worked through the catalogue for all 39 new test files.
No `HIGH` catalogue smell was found: no assertion-free test, tautology, doubled subject, snapshot, skip, or conditional assertion.
Loops appear in table-style tests (U58, U94, U96, U125, U170, U171) and each iteration asserts with a label, so they do not decide what to assert.
The fakes (`test/fixtures/bb-port.ts`, `FakeValidator`) are hand-written and exercised by real code under test (Notifier, ValidationDriver, tools), so the "over-mocked" smell does not apply.
Several wake and driver tests assert on the fake's recorded calls, which is the observable behavior of those units.
`U62`, `U127`, and `U61` pin exact output text, which is implementation coupling at `MED` level but is the requirement for tool results.
Style matches the exemplar: explicit `vitest` imports, `[U/A id]` in names, shared fixtures, named exports.
All 246 behaviors have a tag in a test name; there is one untagged feature test (`src/tools/merge.test.ts`, "refuses a worker caller, a scout, and a wrong state with no form"), and the log says it is the unit twin of A14.
Suite time is 10.7 s for 604 tests.

## Mutation results

Method: one small edit per mutant, run the file for the behavior (`pnpm vitest run <file>`), copy the original back from a saved copy, and check `git diff --stat -- <file>` is empty.
For every survivor I also ran the whole suite with the same edit applied.
I did not repeat any mutant already in the cycle log.
Selection was adversarial: I read the tests first and picked guards I suspected were unpinned, so the score understates nothing and overstates nothing about the whole code base.
Nineteen mutants across twelve source files.

| # | Mutant | Behavior | Unit file result | Full suite | Judgment |
| --- | --- | --- | --- | --- | --- |
| M1 | `src/tools/report.ts:39` `mode === "no-mistakes"` to `mode !== "direct-PR"` (local-only gets `handoff`) | U56, A6 | Caught: U56 | n/a | Mode mapping is pinned |
| M2 | `src/tools/status.ts:87` drop `projectId` from `listTasks` | U66 | Caught: U66 | n/a | Project scoping of the list is pinned |
| M3 | `src/tools/dispatch.ts:128` remove the worker-caller refusal | U47 | Caught: U47 | n/a | Pinned |
| M4 | `src/wiring/wake.ts:37` send to the worker thread, not its parent | U125-U132 | Caught: 6 tests | n/a | Target selection is pinned |
| M5 | `src/bb/adapter.ts:133-134` delete the environment before archiving | U14 | Caught: U14 | n/a | Order is pinned |
| M6 | `src/validator/toon.ts:38` bare-name gate reads `""` | U173 | Caught: U173 | n/a | Pinned |
| M7 | `src/git/report.ts:191` drop the blank and dash checks, keep null | U76 | Survived | Survived | Not equivalent. Finding 2 (HIGH) |
| M8 | `src/wiring/wake.ts:10` `FINDINGS_LIMIT` 8000 to 1000 | U132 | Survived | Survived | Not equivalent. Finding 11 (LOW) |
| M9 | `src/tools/status.ts:64` drop `outcome === "applied"` | U68 | Survived | Survived | Not equivalent. Finding 12 (LOW) |
| M10 | `src/tools/merge.ts:163` `findLast` to `find` | U89 | Survived | Survived | Not equivalent. Finding 7 (MED) |
| M11 | `src/exec.ts:114` `shell: false` to `shell: true` | U1-U5 | Caught: all five fail | n/a | Pinned (even U1 fails, so the catch is partly incidental) |
| M12 | `src/validator/toon.ts:40` drop `step === ""` | none | Survived | Survived | Not equivalent. Finding 6 (MED) |
| M13 | `src/tools/teardown.ts:113` drop `sameProject` | none | Survived | Survived | Not equivalent. Finding 1 (HIGH) |
| M14 | `src/tools/merge.ts:183` delete the scout (`kind !== "ship"`) refusal | untagged scout test | Survived | Survived | Equivalent today. The state guard at line 184 refuses every state a scout can be in |
| M15 | `src/git/merge.ts:51` drop the blank and dash base checks | U83 | Survived | Survived | Equivalent today. Line 58 compares the base to `rev-parse --abbrev-ref HEAD` and refuses blank and dash values; only the message changes |
| M16 | `src/tools/merge.ts:182` drop `sameProject` | U105 | Caught: U105 | n/a | Pinned. The same mutation in teardown (M13) is not |
| M17 | `src/validator/driver.ts:68` `resumeAll` drops `needs_decision` | U202 | Caught: U202 | n/a | Pinned |
| M18 | `src/tools/merge.ts:194` merge method fixed to `"squash"` | none | Survived | Survived | Not equivalent. Finding 5 (MED) |
| M19 | `src/validator/driver.ts:62` drop the `WATCHED` check in `ensure` | U203, U205 | Survived | Survived | Equivalent today. `step` repeats the check at line 92. U203 cannot fail |

Score: 9 caught of 19 (47%), or 9 of 16 (56%) after removing the three equivalent mutants.
Seven non-equivalent survivors sit inside behaviors marked `DONE` or inside a documented requirement, which the rubric treats as `HIGH`.
I rated the ones with the smallest user impact (M8, M9) `LOW` on severity, but the rubric class is the same.

Recorded mutants in the cycle log were not repeated.
I did not verify them, and several are for gates (hard rules 1 and 2, the approval form) that I trust only as far as the log.
The C12 and C13 gate mutants are the ones most worth a second look if the owner wants more assurance.

Restore and green check: after every mutant `git diff --stat` for the file was empty.
After the last mutant, `pnpm test` and `git status --short` are recorded under "Final state".

## Traceability

The test list maps one acceptance behavior to each acceptance criterion.
I checked that every row's named file contains a test whose name starts with the behavior tag (no mismatch for any of the 246 rows), and that no test tag is missing from the list.
All 246 behaviors exist, run, and pass.

| Criteria | Behaviors | Entry point | End to end |
| --- | --- | --- | --- |
| AC-1.1 to AC-1.18 | A1 to A18 | `loadWorld` loads the real factory, real adapter, and real SQLite store in the fake plugin host. Tools are called with `callAgentTool` | Yes, in process. `exec` is scripted (finding 16) |
| AC-2.1 to AC-2.10 | A19 to A28 | The same world, with `emitThreadEvent`, `reload`, and `runService` | Yes, in process. A28 replays the real recorded bb payloads |
| AC-3.1 | A29 | Existence check on two objects | Weak (finding 4) |
| AC-3.2 to AC-3.9 | A30 to A37 | The world with `FakeValidator`. A36 uses the real `NoMistakesValidator` over recorded stdout | Yes, in process. The AC-3.8 `checks-passed` output is derived (D-049), not recorded |
| AC-3.10 | A38 | The world with `FakeValidator` | Passes vacuously (finding 4) |

Untested criteria: none by id.
Untested requirement: the cross-project refusal for teardown (`spec.md:178`, `contracts/tools.md:119`), which no A or U behavior names (finding 1).
Tests tracing to nothing: none.
One untagged unit test exists and is described by the log.

## Remediation tasks

The feature is not done until findings 1 to 4 are cleared.
Append this section to `tasks.md` after the invoker has approved it.
Each task names the command that proves it done.

```markdown
## Phase 7: TDD remediation

The feature is not done until R001 to R004 are complete (verification.md findings 1 to 4).

- [ ] R001 [US1] Finding 1: add a cross-project refusal test for teardown, red first, in `src/tools/teardown.test.ts` and in `test/acceptance/tools-authority.test.ts` (a supervisor with `projectId: "proj-2"` calls `factoryman_teardown` for a merged task of `proj-1`; expect a failure text, no `teardown` row, no `threads.archive`). Proof: `pnpm vitest run src/tools/teardown.test.ts test/acceptance/tools-authority.test.ts` passes, and the same two files fail with `src/tools/teardown.ts:113` reduced to `if (task === null)`
- [ ] R002 [US1] Finding 2: extend U76 in `src/git/report.test.ts:219` to cover a blank base (`""`, `"  "`) and a dash base (`"-x"`), each expecting an error result and no git call. Proof: `pnpm vitest run src/git/report.test.ts` passes, and fails with `src/git/report.ts:191` reduced to `input.baseBranch === null`
- [ ] R003 [US1] Finding 3: for U40, U120, U121, U122, U123, U124, either re-derive each test red against a stubbed factory in a recorded cycle-log entry, or record the TEST_AFTER class in `test-list.md` and accept the FAIL until the owner waives it. Proof: cycle-log entry with the red command and output per id
- [ ] R004 [US3] Finding 4: replace A29 with a behavior assertion (call each operation on the adapter with a fake runner and check the command line), and give A38/U203 a positive control (the same task in `no-mistakes` mode starts the validator in the same test) so they fail if the driver is not wired. Proof: `pnpm vitest run test/acceptance/validator-fake.test.ts src/validator/driver.test.ts`, and a mutant that registers the driver for every mode must fail A38
- [ ] R005 [US1] Finding 5: add a test that sets the `mergeMethod` setting to `rebase` and checks the `gh pr merge` argument list in `src/tools/merge.test.ts` and `test/acceptance/tools-merge.test.ts`. Proof: both files fail with `src/tools/merge.ts:194` fixed to `"squash"`
- [ ] R006 [US3] Finding 6: add a U170-style case for a gate with no step in `src/validator/toon.test.ts`. Proof: the file fails with `src/validator/toon.ts:40` reduced to `findings === null`
- [ ] R007 [US1] Finding 7: add a U89 case with two `validated` rows (a request_changes loop) and expect the later evidence in the form payload. Proof: `src/tools/merge.test.ts` fails with `findLast` replaced by `find`
- [ ] R008 [US3] Finding 8: replace the fixed sleeps at `src/validator/driver.test.ts:292, 308, 310`, `test/acceptance/validator-fake.test.ts:142` with `settle`-style waits on a positive condition. Proof: `pnpm test` stays green over 10 runs
- [ ] R009 [US1] Finding 10: restore a "registers no hooks" assertion in `test/acceptance/plugin.test.ts` or record in D-045 why it is gone. Proof: `pnpm vitest run test/acceptance/plugin.test.ts`
- [ ] R010 [US2] Findings 11 and 12: pin the findings limit above 1000 characters in `src/wiring/wake.test.ts:98` and add a refused-start case in `src/tools/status.test.ts:146`. Proof: both files fail with the matching mutants (M8, M9) applied
- [ ] R011 Findings 13 and 14: fix the `T031` and `T087` task text, align the cycle names between `cycle-log.md` and `test-list.md`, and delete the two `void` lines and the `as never` casts. Proof: `pnpm run lint && pnpm run typecheck && pnpm test`
- [ ] R012 Finding 9 and 16: add one acceptance test that runs `factoryman_teardown` against a real temporary git repository (the `test/fixtures/git-repo.ts` builders) with an unpushed commit, expecting the refusal. Proof: `pnpm vitest run test/acceptance/tools-teardown.test.ts`
```

## What was not audited

- Mutation was a hand-picked sample of 19 mutants in 12 files out of 25 new source files (plus the changed `src/server.ts`).
  There is no mutation tool, so there is no score for the whole feature.
  I did not mutate `src/wiring/handlers.ts`, `src/wiring/startup.ts`, `src/tools/register.ts`, `src/tools/supervisor-command.ts`, `src/bb/adapter.ts` beyond M5, `src/validator/no-mistakes.ts`, `src/validator/fake.ts`, `src/runtime.ts`, or `src/server.ts`.
  They may hold further survivors.
- I did not repeat or verify the mutants the cycle log already records.
  Hard rules 1 and 2 (the approval gate and the teardown check) rest on those log entries plus the tests I read.
- No coverage tool is installed (`coverage: null`), so no branch coverage corroborates the traceability.
- I reproduced the three outer-loop reds (H0, H1, H2) only.
  I did not reproduce any unit-cycle red, because the stubs the log describes were never committed and cannot be rebuilt without guessing.
- I did not run a real bb server, a real no-mistakes pipeline, or `gh`.
  The cycle log and `docs/DECISIONS.md` describe a live smoke test (`eb0e208`, `3fb0598`); I read the commit but did not repeat the run.
  The fixtures under `test/fixtures/recorded/` were not compared with a fresh recording.
- Milestone 1 to 3 tests are outside this feature and were only checked for modification (two files changed, both reported).
- Performance and load behavior: no criterion, no test, not assessed.
  The suite took 10.3 to 10.9 s over five runs on this machine; I did not stress it under CPU contention, so timing-based flakiness in the real-sleep tests (finding 8) is untested.
- Security review of the tool inputs (for example option injection through a configured branch prefix into `git merge`) is outside this audit.
  I noted only the base-branch case in finding 2.
- The `speckit.checklist`, `speckit.analyze`, and `speckit.converge` parts of `T104` were not run.

## Final state

Recorded after the last mutant was restored:

- `git diff --stat` is empty for all source and test files.
- `pnpm test`: 57 files, 604 passed, 0 failed.
- `git status --short`: only `specs/002-tools-events-validator/tdd/verification.md` is new.
