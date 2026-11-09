# Specification quality checklist: Conformance harness for agent harnesses

**Purpose**: Validate specification completeness and quality before planning.

**Created**: 2026-11-08

**Feature**: [spec.md](../spec.md)

## Content quality

- [x] No implementation details beyond the contract names the maintainer meets (the commands, the scenario ids, the harness ids, and the file locations are the interface of a developer tool).
- [x] Focused on the maintainer's need: know what works on each harness without a credential.
- [x] Written so the captain can read the stories without the code.
- [x] All mandatory sections are complete.

## Requirement completeness

- [x] No `[NEEDS CLARIFICATION]` markers remain.
- [x] Requirements are testable and unambiguous.
- [x] Success criteria are measurable.
- [x] Success criteria say what the maintainer sees or what the result file records, not how the code works.
- [x] All acceptance scenarios are defined.
- [x] Edge cases are identified.
- [x] Scope is clearly bounded (report tasks H1 to H5 and H9 to H14, tier 2, and credentials are out).
- [x] Dependencies and assumptions are identified.

## Feature readiness

- [x] Every functional requirement maps to an acceptance scenario.
- [x] The user scenarios cover the primary flows: tier 1, known gaps, tier 1.5 per harness, the fake model, the offline lab, and the generated document.
- [x] The feature meets the outcomes in the success criteria.
- [x] The plan, not the spec, picks the runner's language, the module layout, and the driver interface.

## Notes

- The spec names `pnpm run conformance`, `bblab`, and the harness ids because they are the interface of this developer tool, as earlier specs name the tool and the contract names they meet.
- Scenarios that need report tasks H1, H3, or H4 are written to the target behavior and are `known-gap` until those tasks land (assumption 4).
  This is the one scope call the captain's intent leaves open, and the plan records it in `docs/DECISIONS.md`.
