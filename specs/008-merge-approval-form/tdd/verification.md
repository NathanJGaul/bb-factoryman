---
feature: 008-merge-approval-form
verdict: FAIL
standard: .specify/extensions/tdd/templates/tdd-test-quality-rubric.md # resolved from the extension copy; no override or preset file exists
verified_at: 579b982 # short SHA audited (branch fm/bb-factoryman-approval-form, range bbfdb15..579b982). This is the second run; the first graded 497f69c
behaviors: 57 # 21 acceptance (A1201-A1221) and 36 unit (U1201-U1213, U1220-U1242)
proven: 42 # red recorded in the cycle log, and the test lands in the same commit as its code
likely: 6 # written before the code, but passed against a stub: no individual red (U1202-U1205, U1207, U1210)
test_after: 7 # the code predates the test (A1215, U1236, U1238, U1239, A1212, U1241, U1242). Each has a recorded revert-red and is killed by a deliberate mutant
no_test: 0
high_smells: 0 # none open. Two were found in this run (a trimming mutant and a scheme look-alike survived) and were closed in 579b982
criteria_total: 19 # AC-1.1 to AC-5.4
criteria_covered: 19 # every AC reaches a test; AC-4.1 and AC-5.4 only partly automated (see Traceability)
mutation_score: 100 # 45 of 45 hand-picked deliberate mutants killed, no tool. Scope: src/app.tsx, src/app/merge-approval-form.tsx, src/approval/contract.ts. Not a representative sample
mutants_survived: 0 # the first run had 5 survivors, and the fresh-context subagent of this run found 10 on its own set; all were closed or judged low value (see Mutation results)
suite: 1310 passed, 0 failed, 95 files, 18 s of test time; pnpm run check (typecheck, lint, tests) exit 0
---

# TDD verification: Merge approval form in the web UI

**Verdict: FAIL.**
One rule still blocks: seven behaviors have tests that came after their code (A1215, U1236, U1238, U1239, A1212, U1241, U1242), and the rubric fails a feature for any `TEST_AFTER`.
Everything else is clean: no `HIGH` smell is open, 45 of 45 deliberate mutants are killed, every acceptance criterion reaches a test, and no existing test was weakened.
The seven are guard tests for properties that the code already had.
Each has a recorded revert-red in the cycle log (the property removed, the test failing, the file restored) and a mutant that kills it.
The order cannot be rewritten, because the repository's rule is to commit only on green, so the history shows each test and its code in one commit, or the code first.
I wrote the code and most tests, so this audit is not independent.
A fresh-context subagent did the smell pass in both runs, and I opened every line it cited before it reached this report.

This run corrects one claim of the first run.
Its remediation task T1284 said that re-proving the red would move the five test-after behaviors to `LIKELY`.
The rubric says `TEST_AFTER` applies when "history shows the source change landing in an earlier commit than its test", whatever the log holds.
The retroactive reds are good evidence of strength, and they do not change the class.
The decision whether to accept these seven as a documented exception belongs to the owner, and I did not weigh it into the verdict.

## Test-first evidence

The history cannot show a test before its code, because no commit holds a red state.
A test and its code arrived together (`PROVEN` when the log holds the red), or the code came first (`TEST_AFTER`).
The log is self-reported.

| Group (commit) | Behaviors | Class | Evidence |
| --- | --- | --- | --- |
| 1 (`91a3678`) | A1214 | PROVEN | red: `expected 'tsc --noEmit' to match /^tsc6/`; test and `package.json` change in one commit |
| 1 (`91a3678`) | A1215 | TEST_AFTER | `tsconfig.json` changed in `576154c`, before the test. The red came from a temporary revert (group 1), and a second one is in the retroactive-red entry |
| 2 (`123dccc`) | A1221 | PROVEN | one of its tests failed first; the two guard tests were killed by two mutants of the rule |
| 3 (`31380ed`) | U1201, U1206, U1208, U1209, U1211, U1212 | PROVEN | 6 failed against the stub, failure lines recorded |
| 3 (`31380ed`) | U1202 to U1205, U1207, U1210 | LIKELY | written before the code, but they passed against a stub that returns `null` and drops the comment. The log says so, and six mutants of the finished module kill them |
| 4 (`78bd415`) | U1220, U1221, U1223 to U1226, U1229, U1230, A1201 to A1205, A1220 | PROVEN | 14 failed first, with failure lines. One red came from a broken fixture (`URL` under jsdom), fixed in `f2e5c5c` before the real red |
| 5 (`131e1c5`) | U1227, U1228, U1237, A1206 to A1208 | PROVEN | 6 failed first |
| 6 (`2a03c53`) | U1222, U1231 to U1235, A1209 to A1211, A1213 | PROVEN | 10 failed first |
| 6 (`2a03c53`) | U1236, U1238, U1239, A1212 | TEST_AFTER | the markup they check came in group 4. Retroactive reds with verbatim failure lines: log entry "Retroactive red" (`5a59679`) |
| 7 (`452470c`) | A1216 to A1218 | PROVEN | 4 failed first (with the changed `[A1109]`) |
| 8 (`497f69c`) | U1240 | PROVEN | `expected '' to contain 'underline'` failed first. The test was vacuous in the first run and is exact now |
| 9 (`c52f6f7`) | U1241, U1242 | TEST_AFTER | both behaviors existed. The log records a revert-red for each (`expected <p role="alert" …> to be null`, `expected [] to deeply equal [ { method: 'openUrl' … } ]`) |
| 8 | A1219 | NOT_APPLICABLE | the live check in the lab is manual: no automated runner |
| list | U1213 | NOT_APPLICABLE | baseline: `src/tools/merge.test.ts::[U89]` was green before the contract refactor (`79b9b2b`) and stays green |

Discrepancies between the log and the history: none found, apart from the log's own correction notes (the `[U1236]` mutant that was a syntax error, and the string replace that misplaced the `[U1239]` tests; both are logged).

Changes to tests that already existed, from `git diff bbfdb15 HEAD`:

- `test/acceptance/live-check.test.ts` `[A1109]`: the positive assertion `toMatch(/bb factoryman preflight server --project \$PROJ/)` became `not.toMatch(/preflight server\b/)`, and in this run's fix every `preflight` call must now name `"$MACHINE"`.
  The old assertion pinned the defect that the live check found (finding 5.3).
  Not weakened.
- `test/fixtures/skills.ts`: a `URL` object became a path string, so the plugin host loads under jsdom.
  No assertion changed.
- Assertions that the feature's own tests lost after the first audit, each tied to a finding: `toBeTruthy` after `getByRole`, three tautological lines of `[A1210]`, the `node_modules/.bin/tsc6` file check of `[A1214]`, the `zod` stray-field assertion of `[U1210]`, and four repeated assertions.
  Each was replaced by a stronger one or was a repeat of another test.
  The `.bin/tsc6` check is the one real loosening: `pnpm run check` fails without `tsc6`, so the gate still covers it.
- No `skip`, `only`, `todo`, threshold, or exclusion appears in the range.

`tasks.md` against the test list: every ticked task has all of its behaviors `DONE`, and no task is unticked while its behaviors are `DONE`.
Two ticked tasks do not fit the rule, and both are explained: `T1207` (its marker `[U1213]` is a baseline, and the loop never ticks a baseline's task, so I ticked it by hand after the refactor) and `T1288` (its text cites the existing test `[A1109]`, which is not on the list).

## Findings

Findings 1 to 4 are from the fresh-context subagent of this run, and I confirmed each at the cited lines.
The subagent ran the mutants of findings 1 and 2 (M35, M36) before they were fixed.
I did not re-run them on the old tests, and I confirmed that the fixed tests kill them.
The subagent's own mutant run stopped early, because `/tmp` hit its per-user quota (`EDQUOT`), so I ran the rest of the mutants myself.

| # | Severity | Finding | Evidence | Status |
| --- | --- | --- | --- | --- |
| 1 | HIGH | A form that trims its field on every change would make a space impossible to type, and every test passed, because the answer is trimmed anyway. | `src/app/merge-approval-form.test.tsx` `[U1226]`, `acceptance` `[A1204]`; mutant M35 | closed in `579b982`: both assert the field keeps the typed text; M35 now fails them |
| 2 | HIGH | `protocol.startsWith("http")` would render `httpx://...` as a link, against FR-1207 (MUST). Only five non-web values were tried. | `[U1222]`, `[A1211]`; mutant M36 | closed in `579b982`: `httpx://` and `http-x://` added; M36 now fails both |
| 3 | MED | No test pinned the in-flight guard: the second click of the old test landed on a disabled button. | `[U1230]`; mutant M29 | closed in `579b982`: two clicks in one batch; M29 now fails |
| 4 | MED | My own defect: three `[U1239]` tests sat at the top of the unit test file, before the `// @vitest-environment jsdom` line and outside any `describe`, and the older, weaker `[U1239]` test was still there. | `merge-approval-form.test.tsx:1-18` of `6e3daaf` | closed in `579b982` |
| 5 | MED | `[A1109]` accepted any hard-coded machine name except two. | `live-check.test.ts:98-100` | closed: every `preflight` call names `"$MACHINE"` |
| 6 | MED | Names that claim more than they check: `[A1214]` (the binary), the list row of `[U1210]` (a stray field). | `manifest.test.ts`, `tdd/test-list.md` | closed: renamed, rows corrected |
| 7 | MED | The tests pin Tailwind class tokens (`font-mono`, `max-h-64`, `break-all`, and others) and scan the component's source for colors. `max-h-64` to `max-h-96` fails them with no change that a user sees. jsdom has no layout, so these are proxies, and the lab owns the look. | `merge-approval-form.test.tsx` `[U1220]`, `[U1238]`, `[U1239]`, `acceptance` `[A1212]` | open, accepted: labelled as class-token proxies |
| 8 | MED | The docs tests (`[A1217]`, `[A1218]`) check phrases, so a sentence that contradicts the text can still pass. Order and status checks were added in this run (a swap of the two sentences and a `Decided` status both fail). | `live-check.test.ts` | open, accepted |
| 9 | MED | Several tests still cover more than one assertion about one scenario (`[U1229]`, `[A1205]`, `[A1208]`, `[A1210]`). `[U1231]` was split. They are single flows, and their names say so. | various | open, accepted |
| 10 | LOW | `[A1211]` to `[A1213]` repeat `[U1222]`, `[U1238]`, and `[U1235]` through the app's registry with payloads that the backend cannot send; `mountRenderer` keeps its own `submitted` array instead of the harness spy; `[U1235]` pins the year and not the time of day (the visible text is locale text); `[U1236]` cannot trigger a native submit under jsdom, so the `<form>` and `tagName` checks are the real guard. | various | open, accepted |

Properties: the suite is isolated (each test builds its world and cleans up), deterministic (no real clock, sleep, or randomness), and fast (the six audited files take about 2.5 s).
Failures name the case or the control now (`it.each`, `disabledControls()`).
It is weak on refactor-insensitivity (findings 7 and 8).

## Mutation results

No mutation tool is installed (the profile says `mutation: null`), so these are deliberate mutants, one at a time, each restored with `git checkout` and checked clean (`git diff --quiet` on the component, the entry, and the contract, and an empty `git status` apart from the intended test changes).
The gate afterwards: `pnpm run check` exited 0 (95 files, 1310 passed).
Scope: `src/app.tsx`, `src/app/merge-approval-form.tsx`, and `src/approval/contract.ts`, run against `src/app`, `src/approval`, and `test/acceptance/merge-approval-form.test.tsx`. 45 mutants, 45 killed.
It is a sample of the highest-risk behaviors (what each button sends, fail-closed, in-flight, the link guard, the comment, the renderer id, the payload reader, and the answer builder), not a representative one.

| Mutants | Killed by | Judgment |
| --- | --- | --- |
| M01 to M03 swapped decision, Deny sent as Approve, Cancel submits a denial | A1203 to A1210, U1225 to U1228, U1231 to U1234 | killed |
| M04, M30 Approve shown only (or always) for an unreadable request | A1209, U1233, and others | killed |
| M05, M06, M36 every value, https only, or `startsWith("http")` becomes a link | A1211, U1221, U1222 | killed (M36 was a survivor before `579b982`) |
| M07, M08, M25, M35 comment dropped, raw comment sent, or the field trims what is typed | A1204, A1207, A1210, U1226, U1227, U1231 | killed (M35 was a survivor) |
| M09, M26, M31, M37 failure never shown, stale banner kept, no alert role, fixed text for a non-Error | A1210, U1231, U1232, U1241 | killed (M26 and M37 were survivors) |
| M10 to M13, M33 controls re-enable after success, or one control stays enabled while sending | A1205, U1229 | killed |
| M29 in-flight guard removed | U1230 | killed (survivor before `579b982`) |
| M14, M28, M32 expiry `datetime` wrong, visible date wrong, line shown when none | A1213, U1235 | killed (M28 was a survivor) |
| M15, M16 empty evidence or pull request shows nothing | U1223 | killed |
| M17, M38 `aria-busy` never set, or never cleared | U1229 | killed (M38 is new) |
| M18 unreadable notice not an alert | A1209, U1233 | killed |
| M19 to M21 renderer id changed or registered twice | A1201 to A1213, U1212, U89 | killed (a changed contract constant now moves both sides together, so only the literal-id tests fail, as intended) |
| M22 link loses its underline | U1240 | killed (survivor before `4c0eccd`) |
| M23, M24, M39 evidence breaks collapse, task id loses monospace, pull request cell loses `break-all` | U1224, U1220, U1238 | killed |
| M27 `UrlLink` replaced by a plain anchor | U1242 | killed (survivor before `c52f6f7`) |
| M34 comment label detached | U1237 | killed |
| C01 to C06 payload reader (field count, type check, null) and answer builder (undefined key, trim, stray field) | U1202 to U1210 | killed |

The first pass of M01 to M08 in this run ran while the `/tmp` quota failure was active and failed whole files for the wrong reason.
I ran those eight again alone, and they are killed for the right reason (7 to 25 tests, all in the expected files).
Not killed and not closed, judged low value: dropping `timeStyle: "short"` from the visible date, changing the failure prefix text, and rewording the unreadable notice while keeping the word "unreadable".
The subagent found them.
They are copy and locale text, and pinning them would couple the tests to wording.

## Traceability

| Criterion | Behaviors | End to end |
| --- | --- | --- |
| AC-1.1 | A1201 | Yes: plugin factory plus the registered renderer, in process |
| AC-1.2 | A1202, U1220, U1221, U1223, U1224, U1240, U1242 | Yes |
| AC-1.3, AC-1.4, AC-1.5 | A1203, A1204, A1205 and units | Yes |
| AC-2.1, AC-2.2, AC-2.3 | A1206, A1207, A1208 and units | Yes |
| AC-3.1, AC-3.2, AC-3.3 | A1209, A1210, A1211 and units, U1241 | Yes |
| AC-3.4 | A1212, U1238 | Class tokens only; the real fit is the live check |
| AC-3.5 | A1213, U1235 | The visible date is asserted to the year (finding 10) |
| AC-4.1 | A1214 | Partly: the test pins the script and the `check` script. The real run under `env -i` is a logged manual run (T1241) |
| AC-4.2 | A1215 | Config strings: `include`, `exclude`, `jsx`, `DOM` (case-insensitive) |
| AC-5.1, AC-5.2, AC-5.3 | A1216, A1217, A1218, and `[A1109]` | Yes: the entry point is the document, as in feature 007 (finding 8) |
| AC-5.4 | A1219 | Manual: the lab run, with 20 screenshots, a report, and database rows quoted in the log. I did not repeat it |

Every acceptance criterion reaches a test, and every `traces` value resolves to a test that exists (a mechanical check found a test marker for all behaviors that have an automated test; `A1221` now has the suffixed ids `[A1221a]` to `[A1221c]`, and the list names all three; `U1213` points at `src/tools/merge.test.ts` `[U89]`, which exists).
Tests that trace to nothing: none.
The acceptance layer is an in-process integration test, and the profile says so.
It is not a browser test.

## What was not audited

- Mutation was by hand on three files.
  No mutation tool is installed, so there is no score for `eslint.config.js`, the docs tests, or the fixtures.
  `src/tools/merge.ts` was not mutated, and the subagent's own run did not reach it either.
- The subagent's mutant run of this audit stopped early because `/tmp` hit its quota.
  It ran 52 mutants of the component, and 19 more for the contract, the entry, and the merge tool did not run.
  I ran the contract and the entry mutants myself (C01 to C06, M19 to M21).
- Coverage: no coverage tool is installed.
- The live check in the lab (A1219) was not repeated.
  I read its report and screenshots as evidence, and I made them, so that is not independent either.
  The lab ran the component as committed in `497f69c`.
  Since then only tests changed, plus a type-only move of the renderer id and the payload type from `src/tools/merge.ts` into the contract module (`79b9b2b`).
  The form itself did not change.
- The red evidence in the cycle log was not reproduced: I did not check out earlier commits, because no commit holds a red state.
  The log's failure lines are the only record.
- Performance under load, a real person's click, and cross-browser behavior: no criterion, no test.

## Owner decision on the verdict

The captain accepted the seven `TEST_AFTER` behaviors as a recorded deviation (D-099, 2026-11-08), as for the earlier factoryman milestones.
They are guard tests that fail against the code without the guard (the revert-reds and the mutants above).
The verdict above stays `FAIL` as the rubric computes it, because an auditor does not accept an exception.
The exception is the owner's call, and the owner has made it.

