---
feature: 004-machine-placement
verdict: FAIL
standard: .specify/extensions/tdd/templates/tdd-test-quality-rubric.md # resolved from the extension copy; no override or preset file exists
verified_at: 9e765f8 # short SHA audited (branch fm/bb-factoryman-milestones-7-11, range 5028c96..9e765f8)
behaviors: 80 # 24 acceptance (A801-A824) and 56 unit (U801-U856)
proven: 80 # 70 reproduced from the red commits, 10 passed against the stubs and rest on a mutant
likely: 0
test_after: 0
no_test: 0
high_smells: 0 # by the smell catalogue; the HIGH findings below come from surviving mutants. A812 is graded MED (finding 10)
criteria_total: 24 # AC-1.1 to AC-5.3, matches test-list.md
criteria_covered: 24 # every AC reaches a test through the fake host; AC-2.3, AC-2.4, AC-4.4, AC-5.1, AC-5.2 only partly
mutation_score: 76 # 69 of 91 hand-picked deliberate mutants killed, no tool; 77 if the 1 equivalent survivor is excluded. Plus 3 more killed in a scratch copy. Not a representative sample
mutants_survived: 22 # 1 equivalent (N4), 21 real (findings 1 to 12)
suite: 801 passed, 0 failed, 18.3 s wall, 72 files; pnpm run check (typecheck, lint, tests) clean, 17.2 s
---

# TDD verification: Machine placement

**Verdict: FAIL.**
Four fail-open paths survive a mutant: a `bb` read failure at dispatch, an unreadable source list at teardown, the preflight cache, and the remote exit-code wrapper that no test runs.
The discipline is otherwise strong: every behavior has a red commit, a tagged test that runs, and no existing test was weakened.
I did not write these tests, and I re-read every file cold.

## Test-first evidence

Each group has a red commit (tests plus stubs) before its implementation commit, so git history shows the order.
I extracted `b6303bd`, `48c2e3d`, and `bd22884` into scratch copies and ran the group tests against the stubs.
The failures match the cycle log: 41 failed at group 1 (35 new tests and 6 existing result-shape tests), 35 at group 2, 10 at group 3.

| Behaviors | Class | Evidence |
| --- | --- | --- |
| A801-A808, A814, A815, U801-U808, U810-U822 (31) | PROVEN | Failed at `b6303bd` with the logged messages. Implementation followed in `d2a8578`. |
| A817-A820, A822, U823-U832, U834-U845, U855, U856 (29) | PROVEN | Failed at `48c2e3d`. Implementation followed in `1d767d6`. |
| A809-A811, A813, U846, U848, U851-U854 (10) | PROVEN | Failed at `bd22884`. Implementation followed in `9e765f8`. |
| U809, A816, A812, U833, U847, U849, U850, A821, A823, A824 (10) | PROVEN | Passed against the stubs, and the log cites a mutant for each. My mutants fail them: A3 (A816), the scratch effects mutants (A812), H1 (U833), N14 (U847), N17 (U849), N10 and N11 (U850), D6 (A821), R1 and R10 (A823), H10 (A824). U809 is weak (finding 12). |

Changes to existing tests: `U45`, `U123`, `U186`, `U192`, `U702`, and `U710`-`U717` grew or moved with a changed requirement (D-077).
None is weakened, and `U702` swapped its unknown key from `machine` to `color` because `machine` is now valid.
The `A823` truncation case and `U839` were strengthened in `1d767d6` after a mutant survived, as the log says.
I found no `.skip`, `.only`, `.todo`, lint disable, config exclusion, or threshold change in the range.
The tasks match the list: every `[X]` task has `DONE` behaviors, and T841 (this audit) is open.

## Findings

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | HIGH | A `bb` read failure while placing a task fails open (hard rules 5 and 8). No test makes `getProjectSources` or `listMachines` reject during dispatch. Returning `ok: true` from the catch (mutant D4) spawns a pinned task on the default host. | `src/tools/dispatch.ts:75-77` |
| 2 | HIGH | An unreadable source list at teardown fails open (hard rules 2 and 8). Mutant H3 sets `host = null`, so the landed-work check runs on the server against a path that lives on another machine. No test fails `getProjectSources` at teardown. | `src/tools/teardown.ts:44-48` |
| 3 | HIGH | The preflight cache key can drop the host (mutant F4) or the provider (F5) and every test passes. A pass on one machine then skips the checks on another. `U844` is named "per host" and varies only mode and project. | `src/machines/preflight.ts:67`, `preflight.test.ts:88` |
| 4 | HIGH | No test runs the `FMX1` shell wrapper. The fake terminal prints a frame that the `frame()` helper builds, so producer and consumer are never tested together. Mutants W1 (`c=0`) and W2 (`2>&1`) survive, and so would any change to the exit-code capture. I ran the wrapper by hand and it works (exit 3, stdout, and stderr decode). | `src/machines/remote-exec.ts:18-21`, `remote-exec.test.ts:26` |
| 5 | MED | A `local-only` dispatch with a machine and no default source is refused only at the guard unit (`U816`). Mutant D13 (the first source becomes the clone) survives at dispatch level. This is a spec edge case on the hard rule 6 path. | `src/tools/dispatch.ts:68` |
| 6 | MED | The provider check on the target host is unpinned (D5). Because the preflight caches a pass (finding 3), this live check is the only protection after the cache fills. A throw from the preflight also fails open (D8). | `src/tools/dispatch.ts:126,137-139` |
| 7 | MED | The task's host is dropped without notice for `answer` (H6) and for the `status` poll (H5). `U836` covers only `start`, and no acceptance test runs the validator on a remote machine. | `src/validator/driver.ts:83,153` |
| 8 | MED | The monitor's "only its own blocks" rule is thinly pinned. "Latest applied row" (N5), the `applied` filter (N6), and the actor check (N3) each survive. A flapping host followed by a worker block would be unblocked by the first mutant. The prefix check (N4) is equivalent today, because only the monitor writes system blocks. | `src/machines/monitor.ts:66-67` |
| 9 | MED | AC-2.4 says a deleted machine's task is "never unblocked". The code relies on the host leaving `hosts.list` (D-072). In a scratch test, `hostDeleted` then a tick with the host still listed online moved the task back to `working`. `A811` removes the host from the list before the monitor ticks (line 66). | `src/machines/monitor.ts:36,45` |
| 10 | MED | `A812` skips illegal rows with `if (!result.ok) continue`. The catalogue grades this HIGH. I grade it MED because it ran 31 of 33 rows and killed 3 scratch mutants. The floor of 15 would hide 16 skipped rows. | `test/acceptance/machine-placement-gates.test.ts:19,25` |
| 11 | MED | Eager tests with several behaviors each: `U856` (usage, success, failure, context, unknown machine), `A805` (name, unknown, ambiguous), and `U844` (four cache rules). | `supervisor-command.test.ts:42`, `machine-placement.test.ts:66`, `preflight.test.ts:88` |
| 12 | LOW | Smaller survivors. P11: the command path for the clone host. R4: a `starting` terminal. N8 and N9: warning re-arm and `torn_down`. S1, S2, N16: the `machinePollSeconds` default, unit, and floor. `U809` uses empty lists, so my guarded mutant P12 died only in `U801`. | `supervisor-command.ts:73`, `remote-exec.ts:62`, `monitor.ts:9,71`, `server.ts:73,83`, `placement.test.ts:74` |
| 13 | LOW | Four fixed real sleeps (20-30 ms) prove a negative in the monitor acceptance tests. Eight repeat runs did not flake. | `machine-monitor.test.ts:33,54,68,85` |
| 14 | LOW | Bookkeeping. `tasks.md:31` says D-069 to D-074 (D-077 exists). `test-list.md` still says `updated_at: 5028c96`. Two tests share `[A820]` (`machine-remote.test.ts:64,75`). Six tests have no id and trace to nothing: `placement.test.ts:78`, `route.test.ts:25`, `preflight.test.ts:80,123`, `remote-exec.test.ts:97`, `supervisor-command.test.ts:68`. The `sources` setup is copied in three acceptance files, and `supervisor-command.test.ts:2-3` imports one module twice. | as listed |

## Mutation results

Scope: 91 mutants in the changed files, applied one at a time, run against the matching unit and acceptance files, then restored with `git checkout`.
I ran 3 more in a scratch copy (`src/machine/effects.ts`, unchanged by this milestone), and `A812` killed all three.
The count is above the 25 to 30 planned, because each survivor on a hard-rule path needed neighbors to judge it.

| Area | Killed | Survived | Judgment |
| --- | --- | --- | --- |
| Local-only guard and table (G1-G5) | 5 | none | Mode, compare, unknown clone, and both lanes are pinned. |
| Dispatch preview and clone host (D1, D2, D10, D13) | 3 | D13 | Finding 5. Removing the preview fails `A814`. |
| `pickMachine` (P1-P10, P12) | 11 | none | Offline, phase, no source, unknown, ambiguous, precedence, case, and trim all die. |
| Rule machine (C1-C4) | 4 | none | Ambiguity, carry, and blank all die. |
| Dispatch flow and ordering (D3-D9, D11, D12, E2-E4) | 9 | D4, D5, D8 | Findings 1 and 6. Blockers before task creation are pinned (E2-E4). Falling back after a block dies (D3). |
| Preflight (F1-F9, P11) | 7 | F4, F5, P11 | Per-mode checks die. Caching is findings 3 and 12. |
| Monitor (N1-N15, N17) | 10 | N3, N4, N5, N6, N8, N9 | Findings 8 and 12. Missing host as offline, working only, warn once, and deletion all die. N4 is equivalent. |
| Settings (S1, S2, N16) | none | 3 | Finding 12. |
| Remote runner and wrapper (R1-R11, W1, W2) | 10 | R4, W1, W2 | Finding 4. Frame decode, truncation, timeout, disconnect, and cleanup die. R3 dies only on a test timeout. |
| Host routing (H1-H10) | 7 | H3, H5, H6 | Findings 2 and 7. Teardown, report, `start`, and `cancel` hosts die. |
| Adapter (A1-A3) | 3 | none | Online flag, source check, and default host die. |

## Traceability

Each acceptance test calls the registered tool, service, or command through `loadWorld` (`callAgentTool`, `runService`, `runCli`, `emitThreadEvent`).
Only the bb SDK is faked.

| Criterion | Tests | Real entry | Can fail |
| --- | --- | --- | --- |
| AC-1.1 to AC-1.4 | `A801`-`A804`, `U801`, `U822` | Yes | Yes (D9, D11, D12, A3) |
| AC-1.5, AC-1.6 | `A805`, `A806`, `U803`-`U807` | Yes | Yes, except finding 1 |
| AC-1.7 | `A807`, `U811`, `U812` | Yes | Yes (C1) |
| AC-2.1 | `A808`, `U805`, `U806` | Yes | Yes (P1, D3), except finding 1 |
| AC-2.2, AC-2.6 | `A809`, `A813`, `U846`, `U854` | Yes (the service) | Yes (N1, N2, N14) |
| AC-2.3 | `A810`, `U848`, `U849` | Yes | Partly (finding 8) |
| AC-2.4 | `A811`, `U853` | Yes (the event) | Partly (finding 9) |
| AC-2.5 | `A812`, `U818` | `transition` (the machine's public entry) | Yes (3 scratch mutants), finding 10 |
| AC-3.1 to AC-3.3 | `A814`-`A816`, `U814`-`U818` | Yes | Yes (G1-G5, D1, D2), except finding 5 |
| AC-4.1 to AC-4.3 | `A817`-`A819`, `U838`-`U845` | Yes (`bb factoryman preflight`) | Yes (F1, F2, F7-F9) |
| AC-4.4, AC-4.5 | `A820`, `A821` | Yes | Partly (D8, P11, findings 3 and 6) |
| AC-5.1 | `A822`, `U835`-`U837` | Teardown only, not the validator | Partly (findings 4 and 7) |
| AC-5.2 | `A823`, `U827`-`U831` | Yes | Yes, except finding 2 |
| AC-5.3 | `A824`, `U832` | Yes | Yes (H10) |

Untested criteria: none.
Tests tracing to nothing: the six untagged tests in finding 14.

## Remediation tasks

The feature is not done until R1 to R4 are cleared.
I did not edit `tasks.md`.

- [ ] R1 (finding 1) Add an acceptance test where `listMachines` or `getProjectSources` rejects during a pinned dispatch. Expect `isError`, "could not read bb's machines", no spawn, and no task. Prove it with `pnpm vitest run test/acceptance/machine-placement.test.ts`, then confirm that `ok: true` in the catch at `dispatch.ts:75-77` fails it.
- [ ] R2 (finding 2) Add a fixture toggle that makes `projects.get` fail after dispatch, then test that teardown refuses and records nothing. Confirm that mutant H3 fails it.
- [ ] R3 (finding 3) Extend `U844` with a second host and a second provider on the same project and mode. Expect each to run its own checks. Confirm that F4 and F5 fail it.
- [ ] R4 (finding 4) Add a unit test that runs `WRAPPER` through `sh -c` for exit 0, exit 3 with output on both streams, and a failing `git`, and decodes each with the runner. Confirm that W1 and W2 fail it.
- [ ] R5 (finding 5) Add an acceptance test for `local-only` with a machine and no default source. Expect `machine_mismatch`.
- [ ] R6 (finding 6) Add tests for a provider unavailable on the target host only, a cached preflight followed by a lost provider, and an `exec` that rejects during the preflight.
- [ ] R7 (finding 7) Add a driver test for a remote task in `needs_decision` and in the wait loop that expects the host on `answer` and `status`.
- [ ] R8 (finding 8) Add monitor tests for block, unblock, then a worker block while online (stays blocked), a refused row after the monitor's block (still unblocks), and a system block without the prefix.
- [ ] R9 (finding 9) Decide the rule. Either record removals so a deleted host's task is never unblocked, or reword AC-2.4 and D-072. Add a test where the host stays listed online.
- [ ] R10 (findings 10, 11) Assert the exact count in `A812` or use `it.each`. Split `U856`, `A805`, and `U844` into one behavior per test.
- [ ] R11 (findings 12 to 14) Cover P11, R4, N8, N9, and the settings, use a non-empty list in `U809`, replace the sleeps with `settle` on a tick, and fix the bookkeeping. Run `pnpm run check`.

## What was not audited

- No mutation or coverage tool exists (`tdd-profile.md`), so strength rests on hand-picked mutants and is not a score.
- No real bb or second machine ran. The wrapper ran once by hand on the local shell. Milestone 11 is the first live check.
- Not mutated: the `reportText` wording, the `status` line, command argument parsing, the `readTerminal` chunk order, and the `server.ts` handler error catches.
- Flakiness: the full suite ran green twice (baseline and `pnpm run check`), and the monitor and remote files ran eight times. That does not prove stability.
- `docs/DESIGN.md` conformance and the reasoning in D-069 to D-077 were not judged. The refused preview in dispatch is not written to the event log, because no task exists yet (D-073).

## Remediation status

The audit above is the record at commit `9e765f8`.
The remediation commit answers it, and this section is the only edit made to the report afterwards.
It was not re-audited from cold context, so the verdict line above still reads FAIL.

| Task | State | Evidence |
| --- | --- | --- |
| R1 | Done | `[U857]`, `[A827]`. The mutant that returns `ok: true` from the placement catch now fails 3 tests. |
| R2 | Done | `[U861]`. Mutant H3 fails it. |
| R3 | Done | `[U882]` to `[U884]`. Mutants F4 and F5 fail them. |
| R4 | Done | `[U878]` runs the wrapper under a real shell. Mutants W1 and W2 fail it. |
| R5 | Done | `[A826]`. Mutant D13 fails it after the source order was fixed. |
| R6 | Done | `[U858]` to `[U860]`. Mutants D5 and D8 fail them. |
| R7 | Done | `[U879]`, `[U880]`. Mutants H5 and H6 fail them. |
| R8 | Done | `[U862]` to `[U864]`, `[U877]`. N3 and N6 fail. N5 is equivalent (cycle R1). |
| R9 | Done | `[U865]` was red. The monitor keeps removed host IDs, and D-072 says so. |
| R10 | Done | `[A812]` runs 33 cases with no skip. The eager tests are split. |
| R11 | Done | The smaller survivors, the untagged tests, and the bookkeeping. |

The suite after remediation: 72 files, 873 tests, all passing.

