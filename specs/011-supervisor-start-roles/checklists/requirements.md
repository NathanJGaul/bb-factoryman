# Specification quality checklist: Supervisor start command, role advice, and the dispatch roles block

**Purpose**: Validate specification completeness and quality before planning
**Created**: 2026-11-09
**Feature**: [spec.md](../spec.md)

## Content quality

- [x] No implementation details beyond the names of the entry points the feature changes
- [x] Focused on the owner's and the maintainer's needs
- [x] All mandatory sections completed

## Requirement completeness

- [x] No `[NEEDS CLARIFICATION]` markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria avoid implementation detail beyond the repository's own entry points
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is bounded, with an out-of-scope list
- [x] Dependencies and assumptions identified

## Feature readiness

- [x] Every functional requirement maps to an acceptance scenario
- [x] User scenarios cover the start command, the profile choice, the stamp advice, the validator observation, the schema, S9, and the records
- [x] The feature meets the outcomes in Success Criteria

## Notes

- The spec names `dispatch.json`, `src/harness/contracts.ts`, `conformance/known-gaps.json`, and `docs/DECISIONS.md` because the captain's task names them.
  They are the feature's real surface, so they are not leaked implementation detail.
- Four choices are Assumptions and not clarification markers, because each has a reasonable default and none changes the scope the captain approved:
  where the supervisor runs, what an unready validator agent does at hand-off, how an `auto` agent is reported, and which agent names map to which bb provider.
  `/speckit.plan` records each in `research.md` and the decision log.
