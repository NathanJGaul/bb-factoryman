---
feature: 003-dispatch-resolver
verdict: FAIL
standard: .specify/extensions/tdd/templates/tdd-test-quality-rubric.md # resolved from the extension copy; no override or preset file exists
verified_at: 8ec714b # short SHA audited (branch fm/bb-factoryman-milestones-7-11, range bf5f79b..8ec714b)
behaviors: 57 # 14 acceptance (A701-A714) and 43 unit (U701-U743)
proven: 57 # 7 of them (A701, A707, A711, A714, U729, U730, U735) have a deliberate mutant as the red, because they passed at once
likely: 0
test_after: 0
no_test: 0
high_smells: 0 # by the smell catalogue; the HIGH findings below come from surviving mutants
criteria_total: 14 # spec.md has AC-1.1 to AC-4.1 (14); test-list.md says 13
criteria_covered: 14 # every AC reaches a test through the plugin factory; AC-2.3 and AC-2.5 only partly (findings 1 and 2)
mutation_score: 65 # 32 of 49 hand-picked deliberate mutants killed, no tool; 68 if the 2 equivalent mutants are excluded. Not a representative sample
mutants_survived: 17 # 2 equivalent, 15 not equivalent (findings 1 to 7)
suite: 682 passed, 0 failed, 14.9 s wall, 63 files; pnpm run check (typecheck, lint, tests) clean, 23.3 s
---

# TDD verification: Dispatch resolver

**Verdict: FAIL.**
Two surviving mutants sit on fail-closed paths: a `listProviders` failure fails open, and a provider blocker can create a task without any test noticing.

The discipline is otherwise sound.
Every behavior has a tagged test that exists and runs, precedence, the lowering comparison, and the loader error paths are well pinned, and no existing test was weakened.
I did not write these tests, and I re-read every file cold.

## Test-first evidence

History cannot show order inside one commit.
`44b4ee2` (spec, plan, test list, empty cycle log) precedes `8ec714b` (tests and source together, 6 minutes later).
So the cycle log is the only red evidence for the inner loop, and I treat it as a claim.

| Behaviors | Class | Evidence |
| --- | --- | --- |
| A702-A706, A708-A710, A712, A713 (10) | PROVEN | Log records the red output. I rebuilt the `44b4ee2` tree in the scratchpad, overlaid the final acceptance file and its fixtures, and got 11 failures with the same messages as the log. |
| A701, A711 | PROVEN | Log says they passed at once and cites a mutant. My mutant M2 fails `A701` and M42 fails `A711`. |
| A707 | PROVEN | Log admits the first version passed at once and was strengthened. The final test fails against `44b4ee2` ("not both") and dies to mutant M36. |
| A714, U729, U730, U735 | PROVEN | Passed at once. Mutants in the log. I re-ran `A714` (scratch copy), `U729` (M1), and `U730` (M21). `U735` rests on the log. |
| U701-U728, U731-U734, U736-U743 (40) | PROVEN | Log records stub reds with counts that match the test files (for example C2: 20 failed, 1 passed for 21 tests). Not reproducible from history. |

Discrepancies with the log: none that change a class.
The `U208` and `U37` assertions changed with their requirements (D-068, D-067) and are not weakened.
`U208` still forbids `skills`, and `U37` still pins the schema.
I found no `.skip`, `.only`, `.todo`, lint disable, config exclusion, or threshold change in the range.

## Findings

| # | Severity | Finding | Evidence |
| --- | --- | --- | --- |
| 1 | HIGH | A `bb.sdk.providers.list` failure is not tested. Swallowing the catch lets dispatch spawn with no provider check (hard rule 8). The `providersError` fixture exists and no test sets it. | `src/tools/dispatch.ts:96-98`, `test/fixtures/bb-port.ts:24,103` |
| 2 | HIGH | `A711` claims every blocker leaves the log unchanged but covers only `ambiguous` and `rule_not_applicable`. Creating the task before the availability check passes the suite, so a `provider_unavailable` call could leave a task. `A708` and `A710` assert only the spawn calls. | `src/tools/dispatch.ts:93-103`, `test/acceptance/dispatch-resolver.test.ts:103-112,124-146` |
| 3 | MED | The tool's pass-through of `kind`, `mode`, and `tags` to the resolver is untested. No acceptance test dispatches a scout, a non-default mode, or `tags`. | `src/tools/dispatch.ts:82` |
| 4 | MED | The reasoning baseline order (matched rules first, then the default) is unpinned when both exist. Swapping the order passes. | `src/dispatch/resolver.ts:67-72`, `resolver.test.ts:110-144` |
| 5 | MED | Ambiguity needs profiles to differ in "at least one of four fields" (D-065). Dropping any single field from `sameProfile` passes, because `U712` differs in two fields at once. | `src/dispatch/resolver.ts:15-16`, `resolver.test.ts:32-46` |
| 6 | MED | Only a top-level unknown key is tested (AC-2.2). `z.object` instead of `z.strictObject` for `when`, a rule, or a profile passes. A typo such as `keyword` in a rule that also has `kind` silently widens the rule. | `src/dispatch/config.ts:12,19-20,28`, `config.test.ts:30-32` |
| 7 | LOW | Keyword whole-word matching is pinned only by input that breaks both boundaries ("prefactoring"). Removing either lookaround passes. | `src/dispatch/resolver.ts:24`, `resolver.test.ts:93-98` |
| 8 | LOW | The handler for a throw while loading the config or resolving (for example `projects.get` rejecting) has no test. Removing its `return` passes, so the specified "No task was created" text is unverified. | `src/tools/dispatch.ts:86-88` |
| 9 | LOW | `A709`, `A710`, and `U715` loop over cases with no case label, where the exemplar uses `it.each`. A failure does not say which case broke. `U743` has three behaviors in one test. | `dispatch-resolver.test.ts:114-137`, `resolver.test.ts:55-57`, `files.test.ts:253` |
| 10 | LOW | Bookkeeping drift. `test-list.md` says 13 criteria (14 exist). `plan.md:35` lists a `builtin.ts` that does not exist. `DECISIONS.md:548` cites cycle `L1`, which the log calls `C5`. `tasks.md` T732 says A-701 to A-709, and T750 is unticked although D-062 to D-066 are recorded. The test at `resolver.test.ts:100` has no id. `test/fixtures/checkout.ts` and `files.ts` are missing from the profile's `helpers`. | `tdd/test-list.md:5`, `plan.md:35`, `docs/DECISIONS.md:548`, `tasks.md:26,31` |
| 11 | LOW | The committed T731 claimed `src/tools/dispatch.test.ts` covers "blockers create nothing". That file was not touched. The uncommitted edit rewords it to match what exists, which is accurate, but "blockers create nothing" stays unproven (finding 2). | `specs/003-dispatch-resolver/tasks.md:25` |

## Mutation results

Scope: 49 hand-picked mutants across `resolver.ts`, `availability.ts`, `load.ts`, `config.ts`, `files.ts`, `tools/dispatch.ts`, `server.ts`, and `adapter.ts`.
Each was applied alone, run against the unit file and `dispatch-resolver.test.ts`, then restored with `git checkout`.
M49 ran in a scratch copy of the tree, because `src/machine/` is outside the feature's changed files.

| Area | Killed | Survived | Judgment |
| --- | --- | --- | --- |
| Precedence and rule pick (M1, M18) | 2 | none | Pinned by `U729`, `U715`, `A704`. |
| Reasoning floor (M2, M4-M7, M16) | 6 | M3, M17 | M3 (`<` to `<=`) is equivalent: equal strings return first and the schema rejects duplicate ladder levels. M17 is finding 4. |
| Matching (M10-M12) | 3 | M8, M9 | Tags `every` to `some` (M11) and keyword `some` to `every` (M12) die. M8 and M9 are finding 7. |
| Equal-profile test (M13-M15) | 0 | M13, M14, M15 | Finding 5, one mutant per dropped field (provider, permission mode, model). |
| Availability (M19-M21) | 3 | M22 | M22 lists unavailable providers in the message. No gate changes. Equivalent. |
| Loader, files, config rules (M23-M31, M44, M45) | 11 | none | Each fail-open mutant in `load.ts` dies (M23-M25), and the `ENOENT` and `ENOTDIR` mapping is pinned from both sides (M28-M31). |
| Config strictness (M46-M48) | 0 | M46, M47, M48 | Finding 6. |
| Tool flow (M36, M37, M39, M42) | 4 | M32-M35, M38, M43 | Findings 1, 2, 3, 8. |
| Wiring, adapter, layout (M40, M41, M49) | 3 | none | `A712`, `U742`, and `A714` can fail. |

Mutants M3 and M22 are the only equivalents.
Every other survivor is inside a behavior marked `DONE`.

## Traceability

Each acceptance test enters through `loadWorld`, which builds `createPlugin` on `createFakePluginHost` and calls the registered `factoryman_dispatch` tool with the real `nodeFiles` and a temporary checkout.
Only the bb SDK is faked.

| Criterion | Tests | Real entry | Can fail |
| --- | --- | --- | --- |
| AC-1.1 to AC-1.6 | `A701`-`A706`, `U710`-`U717` | Yes | Yes |
| AC-1.7 | `A707`, `U729` | Yes | Yes (M36) |
| AC-2.1 | `A708`, `U722`-`U728` | Yes | Yes, except finding 4 |
| AC-2.2 | `A709`, `U701`-`U709`, `U738`-`U740` | Yes | Partly (finding 6) |
| AC-2.3, AC-2.4 | `A710`, `U730`-`U735` | Yes | Partly (finding 1) |
| AC-2.5 | `A703`, `A709`, `A711` | Yes | Partly (finding 2) |
| AC-3.1 | `A712`, `A714` | Yes (`A714` reads files) | Yes (M40, M49) |
| AC-4.1 | `A713` (absent file), `U736`, `U737` | Yes for the absent file | The unknown-checkout half is unit-level only |

Untested criteria: none.
Tests tracing to nothing: `resolver.test.ts:100`, which has no id and traces to FR-703.

## Remediation tasks

The feature is not done until tasks R1 and R2 are cleared.
I did not edit `tasks.md`.

- [ ] R1 (finding 1) Add an acceptance test where `providers.list` rejects. Expect `isError`, the text "could not read bb's providers", no spawn, and no task. Prove it with `pnpm vitest run test/acceptance/dispatch-resolver.test.ts`, then confirm that emptying the catch at `src/tools/dispatch.ts:96-98` fails it.
- [ ] R2 (finding 2) Extend `A711` to the `reasoning_lowered`, `config_invalid`, and `provider_unavailable` blockers, asserting `store.listEvents()` and `listTasks()` are unchanged. Confirm that moving the availability check after `rt.log.create` fails it.
- [ ] R3 (finding 3) Add acceptance tests for a scout dispatch matching a `kind` rule, a `direct-PR` project matching a `mode` rule, and `tags` matching a `tags` rule.
- [ ] R4 (finding 4) Add a unit test with a matching rule at `xhigh`, a default at `low`, and an explicit `medium`. Expect `reasoning_lowered`.
- [ ] R5 (finding 5) Replace the single ambiguity case with an `it.each` over the four profile fields, each pair differing in one field only.
- [ ] R6 (finding 6) Add `U702` cases for an unknown key in `when`, in a rule, and in a profile.
- [ ] R7 (findings 7, 8) Add keyword cases "prerefactor" and "refactoring", and a test where `projects.get` rejects.
- [ ] R8 (findings 9 to 11) Convert the loops to `it.each`, fix the bookkeeping drift, and restore a T731 that names the test that proves "blockers create nothing" (R2). Run `pnpm run check`.

## What was not audited

- No mutation or coverage tool exists (`tdd-profile.md`), so strength rests on 49 hand-picked mutants and is not a score.
- The `reasoningLevel` field of `sameProfile`, the `.max(10)` tag limit, and message wording were not mutated.
- No real bb ran. Spike item 29 pins the provider shape, and milestone 11 is the first live check.
- Flakiness: the full suite ran green twice (baseline and `pnpm run check`). Two runs do not prove stability.
- The cycle log's stub-based reds for the inner loop cannot be corroborated from one commit.
- `docs/DESIGN.md` conformance and the D-062 to D-068 reasoning were not judged.

## Remediation status

The audit above is the record at commit `8ec714b`.
The remediation commit answers it, and this section is the only edit made to the report afterwards.
It was not re-audited from cold context, so the verdict line above still reads FAIL.

| Task | State | Evidence |
| --- | --- | --- |
| R1 | Done | `[A715]`. The mutant that swallows the `catch` now fails the suite. |
| R2 | Done | `[A711]` runs for all five blockers. The mutant that creates a task before the availability check now fails `[A711]` and `[A715]`. |
| R3 | Done | `[A717]`. Hard-coding `kind`, `mode`, or `tags` each fails it. |
| R4 | Done | `[U744]`. Swapping the baseline order fails four tests. |
| R5 | Done | `[U712]` runs four cases. Dropping any single field from `sameProfile` fails its case. |
| R6 | Done | `[U702]` runs four cases. Replacing `strictObject` with `object` in each place fails its case. |
| R7 | Done | `[U721]` and `[A716]`. Removing either lookaround, or the `catch` return, fails them. |
| R8 | Done | `it.each` conversions, `[U743]` split in three, and the bookkeeping drift fixed. |

The suite after remediation: 63 files, 708 tests, all passing.

