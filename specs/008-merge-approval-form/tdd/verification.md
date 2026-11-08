---
feature: 008-merge-approval-form
verdict: FAIL
standard: .specify/extensions/tdd/templates/tdd-test-quality-rubric.md # resolved from the extension copy; no override or preset file exists
verified_at: 497f69c # short SHA audited (branch fm/bb-factoryman-approval-form, range bbfdb15..497f69c)
behaviors: 55 # 21 acceptance (A1201-A1221) and 34 unit (U1201-U1213, U1220-U1240)
proven: 42 # red recorded in the cycle log, and the test lands in the same commit as its code
likely: 6 # written before the code, but passed against a stub: no individual red (U1202-U1205, U1207, U1210)
test_after: 5 # the code predates the test (A1215, U1236, U1238, U1239, A1212); each is disclosed in the log and killed by a deliberate mutant
no_test: 0
high_smells: 4 # findings 1 to 4. Findings 5 (test-after) and 6 (surviving mutants) are also HIGH, as process and strength findings
criteria_total: 19 # AC-1.1 to AC-5.4
criteria_covered: 19 # every AC reaches a test; AC-4.1 and AC-5.4 only partly automated (see Traceability)
mutation_score: 83 # 24 of 29 hand-picked deliberate mutants killed, no tool. Scope: src/app.tsx, src/app/merge-approval-form.tsx, src/approval/contract.ts. Not a representative sample
mutants_survived: 5 # M22, M26, M27, M28 are real gaps (findings 1, 2, 7); M29 is an equivalent mutant
suite: 1189 passed, 0 failed, 95 files; about 17 s of test time unloaded and 45 s while a subagent ran in parallel; pnpm run check (typecheck, lint, tests) exit 0
---

# TDD verification: Merge approval form in the web UI

**Verdict: FAIL.**
Two tests pass over a broken implementation: removing the link underline (U1240) and showing the wrong visible expiry date (U1235, A1213) both leave the suite green.
Five behaviors have tests that were written after their code.
The discipline is otherwise good: 42 of 55 behaviors have a recorded red and land with their test, the real plugin factory drives the acceptance tests, no existing test was weakened, and 24 of 29 hand-picked mutants of the form, the entry, and the contract are caught.
I wrote the code and most tests, so this audit is not independent. A fresh-context subagent did the smell pass and I opened every line it cited before it reached this report. I ran the suite, the history check, the mutants, and the traceability check myself.

## Test-first evidence

The repository's rule is "never commit on red", so no commit holds a test without its code. The git history therefore shows only that a test and its code arrived together. The order rests on the cycle log, which is self-reported. Every red below is a log entry, and a commit that holds the test and the code together is what the rubric accepts for `PROVEN`.

| Group (commit) | Behaviors | Class | Evidence |
| --- | --- | --- | --- |
| 1 (`91a3678`) | A1214 | PROVEN | red: `expected 'tsc --noEmit' to match /^tsc6/`; test and `package.json` change in one commit |
| 1 (`91a3678`) | A1215 | TEST_AFTER | `tsconfig.json` changed in `576154c`, before the test. The log says the red came from a temporary revert of the file. History shows the config first (finding 5) |
| 2 (`123dccc`) | A1221 | PROVEN | one of its three tests failed first. The other two passed on their first run (guards against over-restriction), and two mutants of the rule killed them |
| 3 (`31380ed`) | U1201, U1206, U1208, U1209, U1211, U1212 | PROVEN | 6 failed against the stub, with the failure lines recorded |
| 3 (`31380ed`) | U1202 to U1205, U1207, U1210 | LIKELY | written before the code, but they passed against a stub that returns `null` and drops the comment. The log says so. Six mutants of the finished module killed them |
| 4 (`78bd415`) | U1220, U1221, U1223 to U1226, U1229, U1230, A1201 to A1205, A1220 | PROVEN | 14 failed first, with failure lines. One red came from a broken fixture (`URL` under jsdom), fixed in `f2e5c5c` before the real red |
| 5 (`131e1c5`) | U1227, U1228, U1237, A1206 to A1208 | PROVEN | 6 failed first |
| 6 (`2a03c53`) | U1222, U1231 to U1235, A1209 to A1211, A1213 | PROVEN | 10 failed first |
| 6 (`2a03c53`) | U1236, U1238, U1239, A1212 | TEST_AFTER | the markup that they check (no `<form>`, wrapping classes, theme tokens) came in group 4. The log says they passed on first run. Seven mutants killed them (finding 5) |
| 7 (`452470c`) | A1216 to A1218 | PROVEN | 4 failed first (with the changed `[A1109]`) |
| 8 (`497f69c`) | U1240 | PROVEN (weak test) | `expected '' to contain 'underline'` failed first. The test is vacuous (finding 1) |
| 8 | A1219 | NOT_APPLICABLE | the live check in the lab is manual: no automated runner |
| list | U1213 | NOT_APPLICABLE | baseline: `src/tools/merge.test.ts::[U89]` was green before and stays green |

Discrepancies between the log and the history: none found. The log claims red counts (2, 1, 6, 14, 6, 10, 4, 1) that the test files fit, but only the log can show them.

Changes to tests that already existed, from `git diff bbfdb15 HEAD`:

- `test/acceptance/live-check.test.ts:98-99` (`[A1109]`): the positive assertion `toMatch(/bb factoryman preflight server --project \$PROJ/)` became `not.toMatch(/preflight server\b/)`. The old assertion pinned the defect that the live check found (finding 5.3), so this is a planned change and a tightening. `[A1216]` pins the positive form. Not weakened.
- `test/fixtures/skills.ts`: a `URL` object became a path string, so the plugin host loads under jsdom. No assertion changed.
- `test/acceptance/manifest.test.ts`, `test/acceptance/lint-isolation.test.ts`: lines were added, and only an import and a type were edited.
- No `skip`, `only`, `todo`, threshold, or exclusion appears in the range. `vitest.config.ts` only gained `*.test.tsx` in its include.

`tasks.md` against the test list: every ticked task has all of its behaviors `DONE`, and every unticked task with markers has a behavior that is not `DONE` (T1207 waits on the baseline `U1213`). No mismatch.

## Findings

Ordered by severity. Findings 1 to 4 were raised by the fresh-context subagent and confirmed by me at the cited lines. Findings 1 and 2 also came with a surviving mutant that I ran.

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | HIGH | `[U1240]` asserts `className` contains the substring `"underline"`, and the class `underline-offset-2` contains it. Removing the `underline` class leaves the test green. The commit that added the underline has no effective test. Should assert the exact `underline` token. | `src/app/merge-approval-form.test.tsx:166`; mutant M22 survived |
| 2 | HIGH | `[U1235]` and `[A1213]` check the `datetime` attribute and the `Expires ` prefix. They never read the visible date, though AC-3.5 says the form shows when it expires. The expected value is `new Date(expiresAt).toISOString()`, the same call the component makes (re-implemented expectation). Should compare to the literal `2026-11-08T15:30:00.000Z` and assert that the visible text names the year. | `merge-approval-form.test.tsx:250-251`, `test/acceptance/merge-approval-form.test.tsx:286`; mutant M28 survived (visible date shows 1970) |
| 3 | HIGH | `expect(button(name)).toBeTruthy()` after a `getByRole` that already throws when the element is missing. Vacuous. Should be `toBeEnabled()` where the point is that the button works, or deleted. | `merge-approval-form.test.tsx:158`, `:223-224` |
| 4 | HIGH | `[A1210]` asserts "no approvals, state `awaiting_approval`, one pending form" after a failed submit, but the test's own `submit` wrapper throws before it reaches `submitInteraction`. Those lines hold for any renderer that submits nothing (tautological). Should assert, after the retry, that exactly one approval row exists. | `test/acceptance/merge-approval-form.test.tsx:247-249` and the wrapper at `:62-65` |
| 5 | HIGH (process) | Five behaviors are `TEST_AFTER`: A1215 (config committed first), U1236, U1238, U1239, and A1212 (markup written in group 4, tested in group 6). Each is disclosed in the log, and a deliberate mutant kills each: the root becomes a `<form>`, `max-h-64`, `overflow-y-auto`, and `break-all` removed, a palette color added. The rubric fails a feature for any `TEST_AFTER`. The order cannot be rewritten. A re-proved red (the mutant output, kept verbatim in the log) moves them to `LIKELY`. | `tdd/cycle-log.md` groups 1 and 6 |
| 6 | HIGH (mutant) | Real surviving mutants that no behavior pins: **M26** removing `setFailure(null)` leaves a stale "Your answer was not sent" banner after a successful retry (AC-3.2 says the controls come back, and a retry that works must clear the error); **M27** replacing `UrlLink` with a plain `<a>` passes, though the plan requires `UrlLink` so that bb's open-in-app preference applies. Both need a behavior on the list and a test. | `merge-approval-form.tsx:76`, `:41` |
| 7 | MED | Tests check Tailwind class tokens (`font-mono`, `whitespace-pre-wrap`, `max-h-64`, `overflow-y-auto`, `break-words`, `break-all`). `max-h-64` to `max-h-[16rem]` fails them, and a user sees no change (implementation coupled). jsdom has no layout, so these are style guards at best, and the live check owns the look. `[U1239]` reads the component's source with a regular expression: it misses `border-t-red-500`, `shadow-red-500`, `text-[rgb(...)]`, and `style={{ color: "red" }}`, and it guards one file. | `merge-approval-form.test.tsx:34,36,59,274-286`, `acceptance:274-276` |
| 8 | MED | Several scenarios share one `it` with a mid-test `cleanup()`, and case loops sit inside one `it`. The first failure hides the rest, and the repository's exemplars use `it.each`, which names each case (eager test, assertion roulette, foreign style). | `contract.test.ts:20,26,34,53,65,72`; `merge-approval-form.test.tsx:40,73-88,127-143,170,181-196,218-242`; `acceptance:125-146,195-256`; `lint-isolation.test.ts:136-143`; `live-check.test.ts:289-326` |
| 9 | MED | Redundant tests: `[A1220]` repeats the `build` assertion at `manifest.test.ts:36`; `[A1216]` repeats `[A1109]`; `[A1203]` repeats `tools-merge.test.ts` `[A8]`; `[A1211]` to `[A1213]` repeat `[U1222]`, `[U1238]`, and `[U1235]` at the same level, and feed a made-up payload that the backend cannot send (the backend refuses a pull request outside the repository first); `[U1212]` pins the renderer id three ways. | `manifest.test.ts:56`; `live-check.test.ts:286`; `acceptance:118-122,258-290`; `contract.test.ts:97-101` |
| 10 | MED | The acceptance `mountRenderer` hand-builds the renderer's props, while `test/fixtures/approval-form.ts` (`formHarness`) provides them. `readyWorld`, `merges`, and `state` are copied from `tools-merge.test.ts`. | `acceptance:15-26,58-59` |
| 11 | MED | Framework under test: `contract.test.ts:77` checks that `zod` rejects a stray field (already pinned by `tools-merge` `[A11]`); `manifest.test.ts:43` checks that a file exists in `node_modules/.bin`. | `src/approval/contract.test.ts:77`, `test/acceptance/manifest.test.ts:43` |
| 12 | MED | `[A1214]`, `[A1215]`, and `[A1220]` pin script and config strings and never run the type check, which the list admits is manual (T1241). `include` containing `"src"` passes even with an added `exclude`. | `manifest.test.ts:39-57` |
| 13 | MED | The runbook tests (`[A1216]` to `[A1218]`) are phrase-presence checks, the same weakness that the audit of feature 007 raised: they cannot see an instruction that contradicts the text. I did not mutate the docs. | `live-check.test.ts:277-330` |
| 14 | LOW | One id reused for three tests (`[A1221]`, `lint-isolation.test.ts:120,128,136`); `[A1214]`/`[A1215]` names claim a type check that never runs; the `act(click)` block repeats about 14 times; `Date.UTC(2026, 10, 8, 15, 30)` and `1_700_000_000_000` are unnamed; the `inFlight` guard is untested (M29 is an equivalent mutant today, because `disabled` already blocks a second click); `.every(...)` booleans do not say which control failed. | various |

Properties: the suite is isolated (each test builds its world and cleans up), deterministic (no real clock, sleep, or randomness in the new tests), and fast (the tsx unit tests take about 0.6 s and the acceptance tests about 1.4 s). It is weak on refactor-insensitivity (findings 7 and 8) and mixed on specificity.

## Mutation results

No mutation tool is installed (the profile says `mutation: null`), so these are deliberate mutants, one at a time, each restored with `git checkout` and checked clean. After the run `git status` was empty and `pnpm run check` exited 0 (95 files, 1189 passed).
Scope: `src/app.tsx`, `src/app/merge-approval-form.tsx`, and `src/approval/contract.ts`, run against `src/app`, `src/approval`, and `test/acceptance/merge-approval-form.test.tsx`. 29 mutants, 24 killed, 83 percent. It is a sample of the highest-risk behaviors (what each button sends, fail-closed, in-flight, the link guard, the renderer id), not a representative one.

| Mutant | Behaviors that caught it | Result | Judgment |
| --- | --- | --- | --- |
| M01 Approve submits `denied` | A1203-A1205, A1208, A1210, U1225, U1226 | killed | |
| M02 Deny submits `approved` | A1206, A1207, A1209, U1227, U1231, U1234 | killed | |
| M03 Cancel submits a denial | A1208, A1209, U1228, U1232, U1234 | killed | |
| M04 Approve shown only for an unreadable request | 14 tests | killed | |
| M05 every value becomes a link | A1211, U1222 | killed | |
| M06 https only | U1221 | killed | |
| M07, M08 comment dropped on Deny or Approve | A1204, A1207, A1210, U1226, U1227, U1231 | killed | |
| M09 failure never shown | A1210, U1231, U1232 | killed | |
| M10 controls re-enable after success | U1229 | killed | |
| M11, M12, M13 comment field, Deny, or Approve stays enabled | A1205, U1229 | killed | |
| M14 expiry `datetime` wrong | A1213, U1235 | killed | |
| M15, M16 empty evidence or pull request shows nothing | U1223 | killed | |
| M17 `aria-busy` never set | U1229 | killed | |
| M18 unreadable notice not an alert | A1209, U1233 | killed | |
| M19 renderer registered under another id | A1201 to A1213 | killed | |
| M20 renderer registered twice | A1201 | killed | |
| M21 contract id changed | 15 tests | killed | |
| **M22** link loses its underline | none | **survived** | real: finding 1 |
| M23 evidence line breaks collapse | U1224 | killed | |
| M24 task id loses monospace | U1220 | killed | |
| M25 raw comment sent | A1204, U1226 | killed | |
| **M26** stale failure banner kept after a retry | none | **survived** | real: finding 6 |
| **M27** `UrlLink` replaced by a plain `<a>` | none | **survived** | real: finding 6 |
| **M28** visible expiry date wrong | none | **survived** | real: finding 2 |
| M29 in-flight guard removed | none | survived | equivalent today: the `disabled` buttons already block a second click, and React flushes a click's state before the next click (finding 14) |

In-loop mutants (recorded in the cycle log, groups 2, 3, and 6) also killed: six of the contract module, two of the lint rule, and seven of the form. I re-ran none of them in this audit.

## Traceability

| Criterion | Behaviors | End to end |
| --- | --- | --- |
| AC-1.1 | A1201 | Yes: plugin factory plus the registered renderer, in process |
| AC-1.2 | A1202, U1220, U1221, U1223, U1224, U1240 | Yes |
| AC-1.3, AC-1.4, AC-1.5 | A1203, A1204, A1205 and units | Yes |
| AC-2.1, AC-2.2, AC-2.3 | A1206, A1207, A1208 and units | Yes |
| AC-3.1, AC-3.2, AC-3.3 | A1209, A1210, A1211 and units | Yes, with the findings 4 and 9 caveats |
| AC-3.4 | A1212, U1238 | Class tokens only; the real fit is the live check |
| AC-3.5 | A1213, U1235 | The visible date is unasserted (finding 2) |
| AC-4.1 | A1214 | Partly: the test pins the script and the binary. The real run under `env -i` is a logged manual run (T1241) |
| AC-4.2 | A1215 | Config strings only (finding 12) |
| AC-5.1, AC-5.2, AC-5.3 | A1216, A1217, A1218 | Yes: the entry point is the document, as in feature 007 (finding 13) |
| AC-5.4 | A1219 | Manual: the lab run, with 19 screenshots, a report, and database rows quoted in the log. I did not repeat it |

Every acceptance criterion reaches a test, and every `traces` value resolves to a test that exists (a mechanical check found a test marker for all 53 behaviors that have an automated test (A1219 is manual); `U1213` points at `src/tools/merge.test.ts` `[U89]`, which exists and asserts the renderer id, task, branch, pull request, and evidence). SC-1202 and SC-1204 are not in any `traces` column: A1203 and A1214 cover them. Tests that trace to nothing: none.
The acceptance layer is an in-process integration test, and the profile says so. It is not a browser test.

## What was not audited

- Mutation was by hand on three files. No mutation tool is installed, so there is no score for `eslint.config.js`, the docs tests, or the fixtures. I did not mutate the runbook or the decision log (finding 13).
- Coverage: no coverage tool is installed.
- The live check in the lab (A1219) was not repeated. I read its report and screenshots as evidence, and I made them, so that is not independent either.
- The red evidence in the cycle log was not reproduced: I did not check out earlier commits, because no commit holds a red state. The log's failure lines are the only record.
- `pnpm run build` and `bb plugin build` are not part of the suite. The lab built the plugin twice, and `dist/app.js` came to 8.4 KB with no `zod`.
- Performance under load, a real person's click, and cross-browser behavior: no criterion, no test.
- `T1207` (making `src/tools/merge.ts` import the contract module) is still open, so `merge.ts` keeps its own copy of the renderer id. `[A1201]` and `[U1211]` pin that both sides agree.
