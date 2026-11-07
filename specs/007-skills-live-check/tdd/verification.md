---
feature: 007-skills-live-check
verdict: FAIL
standard: .specify/extensions/tdd/templates/tdd-test-quality-rubric.md # resolved from the extension copy; no override or preset file exists
verified_at: 7bbd5c9 # short SHA audited (branch fm/bb-factoryman-milestones-7-11, range 0d114bd..7bbd5c9)
behaviors: 15 # 14 acceptance (A1101-A1114) and 1 unit (U1101)
proven: 15 # red commit holds the tests and a stub, and the diff fits the logged failures
likely: 0
test_after: 0
no_test: 0
high_smells: 2 # A1105 and A1114 name a negative property that no assertion checks (findings 1, 2)
criteria_total: 13 # AC-1.1 to AC-3.4
criteria_covered: 13 # every AC reaches a test; AC-1.5, 1.6, 2.1, 2.2, 3.2, 3.3, 3.4 only weakly (see Traceability)
mutation_score: 46 # 65 of 140 hand-picked deliberate mutants killed, no tool. Not a representative sample
mutants_survived: 75 # 1 equivalent (X09), 74 real (findings 1 to 13)
suite: 1121 passed, 0 failed, 17 s wall, 92 files; pnpm run check (typecheck, lint, tests) exit 0
---

# TDD verification: Skills and live check

**Verdict: FAIL.**
The tests that pin the safety rules in the skills and the runbook check that sentences are present, and they cannot see an instruction that contradicts them.
Mutants that put the token in a file or on a command line, tell the supervisor to turn on `yolo`, tell a worker to push to `origin`, install the plugin without `bblab x`, and delete every gate condition of tier 2 all survive.
The discipline is otherwise good: the red commit holds only tests and a stub, and no existing test was weakened.
The selection function (`skillsForMetadata`) and the skill front matter are well tested.
I did not write these tests, and I re-read every file cold.

## Test-first evidence

| Group | Red commit | Content | Class |
| --- | --- | --- | --- |
| 1: skills, selection, runbook | `2ee210a` | Tests (`skills.test.ts`, `live-check.test.ts`, `[A1106]`, `[U1101]`, `[U208]`), a `skillsForMetadata` stub that returns `[]`, the call that wires it into `configure`, the spec files, and spike item 11. No skill file and no runbook. | PROVEN for all 15 behaviors |

The log reports 15 failures, and the diff fits that count one for one.
`[U1101]` and `[A1102]` fail against the stub (`[]`).
`[A1106]` fails because the prompt has no skill line.
`[U208]` fails because `skills/` does not exist.
`[A1101]`, `[A1103]` to `[A1105]` fail with `ENOENT` on `skills/`, and `[A1107]` to `[A1109]` and `[A1111]` to `[A1114]` fail with `ENOENT` on `docs/LIVE-CHECK.md`.
I did not check out the red commit, as the brief says, so the count is the log's and the diff's.
Eleven of the 15 reds are `ENOENT`. They prove that the file was missing, and they do not show that an assertion can fail on content. The mutants below do that, and many survive.

Changes to tests that already existed:

- `[U208]` (`layout.test.ts:12`) dropped the assertion that `skills` "should not exist yet" and now asserts that it exists. This is the planned change A1110, and the old assertion encoded the state that this milestone ends. Not weakened.
- `register.test.ts` and `test/fixtures/plugin-host.ts` now pass `agentSkillIds: skillNamesOnDisk()` to the fake host. Without it, seven existing tests (`[U33]` to `[U39]`) fail, because the fake host rejects a skill it does not know. The fixture reads the names from the skill files, so no existing assertion changed.
- The green commit edited two new tests: `[A1108]` (heading `## 6. Tier 0 checks` became `## 6. Tier 0 and tier 1`) and `[A1113]` (the ordering check grew from one comparison to five). Both stay as strong as before or stronger. The log says so.
- No `skip`, `only`, `todo`, threshold, or config change appears in the range.

The `configure` line in the red commit already calls `skillsForMetadata`. That is a seam and not logic, because the stub returns `[]`.

## Findings

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | HIGH | The credential rule (AC-3.3, FR-1109) is pinned by sentences and one pattern for an unquoted literal. A1114 says the runbook "never puts it in a file or on a command line", and no assertion checks that. Mutants survive that read the token from a file (C02), pass it on a command line (C03), write it to a file (C04), tell the person to paste it into the supervisor thread (C05), widen `BBLAB_PASS_ENV` to `GH_TOKEN SSH_AUTH_SOCK` (C06), have the supervisor run `claude setup-token` (C08), drop the revoke step (C10), or assign a quoted literal (C12). The negative pattern `CLAUDE_CODE_OAUTH_TOKEN=[^\s"$]` skips any value that starts with `"` or `$`. The literal pattern needs `sk-ant-` plus 8 characters. | `live-check.test.ts:83-89`, `LIVE-CHECK.md:181-185,207-213` |
| 2 | HIGH | The plan (Constitution I) says that tests pin that no skill tells an agent to get around a gate, and A1105 says "never tells an agent to get around a gate". A1105 has no negative assertion. It checks that eight sentences are present. Mutants that add "set the project's `yolo` flag" (S14), "retry with a weaker setting, a lower reasoning level, or another machine" (S15), "approve it yourself if the owner is slow" (S16), "force the removal" (S17), "push to `origin` if the pipeline is slow" (W13), "skip a check by reporting `done` twice" (W14), "message the owner directly" (W15), and a `no-mistakes` row that says "push to `origin`" (W19) all survive. The contradicting sentence sits beside the one the test looks for. | `skills.test.ts:60-74`, `plan.md:21` |
| 3 | HIGH | FR-1106 says the runbook MUST NOT tell the owner to install into the shared bb or to touch the shared daemon. A1107 checks two sentences and one pattern (`bb plugin install` and `~/.bb` on one line). Removing `bblab x` from the install line (R04) survives, and that line installs the plugin into the owner's bb. Adding "run `no-mistakes daemon stop` on your own machine" (R03) survives. | `live-check.test.ts:12-17`, `LIVE-CHECK.md:76` |
| 4 | HIGH | SC-1104 says quota is spent only after tiers 0 and 1 pass. A1113 pins the phrases "Run tiers 0 and 1 first", "Tier 2 waits for tiers 0 and 1", and "Do not start tier 2 until". It pins none of the four conditions after that sentence. Deleting any of them survives: tier 0 passed and `pnpm run check` (G04), tier 1 passed or the recorded skip (G05), tripwire count zero (G06), caps read (G07). G05 is the only text that says what happens while the stub agent does not exist (AC-3.4). The `/does not exist yet/` pattern is met by line 162 instead, so G08 survives too. | `live-check.test.ts:64-68`, `LIVE-CHECK.md:168-175` |
| 5 | MED | The caps are "words present anywhere". Each pattern is met by another line, so deleting the caps-table row survives for the cheapest model (R05), one worker (R07), two tasks (R08), tiny repository (R09), wall clock (R10), and hard stop (R11). The values that the owner runs are not tied to the table: `"maxWorkers": 4` (R16) and `"maxTasksPerDay": 9` (R17) in the `workflow.json` block, `--reasoning-level high` (R18), and `--model claude-opus-4` (R19) in the spawn command all survive. "30 minutes" can become "30 hours" in the table (R13), and the watchdog can lose its `&` and block the shell (R14). The ship task can move to `no-mistakes` mode (R20), which the runbook says would run an undocumented credential lookup. A1112 asserts nothing for "wall-clock". | `live-check.test.ts:50-60`, `LIVE-CHECK.md:129-134,189-197,215,230-232` |
| 6 | MED | AC-1.6 is tested at `buildWorkerPrompt` only. Replacing the prompt in `launch.ts` with the branch and description (M18) passes all 1121 tests. The dispatch tests check only the branch and the description. | `launch.ts:61`, `dispatch.test.ts:63-64`, `prompt.test.ts:25-30` |
| 7 | MED | Two claims in the supervisor skill disagree with the code (a real defect, not a mutant). (a) The skill says to call `factoryman_merge` "only for a task in `review_ready`" and that after no answer "the task stays as it was". The tool accepts `awaiting_approval` too, and moves a task there before it opens the form, so a no-answer or a denial leaves it in `awaiting_approval`, and the tool tells the supervisor to call it again. A supervisor that follows the skill literally will not ask again. (b) The skill says to tear down "a merged or failed task". The state table also allows teardown from `report_ready` for a scout (`table.ts:63`), and the wake table says nothing about tearing a finished scout down. | `SKILL.md (supervisor):61,66,70`, `merge.ts:44,71,85,100`, `table.ts:63` |
| 8 | MED | The skills' claims about tool behavior are unpinned. A1103 checks tool names, and nothing checks argument names, outcome names, wake states, or states. Survivors: wrong worker argument `prUrl` (W16), wrong `landedCommits` (W17), wrong outcomes `stuck` and `abandoned` (W18), wrong dispatch arguments (S22), wrong `states` filter (S23), a wake row removed (S24) or renamed to a state that does not exist (S25), merge allowed in any state (S19), teardown allowed on any task (S21), a merge "done" without approval (S26), and the `yolo` clause removed (S20). The schemas are strict, so a wrong name becomes a refusal at run time. `WAKE_STATES`, `reportSchema`, and `dispatchSchema` are exported and could drive the test. | `skills.test.ts:40-49`, `report.ts:12-17`, `dispatch.ts:31-51`, `wake.ts:7` |
| 9 | MED | AC-2.2 (hold the hard-rule checks, the unverified list, and the teardown checklist) is pinned in part. Of the seven hard-rule checks, three are asserted. Removing the merge check (H01), the teardown check (H02), the offline machine check (H04), or the `yolo` and `gates` check (H06) survives, and so does rewriting the intro to "may succeed" (H08). Four of seven unverified items survive removal (U01, U02, U04, U05). The teardown checklist is a heading only: the evidence diff (U06) and the whole checklist paragraph (U07) can go. Headings 3, 5, and 11 can be renamed (U08, U09, U10). Funding can switch to "a company API key (option C)" (U11), because the phrase also occurs in the tiers table. The test list says A1108 covers the funding decision, and A1108 does not assert it. | `live-check.test.ts:20-29`, `test-list.md:28` |
| 10 | MED | A1109 checks the word after `bb factoryman` only. A typo in a flag (X02), a machine name that does not exist (X04), and a mistyped core bb command (X08) survive. One command is wrong today: the tier 0 check `bb factoryman preflight lab-box --project $PROJ` names a machine `lab-box`. The isolation report shows the lab's one machine as `server`, so the check would print a "blocked" result and not the text that the table expects. The other core bb commands that I could check offline exist with the flags used: `project create`, `machine list`, `skill list --json`, `provider models`, `provider list`, `status`, `thread spawn` (every flag in the runbook), `thread interactions respond`, `plugin install --yes`, `plugin list`, `plugin logs`, and `plugin build`. | `live-check.test.ts:31-39`, `LIVE-CHECK.md:148`, report line 398 |
| 11 | MED | SC-1102 says the owner runs the runbook without asking, and three steps do not allow that. (a) Setting the project to `local-only` and giving it a base branch says "use the plugin's database from a one-off script", with no script and no path. `workflow.json` cannot lower the mode, and only `store.putProjectConfig` writes it (`effective.ts:26`, D-037), so the ship task cannot run without this step. (b) "Ask the supervisor to dispatch" has no command (`bb thread tell` exists). (c) The runbook says to check the supervisor's tools "on the first turn", but the stamp command says the tools arrive "from its next session", and the thread starts its first turn when it is spawned, before the stamp. A correct run can look like a failed skill selection. | `LIVE-CHECK.md:122-124,227-242`, `supervisor-command.ts:53` |
| 12 | MED | The ordering check in A1113 has a vacuous leg. It looks for the first `bblab down` after `## 7. Tier 2`, and the caps table names `bblab down` at lines 196-197, above the code block. Deleting the `bblab down` command from the block (O02) therefore survives, and the lab would never be stopped before the token enters it. The other four mutants on order die (O01, O03, O04, C07). | `live-check.test.ts:75-78`, `LIVE-CHECK.md:196-197,208` |
| 13 | LOW | `skillsForMetadata` accepts a looser role than `toolsForMetadata`: `String(role)` (M09) and a trimmed, lower-cased role (M11) both survive. `[U35]` covers arrays, numbers, and `null` for tools, and `[U1101]` covers only `3`. The selection is a hint, so the effect is small. | `register.ts:31-36`, `register.test.ts` (`[U1101]`, `[U35]`) |
| 14 | LOW | The isolation report's checklist ends with "quota before and after was read and matches the cap". The runbook's teardown section has the other items and drops this one, and the prerequisites have no "read quota before" step. It is the only check that spend stayed inside the caps (SC-1104). | `LIVE-CHECK.md:302`, report line 509 |
| 15 | LOW | Credential residual risk, not reproduced. The runbook has the captain `export` the token in the shell that runs `bblab up`. In the report's `bblab` source, the keeper process starts as `setsid nohup bwrap ... sleep infinity` with the caller's full environment (`env -i` applies only to `labenv` children), so a process inside the PID namespace may read the token, and the rest of the owner's exports, from `/proc/<pid>/environ`. The lab's Claude CLI also holds the token, so "No agent creates, reads, or handles the token" is stricter than the design delivers. `bblab` is not installed here, so I could not test it. | `LIVE-CHECK.md:183,207-215`, report lines 788, 758 |
| 16 | LOW | Brittleness and bookkeeping. A1105 couples to Markdown (`\*\*Never push to \`origin\`\.\*\*`), so a rewording that keeps the rule breaks the test. A1101 uses unexplained bounds 40 and 400. `test-list.md` still reads `updated_at: 0d114bd` after the green commit. Section 8 says "the first six" of seven checks need no model. `[U1101]` traces to FR-1101 only. | `skills.test.ts:70`, `skills.test.ts:19-28`, `test-list.md:7`, `LIVE-CHECK.md:269` |

I checked the points below and found no defect:

- Neither skill tells an agent to get around a gate, and neither handles a credential.
- The runbook's `workflow.json` example parses with `parseWorkflowConfig` (one JSON block, accepted). A scratch test under the scratchpad ran it, and the tree is unchanged.
- The skills name only registered tools and only registered `bb factoryman` commands, with the flags and arguments that `supervisor-command.ts` accepts.
- The wake message format (`[factoryman]`, task, state, evidence), the five wake states, the dispatch result shapes (`Dispatched`, `ambiguous`, `Dispatch blocked (...)`, `queued`), and the `rule` and `profile` arguments match `wake.ts` and `dispatch.ts`.
- Every `D-0xx` that the runbook cites exists in `docs/DECISIONS.md`.

## Mutation results

Scope: 140 mutants, one at a time, by hand, in `src/tools/register.ts`, `src/tools/prompt.ts`, `src/tools/launch.ts`, both `SKILL.md` files, and `docs/LIVE-CHECK.md`.
Each ran against `skills.test.ts`, `live-check.test.ts`, `register.test.ts`, `prompt.test.ts`, and `layout.test.ts` (29 tests, under 1 s), except M18, which also ran the full suite.
The helper restored each file after its run. I confirmed a clean tree and a green full suite at the end.
I aimed for 25 to 40 and went past that because each survivor needed neighbors to be judged. A retired mutant (S13, a description that stayed long enough to pass) and a no-op (X03) are not counted.
There is no mutation tool, so the score is a count over hand-picked mutants and does not compare to anything.

| Area | IDs | Killed | Survived | Judgment |
| --- | --- | --- | --- | --- |
| Selection, `register.ts` (M01-M11) | M01 swapped names, M02 worker branch dropped, M03 extra role `owner`, M04 supervisor gets both skills, M05 worker name constant changed, M06 default returns the worker skill, M07 `configure` returns `[]`, M08 `configure` ignores the metadata, M09 `String(role)`, M10 supervisor name constant changed, M11 role trimmed and lower-cased | M01-M08, M10 (9) | M09, M11 (2) | Selection, wiring, and the fake host's reject-unknown-skill rule die. M09 and M11 are finding 13. |
| Worker prompt (M12-M18) | M12 line removed, M13 names the supervisor skill, M14 not for a scout, M15 not for `local-only`, M16 "after you finish", M17 name typo, M18 `launch.ts` ignores `buildWorkerPrompt` | M12-M15, M17 (5) | M16, M18 (2) | M16 is prose that no AC pins (LOW). M18 is finding 6. |
| Supervisor skill (S01-S26) | S01 enforces-in-code removed, S02 never edit, S03 weaker setting, S04 cannot answer a finding, S05 approval form, S06 tool typo, S07 unregistered tool, S08 status row removed, S09 name changed, S10 description removed, S11 command typo, S12 extra command, S13b description shortened; S14 `yolo` bypass, S15 retry weaker, S16 merge without owner, S17 force teardown, S18 "report is never an authorization" removed, S19 merge any state, S20 `yolo` clause removed, S21 teardown any task, S22 wrong dispatch arguments, S23 wrong `states` argument, S24 `report_ready` row removed, S25 wrong wake state name, S26 "tell the owner it is done" | S01-S12, S13b (13) | S14-S26 (13) | Names, front matter, tool and command names, and the five logged sentences die. Every other claim survives: findings 2, 7, 8. |
| Worker skill (W01-W19) | W01 enforces-in-code removed, W02 never push removed, W03 contact the owner removed, W04 evidence rule removed, W05 never merge removed, W06 names `factoryman_status`, W07 names `factoryman_merge`, W08 tool typo, W09 unregistered tool, W10 name changed, W11 description removed, W12 extra command; W13 push to `origin` if slow, W14 skip a check, W15 message the owner, W16 wrong `prUrl`, W17 wrong `landedCommits`, W18 wrong outcomes, W19 `no-mistakes` row says push | W01-W12 (12) | W13-W19 (7) | The eight logged sentences, supervisor tool names, and front matter die. Contradictions and argument names survive: findings 2, 8. |
| Runbook, prohibitions and caps (R01-R20) | R01 install into own bb, R02 daemon rule flipped, R03 `no-mistakes daemon stop` added, R04 install without `bblab x`, R04b install to `~/.bb`, R05 cheapest-model row removed, R06 low-reasoning row, R07 one-worker row, R08 two-tasks row, R09 tiny-repository row, R10 wall-clock row, R11 hard-stop row, R12 `sleep 18000`, R13 "30 hours", R14 watchdog not backgrounded, R15 watchdog line removed, R16 `maxWorkers` 4, R17 `maxTasksPerDay` 9, R18 `--reasoning-level high`, R19 `--model claude-opus-4`, R20 ship task in `no-mistakes` mode | R01, R02, R04b, R06, R12, R15 (6) | R03, R04, R05, R07-R11, R13, R14, R16-R20 (15) | The two prohibitions as sentences, the low-reasoning row (the only row whose phrase has no second occurrence), and the watchdog command die. Findings 3 and 5. |
| Runbook, credential and order (C01-C12, O01-O04) | C01 literal `sk-ant-` token, C02 read from a file, C03 on a command line, C04 written to a file, C05 paste into the supervisor, C06 widened `BBLAB_PASS_ENV`, C07 `read -r` (echoes), C08 supervisor runs `setup-token`, C09 `unset` dropped, C10 revoke dropped, C11 literal token in a new paragraph, C12 quoted literal assignment; O01 `bblab up` before `read -rs`, O02 `bblab down` command removed, O03 `BBLAB_PASS_ENV` in section 4, O04 tier 2 before tier 0 | C01, C07, C09, C11, O01, O03, O04 (7) | C02-C06, C08, C10, C12, O02 (9) | Only the literal-token pattern, `read -rs`, `unset`, and the order of headings die. Findings 1 and 12. |
| Runbook, gate, hard rules, unverified, teardown (G01-G08, H01-H08, U01-U12) | G01 gate sentence replaced, G02 "Run tiers 0 and 1 first" removed, G03 "Tier 2 waits" removed, G04-G07 gate conditions 1 to 4 removed, G08 "stub agent does not exist yet" removed; H01-H07 hard-rule items 1 to 7 removed, H08 intro rewritten; U01 forge gap, U02 cost-data gap, U03 same-name skill gap, U04 pipeline gap, U05 stub-agent gap, U06 evidence diff, U07 checklist paragraph, U08-U10 headings 5, 3, 11 renamed, U11 funding changed to a company API key, U12 "competes with firstmate" removed | G01-G03, H03, H05, H07, U03, U12 (8) | G04-G08, H01, H02, H04, H06, H08, U01, U02, U04-U11 (20) | The three phrases, three hard-rule items, and two phrases die. Findings 4, 9. |
| Runbook, commands and names (X01-X12) | X01 nonexistent `bb factoryman` command, X02 flag typo, X03b nonexistent tool, X04 unknown machine name, X05 scout label, X06 ship label, X07 wrong skill names in the "Expect" line, X08 mistyped core bb command, X09 hard-stop intro line removed, X10 isolation report path changed, X11 "nine agent tools", X12 D-030 flipped | X01, X03b, X05, X06, X10 (5) | X02, X04, X07, X08, X09, X11, X12 (7) | Plugin command and tool names, the two task labels, and the report path die. X09 is equivalent for what the test claims, because the hard stop is named in the caps table. Findings 10; X07, X11, X12 are LOW. |
| Total | 140 | 65 | 75 | 46 percent. 1 equivalent (X09), 74 real. |

## Traceability

| Criterion | Tests | Real entry point | Can fail |
| --- | --- | --- | --- |
| AC-1.1 | `A1102`, `U1101` | Plugin factory, `resolveAgentConfiguration` on the fake host | Yes (M01-M08, M10). Role type edge: finding 13 |
| AC-1.2 | `A1101`, `U208` (A1110) | File read | Yes (S09-S10, S13b, W10-W11) |
| AC-1.3 | `A1103` | File read, `TOOL_NAMES` | Names yes (S06-S08, W06-W09). Behavior of the tools no (finding 8) |
| AC-1.4 | `A1104` | File read, fake host registrations | Command names yes (S11, S12, W12). Flags no |
| AC-1.5 | `A1105` | File read | Words present only: 8 sentences die, and every contradiction survives (finding 2) |
| AC-1.6 | `A1106` | `buildWorkerPrompt` only | Builder yes (M12-M15, M17). Wiring no (M18, finding 6) |
| AC-2.1 | `A1107` | File read | Sentences yes (R01, R02). Commands no (R03, R04, finding 3) |
| AC-2.2 | `A1108` | File read | Headings 2, 4, 6, 7, 8, 9, 10 and 3 of 7 hard-rule items only (finding 9) |
| AC-2.3 | `A1109` | File read, fake host registrations | Plugin command word and tool names yes (X01, X03b). Flags, machine, core bb commands no (finding 10) |
| AC-3.1 | `A1111` | File read | The competes sentence yes (U12). The funding line no (U11) |
| AC-3.2 | `A1112` | File read | Weak: phrases occur elsewhere (finding 5) |
| AC-3.3 | `A1111`, `A1114` | File read | Literal token yes (C01, C11). Everything else no (finding 1) |
| AC-3.4 | `A1113` | File read | Phrases and heading order yes. Gate conditions and the stub-agent rule no (finding 4). Ordering leg vacuous (finding 12) |

Untested criteria: none.
Tests that trace to nothing: none. `[U1101]` traces to FR-1101 only and has no AC, which is fine for a unit test.
FR-1107 (mark what stays unverified) is covered by 4 of 7 items (finding 9).
The test-list table matches the actual test titles: all 15 ids exist, and `A1110` is the `[U208]` test.
`test-list.md` front matter says 13 criteria, which matches the 6 + 3 + 4 in `spec.md`.

Test smell pass on the new files:

- A1101, A1102, A1104, and `[U1101]` assert values and are strong (they enter through the plugin factory, the fake host, and the file system). A1102 and the fixture give a real guard, because the fake host rejects an unknown skill name and returns no tools.
- A1103, A1105, A1107, A1108, A1111, A1112, and A1113 are "words present" tests. Each can fail when its sentence goes. None can fail when a sentence is contradicted, moved, or made false, except where a mutant above died by accident.
- A1105 and A1114 are the HIGH smells: the name claims a negative property that no assertion checks.
- A1103, A1108, A1113, and A1114 are eager (many behaviors in one test) and some use bare `expect(text).toMatch(...)` with no label, which makes a failure name the regex and not the rule. Both MED.
- The suite is deterministic and fast (29 tests in about 0.9 s). The tests match the style of `layout.test.ts` (file reads through `new URL`).

## What was not audited

- I did not check out the red commit or build copies of it. The red counts are the log's, checked against the diff.
- I did not run `bblab`, `bblab-evidence`, `no-mistakes`, or any `bb plugin` or `bb thread` command, and I did not start, stop, or install into any bb. `bblab` is not installed here.
- I checked the runbook's core bb commands with `bb <command> --help` and `bb guide commands` and `bb guide json`, which need no server. I did not check the `bblab` commands against anything but the report's source, the `no-mistakes` commands at all, the provider id `claude-code`, or the `jq` path `.id` on `bb project create --json` (its shape is not in `bb guide json`).
- I did not re-run spike item 11's claim that the plugin was built and installed by path into a throwaway bb 0.48.1, and I did not run `pnpm run build` or `bb plugin build`.
- I did not test whether any model follows the skills. The live check is the only test for that, and it has not run.
- I did not reproduce finding 15.
- No coverage or mutation tool is installed. The mutants are hand-picked, so the 46 percent is not a representative score.
- I judged the prose of the skills and the runbook for rules and facts, not for the Google developer documentation style.
- Flakiness was not assessed beyond four clean full-suite runs.

## Remediation tasks

The feature is not done until R1 to R5 are cleared.
Each task names the mutant that must fail the new test.
Write the test first, show it fail with the mutant applied, then pass without it.

- [ ] R1 (finding 1): Parse the fenced blocks of section 7 and allow only these lines to name the token: `read -rs CLAUDE_CODE_OAUTH_TOKEN`, `export CLAUDE_CODE_OAUTH_TOKEN`, the `BBLAB_PASS_ENV` assignment (equal to exactly `CLAUDE_CODE_OAUTH_TOKEN BB_CLAUDE_CODE_EXECUTABLE`), and `unset`. Reject any `CLAUDE_CODE_OAUTH_TOKEN=` in any form, any redirect or `cat` on a line that names the token, and any sentence that hands the token or `claude setup-token` to an agent. Pin the revoke step. Proof: C02, C03, C04, C05, C06, C08, C10, C12 fail.
- [ ] R2 (finding 2): Add a negative list to A1105 that fails on an instruction to set `yolo`, retry weaker, approve for the owner, force a removal, push to `origin` outside the no-mistakes "Never" sentence, skip a check, or contact the owner. Anchor the "Never push to `origin`" sentence to the `no-mistakes` row. Proof: S14, S15, S16, S17, W13, W14, W15, W19 fail.
- [ ] R3 (finding 3): In A1107, require that every `bb ` command in a fenced block sits behind `bblab x` (or inside `bblab x bash -c`), and reject `no-mistakes daemon` with `start`, `stop`, or `restart` outside a "Never" sentence. Proof: R03 and R04 fail.
- [ ] R4 (findings 4, 5): Parse the gate list under `### The gate` and assert its four conditions, including the recorded skip line. Parse the `workflow.json` block with `parseWorkflowConfig` and assert `maxWorkers` 1 and `maxTasksPerDay` 2. Assert `--reasoning-level low` and a placeholder in `--model`. Assert each cap row inside the caps table. Assert "30 minutes" next to `sleep 1800`, and a backgrounded watchdog. Proof: G04, G05, G06, G07, G08, R05, R07-R11, R13, R14, R16-R19 fail.
- [ ] R5 (finding 6): Add an acceptance test that dispatches through the fake host and asserts the spawn prompt contains the `factoryman-worker` skill line (or equals `buildWorkerPrompt` output). Proof: M18 fails with the full suite.
- [ ] R6 (finding 7): Fix the supervisor skill: `factoryman_merge` also takes a task in `awaiting_approval`, a no-answer or a denial leaves it there and the supervisor asks again, and a scout in `report_ready` can be torn down. Add tests that pin each sentence and compare the wake table with `WAKE_STATES`. Proof: S19, S21, S24, S25 fail, and so does reverting the text.
- [ ] R7 (finding 8): Derive the field names of `reportSchema` and `dispatchSchema` and the wake states from the code, and assert that the skills name them and that the worker skill lists exactly the three outcomes. Proof: W16, W17, W18, S22, S23, S24, S25 fail.
- [ ] R8 (finding 9): In A1108, assert all seven hard-rule items, all seven unverified items, the funding line in the funding paragraph, the teardown commands, and headings 1, 3, 5, and 11. Proof: H01, H02, H04, H06, H08, U01, U02, U04-U11 fail.
- [ ] R9 (finding 10): Check the flags of each `bb factoryman` line against the command's usage, and check the machine name against what the lab reports. Change `lab-box` to `server` or to a variable that the runbook sets from `machine list`. Check the core bb commands against a recorded `bb guide commands` list. Proof: X02, X04, X08 fail.
- [ ] R10 (finding 11): Add the script or command that sets `local-only` and a base branch, add `bb thread tell` commands for the supervisor steps, and change "on the first turn" to "after the next message". No mutant fits a missing step. The proof is a dry read-through in the throwaway lab, recorded in `spike/RESULTS.md`.
- [ ] R11 (finding 12): In A1113, find `bblab down` inside a fenced block of section 7 and assert it comes before `read -rs`. Proof: O02 fails.
- [ ] R12 (finding 13): Mirror `[U35]` for `skillsForMetadata` with non-string, array, `null`, differently cased, and padded roles. Proof: M09 and M11 fail.
- [ ] R13 (finding 14): Add "read quota before and after" to the prerequisites and the teardown section, and pin it. Proof: deleting either sentence fails A1108.
- [ ] R14 (findings 15, 16): Record in `docs/LIVE-CHECK.md` that the lab's agent process holds the token, and check in the lab whether a process can read the keeper's environment. Loosen A1105 from Markdown to words, name the 40 and 400 bounds, and refresh `test-list.md`. Then run `pnpm run check`.

## Remediation status

The audit above is the record at commit `7bbd5c9`.
The remediation commit answers it, and this section is the only edit made to the report afterwards.
It was not re-audited from cold context, so the verdict line above still reads FAIL.

| Task | State | Evidence |
| --- | --- | --- |
| R1 | Done | `[A1114]`, `[A1111]`, `[A1124]`. C02 to C06, C08, C10, C12 fail them. |
| R2 | Done | `[A1115]` and `[U1102]`. S14 to S17, W13 to W15, and W19 fail them. |
| R3 | Done | `[A1107]`. R03 and R04 fail it. |
| R4 | Done | `[A1112]`, `[A1113]`. G04 to G08, R05, R07 to R11, R13, R14, R16 to R19 fail them. |
| R5 | Done | `[A1121]`. M18 fails it. |
| R6 | Done | The skill text matches the code, and `[A1118]` pins it. S19, S21, S24, and S25 fail the tests. |
| R7 | Done | `[A1116]`, `[A1117]`, `[A1119]`. W16, W17, W18, and S22 to S25 fail them. |
| R8 | Done | `[A1108]`. H01, H02, H04, H06, H08, U01, U02, U04 to U11 fail it. |
| R9 | Done | `[A1109]` and `test/fixtures/bb-cli.json`. X02, X04, and X08 fail it. `lab-box` became `server`. |
| R10 | Done | `[A1122]`, and the runbook has the database script, `bb thread tell`, and the next-session sentence. I ran the database statement against a throwaway plugin database. The rest is the live check's to prove. |
| R11 | Done | `[A1114]` pins the order of `bblab down`, the fresh shell, `read -rs`, and `bblab up`. O02 fails it. |
| R12 | Done | `[U1103]`. M09 and M11 fail it. |
| R13 | Done | `[A1123]`. |
| R14 | Partly | The runbook discloses the risk, uses a fresh shell, and lists the question as untested. `bblab` is not installed here, so nobody tested whether a lab process can read the keeper's environment. The other bookkeeping is done. |

86 of the audit's mutants were re-run against the new tests: 85 died at once, and S17 died after the lint dropped a word that excused it.
The audit's other survivors are the ones that its table calls equivalent or LOW (X09, a description edit).
`pnpm run check` after the remediation: 92 files, 1133 tests, 0 failed.
