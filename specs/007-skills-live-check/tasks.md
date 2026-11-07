---
description: "Task list for skills and the live check"
---

# Tasks: Skills and live check

**Input**: `specs/007-skills-live-check/spec.md`, `plan.md`, `tdd/test-list.md`
**Tests**: Mandatory. The tests and the layout change are committed red before the files exist.

## Phase 1: Spike

- [X] T1101 Record spike item 11 and the plugin skill convention in `spike/RESULTS.md`

## Phase 2: Tests and stubs

- [X] T1110 `test/acceptance/skills.test.ts` (A1101 to A1105), `test/acceptance/live-check.test.ts` (A1107 to A1109, A1111 to A1114), the prompt test (A1106), `[U1101]`, and the layout rule

## Phase 3: Implementation

- [X] T1120 Write the two skills, select them in `configure`, point the worker prompt at the skill, and write `docs/LIVE-CHECK.md`
- [X] T1121 `pnpm run build` passes with the skills in the tree

## Phase 4: Close-out

- [X] T1130 Record D-090 to D-093 in `docs/DECISIONS.md` and finish `spike/RESULTS.md`
- [X] T1131 `/speckit.tdd.verify`, remediation, `/speckit.checklist`, `/speckit.analyze`, `/speckit.converge`
- [X] T1132 Remediation R1 to R14 from the audit (cycle R1 in `tdd/cycle-log.md`)
