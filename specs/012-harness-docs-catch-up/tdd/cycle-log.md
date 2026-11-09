# Cycle log: Harness documentation catch-up

Append only.
Newest last.

## Baseline

- suite: `pnpm run check` -> typecheck, lint clean; 151 files, 2067 passed, 0 failed (29 s)
- commit: `2b0bac6`
- recorded: cycle 0, before any change

## Notes and deviations

- The loop ran in three groups, one per user story, as the earlier features did.
  Each group has one test file, one document change, and one commit.
  Every behavior has its own named test and its own recorded red where it failed.
- Commit `7e4359e` (the specification documents) cites D-135 before the entry exists.
  The decision-log guard `[A1510]` was red from that commit until group 3 added the entry (`pnpm run check` after group 1: `Tests 1 failed | 2072 passed`, `[A1510]`).
  No test was changed to hide it.
- A1707 was folded into the adapted tests `[A1107]`, `[A1108]`, `[A1109]`, and `[A1112]`, and A1712 is checked by `git diff --stat` (task T010), as the test list says.
- A1705 changed its wording before its first run: the runbook has no `dispatch.json` literal to parse, because `dispatch init` writes the file in the lab.
  The test pins the order (`dispatch init`, then `supervisor start`) and the flags instead.
- The runbook guard's `env -i` pin gained `PROJ`, `PROVIDER`, and `HARNESS_CLI` between the red run and the green run, because the first draft of the pin kept the old line and the old line loses `$PROJ` (D-135, defect 2).
  That is a change of the expectation before any implementation, and it is part of the red.

## Group 1: the runbook (A1701 to A1705, A1708, and the adapted A1108, A1111 to A1114, A1122 to A1124)

Red, against the old `docs/LIVE-CHECK.md`:

- command: `pnpm vitest run test/acceptance/live-check.test.ts`
- result: `16 tests | 14 failed`
- decisive lines:
  - `[A1108]`: `AssertionError: expected [ …(11) ] to deeply equal [ …(11) ]` (the section 6 and 7 titles)
  - `[A1701]`: `expected [ '0', '1', '2' ] to deeply equal [ '0', '1', '1.5', '2' ]`
  - `[A1702]`: `expected [ Array(1) ] to include 'pnpm run conformance -- --tier 1'`
  - `[A1705]`: `expected -1 to be greater than or equal to 0` (no `dispatch init` line)
  - `[A1708]`: `## 3.: expected '\n1. `bblab` and `bblab-evidence` sav…' not to match /Claude/`
  - `[A1111]`: `expected '\nThe report defines three tiers by w…' to contain 'Claude Code is funded by the captain\…'`
  - `[A1114]`: `expected [ …(4) ] to deeply equal [ …(7) ]`
  - `[A1113]`: `expected '\nThe report defines three tiers by w…' to contain 'Run tiers 0, 1, and 1.5 first.'`
  - `[A1122]`: `expected 'bblab x bash -c "cd $BBLAB_DIR/plugin…' to contain '.run(\'$PROJ\', \'$MODE\', \'main\')'`
  - `[A1123]`: `expected '\n1. `bblab` and `bblab-evidence` sav…' to contain 'Read the usage page of each account t…'`
  - `[A1112]`, `[A1124]`, `[A1703]`, `[A1704]`: the same kind of missing-text failure.
- passed on the first run: `[A1107]` (unchanged) and `[A1109]` (it only allows more flags, and the old runbook names none of them).
  `[A1109]` is a `TEST_AFTER` behavior: its new flag table passes against the old runbook.
  Its guard still bites, because a flag outside the table fails (revert-red: `"dispatch init": ["--provider"]` fails the runbook's `--model`).

Green: the rewrite of `docs/LIVE-CHECK.md`.
Four failures remained after the first pass, each a wording fix in the document, never in a test:
`[A1705]` (the prose did not name `bb factoryman supervisor start`), `[A1111]` (a table cell held the words `claude setup-token`, which the guard allows only in a sentence that says the captain runs it), `[A1114]` (the raw-line filter matched `console.log` in the project script, so the test filter now reads `provider console`), `[A1122]` (the Pi sentence began in lower case).
A last fix reworded one sentence that put the word credential next to the word agent without a negation.
After that: `pnpm vitest run test/acceptance/live-check.test.ts` -> `16 passed`.

- full suite after the group: `pnpm run check` -> 151 files, `Tests 1 failed | 2072 passed` (`[A1510]`, see the notes), then green after group 3
- commit: `f02c7c3`
- refactor: none needed

## Group 3: the decision log (A1711)

Red: `pnpm vitest run test/acceptance/decision-log.test.ts` -> `2 failed | 3 passed`
(`[A1711]`: `AssertionError: expected [ 'D-001', 'D-002', 'D-003', …(131) ] to include 'D-135'`; and `[A1510]`: `expected [ …(12) ] to deeply equal []`).

Green: the "Amended by" lines on D-092 and D-093 and the entry D-135 in `docs/DECISIONS.md`.
`pnpm vitest run test/acceptance/decision-log.test.ts` -> `5 passed`; `pnpm run check` -> 151 files, 2074 passed.

- commit: `df1907a`
- refactor: none needed (a blank line between two tests)

## Group 2: the design (A1709, A1710)

Red: `pnpm vitest run test/acceptance/design-profiles.test.ts` -> `2 failed`
(`[A1709]`: `status ready: expected '\nA profile is a provider, model, rea…' to contain '`ready`'`; `[A1710]`: `expected '\nYou talk to one thread per bb proje…' to contain 'The plugin gives the supervisor four …'`).

Green: the edit of `docs/DESIGN.md`.
One more failure remained after the first pass (`[A1709]`: the command was written with its flags in one code span), fixed in the document.
`pnpm vitest run test/acceptance/design-profiles.test.ts` -> `2 passed`; `pnpm run check` -> 152 files, 2076 passed.
The first draft of `[A1710]` held one regular expression that guarded nothing, and it was removed before the first run.

- commit: `9a7e9d0`
- refactor: none needed

## Suite now

`pnpm run check` -> typecheck clean, lint clean, 152 files, 2076 passed.

## Remediation of the audit (tasks T015 to T019)

The audit (`tdd/verification.md`, verified at `284443c`) found five issues.
Findings 2 to 5 are test refactors on green code and each was checked with its mutant:

- Finding 2 (`[A1709]` read the source text of `config.ts`): it now calls `parseDispatchConfig` with `roles.supervisor.profile` and `roles.validator.agent`, and checks the returned `roles`.
- Finding 3 (mutant M16 survived): the roles paragraph and the supervisor-start paragraph are asserted separately. Re-run: M16 -> `failed: ['A1709']`.
- Finding 4 (`[A1708]` ratio): the lines of section 7 that name Claude are now an exact list of six patterns. Re-runs: M21 (`Claude lists it`) and M22 (an added sentence) -> `failed: ['A1708']`.
- Finding 5 (`"ready"` string in the source): each status goes through `readinessProblem`, which returns null for `ready` and a text with `(bb status: <status>` for the others. Re-run: M20 (the document drops `expired`) -> `failed: ['A1709']`.

Finding 1 (`[A1109]` is `TEST_AFTER`) cannot be cleared by a later red, so D-135 records it for the captain's decision.
After the refactors: `pnpm vitest run test/acceptance/design-profiles.test.ts test/acceptance/live-check.test.ts` -> 18 passed.
