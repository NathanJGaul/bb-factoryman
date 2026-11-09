# Convergence: supervisor start command, role advice, and the dispatch roles block

**Date**: 2026-11-09
**Outcome**: Seven tasks were appended in phase 11 of `tasks.md`, and all seven are done. `T065` was the captain's decision on D-133, and the captain accepted it on 2026-11-09.
**Assessed at**: `4ffde3d` for the code and the tests (nothing under `src/`, `tools/`, `test/`, or `conformance/` has changed since the live runs except the commits listed in `tdd/cycle-log.md`). The documents were edited after it by tasks `T066` to `T071`.

## What was checked

29 functional requirements, 9 success criteria, 46 acceptance scenarios, 15 plan decisions (Q1 to Q15), and the six principles of the constitution with its engineering constraints.
The checks read `src/` (the adapter, the gate, the schema, the advice, the observation, the command, the hand-off, the preflight), `tools/conformance/`, `test/`, `conformance/`, and `docs/`.
Findings by gap type: missing 0, partial 5, contradicts 1, unrequested 1 (it overlaps one partial finding).
By severity: CRITICAL 1, HIGH 1, MEDIUM 2, LOW 3.

| Question | Answer |
| --- | --- |
| Does `bb factoryman supervisor start` spawn the supervisor with `role: supervisor` in the spawn call, from `--profile` or `roles.supervisor.profile` and never from `default`? | Yes. `src/tools/supervisor-start.ts`; `[A1601]` to `[A1605]`, `[A1621]`; mutants `M1`, `M2`, `M5`, `M6`, `M7` are caught. |
| Does it run the readiness, mode, model, and level checks without the worker admission rule, and spawn nothing after a refusal? | Yes. `gateReadiness` in `src/dispatch/gate.ts`; `[U1635]` to `[U1638]`; mutants `M3` and `M4` are caught. |
| Does `supervisor <thread>` print the advice that the contract calls for, and never "from its next session"? | Yes. `src/harness/advice.ts`; `[U1644]` to `[U1650]`, `[A1607]`; mutants `M10` and `M11` are caught. |
| Does `dispatch.json` accept the `roles` block, refuse every validator mode but `observe`, and stay valid without it? | Yes. `src/dispatch/config.ts`; `[U1612]` to `[U1622]`, `[A1606]`; mutants `M8` and `M9` are caught. |
| Does the plugin observe the validator's agent read-only, on the right host, and never claim readiness it did not confirm? | Yes. `src/validator/agent.ts`; `[U1656]` to `[U1689]`, `[U1723]` to `[U1726]` (a real `sh`), `[A1608]` to `[A1613]`; mutants `M12` to `M18` are caught. |
| Does the hand-off name the agent in the `handoff` evidence without refusing, and does the preflight refuse? | Yes. `src/tools/report.ts`, `src/machines/preflight.ts`; `[U1690]` to `[U1705]`, `[U1719]`; mutants `M19` to `M22` are caught. |
| Does S9 pass on the stub and on four real harnesses, with no known gap? | Yes. See the table below. |
| Is anything unrequested in the code? | One thing, and it is justified: the lab waits up to 60 seconds for bb's model catalog (D-132), which a live run called for. `plan.md` now says so. |
| Was `src/machine/` changed, or a dependency added, or a gate removed? | No (checked by `git diff`, and the lint rule passes). |

## Verdicts of the five runs

All runs: no credential, bb 0.49.0, isolation clean, tripwire with no event, exit code 0. Tier 1.5 ran offline.
The full table with versions and commits is in `/home/nathanjgaul/Projects/firstmate/data/bb-factoryman-supervisor-profile-validator-observe/pr-verdicts.md`.

| Run | CLI | S1 to S8 | S9 | S10 | S11 | S12 | Plugin commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tier 1, stub | stub-agent 0.0.1 | pass | pass (5 of 5 checks) | pass | pass | pass | `5042e16` |
| Tier 1.5, Claude Code | claude 2.1.316 | pass | pass (5 of 5) | skipped | pass | pass | `5042e16` |
| Tier 1.5, Codex | codex 0.166.0 | pass | pass (5 of 5) | skipped | pass | pass | `5042e16` |
| Tier 1.5, Pi | pi 1.4.0 | pass (S4 in `direct-PR`) | pass (5 of 5) | skipped | pass | pass | `53eeae8` |
| Tier 1.5, omp | omp 18.18.3 | pass | pass (5 of 5) | skipped | pass | pass | `5042e16` |

Before this change, S9 was a known gap with three entries on every harness.
The first Pi run failed S2 to S12 on an empty model catalog, and its rerun on the commit that waits for the catalog passed (D-132).

## Merge readiness

Ready for review. The one decision that belonged to the captain, D-133, was accepted on 2026-11-09 (`T065`), so nothing in the feature's own rules stands in the way of a merge decision.

- `pnpm run check` is green: 151 files, 2067 tests, typecheck and lint clean.
- The five runs are the end-to-end proof, and the evidence of S9 is in the result files.
- The TDD audit (`tdd/verification.md`) returned `FAIL` for the rubric's rule that any `TEST_AFTER` behavior fails a feature. Thirteen behaviors passed on their first run, because the behavior they pin already held. Each has a killing mutant. The audit's other findings were fixed in the remediation, and the re-check section in the report says which and with what evidence. D-133 records the deviation, and the captain accepted it on 2026-11-09 as a recorded test-after waiver.
- The reviewer-owned checklist `checklists/safety-and-observation.md` has 30 open questions. None blocks a task.

## Risk

- **Medium for the preflight.** A dispatch to a remote machine in a `no-mistakes` project is now refused when the validator agent is not ready or cannot be read. That is the point of the check, and it is a visible change for an owner whose pipeline agent is signed out. The refusal names the agent and bb's remedy.
- **The observation has not met a real no-mistakes install (D-134).** The reader is tested against the shipped file shape and a fake host. If the file differs, the line says "could not be observed" and gives the reason, and it never says ready.
- **Pi as a supervisor.** Pi is allowed as a supervisor in every mode (D-125). A supervisor in permission mode `full` can answer the owner's approval form (D-030). That exposure exists for any supervisor with a shell, and the feature does not add it, but it does make a Pi supervisor possible. Reviewer item CHK013 asks the captain.
- **`real-lab.ts` has no unit test (D-107).** The live runs are its test. A flaky bb catalog made the first Pi run fail, and the lab now waits for it.
- **Test strength.** Twenty-seven sampled mutants gave 26 caught and one survivor, and the survivor (the shell read) is now caught. The sample is not exhaustive and no mutation tool is installed.
- **`bb factoryman` usage text.** The registered `supervisor` command now has a two-line usage. The real bb 0.49.0 loaded the plugin and ran the command in all five labs, so the registration is accepted.

## Evidence

- `specs/011-supervisor-start-roles/tdd/cycle-log.md`: the reds, the mutants, the live runs, and the remediation.
- `specs/011-supervisor-start-roles/tdd/verification.md`: the audit and its re-check.
- `specs/011-supervisor-start-roles/checklist.md`: the quality gates with evidence.
- `specs/011-supervisor-start-roles/analyze.md`: the consistency analysis.
- `conformance/results/*.json` and `docs/HARNESS-SUPPORT.md`: the results, generated and checked by `[A1329]` and `[A1619]`.
- `/home/nathanjgaul/Projects/firstmate/data/bb-factoryman-supervisor-profile-validator-observe/live/`: the logs of the five runs and of the Pi investigation.

## Remaining work

- A fresh TDD audit to confirm the remediation, and the reviewer's pass over the 30 requirement questions.
- The first real no-mistakes project at the cutover shows the validator line (D-134).
- Tier 2 for each harness (credentials, the captain's), out of scope here.
- Directories that earlier runs leaked in the temporary directory stay until their owner removes them.
