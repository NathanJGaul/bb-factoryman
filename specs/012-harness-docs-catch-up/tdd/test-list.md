---
feature: 012-harness-docs-catch-up
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 10
planned_at: 2b0bac6
updated_at: 9a7e9d0
suite_baseline: green
---

# Test list: Harness documentation catch-up

The feature changes documents, so its tests are document guards.
Each guard reads a document from disk and asserts on its text, its structure, or its link to the code.
The acceptance runner is vitest, and the entry point is the document file itself.
A guard checks that a claim is present and that the names in it exist in the code.
It cannot show that a human finds the runbook clear.
The inner loop is empty: the feature has no component that is not a document.
The runbook guard already exists as `test/acceptance/live-check.test.ts`.
Its tests keep their ids (`A1107` to `A1124`) when they are adapted, and the new pins take `A1701` and above.
The suite baseline was 151 files and 2067 tests, all passing (29 s).

## Outer loop: acceptance behaviors

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| A1701 | The runbook's tier table lists tiers 0, 1, 1.5, and 2 with brain, credential, and spend, and says that no tier 2 run has been done for any of the four harnesses | US1.1, FR-001, FR-002 | example | DONE | `test/acceptance/live-check.test.ts::[A1701]` |
| A1702 | The runbook gives `pnpm run conformance -- --tier 1` and `--tier 1.5 --harness <id>` for each of the four ids that the conformance tool accepts, names `docs/CONFORMANCE.md`, and never says the stub agent is missing | US1.2, FR-004, SC-002 | example | DONE | `test/acceptance/live-check.test.ts::[A1702]` |
| A1703 | The runbook's tier 2 table has one row for each of Claude Code, Codex, Pi, and omp with a credential, who creates it, and how it enters the lab; only the captain creates a credential | US1.3, FR-003, SC-003 | example | DONE | `test/acceptance/live-check.test.ts::[A1703]` |
| A1704 | Each harness fact in the runbook agrees with `src/harness/contracts.ts`: the permission modes, the clear step for Codex and omp, and the Pi refusal in `local-only` | US1.4, FR-010 | example | DONE | `test/acceptance/live-check.test.ts::[A1704]` |
| A1705 | The tier 2 steps write the starter `dispatch.json` with `bb factoryman dispatch init` before `bb factoryman supervisor start --profile`, with no fixed provider and no `bb thread spawn` | US1.3, FR-006 | example | DONE | `test/acceptance/live-check.test.ts::[A1705]` |
| A1706 | No credential reaches a command line, a file, or an agent: each credential variable appears only on fixed lines of the shell blocks, with no assignment and no secret-shaped literal, and every prose sentence that joins a credential with an agent forbids it | FR-005 | example | DONE | `test/acceptance/live-check.test.ts::[A1114]` (adapted) |
| A1707 | Every isolation rule, every spend cap, every tier 0 check, every hard-rule check, and the teardown checklist of the old runbook is still there, and every `bb` command and flag the runbook names exists | FR-005, SC-004 | example | DONE | `test/acceptance/live-check.test.ts::[A1107]`, `[A1108]`, `[A1109]`, `[A1112]` (adapted) |
| A1708 | The runbook has no Claude-only wording in a shared step: no `Read your Claude usage`, no fixed `--provider claude-code`, no `Haiku-class` as the only model, and the Claude path is one row of the credential table | FR-009, SC-002 | example | DONE | `test/acceptance/live-check.test.ts::[A1708]` |
| A1709 | The dispatch profiles section of the design names the readiness statuses, the `provider_not_admitted` refusal, the contract table, `roles.supervisor.profile`, `bb factoryman supervisor start` with its profile order, the clear advice, and the validator observation, and every named code, command, and flag exists in the code | US2.1, US2.2, US2.3, FR-007 | example | DONE | `test/acceptance/design-profiles.test.ts::[A1709]` |
| A1710 | The design says the supervisor has four tools, and has no "unavailable provider" wording | FR-007, FR-009 | example | DONE | `test/acceptance/design-profiles.test.ts::[A1710]` |
| A1711 | D-063, D-064, D-092, and D-093 each carry an "Amended by" line that names a decision with a heading, and D-135 exists | US3.1, US3.2, US3.3, FR-008 | example | DONE | `test/acceptance/decision-log.test.ts::[A1711]` |
| A1712 | The change leaves `src/`, `tools/`, `skills/`, `conformance/`, and `docs/HARNESS-SUPPORT.md` as they were | FR-011 | example | DONE | checked by `git diff --stat` in task T010 (not a vitest test: a test cannot know the base commit) |

## Inner loop: unit behaviors

None.
Every behavior above is observable at a document, and no component sits beneath it.

## Invariants and edge cases still to place

- The one sentence per line rule: a guard on added lines is not worth its cost, so task T011 checks it by review.
- The em dash rule: task T011 checks it with grep.

## Out of scope

- A tier 2 run on any harness: shelved by the captain.
- A change to `skills/`, `src/`, `tools/`, or the generated support document: the brief says docs only.
- A new Markdown linter: the repository has none, and the ESLint config ignores `docs/`.
- An edit to `CLAUDE.md` or the constitution: D-117 left the `CLAUDE.md` scope text alone.

## Verification commands

```sh
pnpm vitest run test/acceptance/live-check.test.ts
pnpm vitest run test/acceptance/design-profiles.test.ts
pnpm vitest run test/acceptance/decision-log.test.ts
pnpm run check
```
