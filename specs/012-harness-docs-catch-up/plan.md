# Implementation plan: Harness documentation catch-up

**Branch**: `fm/bb-factoryman-harness-docs` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/012-harness-docs-catch-up/spec.md`

## Summary

Bring three documents in line with the merged harness-independence work: `docs/LIVE-CHECK.md` (rewrite), `docs/DESIGN.md` (the dispatch profiles section and two wrong counts), and `docs/DECISIONS.md` (two "Amended by" lines and one new entry).
Change the two guard tests that pin these documents so that they pin the new text at least as strictly.
Change nothing under `src/`, `tools/`, `skills/`, or `conformance/`.
`research.md` records the check of each claim against the code.

## Technical context

**Language/version**: Markdown, and TypeScript 6 for the guard tests (`tsc6`).

**Primary dependencies**: `vitest`; the guard fixtures in `test/fixtures/markdown.ts` and `test/fixtures/decision-log.ts`.

**Storage**: Not applicable.

**Testing**: `pnpm run check` (typecheck, lint, test).
The two guards are `test/acceptance/live-check.test.ts` and `test/acceptance/decision-log.test.ts`.

**Target platform**: Not applicable (documents).

**Project type**: Plugin repository; this feature touches `docs/` and `test/acceptance/`.

**Constraints**: One sentence per line.
Sentence case headings, active voice, no em dash.
Do not edit `docs/HARNESS-SUPPORT.md` (generated), `CHANGELOG.md` files, `CLAUDE.md`, or the constitution.
No credential value, and no command that puts one on a command line or in a file.

**Scale/scope**: About 400 lines of runbook, 40 lines of design, 25 lines of decisions.

## Constitution check

*Gate: must pass before research.*

| Principle | Result |
| --- | --- |
| I. Gates live in code and fail closed | Pass. No gate changes. The docs state gates as they are in code. |
| II. The machine core is pure | Pass. No code changes. |
| III. The event log is the source of truth | Pass. Not touched. |
| IV. Storage sits behind an interface | Pass. Not touched. |
| V. Test first | Pass with a note. The guard tests change first and fail against the old documents (red). The documents change second (green). The strength of each assertion stays the same or grows (T-series in `tasks.md`). |
| VI. Scope discipline | Pass. Harness independence is in scope (D-117, D-129). Documentation of in-scope work is in scope. Tier 2 runs (H13) stay out, as the captain shelved them. |

Governance: the brief says "no code changes" and the runbook guard is test code.
D-135 records the reading (the guards are the documents' lint) and the deviation.

## Project structure

### Documentation (this feature)

```text
specs/012-harness-docs-catch-up/
  spec.md  plan.md  research.md  quickstart.md  tasks.md
  checklists/requirements.md
  tdd/test-list.md  tdd/cycle-log.md  tdd/verification.md
  checklist.md  analyze.md  converge.md
```

No `data-model.md` or `contracts/`: the feature has no data and no interface.

### Source (repository root)

```text
docs/LIVE-CHECK.md              rewrite
docs/DESIGN.md                  edit the dispatch profiles section, the supervisor tool count, remote setup line
docs/DECISIONS.md               Amended-by lines on D-092 and D-093; new D-135
test/acceptance/live-check.test.ts      pin the new runbook
test/acceptance/decision-log.test.ts    pin D-135
```

## Design

### LIVE-CHECK.md structure

The eleven numbered sections stay, so the runbook keeps its shape.
Section 6 and 7 change names.

| Section | Change |
| --- | --- |
| Preamble | Say the runbook covers any harness. Say the build ran the plugin against the fake plugin host and throwaway bb servers, and that tiers 1 and 1.5 have run (result files). Say tier 2 has not run for any harness. |
| 1. Where the isolation comes from | Unchanged. |
| 2. Tiers | Four rows (0, 1, 1.5, 2) with brain, credential, spend. A status line: tiers 1 and 1.5 pass for the four harnesses (`docs/HARNESS-SUPPORT.md`), tier 2 has not run. Funding: Claude Code keeps D-092. Codex, Pi, and omp use one OpenAI key with a provider-side cap (D-108 D2). |
| 3. Prerequisites | Generic: harness CLI bound read-only, usage page of each account that funds a run. |
| 4. Bring-up and install | Unchanged apart from the skills line. |
| 5. The throwaway project | Add `dispatch.json` (profiles and `roles.supervisor.profile`), written with `bb factoryman dispatch init` then edited, because the plugin has no built-in default (D-112). Keep `workflow.json`. |
| 6. Tiers 0, 1, and 1.5: the free tiers, and the gate | Tier 0 table stays. Tier 1 and tier 1.5 become commands and point to `docs/CONFORMANCE.md`. The gate drops the stub-agent skip and requires tiers 1 and 1.5 for the harness. |
| 7. Tier 2: one scout task and one ship task, with a real model | Per-harness credential table. The generic handling rules. Spend caps without the Claude-only words. Start with `supervisor start`. The stamp form stays as the fallback. |
| 8, 9, 10, 11 | Hard rules stay. Gaps list drops the stub agent, adds tier 2 not run, adds the validator observation. Teardown reads usage "of each account". |

### DESIGN.md changes

1. Dispatch profiles: replace the paragraph block with profiles, resolution (already four rungs), the gate (readiness, mode, model, level, admission), the contract table, the `roles` block, `supervisor start`, the stamp advice, and the validator observation.
2. "The plugin gives it five tools" becomes four, because `factoryman_report` is a worker tool (code: `SUPERVISOR_TOOLS`).
3. "an unavailable provider" becomes "a provider that bb does not report ready".
4. Remote machine setup: "the agent CLI signed in" gains "and ready in bb".

### DECISIONS.md changes

1. D-092: "Amended by D-108 (D2) and D-135: the funding is per harness, and tier 2 has not run." The text stays.
2. D-093: "Amended by D-100: the stub agent exists (tier 1)." The text stays.
3. D-135: this change.

### Guard test changes

`live-check.test.ts` pins the old text with 14 tests.
Each test is kept or replaced with an assertion of equal strength:

| Old test | New pin |
| --- | --- |
| A1107 isolation | Unchanged. |
| A1108 sections | New heading list, tier 0 rows, hard rules, gaps (stub agent entry replaced), teardown. |
| A1109 names exist | Unchanged, plus `dispatch init` flags and `supervisor start` flags. |
| A1111 funding | Per-harness funding rows. |
| A1114 token handling | Generalised: each credential variable appears only on fixed lines, no assignment, no secret-shaped literal, token sentences forbid handing to an agent. |
| A1124 what can read | Generalised to "the credential". |
| A1112 caps | Provider flag no longer fixed to `claude-code`; the spawn goes through `supervisor start`. |
| A1113 gate | New gate text. |
| A1122, A1123 | Updated for `supervisor start` and "usage". |

`decision-log.test.ts` gains one test that D-135 exists, D-092 and D-093 carry an "Amended by" line, and the last number is at least D-135.

## Phase 0 and Phase 1

Phase 0 is `research.md`: each claim checked against code.
Phase 1 is `quickstart.md`: how to validate the result.
There is no data model and no contract.

## Re-check after design

Principle V holds: the guards go red first.
No new dependency, no new gate.
