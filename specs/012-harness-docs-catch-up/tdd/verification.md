---
feature: 012-harness-docs-catch-up
verdict: FAIL
standard: .specify/extensions/tdd/templates/tdd-test-quality-rubric.md
verified_at: 284443c
behaviors: 12
proven: 10
likely: 0
test_after: 1
no_test: 0
not_applicable: 1
high_smells: 0
criteria_total: 10
criteria_covered: 10
mutation_score: 94 # deliberate mutants, 18 sampled, 17 caught; scope: the three changed documents
mutants_survived: 1 # M16, triaged as redundant text (finding 3)
suite: 2076 passed, 0 failed, 46s
---

# TDD verification: Harness documentation catch-up

**Verdict: FAIL.** One behavior (A1707, through its adapted test `[A1109]`) is `TEST_AFTER`: the new flag table of the plugin-command check passed on its first run against the old runbook, because the old runbook names none of the new commands.

**This audit was not independent.**
The session that wrote the tests ran it, and no fresh-context subagent was used, because the three test files are small and I read every line again.
Two things reduce the risk:

- The ordering evidence does not rest on the cycle log. For each cycle I restored the parent commit's document (`git show <parent>:docs/...`), ran the cycle's tests against it, and restored the new document with `git checkout`. The reds below are reproduced from git.
- The mutants were applied by a script, one at a time, each restored with `git checkout` and checked with `git status`.

The auditor's own bias still applies to what it did not look for.

## Test-first evidence

The repository commits only at green (D-099), so a cycle commit holds its test and its document together.
A behavior is `PROVEN` here when the cycle log records the red and the reproduction from git agrees.

| Behavior | Class | Evidence |
| --- | --- | --- |
| A1701 to A1705, A1708 | PROVEN | `[A1701]`, `[A1702]`, `[A1703]`, `[A1704]`, `[A1705]`, and `[A1708]` fail against `docs/LIVE-CHECK.md` at `7e4359e` (14 of 16 tests failed) |
| A1706 (`[A1114]`) | PROVEN | fails against the old runbook (same run) |
| A1707 (`[A1107]`, `[A1108]`, `[A1109]`, `[A1112]`) | TEST_AFTER | `[A1108]` and `[A1112]` fail against the old runbook. `[A1107]` is unchanged. `[A1109]` passes against it (finding 1) |
| A1709, A1710 | PROVEN | both fail against `docs/DESIGN.md` at `df1907a` (2 of 2) |
| A1711 | PROVEN | fails against `docs/DECISIONS.md` at `f02c7c3` (`[A1711]` and `[A1510]`) |
| A1712 | NOT_APPLICABLE | checked by `git diff --stat` (task T010), because a test cannot know the base commit |

The adapted tests that the list does not name, `[A1111]`, `[A1113]`, `[A1122]`, `[A1123]`, and `[A1124]`, all fail against the old runbook in the same run.

### What the change did to tests that already existed

Nine tests of `test/acceptance/live-check.test.ts` and the decision-log file changed their expectations.
No assertion was loosened.
Each removed expectation is replaced by one for the new text that checks the same property.

| Test | Removed expectation | Replacement |
| --- | --- | --- |
| `[A1108]` | the `Funding decision` regex; eight gaps with "stub agent" | funding moved to `[A1111]`; nine gaps, "Pi ship task" and "tier 2 run" added |
| `[A1111]` | tier 2 row says "the captain's own Claude account" | `[A1701]` pins the row as "the credential of the harness under test (section 7)", and `[A1111]` pins both funding sentences |
| `[A1112]` | spawn line has `--provider claude-code`, `--reasoning-level low`; "Haiku-class" | `dispatch init` line has `--model <cheapest model>` and `--level <lowest level>`; `[A1708]` forbids the old words |
| `[A1113]` | "That stub agent does not exist yet.", and the skip line in the gate | `[A1702]` forbids both; the gate pins "tier 1.5 passed for the harness you will run" |
| `[A1114]` | four fixed credential lines; one raw `setup-token` line | seven fixed lines; two raw lines; a new `sk-` literal check |
| `[A1122]` | `.run('$PROJ', 'local-only', 'main')`; the order spawn, stamp, tell | `.run('$PROJ', '$MODE', 'main')`; the order start, tell |
| `[A1123]` | "Read your Claude usage" | "Read the usage of each account" |
| `[A1124]` | "the token" wording | "the credential" wording |

Each removal follows a requirement change that D-135 records.
The tests were not skipped, and no threshold or config exclusion changed.

`tasks.md`: T009 to T011 were open at the audit and are the polish tasks. Every ticked task has a `DONE` behavior behind it.

## Findings

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | MED | `[A1109]` is `TEST_AFTER`. It passed on its first run, because the new entries of its flag table (`dispatch init`) only allow more, and the old runbook names none. It is not a vacuous test: mutants M17 (`--lvl`) and M18 (`supervisor begin`) fail it. | `test/acceptance/live-check.test.ts:97` |
| 2 | MED | `[A1709]` reads the source text of `src/dispatch/config.ts` and asserts the exact string `supervisor: z.strictObject({ profile: nonBlank.optional() })`. A reformat of that file breaks the test with no change of behavior. The field should be proven by `parseDispatchConfig` accepting `roles.supervisor.profile`. | `test/acceptance/design-profiles.test.ts:25` |
| 3 | LOW | Mutant M16 survives. `[A1709]` asks for the text `roles.supervisor.profile`, and the "Supervisor start" paragraph also holds it, so the bullet under "Roles" can lose its meaning unseen. Equivalent for the claim, but the test cannot tell the two places apart. | `test/acceptance/design-profiles.test.ts:26` |
| 4 | LOW | `[A1708]` ends with a ratio (`claudeLines.length < lines / 4`). The number has no source and breaks when section 7 grows. | `test/acceptance/live-check.test.ts` (`[A1708]`) |
| 5 | LOW | `[A1709]` checks that the code names `ready`, `not_installed` and the other statuses as `"<status>"` in `availability.ts`. The string `"ready"` occurs in the file for other reasons, so the check for that one status is weak. | `test/acceptance/design-profiles.test.ts:15` |

No `HIGH` smell: no tautology, no doubled subject, no assertion computed by the code under test, no conditional logic that hides an assertion (the loops hold an `expect` on every pass).
The tests are deterministic and fast (16 + 2 + 5 tests in 0.2 s) and need no network.
A failure names the section and the missing text.
The tests are sensitive to the exact wording of the documents, which is their purpose.
Their cost is that a wording fix in a document can need a test edit (see finding 4 of the first group in the cycle log).

## Mutation results

Tool: none for Markdown. Method: 18 deliberate mutants of the three changed documents, one at a time, each restored with `git checkout` and checked.
Scope: `docs/LIVE-CHECK.md`, `docs/DESIGN.md`, `docs/DECISIONS.md`.
Sampled behaviors: A1701 to A1705, A1708 to A1711, A1112 to A1114, A1123, A1108, A1109.
This is a sample, not an exhaustive run.

| Mutant | Behavior | Survived | Judgment |
| --- | --- | --- | --- |
| M1 omp provider `acp-omp` to `omp` | A1703 | No | caught |
| M2 drop "No tier 2 run has been done" | A1701 | No | caught |
| M3 `--harness pi` to `pie` | A1702 | No | caught |
| M4 Pi row `direct-PR` to `local-only` | A1704 | No | caught |
| M5 `--provider "$PROVIDER"` to a fixed provider | A1705 | No | caught (also A1708) |
| M6 `OPENAI_API_KEY=sk-...` line added | A1114 | No | caught |
| M7 "Codex and omp" to "Claude Code and omp" | A1704 | No | caught |
| M8 DESIGN loses `provider_not_admitted` | A1709 | No | caught |
| M9 DESIGN "four tools" to "five tools" | A1710 | No | caught |
| M10 DECISIONS loses "Amended by D-100" | A1711 | No | caught |
| M11 "Keep the ship task in `local-only` mode" to "any mode" | A1112 | No | caught |
| M12 "Read your Claude usage page" | A1123, A1708 | No | caught |
| M13 gate item 2 made optional | A1113 | No | caught |
| M14 `env -i` line loses `PROJ`, `PROVIDER`, `HARNESS_CLI` | A1114 | No | caught |
| M15 "A Pi ship task" to "A ship task" | A1108 | No | caught |
| M16 DESIGN roles bullet reworded | A1709 | Yes | redundant text, finding 3 |
| M17 `--level` to `--lvl` | A1109 | No | caught (A1109, A1112, A1705) |
| M18 `supervisor start` to `supervisor begin` | A1109 | No | caught (A1109, A1705) |

17 of 18 caught (94%).
A pattern for a planned M19 did not match the document, so it was not run.

## Traceability

| Criterion | Tests | Real entry point |
| --- | --- | --- |
| US1.1 (tiers, tier 2 not run) | `A1701` | Yes: reads `docs/LIVE-CHECK.md` |
| US1.2 (tier 1 and 1.5 commands) | `A1702` | Yes; flags checked against `tools/conformance/args.ts` usage |
| US1.3 (credential table) | `A1703`, `A1705`, `A1706` | Yes |
| US1.4 (harness facts match the contract table) | `A1704` | Yes; imports `src/harness/contracts.ts` |
| US2.1 (profiles, readiness, admission, contract table) | `A1709` | Yes; reads the code for each name |
| US2.2 (supervisor start, stamp advice) | `A1709` | Yes |
| US2.3 (validator observation) | `A1709` | Yes |
| US3.1 (D-063, D-064 amended) | `A1711` | Yes |
| US3.2 (D-092, D-093 amended) | `A1711` | Yes |
| US3.3 (D-135 recorded) | `A1711` | Yes |
| FR-011 (no code changed) | `A1712` | `git diff --stat`, not a test |

Untested criteria: none. Tests tracing to nothing: none.

## What was not audited

- Whether the runbook's tier 2 steps work. No tier 2 run exists, and the runbook says so. The guards check the text and that every name in it exists in the code. They cannot show that a person finds the steps clear.
- Mutation was a sample of 18 hand-made mutants, not an exhaustive run.
- The sentence-per-line rule and the Google style are checked by review and grep (T011), not by a test.
- `docs/HARNESS-SUPPORT.md`, `docs/CONFORMANCE.md`, and `docs/BRANCH-PROTECTION.md` were not changed and not audited.
- The fixtures (`test/fixtures/markdown.ts`, `decision-log.ts`) were not changed and were only read.
- Performance and load behavior: no criterion, no test, not assessed.

## Remediation tasks

Appended to `tasks.md` (Phase 7).
The feature is not done until finding 1 is accepted or cleared.
