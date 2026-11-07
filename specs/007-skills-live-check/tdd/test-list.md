---
feature: 007-skills-live-check
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 13
planned_at: 0d114bd
updated_at: 0d114bd
suite_baseline: green
---

# Test list: Skills and live check

The acceptance layer reads the skill files and the runbook from the repository, and resolves the agent configuration through the bb fake plugin host.
No agent reads the skills in these tests, so whether a model follows them is the live check's question.
The suite baseline was 90 files and 1107 tests, all passing.

## Outer loop: acceptance behaviors

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| A1101 | `skills/` holds exactly the two skills, each with a matching name and a one-line description | AC-1.2, FR-1102 | example | DONE | `test/acceptance/skills.test.ts::[A1101]` |
| A1102 | The agent configuration selects the supervisor skill, the worker skill, or none by thread role | AC-1.1, FR-1101 | example | DONE | `test/acceptance/skills.test.ts::[A1102]` |
| A1103 | Each skill names every tool of its role and no unregistered tool, and the worker skill names no supervisor tool | AC-1.3, FR-1103 | example | DONE | `test/acceptance/skills.test.ts::[A1103]` |
| A1104 | Each skill names only `bb factoryman` commands that the plugin registers | AC-1.4, FR-1103 | example | DONE | `test/acceptance/skills.test.ts::[A1104]` |
| A1105 | Each skill says the plugin enforces every gate in code and carries its role's rules | AC-1.5, FR-1104 | example | DONE | `test/acceptance/skills.test.ts::[A1105]` |
| A1106 | The worker's first message points to the worker skill | AC-1.6, FR-1105 | example | DONE | `src/tools/prompt.test.ts::[A1106]` |
| A1107 | The runbook says not to install into the owner's bb, never to touch the shared no-mistakes daemon, and to use the throwaway bb of the isolation report | AC-2.1, FR-1106, FR-1107 | example | DONE | `test/acceptance/live-check.test.ts::[A1107]` |
| A1108 | The runbook holds the tiers, the funding decision, the bring-up, the tier 0 checks, a scout task, a ship task, the hard-rule checks, the teardown checklist, and what stays unverified | AC-2.2, FR-1107 | example | DONE | `test/acceptance/live-check.test.ts::[A1108]` |
| A1109 | Every plugin command and tool that the runbook names exists | AC-2.3 | example | DONE | `test/acceptance/live-check.test.ts::[A1109]` |
| A1111 | The runbook funds tier 2 from the captain's own Claude account, says that it competes with firstmate for quota, and has the captain run `claude setup-token` and pass the token through `BBLAB_PASS_ENV` | AC-3.1, AC-3.3, FR-1108, FR-1109 | example | DONE | `test/acceptance/live-check.test.ts::[A1111]` |
| A1112 | The runbook carries the spend caps: the cheapest model, a low reasoning level, one worker at a time, a tiny repository, a wall-clock limit, and `bblab down` as the hard stop | AC-3.2, FR-1108 | example | DONE | `test/acceptance/live-check.test.ts::[A1112]` |
| A1113 | The runbook runs tiers 0 and 1 first, makes tier 2 wait for them, and says what the gate is while the tier 1 stub agent does not exist | AC-3.4, FR-1108 | example | DONE | `test/acceptance/live-check.test.ts::[A1113]` |
| A1114 | The runbook holds no token and no file path for one, and never asks an agent to create, read, or handle the token | AC-3.3, FR-1109 | error | DONE | `test/acceptance/live-check.test.ts::[A1114]` |
| A1110 | The repository has the `skills/` directory, and the layout rule expects it | AC-1.2 | example | DONE | `test/acceptance/layout.test.ts::[U208]` |

## Inner loop: unit behaviors

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1101 | `skillsForMetadata` returns the supervisor skill, the worker skill, or nothing, and ignores an unknown role | FR-1101 | example | DONE | `src/tools/register.test.ts::[U1101]` |

## Cycle plan

One group: the tests and stubs first, then the files and the selection.

## Property and mutation notes

No property tool is installed (profile).
`/speckit.tdd.verify` runs deliberate mutants on the selection, the prompt line, and the claims that the tests read from the skills.
