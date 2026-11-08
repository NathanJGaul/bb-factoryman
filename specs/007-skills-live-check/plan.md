# Implementation plan: Skills and live check

**Branch**: `fm/bb-factoryman-milestones-7-11` | **Date**: 2026-11-07 | **Spec**: [spec.md](spec.md)

## Summary

Add two skill files, select them by thread role in the agent configuration, point the worker prompt at the worker skill, and write `docs/LIVE-CHECK.md`.
No state machine change and no new tool.
The live run itself is the owner's step: nothing here installs into a bb.

## Technical context

- bb facts: plugin skills sit in `skills/<name>/SKILL.md`, are listed by `bb skill list` with scope `plugin`, and a plugin selects them by front matter name through `bb.agents.configure` (spike item 11 and the scaffold).
- The isolation design comes from the live isolation scout's report.
- No new package.

## Constitution check

| Principle | How the plan complies |
| --- | --- |
| I. Gates live in code | The skills say so, and tests pin that no skill tells an agent to get around a gate. Selecting a skill by metadata is a hint, like tool visibility. |
| II. Machine core is pure | No change. |
| V. Test first | The skills test and the layout change are committed red before the files exist. |
| VI. Scope | Milestone 11 only. The live run stays the owner's step. |

## Source layout

```text
skills/factoryman-supervisor/SKILL.md
skills/factoryman-worker/SKILL.md
docs/LIVE-CHECK.md
src/tools/register.ts   # configure() returns skills by role
src/tools/prompt.ts     # the worker prompt names the skill
```

## Design

**Selection.**
`skillsForMetadata(metadata)` returns `["factoryman-supervisor"]` for the supervisor role, `["factoryman-worker"]` for the worker role, and `[]` otherwise, next to `toolsForMetadata`.
Like the tools, it is a hint: the metadata is writable (spike item 2), and every tool still decides the caller from the store.

**Skills.**
Plain Markdown, one sentence per line, written for the agent that reads them.
The supervisor skill covers the four tools, dispatch results (`ambiguous`, blocked, queued, refused), the wake states, the merge and teardown rules, and what reaches the owner.
The worker skill covers the branch, the delivery-mode handoffs, scouts, custom checks, and the rules that never change.

**Runbook.**
`docs/LIVE-CHECK.md` follows the isolation report: the tiers, the funding decision, the bring-up, the plugin install, tier 0 checks, one scout task and one ship task, the hard-rule checks, and the teardown checklist.
It marks what stays unverified.
Tier 2 follows the captain's decision: option B of the report, with the report's caps, a token that the captain creates and passes through `BBLAB_PASS_ENV` into a second bring-up of the lab, and a watchdog that runs `bblab down`.

## Decisions to record

- D-090: how plugin skills are found and selected (resolves D-002).
- D-091: the skills are advice, and a project may add skills of its own.
- D-092: the runbook is the owner's step, based on the isolation report, with tier 2 funded from the captain's own account (the captain's decision) and gated on tiers 0 and 1.
- D-093: the tier 1 stub agent does not exist, so the runbook says what the gate is until it does.
