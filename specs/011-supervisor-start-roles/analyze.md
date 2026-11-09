# Specification analysis report: supervisor start command, role advice, and the dispatch roles block

**Run**: after implementation, on the tree at `909b1e2`. The analysis is read-only: this file is the only one it writes.
**Inputs**: `spec.md`, `plan.md`, `tasks.md`, `data-model.md`, `contracts/`, `tdd/`, `checklist.md`, `docs/DECISIONS.md`, and `.specify/memory/constitution.md` (1.4.0).
Because the feature is built, the analysis also compares the design documents with the code and the evidence, and not only with each other.

## Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
| --- | --- | --- | --- | --- | --- |
| C1 | Constitution | CRITICAL | `constitution.md` Principle V; `docs/DECISIONS.md` D-133 | Thirteen behaviors passed on their first run, so "every behavior change is driven by a test that failed first" does not hold by the letter (`U1649`, `U1650`, `U1702`, `U1714`, `U1716`, `U1719`, `A1612`, and `U1723` to `U1726`, `A1621`, `A1622`). Each has a killing mutant, five more behaviors are `LIKELY`, and the TDD audit verdict is `FAIL`. D-133 records the deviation and says the captain has not accepted it. | The captain decides: accept D-133 as D-099, D-107, D-116, and D-122 were accepted, or ask for rework. Until then the feature is not merge-ready by its own rules. |
| C2 | Constitution | HIGH | `tdd/cycle-log.md` groups 6 and remediation 4; `docs/DECISIONS.md` | Principle V says tests are never deleted or weakened, and Governance says every deviation goes in the decision log. Tests were retired or replaced for stated reasons (`U1519` deleted because it could not fail, `A1508` removed, `U1397`/`U1398` replaced by `U1711` to `U1716`, `U1520` and `A1507` turned from "three entries" to "no entry", `U1519`'s premise). The reasons are only in the cycle log. No entry of the decision log names them. | Name them in D-133 (or a new entry), each with its reason and the test that replaced it. |
| I1 | Inconsistency | MEDIUM | `data-model.md:62-73` against `src/validator/agent.ts` | The model has `auto: boolean` and `readyProviders` on the observation. The code has `auto` as one more agent entry (kind `auto`) and no top-level field. The cycle log (group 5a) says so, and the model was not updated. | Update the model to the built shape. |
| I2 | Inconsistency | MEDIUM | `contracts/validator-observation.md:75` against `src/validator/agent.ts:183` | The contract puts a sentence "The host has no no-mistakes configuration file, so the default (auto) applies." before the `auto` line. The code writes "Validator agent: auto (the host has no no-mistakes configuration file, so the default applies). no-mistakes picks ...", so that the prefix `Validator agent:` is always the first words. The tests pin the built text. | Update the contract to the built text. |
| I3 | Inconsistency | MEDIUM | `tasks.md:50` and `tasks.md:94` | Both lines name the live-run tasks as "T038 to T041" and "T038 to T042". After the rewrite the live-run tasks are T040 to T043. | Correct the two references. |
| I4 | Inconsistency | LOW | `plan.md:113` (Q6) | The plan says the advice module "imports only the contract types". The lint rule forbids every import in `src/harness/`, so the module takes a structural type (`RoleChangeFacts`). The cycle log (group 4) records it. | Reword Q6. |
| I5 | Inconsistency | LOW | `plan.md` (Source code) | The layout omits files that the feature added: `src/validator/agent.shell.test.ts`, `test/fixtures/validator-read.ts`, `tools/conformance/wait.ts` and its test, `test/acceptance/roles-config.test.ts`, and the fixtures `runtime.ts` and `bb-cli.json`. | Add them to the layout. |
| I6 | Inconsistency | LOW | `tasks.md` | `T053` and `T054` (lab hardening) sit in phase 7 after `T043` and before `T044`, so the ids are not in file order. | Leave: they were added after the live runs, and renumbering ticked tasks is forbidden. Note it. |
| A1 | Ambiguity | LOW | `spec.md` (FR-002, user story 1) | "First session" (2 uses) and "first turn" (5 uses) name the same moment. Reviewer item CHK007 asks the same question. | Use "first turn" in the requirement and say once that the session is built for it. |
| U1 | Underspecification | MEDIUM | `checklists/safety-and-observation.md` | Thirty reviewer questions are open. The strongest: CHK001 (may a project have more than one started supervisor?), CHK013 (a supervisor in permission mode `full` can answer the owner's approval form, D-030; Pi is allowed as a supervisor by D-125), CHK025 (the evidence must not echo other configuration), CHK027 (is pluginMetadata applied before the first session on every provider, beyond the four tested?). None blocks a task. | The reviewer works the list; the captain answers CHK013. |
| E1 | Coverage | LOW | `tdd/test-list.md` | `SC-006` ("0 commands write to no-mistakes configuration") traces to one behavior, `A1613`. `U1726` proves the same under a real `sh`, but traces to `FR-015` only. | Add `SC-006` to the trace of `U1726`. |
| E2 | Coverage | LOW | `checklist.md` CHK1655 | The glue of `tools/conformance/real-lab.ts` and the claim that S9 passes on four real harnesses have only the live runs as proof, and the live runs are not automated tests. Known and recorded (D-107, D-133). | None. |
| S1 | Style | LOW | `docs/DECISIONS.md:106`; `plan.md` (5 lines); `research.md:14` | The constitution asks for one sentence per line. A few lines carry two. | Split them. |

No placeholders, no `NEEDS CLARIFICATION`, and no duplicate requirements were found.
The restatement of a requirement in an acceptance scenario (for example `US4.5` and `FR-019`) is the intended shape.

## Coverage summary

| Requirement key | Has task? | Task ids | Notes |
| --- | --- | --- | --- |
| FR-001 | yes | T011, T012, T013, T014, T015, T016... | 6 behaviors |
| FR-002 | yes | T002, T004, T011, T012, T015, T017 | 4 behaviors |
| FR-003 | yes | T002, T004, T011, T012, T015, T017 | 3 behaviors |
| FR-004 | yes | T011, T012, T015, T017 | 6 behaviors |
| FR-005 | yes | T003, T005, T011, T013, T015, T017 | 12 behaviors |
| FR-006 | yes | T008, T009, T011, T012, T015, T017 | 6 behaviors |
| FR-007 | yes | T002, T004, T013, T015 | 4 behaviors |
| FR-008 | yes | T011, T012, T013, T015, T017 | 4 behaviors |
| FR-009 | yes | T014, T016, T018, T020, T022, T023 | 3 behaviors |
| FR-010 | yes | T002, T004, T018, T019, T020, T021... | 12 behaviors |
| FR-011 | yes | T018, T019, T020, T021, T022, T023 | 3 behaviors |
| FR-012 | yes | T006, T007, T009, T010 | 5 behaviors |
| FR-013 | yes | T006, T007, T009, T010 | 4 behaviors |
| FR-014 | yes | T006, T007, T009, T010 | 4 behaviors |
| FR-015 | yes | T024, T026, T029, T030, T032, T033 | 4 behaviors |
| FR-016 | yes | T024, T025, T026, T029, T030, T032... | 19 behaviors |
| FR-017 | yes | T024, T025, T026, T030, T033 | 10 behaviors |
| FR-018 | yes | T024, T025, T026, T027, T030, T033 | 5 behaviors |
| FR-019 | yes | T024, T025, T026, T027, T030, T033 | 5 behaviors |
| FR-020 | yes | T024, T025, T026, T027, T029, T030... | 10 behaviors |
| FR-021 | yes | T024, T027, T029, T030, T032, T033 | 16 behaviors |
| FR-022 | yes | T024, T028, T031, T033 | 8 behaviors |
| FR-023 | yes | T024, T028, T031, T033 | 3 behaviors |
| FR-024 | yes | T034, T035, T036, T038, T039, T043 | 10 behaviors |
| FR-025 | yes | T034, T037, T039, T043 | 3 behaviors |
| FR-026 | yes | T040, T041, T043, T053, T054 | 4 behaviors |
| FR-027 | yes | T044, T046, T049 | 1 behaviors |
| FR-028 | yes | T001, T049 | 1 behaviors |
| FR-029 | yes | T003, T005, T008, T009, T012, T013... | 7 behaviors |
| SC-001 | yes | T040, T041, T043 | 2 behaviors |
| SC-002 | yes | T011, T017, T041, T043 | 2 behaviors |
| SC-003 | yes | T018, T023, T041, T043 | 2 behaviors |
| SC-004 | yes | T040, T043, T044, T048, T049 | 2 behaviors |
| SC-005 | yes | T024, T027, T030, T033 | 3 behaviors |
| SC-006 | yes | T024, T033 | 1 behaviors |
| SC-007 | yes | T011, T012, T013, T015, T017 | 6 behaviors |
| SC-008 | yes | T041, T042, T043 | 2 behaviors |
| SC-009 | yes | T001, T049 | 1 behaviors |

## Constitution alignment issues

| Principle | Result |
| --- | --- |
| I. Gates live in code and fail closed | Holds. A refused `supervisor start` spawns nothing (mutant `M4`), the observation never reports an unchecked or unobserved agent as ready (`M12`), and the hand-off is never refused by the observation. No gate was removed or added to the machine. |
| II. The machine core is pure | Holds. `src/machine/` is unchanged and no bb import was added to it or to `src/harness/`. |
| III, IV. Event log, storage | Not touched. |
| V. Test first | **Violated by the letter** (C1, C2). Recorded, with evidence, as D-133. |
| VI. Scope | Holds after the amendment to 1.4.0 (D-129). |
| Engineering constraints | One style finding (S1). No dependency was added. |

## Unmapped tasks

`T001` (baseline), `T050` to `T052` (the combined check, the compliance search, the quickstart), `T053` and `T054` (lab hardening that a live run called for), and `T055` to `T064` (the remediation of the TDD audit) map to a gate or to an audit finding and not to a requirement. None is scope creep: each is named in `checklist.md` or `tdd/verification.md`.

## Metrics

| Measure | Value |
| --- | --- |
| Requirements (functional / success criteria) | 29 / 9 |
| Acceptance scenarios | 46 |
| Behaviors on the test list | 148 (22 acceptance, 126 unit); all `DONE` |
| Tasks | 64, all ticked |
| Coverage (requirements with at least one behavior and one task) | 100 percent |
| Ambiguity count | 1 |
| Duplication count | 0 |
| Constitution findings | 2 (one CRITICAL, one HIGH) |
| Critical issues open | 1 (C1, waiting for the captain) |

## Next actions

- **C1** needs the captain: accept D-133 or ask for rework. It cannot be fixed by an edit.
- **C2, I1 to I5, A1, E1, S1** are edits to documents and one trace, and none changes behavior. `/speckit.converge` records them as tasks, and they are done in the same session.
- **U1** is the reviewer's list. Nothing here depends on it, and CHK013 is the one question that deserves the captain's eyes before Pi is used as a supervisor on a `local-only` project.

## Resolution after convergence

`/speckit.converge` turned the findings into tasks `T065` to `T071` of `tasks.md`.
The status below is as of the commit that carries this section.

| Finding | Status |
| --- | --- |
| C1 | Open. `T065` waits for the captain's decision on D-133. |
| C2 | Resolved by `T066`: D-133 names the retired and replaced tests with their reasons. |
| I1, I2 | Resolved by `T067` and `T068`: the data model and the contract describe the built shape and text. |
| I3, I6 | Not fixable by an edit, because existing tasks are never reworded or renumbered. `plan.md` records the right ids under "Amendments after implementation" (`T069`). |
| I4, I5, A1 | Recorded in the same amendments section (`T069`); the approved plan text is not reworded. |
| E1 | Resolved by `T071`: `U1726` traces to `SC-006`. |
| S1 | Resolved by `T070`: the lines were split with no change in wording. |
| U1, E2 | Unchanged: they belong to the reviewer, the maintainer, and the captain. |
