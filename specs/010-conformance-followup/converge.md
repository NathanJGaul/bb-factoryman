# Convergence: conformance follow-up after the harness contracts landed

**Date**: 2026-11-09
**Outcome**: Converged. The implementation satisfies the spec, the plan, and the tasks, and no task was appended.
**Assessed at**: `4f28108` (the lab code of the runs is `1e7be3e`, and nothing under `tools/`, `src/`, `package.json`, the lock file, or `conformance/known-gaps.json` changed after it).

## What was checked

15 functional requirements, 7 success criteria, 18 acceptance scenarios, 8 plan decisions (Q1 to Q8), and the six principles of the constitution.
The checks read the code in `tools/conformance/`, `test/`, `conformance/`, `docs/`, and `vitest.config.ts`, and the five result files.
Findings by gap type: missing 0, partial 0, contradicts 0, unrequested 0.

| Question | Answer |
| --- | --- |
| Does a driver name the delivery mode of its lab project, and does the runner use it? | Yes. `Driver.deliveryMode` and `deliveryModeOf` (`tools/conformance/drivers/types.ts`), Pi names `direct-PR`, and `real-lab.ts` writes the row through `projectRowScript`. |
| Does S4 follow the mode, with the same three facts? | Yes. `tools/conformance/scenarios/s04-ship.ts`. In `direct-PR` it sends the pull request, and it puts a note on `S4.review-ready`. The scenario is named "Ship". |
| Does omp ask for a level that its model lists? | Yes. `auto`. The unsupported profile still differs in the permission mode only. |
| Are the three stale known gaps gone and the S9 gaps kept? | Yes. `conformance/known-gaps.json` holds three entries, all for S9 and task H4. |
| Is the decision log unique and are its citations valid? | Yes. D-001 to D-122, one heading each, and the guard keeps it so. Nothing needed renumbering (D-120). |
| Do the tests leave nothing in the temporary directory? | Yes. A private directory for each test file, proved in a child process, wired in the root config (U1532), and measured: 394 directories before, 0 after. A final `pnpm run check` in the default `TMPDIR` added none (3159 before, 3159 after, from earlier runs of other sessions). |
| Do the five runs show it? | Yes. See the table below. |
| Is anything unrequested in the code? | No. The decision-log guard, U1529, and the fixtures of the child process are in the plan. |
| Was `src/` changed? | No. |

## Verdicts of the five runs

All runs: offline, no credential, bb 0.49.0, plugin commit `1e7be3e`, isolation clean, tripwire no events, exit code 0.

| Run | CLI | S1 | S2 | S3 | S4 | S5 | S6 | S7 | S8 | S9 | S10 | S11 | S12 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Tier 1, stub | stub-agent 0.0.1 | pass | pass | pass | pass | pass | pass | pass | pass | known gap (H4) | pass | pass | pass |
| Tier 1.5, Claude Code | claude 2.1.316 | pass | pass | pass | pass | pass | pass | pass | pass | known gap (H4) | skipped | pass | pass |
| Tier 1.5, Codex | codex 0.166.0 | pass | pass | pass | pass | pass | pass | pass | pass | known gap (H4) | skipped | pass | pass |
| Tier 1.5, Pi | pi 1.4.0 | pass | pass | pass | pass (`direct-PR`) | pass | pass | pass | pass | known gap (H4) | skipped | pass | pass |
| Tier 1.5, omp | omp 18.18.3 | pass | pass | pass | pass | pass | pass | pass | pass | known gap (H4) | skipped | pass | pass |

Before this change (the live check of the two merged pull requests): Pi and omp failed S2 to S8, S11, and S12, and every run exited 1 on three stale gaps (S1.unready-blocks, S1.remedy, S7.cause).

## Merge readiness

Ready for review. The one decision that belonged to the captain (D-122) is accepted.

- `pnpm run check` is green: 143 files, 1842 tests, typecheck and lint clean.
- The five runs are the end-to-end proof of the lab changes, and each exits 0.
- The TDD audit (`tdd/verification.md`) has no `HIGH` smell, no weakened test, and no surviving mutant after the remediation. Its verdict is `FAIL` by the rubric, for one reason: eleven behaviors passed on their first run, because the behavior they pin was already true. Each has a killing mutant. D-122 records the deviation, and the captain accepted it on 2026-11-09, as for D-107 and D-116.

## Risk

- Low. The change is in tests, tools, and documents. Nothing under `src/` changed, so nothing in a shipped plugin changes.
- The lab-side change for Pi (a `direct-PR` project and a made-up pull request URL) rests on the plugin checking that the URL is present and valid and calling no forge. The live Pi run shows it for the bb and the plugin of today. A plugin that starts to check a forge would turn S4 for Pi red, which is the signal the suite is for.
- `real-lab.ts` has no unit test (D-107). The five runs are its test.
- The leak fix makes each test file run with a private `TMPDIR`. A test that needs a path under `/tmp` by name would fail in the full run. None does.
- omp moved from 18.14.1 to 18.18.3 between the live check and these runs, with no change in the verdicts.

## Evidence

- `specs/010-conformance-followup/tdd/cycle-log.md`: the red and green of each group, the mutants, the leak measure, and the live runs.
- `specs/010-conformance-followup/checklist.md`: the quality gates with evidence.
- `conformance/results/*.json` and `docs/HARNESS-SUPPORT.md`: the results, generated and checked by `[A1329]`.
- `/home/nathanjgaul/Projects/firstmate/data/bb-factoryman-conformance-followup/`: the run script, the five run logs, the verdict file, and copies of the results.

## Remaining work

- Tier 2 for each harness (credentials, the captain's), `bb factoryman supervisor start` (H4), and the validator readiness check: other tasks, out of scope here.
- Directories that earlier runs leaked in `/tmp` stay until their owner removes them.
