# Specification quality checklist: The `factoryman_decide` tool

**Purpose**: Validate specification completeness and quality before planning
**Created**: 2026-11-09
**Feature**: [spec.md](../spec.md)

## Content quality

- [x] No implementation details that the repository's convention forbids.
  The repository's specs name tools, events, and modules because the product is a plugin API, and the other specs do the same (see 008 and 011).
- [x] Focused on user value: the supervisor's path to answer a finding, and the owner's control of that answer.
- [x] Written so that the owner can read it without the code: each story states who acts and what they see.
- [x] All mandatory sections are complete: stories, edge cases, requirements, success criteria, assumptions, and out of scope.

## Requirement completeness

- [x] No [NEEDS CLARIFICATION] markers remain.
  The three open points have defaults in Assumptions: the allowed actions are the pipeline's three, the key is a hash of the live view, and the denial leaves no log row.
- [x] Requirements are testable and unambiguous: each FR maps to a scenario or a document check.
- [x] Success criteria are measurable (counts of answers, forms, and gaps).
- [x] Success criteria avoid implementation detail where a user-facing statement exists.
  SC-004 and SC-005 name the pipeline flag and the harness suite because those are the captain's own checks.
- [x] All acceptance scenarios are defined for the six stories.
- [x] Edge cases are identified: stale key, direct answer in no-mistakes, timeout, long text, restart.
- [x] Scope is clearly bounded by the Out of scope list and by FR-014 (no machine change).
- [x] Dependencies and assumptions are identified: D-030, D-031, D-057, D-058, D-095, D-134.

## Feature readiness

- [x] Every functional requirement has an acceptance scenario or a document check.
- [x] The user scenarios cover the primary flow (answer a gate), the refusals, the owner's form, the second case, registration, and documentation.
- [x] The feature meets the measurable outcomes in Success criteria.
- [x] No implementation leaks beyond the repository's convention.

## Notes

- Two points are decisions for the plan, not open questions: how the key is computed (FR-005) and where the driver gets a `current view` method (FR-004).
- The captain's brief names the gaps to record rather than build: a new machine event for accepting an override (FR-014), and the missing log row for a denial (FR-017).
