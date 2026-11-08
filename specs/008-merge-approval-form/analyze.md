# Analysis: merge approval form in the web UI

**Run**: after `/speckit.tdd.run`, `/speckit.tdd.verify` (twice), the audit remediation, and `/speckit.checklist`.
**Inputs**: `spec.md`, `plan.md`, `tasks.md`, `tdd/*`, `checklist.md`, the constitution, `docs/DECISIONS.md`, and the code at `HEAD` (`53a1e8b`).
**Method**: a read of each artifact against the code, and the counts in `tdd/test-list.md`.
This report only reads.
I wrote the spec, the plan, the tasks, and the code, so the analysis is not independent.

## Summary

The artifacts agree with the code, with one open constitution finding.
Constitution principle V says that every behavior change is driven by a test that failed first.
Seven guard tests came after their code (D-099), so the second TDD audit stays at `FAIL`, and this analysis counts it as critical, as the rules require.
The finding is recorded, mitigated, and waits for the owner's decision.
Everything else is consistent: every requirement has a task and a behavior, no placeholder is left, and the plan's risks all resolved in the lab.

| Check | Result |
| --- | --- |
| Functional requirements traced to a task and a behavior | 12 of 12 (FR-1201 to FR-1212) |
| Success criteria that need work, traced to a task | 6 of 6 (SC-1201 to SC-1206) |
| Acceptance scenarios traced to a behavior | 19 of 19 (AC-1.1 to AC-5.4) |
| Behaviors in the test list | 21 acceptance (`A1201` to `A1221`) and 36 unit; 56 `DONE` and 1 `BASELINE` (`U1213`) |
| Tasks | 50, with 1 open (`T1271`, this lifecycle's close-out) |
| Constitution principles with a violation | 1 (V, finding C1) |
| Deviations recorded | D-094 to D-099 |
| Suite | 95 files, 1310 tests, `pnpm run check` exit 0 |

## Findings

| ID | Category | Severity | Location | Summary | Recommendation |
| --- | --- | --- | --- | --- | --- |
| C1 | Constitution | Critical (recorded, mitigated) | constitution V, D-099, `tdd/verification.md` | Seven behaviors (`A1215`, `U1236`, `U1238`, `U1239`, `A1212`, `U1241`, `U1242`) have tests that came after their code. Each guards a property that already existed and has a revert-red in the cycle log and a killing mutant. The history cannot show the order, because the repository commits only on green. | The owner accepts the seven as a documented exception, or rejects it. The analysis cannot dilute the principle, so it stays open until the owner decides. |
| U1 | Coverage | Medium | spec FR-1209, `tasks.md` T1210 to T1232 | "Keyboard operable" has no automated test. The lab checked the Tab order (link, comment field, Approve, Deny, Cancel) and the focus ring by hand (`16`, `17`), and every control is a native `<button>` or `<textarea>`. | Accept: jsdom cannot move focus the way a person does, and tier 2 holds a person's keyboard check. |
| U2 | Underspec | Low | spec edge cases | Two edge cases (a CLI answer while the form is open, and a request that times out while the form is open) have no test. The spec says that bb settles the request and the plugin has nothing to handle. | Accept: nothing in the plugin runs in those cases, and the backend already reports a timeout (`tools-merge` `[A10]`). |
| U3 | Underspec | Medium | spec SC-1206, `checklist.md` CHK1206 | The screenshots that prove SC-1206 sit outside the repository (`data/bb-factoryman-approval-form/` in the firstmate home), so a reviewer of the pull request cannot open them from the branch. | Keep the path in the cycle log and the checklist (done). Firstmate links the report from the pull request. |
| I1 | Inconsistency | Low | `plan.md` source layout | The layout does not list `test/fixtures/approval-form.ts` (new), the `test/fixtures/skills.ts` change (a path in place of a URL object), or `docs/DECISIONS.md` D-099. The plan listed D-094 to D-098 only. | Accept: the plan records the intent, and `tasks.md`, the cycle log, and the decision log record the rest. |
| I2 | Inconsistency | Low | `spec.md` assumptions | The first assumption says that the live check settles the split between bb's frame and the plugin's body. The lab settled it (bb draws the title and the requester line and no Cancel), and D-094 records the result, but the assumption text still reads as open. | Accept: the spec was approved before the lab, and D-094 holds the answer. |
| I3 | Inconsistency | Low | `plan.md` risks | The risk list (the frame, the Tailwind scan, type conflicts) has no outcome. All three resolved: no duplicate Cancel, the classes compile into `dist/app.css`, and `tsc6` showed no clash between the DOM and Node types. | Accept: the cycle log and D-094, D-097 carry the outcomes. |
| T1 | Terminology | Low | spec, plan, docs | The form is called "the approval form", "the merge form", and "the merge approval" in different places. They name one form. | Accept. |
| S1 | Style | Low | `tdd/cycle-log.md`, `tdd/test-list.md` | Many lines hold more than one sentence. The cycle log is append-only, and the test list is tables, so I did not reflow them. The spec, plan, quickstart, checklist, verification report, and the new decision entries were reflowed to one sentence per line. | Accept: precedent in the earlier features' logs. |
| P1 | Process | Info | `tdd/verification.md` | The second audit's own subagent stopped early, because `/tmp` hit its per-user disk quota. The report says so, and I ran the missing mutants myself. | None. |

## Coverage summary

| Requirement | Has task? | Task IDs | Notes |
| --- | --- | --- | --- |
| FR-1201 renderer registered under the backend's id | Yes | T1211, T1213 | `[A1201]`, `[A1220]` |
| FR-1202 task, branch, pull request, evidence shown | Yes | T1210, T1212 | `[A1202]`, `[U1220]` to `[U1224]` |
| FR-1203 exact answer shape, blank comment left out | Yes | T1205, T1206, T1210, T1212 | `[U1207]` to `[U1210]`, `[A1203]`, `[A1204]` |
| FR-1204 Approve, Deny, Cancel; Cancel records nothing | Yes | T1220 to T1223 | `[A1206]` to `[A1208]` |
| FR-1205 no Approve for an unreadable request | Yes | T1230 to T1233 | `[U1233]`, `[A1209]` |
| FR-1206 disabled in flight, failure shown, comment kept | Yes | T1210, T1230 to T1233, T1285 | `[U1229]`, `[U1230]`, `[U1231]`, `[U1241]` |
| FR-1207 link only for `http` or `https` | Yes | T1230 to T1233 | `[U1221]`, `[U1222]`, `[A1211]`, `[U1242]` |
| FR-1208 approval design unchanged | Yes | T1207 | `[U1213]` baseline, `[U1210]`, `[U1211]`, the unchanged `tools-merge` tests |
| FR-1209 keyboard, labels, themes, narrow width | Yes | T1210, T1230 to T1232, T1260 to T1263 | the lab covers themes, width, and focus (finding U1) |
| FR-1210 `tsc6`, frontend type-checked | Yes | T1202, T1240 to T1242 | `[A1214]`, `[A1215]` |
| FR-1211 runbook reads the machine name, web step works | Yes | T1250 to T1252 | `[A1216]`, `[A1217]` |
| FR-1212 decisions recorded | Yes | T1250 to T1252, T1294 | `[A1218]`; D-094 to D-099 |
| SC-1201 to SC-1203, SC-1206 | Yes | T1260 to T1264 | the lab |
| SC-1204 clean-PATH check | Yes | T1241, T1270 | `[A1214]`, the logged `env -i` runs |
| SC-1205 suite, lint, type check, build | Yes | T1270 | |

Unmapped tasks: the close-out tasks `T1270` to `T1272` and the remediation tasks `T1280` to `T1294` map to audit findings and not to a requirement, by design.
Tasks that carry no requirement of their own: `T1201`, `T1203` (tooling).

## Constitution alignment

| Principle | Result |
| --- | --- |
| I. Gates live in code and fail closed | Held. The backend gate is unchanged (one import-only edit in `src/tools/merge.ts`), and the form adds a fail-closed view on top. |
| II. The machine core is pure | Held. `src/machine/` is untouched. |
| III. The event log is the source of truth | Held. The form writes no state. |
| IV. Storage behind an interface | Held. No storage change. |
| V. Test first | **One open deviation**: C1 above (seven test-after guard tests, D-099). The other parts hold: tests are never weakened, refactoring happens on green, every acceptance criterion has a real-entry-point test, and test strength was measured with deliberate mutants (45 of 45 killed). |
| VI. Scope discipline | Held. No owner-typed code, no `factoryman_decide`, no change to the approval design, and the live install stayed out. |

## Drift between documents

None open, apart from the two assumption and layout notes (I1, I2, I3).
The cycle log matches the suite counts, the test list carries every behavior ID that the tests use, `tasks.md` has no mismatched checkbox (two explained cases), and the spec's acceptance criteria all trace to a test.

## Next actions

- C1 is the only blocker for a clean audit. The owner decides D-099. The pull request should say so.
- The other findings are accepted, and none needs a task.
- Run `/speckit.converge` to record merge readiness.
