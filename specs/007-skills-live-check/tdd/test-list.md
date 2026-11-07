---
feature: 007-skills-live-check
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 13
planned_at: 0d114bd
updated_at: 7bbd5c9 + remediation
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
| A1105 | Each skill says the plugin enforces every gate in code and carries its role's rules, with the push rule on the `no-mistakes` row | AC-1.5, FR-1104 | example | DONE | `test/acceptance/skills.test.ts::[A1105]` |
| A1106 | The worker's first message points to the worker skill | AC-1.6, FR-1105 | example | DONE | `src/tools/prompt.test.ts::[A1106]` |
| A1107 | The runbook says not to install into the owner's bb, never to touch the shared no-mistakes daemon, and to use the throwaway bb of the isolation report | AC-2.1, FR-1106, FR-1107 | example | DONE | `test/acceptance/live-check.test.ts::[A1107]` |
| A1108 | The runbook holds the tiers, the funding decision, the bring-up, the tier 0 checks, a scout task, a ship task, the hard-rule checks, the teardown checklist, and what stays unverified | AC-2.2, FR-1107 | example | DONE | `test/acceptance/live-check.test.ts::[A1108]` |
| A1109 | Every plugin command and tool that the runbook names exists | AC-2.3 | example | DONE | `test/acceptance/live-check.test.ts::[A1109]` |
| A1111 | The runbook funds tier 2 from the captain's own Claude account, says that it competes with firstmate for quota, and has the captain run `claude setup-token` and pass the token through `BBLAB_PASS_ENV` | AC-3.1, AC-3.3, FR-1108, FR-1109 | example | DONE | `test/acceptance/live-check.test.ts::[A1111]` |
| A1112 | The runbook carries the spend caps: the cheapest model, a low reasoning level, one worker at a time, a tiny repository, a wall-clock limit, and `bblab down` as the hard stop | AC-3.2, FR-1108 | example | DONE | `test/acceptance/live-check.test.ts::[A1112]` |
| A1113 | The runbook runs tiers 0 and 1 first, makes tier 2 wait for them, and says what the gate is while the tier 1 stub agent does not exist | AC-3.4, FR-1108 | example | DONE | `test/acceptance/live-check.test.ts::[A1113]` |
| A1114 | The shell blocks name the token on four fixed lines and nothing else does, no file, redirect, or command line carries it, `BBLAB_PASS_ENV` lists exactly two variables, the run starts in a fresh shell, and it ends with an unset and a revoke | AC-3.3, FR-1109 | error | DONE | `test/acceptance/live-check.test.ts::[A1114]` |
| A1115 | No sentence of either skill tells an agent to get around a gate: each sentence that names a forbidden act also forbids it | AC-1.5, FR-1104 | error | DONE | `test/acceptance/skills.test.ts::[A1115]` |
| A1116 | Every backticked name in the skills is defined in the code: a tool, an argument, an outcome, a state, a kind, or a mode | AC-1.3, FR-1103 | error | DONE | `test/acceptance/skills.test.ts::[A1116]` |
| A1117 | The supervisor's wake table lists exactly the wake states of the plugin | AC-1.3 | example | DONE | `test/acceptance/skills.test.ts::[A1117]` |
| A1118 | The merge and teardown sentences name the states that the tools accept, tell the supervisor to ask again after no answer, and keep the `yolo` and approval clause | AC-1.5, FR-1104 | example | DONE | `test/acceptance/skills.test.ts::[A1118]` |
| A1119 | The worker skill lists exactly the outcomes and fields that the report tool accepts | AC-1.3 | example | DONE | `test/acceptance/skills.test.ts::[A1119]` |
| A1120 | The skills say nothing about tokens or credentials | AC-3.3, FR-1109 | error | DONE | `test/acceptance/skills.test.ts::[A1120]` |
| A1121 | A real dispatch starts the worker with a prompt that points to the `factoryman-worker` skill | AC-1.6, FR-1105 | example | DONE | `test/acceptance/skills.test.ts::[A1121]` |
| A1122 | The runbook sets the project to `local-only` with a script that leaves `yolo` off, and drives the supervisor with `bb thread tell` after the stamp | AC-2.2 | example | DONE | `test/acceptance/live-check.test.ts::[A1122]` |
| A1123 | The runbook reads the Claude usage before and after tier 2 | AC-3.2 | example | DONE | `test/acceptance/live-check.test.ts::[A1123]` |
| A1124 | The runbook says what can read the token, and starts tier 2 from a fresh shell | AC-3.3, FR-1109 | example | DONE | `test/acceptance/live-check.test.ts::[A1124]` |
| A1110 | The repository has the `skills/` directory, and the layout rule expects it | AC-1.2 | example | DONE | `test/acceptance/layout.test.ts::[U208]` |

## Inner loop: unit behaviors

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1101 | `skillsForMetadata` returns the supervisor skill, the worker skill, or nothing, and ignores an unknown role | FR-1101 | example | DONE | `src/tools/register.test.ts::[U1101]` |
| U1102 | The gate lint flags each sentence that tells an agent to get around a gate, and accepts the same idea when the sentence forbids it | FR-1104 | error | DONE | `test/acceptance/skills.test.ts::[U1102]` |
| U1103 | `skillsForMetadata` and `toolsForMetadata` ignore a role that is not exactly the string `supervisor` or `worker` | FR-1101 | error | DONE | `src/tools/register.test.ts::[U1103]` |

## Cycle plan

One group: the tests and stubs first, then the files and the selection.
The audit remediation (cycle R1) rewrote the skill and runbook tests to read structure: sections, tables, fenced blocks, and the schemas in the code.

## Property and mutation notes

No property tool is installed (profile).
`/speckit.tdd.verify` runs deliberate mutants on the selection, the prompt line, and the claims that the tests read from the skills.
