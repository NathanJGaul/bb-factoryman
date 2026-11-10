# Convergence: the `factoryman_decide` tool

Assessment of the tree at `dc96148` against `spec.md`, `plan.md`, and `tasks.md`.

**Outcome: one task was appended, T048, and it is done.** The implementation satisfies the specification, the plan, and the task list, with two open items for the owner (below).
T048 asked for the five offline conformance runs to be repeated on the last code commit, because the result files named an earlier commit (FR-021, partial).
The runs were repeated on `8a6e998`, and the files now name it.

## What was checked

| Source | Result | Evidence |
| --- | --- | --- |
| FR-001, FR-002 (registration, flat schema) | Met | `[A1816]`, `[U1824]`, `[U1825]`; mutants V4, V18 |
| FR-003, FR-004 (task, live view) | Met | `[A1805]`, `[A1810]`, `[U1808]`, `[U1809]` |
| FR-005 (the key) | Met | `[U1801]` to `[U1803]`, `[U1805]` to `[U1807]`, `[A1813]`, `[A1808]`; the spec now says the validator's order (analysis A2) |
| FR-006, FR-007 (answers, finished runs) | Met | `[U1817]`, `[U1818]`, `[U1848]`, `[A1805]`, `[A1811]`, `[A1812]` |
| FR-008, FR-009, FR-018, FR-019 (the form) | Met | 26 form tests, `[A1814]`, `[A1815]`, `[A1821]`, `[A1806]`; `src/app.tsx` registers both renderers |
| FR-010, FR-011 (approval, second read) | Met | `[A1807]`, `[A1808]`, `[U1823]`; 41 deliberate mutants, none survived |
| FR-012, FR-013 (resolve and evidence) | Met | `[A1801]` to `[A1803]`, `[A1811]`, `[U1810]` to `[U1812]`, `[U1820]` |
| FR-014 (no machine change) | Met | `git diff 9f87647..HEAD -- src/machine` prints nothing |
| FR-015 (no `--yes`) | Met | `[A1804]`, `[U180]`, `[U194]`; the real adapter over the recorded gate output |
| FR-016 (one form per task) | Met | `[A1809]` |
| FR-017 (no log row; plugin log line) | Met | `[A1807]`, `[U1849]`; the plugin log gap was found by the analysis and fixed in cycle 14 |
| FR-020, FR-021 (harness suite, runs) | Met | `[U1837]`, `[U1838]`, `[U1847]`, `[A1817]`; five runs on `8a6e998`, exit 0, `dirty: false`, isolation clean |
| FR-022 to FR-024 (documents) | Met | `[U1836]`, `[U1840]` to `[U1842]`, `[A1819]` |
| FR-025, FR-026 (hard rules, temporary directories) | Met | checklist CHK1801 to CHK1815; the leak count is unchanged |
| SC-001 to SC-008 | Met | checklist CHK1801 to CHK1845 |
| Plan: key, driver, tool, form, registration, conformance, documents | Met | commits `a73dc72` to `dc96148` |
| Constitution I to IV, VI | Met | no gate, machine, store, or scope change beyond the amendment (1.5.0) |
| Constitution V | One exception | eleven test-after behaviors (D-144, verification finding 1) |

Findings by gap type: missing 0, partial 1 (FR-021, closed by T048), contradicts 0, unrequested 0.
Items the work added that the spec did not list, and why they stay: `src/tools/decide-text.ts` (shared wording, D-145), `modelsReady` in the conformance readers (D-147, a lab fix that two live runs called for), the plugin log lines (FR-017), and the lint-isolation warm-up (a flaky test found at the baseline).

## Merge readiness

- **Risk**: medium-low. The tool answers a pipeline gate, so a defect could answer the wrong gate. The guards are the key check before the form and again after it, the strict reply, one form per task, the machine's preview of `resolve`, and a refusal on any failed read. Each was proved by mutants. The gate is in the tool and not in the machine (D-140), and a form is not proof of a human (D-030, D-058, D-095).
- **Evidence**: `checklist.md` (quality gates), `tdd/verification.md` (audit, 41 mutants, and the addendum), `analyze.md`, `tdd/cycle-log.md` (15 cycles, with the corrections), the five result files, and the decision log from D-136.
- **Open for the captain**:
  1. The eleven test-after behaviors (task T047, D-144): accepted by the captain on 2026-11-10 through Firstmate, on the same footing as D-099, D-108, D-122, D-133, and D-135. The rubric fails the feature for it, and each behavior fails when its check is removed.
  2. The look of the decision form in a real bb (D-146), which does not block the merge (the captain, 2026-11-10). It was not opened, so the list of findings, the scroll box, and the answer block have not been seen in either theme or at a narrow width. Run the lab check of the approval-form lane with a task parked in `needs_decision` before the first real decision.
- **Not done, by decision**: tier 2 runs and credentials (shelved), branch protection work, a machine event for accepting an override (D-141).
- **Not exercised**: what `no-mistakes axi run` does after a finished run, a decision against a real pipeline, and a restart while a form is open (D-141, D-146).
- **No hosted CI**: the repository has none. The pipeline runs `pnpm run check`.
