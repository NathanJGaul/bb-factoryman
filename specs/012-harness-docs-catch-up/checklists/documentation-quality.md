# Documentation quality checklist: harness documentation catch-up

**Purpose**: Unit tests for the requirements and the documents of this change. A reviewer owns the boxes.
**Created**: 2026-11-09
**Feature**: [spec.md](../spec.md)

`[x]` means the reviewer decided the requirements-quality criterion is satisfied.
It does not mean that implementation work is complete.
`/speckit-implement` reads checklist state and does not modify the markers.

## Requirement completeness

- [ ] CHK001 Are the harnesses that the runbook covers named in one place, and is the list tied to the conformance tool's accepted ids? [Completeness, Spec §FR-003]
- [ ] CHK002 Is the state of each tier (run, not run, shelved) stated for every harness, and not only in aggregate? [Completeness, Spec §FR-002]
- [ ] CHK003 Are the credential-handling rules stated for every credential in the table, and not only for the first one? [Coverage, Spec §FR-005]
- [ ] CHK004 Does the design state who picks the harness for each role: worker, supervisor, and validator? [Gap, Spec §FR-007]

## Requirement clarity

- [ ] CHK005 Is "not exercised" defined for the Codex, Pi, and omp credential rows, so a reader knows what to do when a step stops? [Clarity, Spec §FR-003]
- [ ] CHK006 Is the reading of "docs only, no code changes" (the guards change with the documents) written where a reviewer will see it? [Ambiguity, Spec §Assumptions]
- [ ] CHK007 Is the sentence that tier 2 is "shelved" free of a date or condition that a reader could mistake for a plan? [Clarity, Spec §FR-002]

## Requirement consistency

- [ ] CHK008 Do the runbook, the design, `docs/CONFORMANCE.md`, and `docs/HARNESS-SUPPORT.md` agree on the tier names and the scenario ids? [Consistency]
- [ ] CHK009 Do D-092, D-093, and D-135 agree on which decision replaces which? [Consistency, Spec §FR-008]
- [ ] CHK010 Does the Pi rule read the same in the runbook, the design, and D-111? [Consistency, Spec §FR-009]

## Acceptance criteria quality

- [ ] CHK011 Can "every claim is checked against the code" (SC-005) be verified by someone who did not write `research.md`? [Measurability, Spec §SC-005]
- [ ] CHK012 Is "Claude-only wording where the behavior is harness-neutral" decidable for each line, and who decides? [Ambiguity, Spec §FR-009]

## Edge cases and dependencies

- [ ] CHK013 Is the runbook's behavior defined when a harness CLI is in a versioned install directory? [Edge Case, Spec §FR-003]
- [ ] CHK014 Is the dependency on the conformance tool's default lab directory and free ports stated, so the runner does not clash with the runbook's lab? [Dependency, Spec §FR-004]
- [ ] CHK015 Are the unexercised steps (the credential path for Codex, Pi, and omp) listed in the "does not cover" section as well as in the tier 2 section? [Coverage, Spec §FR-002]
