# Analysis: conformance harness for agent harnesses

**Run**: after `/speckit.tdd.run`, `/speckit.tdd.verify`, the audit remediation, `/speckit.implement`, and `/speckit.checklist`.
**Inputs**: `spec.md`, `plan.md`, `tasks.md`, `tdd/*`, `checklist.md`, the constitution, `docs/DECISIONS.md`, and the code at `HEAD`.
**Method**: a read of each artifact against the code, and the counts in `tdd/test-list.md`.
This report only reads.
I wrote the spec, the plan, the tasks, and the code, so the analysis is not independent.

## Summary

The artifacts agree with the code, with one open constitution finding.
Constitution principle V says that every behavior change is driven by a test that failed first.
26 behaviors have tests that came after their code (D-107), so the TDD audit stays at `FAIL`, and this analysis counts it as critical, as the rules require.
It is recorded, mitigated by revert-reds and mutants, and waits for the captain's decision.
Everything else is consistent.
The plan's layout had drifted from the code, and I corrected it in this run.

| Check | Result |
| --- | --- |
| Functional requirements traced to a task and a behavior | 18 of 18 (FR-1301 to FR-1318) |
| Success criteria traced | 7 of 7 (SC-1301 to SC-1307), each with a live run or a test |
| Acceptance scenarios traced to a behavior | 28 of 28 (AC-1.1 to AC-6.4) |
| Behaviors in the test list | 30 acceptance and 128 unit; all `DONE` (five of the acceptance ones by a live run) |
| Tasks | 63, with 5 open (`T1392` to `T1396`, the `MED` audit findings) |
| Constitution principles with a violation | 1 (V, finding C1) |
| Deviations recorded | D-100 to D-107 |
| Suite | 125 files, 1471 tests, `pnpm run check` exit 0 |
| Live runs at the end | tier 1 and tier 1.5 for the four harnesses, all exit 0 |

## Findings

| ID | Category | Severity | Location | Summary | Recommendation |
| --- | --- | --- | --- | --- | --- |
| C1 | Constitution | Critical | `tdd/verification.md`, D-107 | 26 behaviors came after their code. Each has a recorded revert-red or a killing mutant. | The captain accepts or rejects the exception (as for D-099). Not an implementation task |
| D1 | Drift | Low | `plan.md` source layout | The plan named `lab.ts` and a few modules that were split during the work (`real-lab.ts`, `lab-env.ts`, `readers.ts`, `isolation.ts`, `shell.ts`). | Fixed in this run |
| D2 | Drift | Low | `spec.md` SC-1306 | "One driver file" is two edits: the driver, and its entry in `drivers/index.ts` (and a wire module for a new request format). | `docs/CONFORMANCE.md` says so. No spec change |
| D3 | Scope | Info | `spec.md` Assumptions | The spec expected S7 to fail the task on every harness. omp ends a failing turn normally, so S7 checks the silent-turn wake there. | Recorded in D-105 and shown as a note in the support document |
| D4 | Scope | Info | `conformance/known-gaps.json` | The report's "passes S1 to S9, S11, and S12" holds with five known gaps, because H1, H3, and H4 are out of scope. | Recorded in D-101 |
| D5 | Coverage | Info | `real-lab.ts`, `cli.ts` | No automated test. | The live runs are the test (D-107). Not a gap in the spec |
| D6 | Tasks | Low | `tasks.md` T1334 | The task text names `tools/conformance/lab.ts`. The code is in `real-lab.ts`. | Left as written, because a task is history. This report is the pointer |

## Coverage of the spec

- **US1** (tier 1): FR-1301 to FR-1310 and SC-1301 are met by `run.ts`, the scenarios, and the tier 1 live run.
- **US2** (known gaps): FR-1303 and FR-1308 are met by `verdict.ts`, `gaps.ts`, and `conformance/known-gaps.json`.
- **US3** (tier 1.5): FR-1306, FR-1312, FR-1313, and SC-1302 are met by the drivers and the four live runs.
- **US4** (fake model): FR-1311 is met by `tools/fake-model/` and its process tests.
- **US5** (offline): FR-1314 and FR-1315 are met by `bblab --offline` and D-103.
- **US6** (document): FR-1316 is met by `docs.ts`, `docs-cli.ts`, and `[A1329]`.
- **FR-1317** (plugin unchanged): `git diff 8148863..HEAD -- src` is empty, and `[A1330]` keeps the tools from importing it.
- **FR-1318** (deviations): D-100 to D-107.

## Constitution check

| Principle | Result |
| --- | --- |
| I. Gates live in code | No gate was added or changed. S8 and S11 observe the refusals. |
| II. Machine core is pure | `src/` is untouched, and the tools import nothing from it (`[A1330]`). |
| III. Event log is the source of truth | The scenarios read the log through the read RPC. |
| IV. Storage behind an interface | Untouched. |
| V. Test first | Violated for 26 behaviors (C1). |
| VI. Scope | Within the captain's intent and the Firstmate spec. No H1 to H5 task was built, no tier 2 ran, no credential was handled. |
