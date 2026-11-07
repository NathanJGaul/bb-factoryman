---
feature: 005-extension-surface
verdict: FAIL
standard: .specify/extensions/tdd/templates/tdd-test-quality-rubric.md # resolved from the extension copy; no override or preset file exists
verified_at: 4bad48e # short SHA audited (branch fm/bb-factoryman-milestones-7-11, range 6ce8bfc..4bad48e)
behaviors: 53 # 18 acceptance (A901-A918) and 35 unit (U901-U935)
proven: 52 # 45 reproduced from the red commits, 7 passed against the stubs and rest on a mutant. A918 is NOT_APPLICABLE (finding 8)
likely: 0
test_after: 0
no_test: 0
high_smells: 1 # by the smell catalogue (finding 1). The other HIGH findings come from surviving mutants
criteria_total: 17 # AC-1.1 to AC-5.3, matches test-list.md
criteria_covered: 17 # every AC reaches a test through the fake host; AC-1.2, AC-1.4, AC-2.1, AC-3.1, AC-3.2 only partly
mutation_score: 83 # 87 of 105 hand-picked deliberate mutants killed, no tool; 89 if the 7 non-gap survivors are excluded. Not a representative sample
mutants_survived: 18 # 7 equivalent, covered by lint, or probes (M63, M87, M91, M99, M100, M103, M105), 11 real (findings 1 to 7)
suite: 961 passed, 0 failed, 14 s wall, 80 files; pnpm run check (typecheck, lint, tests) clean, 16 s
---

# TDD verification: Extension surface

**Verdict: FAIL.**
Mutants survive on the hard-rule paths: an unpinned gate-key list (rule 7) and two fail-open catches in the check gate (rule 8).
The `ready` path of the report tool is also never run with checks.
Otherwise the discipline is strong: every group has a red commit, and no existing test was weakened.
I did not write these tests, and I re-read every file cold.

## Test-first evidence

Each group has a red commit (tests plus stubs) before its implementation commit.
I ran the group tests against the stubs of `548d45f` and `7c8b660` in scratch copies: 48 failed at group 1 and 13 at group 2, as the log says.

| Behaviors | Class | Evidence |
| --- | --- | --- |
| A902-A909, A911, U901-U923 (32) | PROVEN | 48 tests failed at `548d45f`. Implementation followed in `0c9caa7`. |
| A913-A917, U925, U927, U929-U934 (13) | PROVEN | 13 failed at `7c8b660`. Implementation followed in `4bad48e`. |
| A901, A910, A912, U924, U926, U928, U935 (7) | PROVEN | Passed against the stubs. Mutants M28, M101, M53, M102, M71, M70, and M94 each fail the matching test. |
| A918 (1) | NOT_APPLICABLE | Added with the group 2 implementation. No red, and no log entry. M98 fails it. A strict reading gives TEST_AFTER (finding 8). |

Existing tests changed with the requirement and none is weakened: `plugin.test.ts` expects the four RPC methods, `tools-supervisor-command.test.ts` expects more metadata, and `legal-set.ts` lists the new guard.
No `skip`, `only`, `todo`, threshold, or config change appears in the range.
The `tasks.md` ticks match the DONE rows, and T931 (this audit) is open.

## Findings

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | HIGH | Rule 7. `[U902]` runs `it.each(GATE_KEYS)`, so it iterates the code's own list. A deleted key deletes its own test. Removing `skipGates` (M04), `approvals` (M05), or `disabled` (M06) survives the full suite. These are in the plan's list of 12. The independent list pins 9 keys, and `gate`, `skipChecks`, `bypass`, and `override` are also unpinned. At `548d45f` the stub list was empty, so no per-key case ever ran red. `[A905]` accepts `Unrecognized key` as well, so no acceptance test needs the hard rule 7 message (M103 and M105 survive). The strict schema still rejects the file, so the loss is the FR-903 message. | `config.test.ts:21,27-29`, `config.ts:12-29`, `extension-workflow.test.ts:95` |
| 2 | HIGH | Rule 8. `loadWorkflowFor` blocks when bb cannot read the project. No test throws there, and `FakeBbPort` has no hook. Turning the catch into an empty config (M27) survives the full suite. A `done` report would then skip every check. | `load.ts:38-41`, `bb-port.ts:102` |
| 3 | HIGH | Rule 8. `customChecks` blocks when `getThread` or `getEnvironmentPath` throws. No test covers it, though `getThreadError` exists. Returning `run: null` from the catch (M58) survives. A throw would skip the checks. | `report.ts:78-80`, `bb-port.ts:83` |
| 4 | HIGH | The `ready` path never runs checks at acceptance. `[A908]` to `[A912]` use only `no-mistakes`. Hard-coding that mode in the lookup (M56) survives, so `direct-PR` and `local-only` checks could go silently unrun. AC-3.1 and AC-3.2 name `ready`. Only the guard unit `[U918]` covers it. | `report.ts:70`, `extension-workflow.test.ts:117` |
| 5 | MED | Nothing pins that only `done` reports run checks. Dropping `outcome === "done"` (M54) survives. A `blocked` or `failed` report with checks configured, or with a bad file, would then fail. A worker must always be able to report those. | `report.ts:47` |
| 6 | MED | No test shows that the resolver gets the effective mode. Passing the stored mode (M66) survives. | `dispatch.ts:117` |
| 7 | LOW | The read limits are unpinned. The default 200 (M76, M77) and the maximum 1000 (M78) survive. D-082 states both. | `read.ts:39-40,115` |
| 8 | LOW | Bookkeeping. The log omits `A910` and the three equal-mode `[U911]` cases from "passed against the stubs". It says part of `[U905]` passed, but the test failed whole. It records 960 tests, and 961 exist, because `[A918]` came later and has no entry. `test-list.md` lists A918 before A917. | `cycle-log.md:25,64`, `test-list.md:38`, `layout.test.ts:36` |
| 9 | LOW | Smaller smells. Eager tests: `[U905]`, `[U915]`, `[U931]`. Duplicate ids: `[A908]`, `[A911]`, and `[U902]` each label two tests. Two tests have no id: `stamp.test.ts:49` and `config.test.ts:65`. The write-method list in `[U934]` is hand-written, and the `rejects` half of `[A916]` tests the fake host. The `900` in `[U923]` is unlabeled. Group 2 added a `pnpm` filter to a group 1 assertion in `[A908]`. | `read.test.ts:148`, `extension-surface.test.ts:224`, `checks.test.ts:219`, `extension-workflow.test.ts:141` |
| 10 | LOW | Observation, not a test smell. A check with no `timeoutSeconds` has no timeout on the server's own machine, so a hung check hangs the report call. The remote path has a default. FR-907 only requires that a timeout counts as failed. | `checks.ts:35`, `remote-exec.ts:55` |

Scratch probes at HEAD show the product is right where the tests are silent: a failing `direct-PR` or `local-only` check refuses `ready`, `blocked` and `failed` reports pass despite a failing check or a bad file, and a `getThread` throw blocks the report.
So findings 2 to 6 are test gaps and not product bugs.

## Mutation results

Scope: 105 mutants in the changed source files, one at a time, run against the matching unit and acceptance files, then restored with `git checkout`.
The count is above the 25 to 30 planned, because each survivor on a hard-rule path needed neighbors to judge it.
I re-ran the survivors that matter against the full suite, and they still survived.

| Area | Killed | Survived | Judgment |
| --- | --- | --- | --- |
| Key scan and schema, M01-M15 | 12 | M04-M06 | Depth, arrays, `baseBranch`, strict objects, version, and the limits die. Finding 1. |
| Effective project, M16-M23 | 8 | none | Ladder (`<`, `<=`, reversed, ranks), fill-only prefix and machine, `yolo` and `baseBranch` from the store all die. |
| Loader, M24-M29 | 5 | M27 | Read error, bad JSON, schema failure, absent file, and file name die. Finding 2. |
| Check runner, M30-M41 | 12 | none | Exit code, null code, timeout, `cwd`, `host`, every check runs, and clipping die. |
| Machine, M42-M52 | 11 | none | The guard, both events, and the table position and order on `handoff` and `ready` die. |
| Report tool, M53-M63 | 7 | M54, M56, M58, M63 | Findings 3 to 5. M63 only appends an empty failure text, so it is benign. |
| Dispatch, M64-M69 | 5 | M66 | A bad file, a looser mode, the task mode, the prefix, and the machine die. Finding 6. |
| Stamper, M70-M75 | 6 | none | Never writes `role`, skips no-thread tasks, and logs a failed write. |
| Read RPC, M76-M95 | 15 | M76-M78, M87, M91 | `since`, `limit`, `taskId`, `projectId`, `states`, version, discoverable, strict input, a leaked payload, and a write call die. M87 and M91 are equivalent, because every method has its own description and the handlers map explicit fields. |
| `server.ts`, M96-M97 | 2 | none | Both registrations are needed. |
| `src/machine` imports, M98-M100 | 1 | M99, M100 | `[A918]` knows only the layers above. ESLint rejects `@get-bb` and `node:` imports there, which I confirmed. |
| Probes, M101-M105 | 3 | M103, M105 | M101 and M102 prove `[A910]` and `[U924]` can fail. M103 and M105 show `[A905]` cannot, and `[U902]` can (M104). |

## Traceability

| Criterion | Tests | Real entry point | Can fail |
| --- | --- | --- | --- |
| AC-1.1 | `A901` | Plugin factory, `world.call` | Yes (M28) |
| AC-1.2 | `A902`, `U907`, `U908` | Factory | Yes, except the read and worktree catches (findings 2, 3) |
| AC-1.3 | `A903`, `U910` | Factory | Yes (M20, M21, M68, M69) |
| AC-1.4 | `A904`, `U911`, `U912` | Factory | Yes, except the resolver mode (finding 6) |
| AC-2.1 | `A905`, `U902` | Factory | Rejection yes. The message only in the unit (finding 1) |
| AC-2.2, AC-2.3 | `A906`, `A907`, `U903`, `U904` | Factory | Yes (M03, M09-M12) |
| AC-3.1 | `A908` (two), `U919` | Factory, `no-mistakes` only | Yes, but not the `ready` path (finding 4) |
| AC-3.2 | `A909`, `U915`, `U918` | Factory, `handoff` only | Yes, but not `ready` (finding 4) |
| AC-3.3 | `A910` | Factory | Yes (M101) |
| AC-3.4 | `A911`, `U921` | Factory | Yes (M30) |
| AC-3.5 | `A912` | Factory | Yes (M53) |
| AC-4.1 | `A913`, `U925`, `U928` | Factory, metadata map | Yes (M70, M74, M75, M96) |
| AC-4.2 | `A914`, `U927` | Factory, `failMetadata` | Yes (M72, M73) |
| AC-5.1 | `A915`, `U929`-`U932` | `callRpc` with a plugin caller | Yes (M80, M81, M88-M90) |
| AC-5.2 | `A916`, `A917`, `U933`, `U934` | `callRpc` | Yes (M92, M93, M97). The method list is the guarantee |
| AC-5.3 | `A917`, `U933` | Registrations in the fake host | Yes (M86) |

Untested criteria: none.
Tests that trace to nothing: the two untagged tests in finding 9.
FR-910 is covered by `[A918]`, M98, and ESLint.

## Remediation tasks

The feature is not done until R1 to R4 are cleared.
Each task names the mutant that must fail the new test.

- [ ] R1 (finding 1): Pin the key list by hand in `config.test.ts`: `expect(GATE_KEYS).toEqual([...16 names])`, and run `it.each` over the hand-written list. Change `[A905]` to require `/never remove a gate/`. Proof: `pnpm vitest run src/workflow/config.test.ts test/acceptance/extension-workflow.test.ts` fails with M04 to M06 and M103 applied.
- [ ] R2 (finding 2): Add a `getProjectCheckout` error hook to `FakeBbPort`. Test that a `done` report blocks, runs nothing, and leaves the task `working`. Proof: M27 fails it.
- [ ] R3 (finding 3): Test a `getThread` throw and a `getEnvironmentPath` throw through `report`. Both block and record nothing. Proof: M58 fails it.
- [ ] R4 (finding 4): Add `direct-PR` and `local-only` acceptance cases. A failing check gives `check_failed` on `ready`, a passing one records `checks` in the event, and another mode's checks do not run. Proof: M56 fails it.
- [ ] R5 (finding 5): Test a `blocked` and a `failed` report with failing checks configured, and with an invalid file. Both succeed and run no check. Proof: M54 fails it.
- [ ] R6 (findings 6, 7): Dispatch with a `dispatch.json` rule that matches the effective mode only, and assert the profile. Test the default of 200 with 201 rows and accept `limit: 1000`. Proof: M66 and M76 to M78 fail them.
- [ ] R7 (findings 8 to 10): Fix the log and ids, add an id to `[A918]` with its note, split the eager tests, and decide whether a check gets a default timeout. Proof: `pnpm run check`.

## What was not audited

- No mutation or coverage tool exists (`tdd-profile.md`), so strength rests on hand-picked mutants and is not a score.
- Not mutated: `src/workflow/types.ts` (types only), the reason-code constant in `refusal.ts`, and message wording.
- Spike items 9 and 10 and the `.bb/factoryman/` loading note in `spike/RESULTS.md` are self-reported. The probe plugins are not in the repository, and I ran no throwaway bb server.
- The fake host's merge of `updatePluginMetadata({ set })`, which keeps `role`, matches the spike note but ran only in the fixture.
- `docs/DESIGN.md` conformance and the reasoning in D-078 to D-083 were not judged. I checked their code claims: the 16 keys, the default of 200, and that the report tool is the only sender of `handoff` and `ready`.
- Flakiness: the full suite ran green twice (baseline and `pnpm run check`). That does not prove stability. Performance and load: no criterion, not assessed.

## Remediation status

The audit above is the record at commit `4bad48e`.
The remediation commit answers it, and this section is the only edit made to the report afterwards.
It was not re-audited from cold context, so the verdict line above still reads FAIL.

| Task | State | Evidence |
| --- | --- | --- |
| R1 | Done | `[U902]` runs over a hand-written list, `[U936]` pins it, and `[A905]` requires the message. M04 to M06 and M103 fail them. |
| R2 | Done | `[U937]`. M27 fails it. |
| R3 | Done | `[U938]`. M58 fails it. |
| R4 | Done | `[A919]`. M56 fails it. |
| R5 | Done | `[U939]`. M54 fails it. |
| R6 | Done | `[A920]` and `[U940]`. M66, M76, and M78 fail them. |
| R7 | Done | The bookkeeping, the splits, and the 600 second default for a check with no timeout (`[U943]`, finding 10). |

The suite after remediation: 80 files, 975 tests, all passing.

