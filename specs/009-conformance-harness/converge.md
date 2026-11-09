# Convergence: conformance harness for agent harnesses

**Run**: after `/speckit.analyze`.
**Inputs**: `spec.md`, `plan.md`, and `tasks.md` as the only source of intent, the constitution, and the code in the worktree.
**Method**: for each requirement, acceptance scenario, plan decision, and constitution principle, a read of the code and of the test or the live run that covers it.

## Result

The implementation satisfies the specification, the plan, and the tasks, with one open decision that is not the code's to make.
`/speckit.converge` found no unbuilt work, and it appended one task, `T1397`, under `## Phase 11: Convergence`.
Five `MED` audit tasks (`T1392` to `T1396`) stay open on purpose, and none blocks the suite.

## Merge readiness

| Question | Answer |
| --- | --- |
| Does the feature do what the captain asked? | Yes. Claude Code, Codex, Pi, and omp each ran the plugin's scenarios as real command-line tools behind a scripted fake model, offline, with no credential, and each result file names the CLI and bb versions. `docs/HARNESS-SUPPORT.md` is generated from them. |
| Did H6, H8, and H7 land? | Yes. H6: the stub agent and the lab scripts are in `tools/`, and `pnpm run conformance -- --tier 1` passes. H8: `bblab --offline`, and bb 0.49.0 starts offline (the build toolchain needs the network once, D-103). H7: the fake model with three wire formats, four drivers, result files, and the generated document. |
| Does every scenario pass? | S2 to S6, S8, S11, and S12 pass on all four harnesses, and S10 passes at tier 1. S1, S7, and S9 hold known gaps that wait for report tasks H1, H3, and H4 (D-101). omp's S7 checks a different shape because omp ends a failing turn normally (D-105). |
| Is the plugin unchanged? | Yes. `git diff 8148863..HEAD -- src` is empty, and the eight hard rules are untouched. |
| Did it touch a credential or the real home? | No. The keys in the lab are the literal `mock-not-a-credential`, the environment passes no host credential variable, and every run's evidence diff was clean. |
| Does the gate pass? | Yes. `pnpm run check` exits 0 with 125 files and 1471 tests, and `bb plugin build` builds the plugin. |
| Does the TDD audit pass? | No. The verdict is `FAIL` for one reason: 26 behaviors have tests that came after their code (D-107). |

## Evidence

- `tdd/test-list.md`: 158 of 158 behaviors `DONE`.
- `tdd/verification.md`: 53 of 54 hand-picked mutants killed (the other is equivalent), no open `HIGH` smell, every criterion covered.
- `tdd/cycle-log.md`: the red for each group, the live runs, and every defect that the live runs found.
- `conformance/results/*.json` and `docs/HARNESS-SUPPORT.md`: the results.
- `checklist.md` and `analyze.md`: the gates and the cross-artifact read.

## Risk

- **D-107 (constitution V).** 26 tests came after their code. Each has a revert-red or a killing mutant. The captain accepts or rejects the exception. The pull request should say so.
- **The live runs are not in `pnpm test`.** They need `bwrap`, a pinned bb, the harness CLIs, and about 10 minutes per harness. The real lab, the entry point, and the lab scripts have no unit test. A CLI upgrade is caught only when someone runs the suite.
- **The fake model is not a model.** Tier 1.5 shows that the plumbing works. It cannot show that a real model reads the skill, loads the deferred tool, follows the `xd://` route, or avoids `git push`. That is tier 2 and the model-behavior checks, which need a credential.
- **The isolation check is judged by a list.** It ignores churn from other tools and flags paths a harness or bb would write (D-106). A leak into a path outside the list would not fail the run, but the tripwire and the process list would still show it.
- **`/var/tmp/bblab-conformance` keeps a lab between runs.** Each run resets it and keeps the pinned bb and its toolchain. The directory holds about 560 MB.
- **Known gaps hide nothing but depend on the list.** A gap that is not in `conformance/known-gaps.json` fails the run, and a listed gap that passes fails it too.

## Remaining work

- The captain decides D-107.
- Report tasks H1 to H5 and H9 to H14 stay as the report lists them. H13 is the tier 2 run per harness, which needs the captain's credentials.
- `T1392` to `T1396`: the `MED` audit findings.
- The no-mistakes pipeline: review, tests, docs, lint, push, and the pull request. Firstmate starts it.
