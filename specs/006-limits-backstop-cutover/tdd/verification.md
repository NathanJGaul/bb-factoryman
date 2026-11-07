---
feature: 006-limits-backstop-cutover
verdict: FAIL
standard: .specify/extensions/tdd/templates/tdd-test-quality-rubric.md # resolved from the extension copy; no override or preset file exists
verified_at: 8e2ecb0 # short SHA audited (branch fm/bb-factoryman-milestones-7-11, range 529574d..8e2ecb0)
behaviors: 57 # 24 acceptance (A1001-A1024) and 33 unit (U1001-U1031, U1044, U1045)
proven: 54 # red from the log and the stubs, or a mutant of mine that fails the test
likely: 3 # A1016, A1022, U1044 passed against the stubs and rest on the author's mutants, which I did not re-run
test_after: 0
no_test: 0
high_smells: 0 # by the smell catalogue. The four HIGH findings come from a probe and from surviving mutants
criteria_total: 23 # AC-1.1 to AC-5.5 (test-list.md front matter says 24, finding 12)
criteria_covered: 23 # every AC reaches a test through the fake host or `runCli`; AC-1.7, AC-2.1, AC-2.3, AC-2.4 only partly
mutation_score: 65 # 87 of 133 hand-picked deliberate mutants killed, no tool; 72 if the 13 equivalent, unreachable, or test-selection survivors are excluded. Not a representative sample
mutants_survived: 46 # 13 equivalent, unreachable, or test-selection probes, 33 real (findings 1 to 11)
suite: 1062 passed, 0 failed, 17 s wall, 90 files; pnpm run check (typecheck, lint, tests) clean
---

# TDD verification: Limits, backstop, and cutover

**Verdict: FAIL.**
The path that carries a pinned machine, profile, and branch prefix into a queued task has no end-to-end assertion (rule 5), a webhook failure can log the secret URL, and the shell-injection allowlist is half tested.
The discipline is otherwise strong: all three groups have a red commit with tests and stubs, and no existing test was weakened.
I did not write these tests, and I re-read every file cold.

## Test-first evidence

| Group | Red commit | Content | Class |
| --- | --- | --- | --- |
| 1: caps, queue, budget | `a391495` | Tests, stubs that return nothing or "not implemented", port stubs, fixtures, the two settings. No logic. | PROVEN. The log reports 36 failures, which fits the stubs. |
| 2: webhook | `57b13e3` | Tests and a `post` that does nothing. | PROVEN. 5 failures. |
| 3: protection and registry | `d28f21c` | Tests and stubs that return no entries or fail. | PROVEN. 19 failures. |

I did not build scratch copies, as the brief says. The stub files and the log are the red evidence.
Behaviors that passed against the stubs rest on a mutant: U1004 (RQ1, RQ2), A1005 (Q09), A1024 (L01, L04), A1014 (W07), U1018 (W01), U1045 (S09). A1016, A1022, and U1044 stay LIKELY.
Nine existing test files changed, and each edit adds the new `limits` or `maxWorkers` field to an expected value. No `skip`, `only`, `todo`, threshold, or config change appears in the range.
The `Math.floor` on the `maxWorkers` setting arrived with the red commit and has no test (S03).

## Findings

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | HIGH | FR-1008, a secret in a log. `post` logs `error.message`. With a URL such as `https://bot:PASS@host/path`, the real `fetch` throws `Request cannot be constructed from a URL that includes credentials: <the full URL>`. A probe with the real `fetch` logged the password. `[U1019]` and `[A1015]` use `connect ECONNREFUSED`, which carries no URL. | `webhook.ts:61`, `webhook.test.ts:58` |
| 2 | HIGH | Rule 5 and rule 6. The queued request is only checked for `description` and `parentThreadId`. Storing `machine: null` (D01), `branchPrefix: null` (D07), or a different `profile` (D08) survives the suite. A task pinned to a machine would then start on the default host after a wait. `[A1007]` writes the request rows by hand, and `[A1003]` never reads the spawn arguments. | `dispatch.ts:169`, `limits-queue.test.ts:19,43,98` |
| 3 | HIGH | The text goes into shell commands that a person pastes. The repo name part and the check name accept `;&\|$` and a backtick without a failing test (P06, P07). The `..` guards on repo and branch are never reached (P01, P02). Today's regexes reject these inputs, so this is a test gap and not an injection. | `protection.ts:7-21`, `protection.test.ts:24-30` |
| 4 | HIGH | The budget check is skipped at a cap. D04 lets a budget refusal become a queued task, and the drain never checks budgets, so the task starts over budget later. AC-2.5 says that a refusal creates no task. | `dispatch.ts:163,167` |
| 5 | MED | `protectionSteps` indents the here-document end marker (`   JSON`). I ran the printed shape in bash. The shell does not end the document, so the body reaching `gh` holds the marker and every later line. A test that runs the printed commands with a stub `gh` would catch it. The fenced block in the docs is fine. | `protection.ts:40-42` |
| 6 | MED | Queue liveness and re-checks. The preflight re-check at drain is never tested (Q17). The `again` flag that re-scans after an overlapping call is never tested (Q12), so a slot freed during a drain can wait for the next event. Tasks with no stored request are left alone, and no test shows it (Q21, Q22). A leaked `launching` entry is not tested (S11). The window between the cap check at `queue.ts:109` and `launching.add` was probed once and showed no overrun. | `queue.ts:70,80,84,109,129`, `launch.ts:50,86` |
| 7 | MED | Budget scope. The day cap counts tasks of every project (B03). A running task from an earlier UTC day is never read for `perTaskBudget` (B07). The day spend sums all days (B08). A failed cost read counts as zero and `[U1015]` asserts only `ok` and the warning (B09). A queued task with no thread is read (B16). A queued result drops the unknown-cost note (D05). | `budget.ts:21,43,44,50,59`, `dispatch.ts:172` |
| 8 | MED | The adapter passes the currency through, but no test shows it. Returning `USD` for every cost survives (S07), so a EUR cost would count as USD. Dropping the floor on the `maxWorkers` setting survives (S03), so a cap of 1.5 would let two workers run. | `adapter.ts:126`, `server.ts:104` |
| 9 | MED | Registry. A bare `yolo` token reads as on, and `yolo` is the approval bypass flag (R01). `forge=` with no value, a near-miss line such as `-x - y`, a mode followed by an extra token, and an unclosed bracket all survive (R02, R05, R15, R08). The unclosed bracket line is counted as skipped and not flagged, though FR-1011 says every line is reported. | `registry.ts:38,54,56,59,75` |
| 10 | LOW | Webhook. A 4xx answer is not warned about, because the bad status test uses 500 (W05). `[A1014]` checks one non-attention state, `validating`. The wake tests cover the rest. The post is awaited before the wake, so a slow hook delays the supervisor wake by up to 5 s. | `webhook.ts:59`, `wake.ts:27` |
| 11 | LOW | Commands. Unknown flags to `import-registry` are ignored (C05). A failing `listProjects` has no test (C09). The report then shows every project as "not found in bb" and does not say why. | `supervisor-command.ts:122,138` |
| 12 | LOW | Bookkeeping. `test-list.md` says 24 criteria and 23 exist. `[A1004]` says "and the supervisor can fail it", the test does not, and the spec says no tool cancels. `U1029` is in group 3 on the list and in the group 1 red in the log. `[A1005]` and `[A1006]` label two tests each. `[A1018]` checks that words appear in a document, such as `scoped`, which is weak. Nothing pins the rest of `docs/CUTOVER.md`. | `test-list.md:5,25,79`, `limits-queue.test.ts:64,70,76,88`, `limits-cutover.test.ts:50` |

## Mutation results

Scope: 133 mutants in the changed files, one at a time, against the matching unit and acceptance files, each restored with `git checkout`.
I went past the 20 to 30 planned because each survivor needed neighbors to judge it.

| Area | Killed | Survived | Judgment |
| --- | --- | --- | --- |
| Queue, Q01-Q23 | 15 | Q12, Q15, Q17-Q23 | Running states, launching set, both caps, FIFO, exclusivity, unreadable request, and the machine fall-back (Q15b) die. Q15 is the log's accident. Q19, Q20, Q23 are equivalent. Q12, Q17, Q21, Q22 are finding 6. |
| Dispatch, D01-D14 | 6 | D01, D04, D05, D07, D08, D13, D14 | D09 and D10 survived the first test set and die with the machine tests, so the gates are covered. D13 and D14 are unreachable or text. The rest are findings 2, 4, 7. |
| Budget, B01-B18 | 12 | B03, B07, B08, B09, B14, B16 | UTC day, both boundaries, currency, per-task running only, and the notes die. B14 is equivalent. The others are finding 7. |
| Webhook, W01-W12 | 12 | W05, W08 | Scheme, host-only log, URL in the log, evidence clip, wiring, and the state list die. W08 dies with the wake tests. |
| Protection, P01-P14 | 8 | P01, P02, P06, P07, P11, P14 | Anchors, the first character, `$` and a backtick in the check, `enforce_admins`, and the ran-nothing line die. Findings 3 and 5. P11, P14 are not in the spec. |
| Registry, R01-R15 | 9 | R01, R02, R05, R08, R12, R15 | Modes, the prod-only note, prefix, `forge`, and extra tokens die. R12 only adds an alias. Finding 9. |
| Commands, C01-C10 | 6 | C04, C05, C07, C09 | `--apply` is refused (C01, C06), the arity guard, and the missing file die. C04 and C07 are harmless. |
| Schema, L01-L09 | 9 | none | Count, positivity, default currency, and strict keys all die. |
| Server and adapter, S01-S12 | 6 | S03, S07, S11, S12 | Start-up drain, setting change, listener, status, port map, and the event field die. S12 is a guard that `previewStart` makes unreachable. |
| Request, RQ1-RQ7 | 4 | RQ4, RQ5, RQ6 | Version, strict keys, the permission enum, and a blank description die. RQ6 is equivalent, because zod rejects non-objects. |

## Traceability

| Criterion | Tests | Real entry point | Can fail |
| --- | --- | --- | --- |
| AC-1.1, AC-1.2 | `A1001`, `A1002`, `U1005`, `U1006` | Factory, `world.call` | Yes (Q05-Q08) |
| AC-1.3 | `A1003`, `U1007`, `U1009` | Factory | Order and trigger yes (Q10, Q14). Not the spawn arguments (finding 2) |
| AC-1.4, AC-1.5 | `A1004`, `A1005`, `U1031` | Factory | Yes (S06, Q09). "Can fail it" is not tested |
| AC-1.6 | `A1006` (two) | Factory, restart | Yes (S01, S02) |
| AC-1.7 | `A1007`, `U1008` | Factory | Unreadable and offline yes. Preflight no (Q17) |
| AC-2.1 to AC-2.3 | `A1008`-`A1010`, `U1011`-`U1014` | Factory | Yes, except project scope and earlier days (finding 7) |
| AC-2.4, AC-2.5 | `A1011`, `A1012`, `U1015`, `U1016` | Factory | Yes (B13, D06). Not the queued note, not the budget-at-cap order (findings 4, 7) |
| AC-3.1 to AC-3.4 | `A1013`-`A1016`, `U1017`-`U1019`, `U1044` | Factory, injected `fetch` | Yes, except the URL leak (finding 1) |
| AC-4.1 | `A1017`, `U1020`, `U1021` | `runCli` | Text yes. Not that it runs when pasted (finding 5) |
| AC-4.2 | `A1018` | File read | Weak (finding 12) |
| AC-5.1 to AC-5.5 | `A1019`-`A1023`, `U1022`-`U1030` | `runCli` | Yes (C01, C06, C10). Parser edges in finding 9 |

Untested criteria: none. Tests that trace to nothing: none.

## What was not audited

I did not re-run the red commits or build scratch copies, so the failure counts are the log's.
I did not run a mutation tool, because the profile has none.
I did not run the code against a real bb, forge, webhook receiver, or cost-reporting provider.
I did not prove or rule out a cap overrun when a dispatch races the drain. One probe showed none.
The webhook posts on every applied event that leaves a task in an attention state, as the wake does. I did not check whether a self-loop event repeats the post.
Performance and flakiness were not assessed beyond one clean run of the full suite.

## Remediation tasks

The feature is not done until R1 to R4 are cleared.
Each task names the mutant that must fail the new test.

- [ ] R1 (finding 1): Log only a fixed text and the host for a thrown error, and add a test where `fetch` rejects with the URL and its credentials in the message. Proof: `pnpm vitest run src/limits/webhook.test.ts test/acceptance/limits-webhook.test.ts` fails with W03 applied and passes after the fix.
- [ ] R2 (finding 2): Add an acceptance test that dispatches a pinned task to an online second machine at a cap, drains it, and asserts the spawn host, profile, prefix, and base branch. Add a case for a pinned machine that is offline at the drain. Proof: D01, D07, and D08 fail it.
- [ ] R3 (finding 3): Add `;`, `&`, `|`, `$`, a backtick, and `..` cases for the repo name part, the branch, and the check. Proof: P01, P02, P06, and P07 fail them.
- [ ] R4 (finding 4): Test a dispatch at a cap and over budget: it is refused and no task exists. Decide whether the drain re-checks budgets. Proof: D04 fails it.
- [ ] R5 (finding 5): Print the here-document end marker with no indent, and run the printed commands with a stub `gh` in a test. Proof: the stub receives valid JSON.
- [ ] R6 (finding 6): Add tests for the drain preflight, an overlapping drain, a task with no request, and a launch refused by `start`. Proof: Q12, Q17, Q21, Q22, and S11 fail them.
- [ ] R7 (findings 7, 8): Add a second project, an earlier-day running task, an earlier-day cost, a failed read with a note check, a queued task with no thread, a queued note, and a EUR cost through the adapter. Proof: B03, B07, B08, B09, B16, D05, and S07 fail them.
- [ ] R8 (findings 9 to 12): Flag a bare `yolo` and an unclosed bracket, test 4xx, the unknown flags, the `listProjects` failure, and fix the list and ids. Proof: R01, R08, W05, C05, and C09 fail them, then `pnpm run check`.

## Remediation status

The audit above is the record at commit `8e2ecb0`.
The remediation commit answers it, and this section is the only edit made to the report afterwards.
It was not re-audited from cold context, so the verdict line above still reads FAIL.

| Task | State | Evidence |
| --- | --- | --- |
| R1 | Done | `[U1048]`. W03 fails it. The fix redacts the URL in the log text. |
| R2 | Done | `[A1025]`, `[A1026]`. D01, D07, and D08 fail them. |
| R3 | Done | `[U1054]`, `[U1055]`. P01, P02, P06, and P07 fail them. |
| R4 | Done | `[A1028]`. D04 fails it. D-086 records that the drain does not check budgets again. |
| R5 | Done | `[U1056]` runs the printed commands with a stub `gh`. P05 fails it. The fix unindents the end marker. |
| R6 | Done | `[U1057]` to `[U1060]`. Q12, Q17, and Q21 fail them. |
| R7 | Done | `[U1061]` to `[U1064]`, `[A1027]`, `[A1029]`, and a EUR case in `[U1028]`. B03, B07, B08, B09, D05, S03, and S07 fail them. |
| R8 | Done | `[U1049]` to `[U1053]`, `[U1065]`, `[U1066]`, `[U1046]`, `[U1047]`. R01, R02, R05, R08, R15, W05, C05, and C09 fail them. The fixes flag an unclosed bracket and send the wake first. |

The 13 equivalent, unreachable, or test-selection survivors stay as the audit left them.
`pnpm run check` after the remediation: 90 files, 1107 tests, 0 failed.
