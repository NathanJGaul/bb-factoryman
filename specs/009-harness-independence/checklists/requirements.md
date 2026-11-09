# Specification quality checklist: Agent-harness independence

**Purpose**: Validate specification completeness and quality before planning.

**Created**: 2026-11-08

**Feature**: [spec.md](../spec.md)

## Content quality

- [x] No implementation details beyond the contract names this plugin must match (bb's `providerStates`, `providers.models`, and `threads.events.list` calls, the `instructions` field of `bb.agents.configure`, the `dispatch.json` path, and the module path that the captain's task names).
- [x] Focused on the owner's need: a harness that cannot run is refused early, no harness is chosen silently, and a failure says why.
- [x] Written so the captain can read the stories without the code.
- [x] All mandatory sections are complete.

## Requirement completeness

- [x] No `[NEEDS CLARIFICATION]` markers remain.
- [x] Requirements are testable and unambiguous.
- [x] Success criteria are measurable (counts of tasks and workers, exact messages, verbatim causes).
- [x] Success criteria say what the owner or the supervisor sees, not how the code works.
- [x] All acceptance scenarios are defined.
- [x] Edge cases are identified.
- [x] Scope is clearly bounded (H4, H6 to H9, H12 to H14, tier 2 runs, credentials, and the supervisor and validator role handling are out).
- [x] Dependencies and assumptions are identified.

## Feature readiness

- [x] Every functional requirement maps to an acceptance scenario.
- [x] The user scenarios cover the primary flows: refuse, admit, choose, check, and explain.
- [x] The feature meets the outcomes in the success criteria.
- [x] The bb calls are named only as the contract, and the plan picks the design.

## Notes

- The spec names bb's SDK calls and the `dispatch.json` path because they are the fixed contract with bb and with the owner's files, as in the specs of earlier milestones.
- The spec keeps two decisions as assumptions where the captain's words leave room: a scout task on Pi in `local-only` mode is refused (the rule keys on the delivery mode), and a provider that bb's states omit is blocked (fail closed).
- Clarification is not needed: every open point has a reasonable default that fails closed, and the assumptions record it.
