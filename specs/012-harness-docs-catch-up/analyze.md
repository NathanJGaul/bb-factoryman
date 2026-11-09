# Analysis: harness documentation catch-up

Cross-artifact analysis of `spec.md`, `plan.md`, `tasks.md`, `research.md`, and the tree at `32c1517`.
Read-only for the three core artifacts; the two corrections it led to are listed at the end.

## Findings

| ID | Category | Severity | Location | Summary | Recommendation |
| --- | --- | --- | --- | --- | --- |
| F1 | Inconsistency | MEDIUM | `spec.md` FR-011, `plan.md` source layout | FR-011 said the only test changes are to the two existing guards. The plan and the tasks add a third, new guard (`design-profiles.test.ts`). | Fixed: FR-011 now names the new guard. |
| F2 | Inconsistency | MEDIUM | `research.md` decisions, `LIVE-CHECK.md` section 7 | The research file said the Pi ship task stops at `review_ready` in `direct-PR`. The runbook says Pi runs the scout task only and lists the Pi ship task as not covered. | Fixed: the decision in `research.md` now matches the runbook. |
| F3 | Underspecification | LOW | `spec.md` Assumptions | "Docs lint" is read as the two guards plus `pnpm run check`. The brief did not define it, and the captain has not confirmed the reading. | Recorded in D-135 as a deviation with the revert option. |
| F4 | Constitution | LOW | Principle V, `tdd/verification.md` | One behavior (`[A1109]`) is `TEST_AFTER`. Principle V requires a red first. | Not clearable by rework. D-135 records it for the captain, on the precedent of D-099, D-107, D-116, D-122, and D-133. |
| F5 | Coverage | LOW | `CLAUDE.md` "Current scope" | The text says "Build milestones 1 to 11", and the constitution (1.4.0) also puts harness independence in scope. The text is out of date. | Out of scope: D-117 left it alone, and the project memory rule allows an edit only for a factual error. Reported, not changed. |
| F6 | Ambiguity | LOW | `spec.md` FR-009 | "Claude-only wording where the behavior is harness-neutral" is a judgment. | Made testable for the runbook by `[A1708]` (no Claude wording in sections 1, 3, 4, 5, 6, 8, 10, 11, and an exact list of six lines in section 7). |

No CRITICAL or HIGH finding.

## Coverage

| Requirement | Has task | Task IDs | Notes |
| --- | --- | --- | --- |
| FR-001 | Yes | T003, T004 | `[A1701]` |
| FR-002 | Yes | T003, T004 | `[A1701]` |
| FR-003 | Yes | T003, T004 | `[A1703]` |
| FR-004 | Yes | T003, T004 | `[A1702]` |
| FR-005 | Yes | T003, T004 | `[A1114]`, `[A1107]`, `[A1112]` |
| FR-006 | Yes | T003, T004 | `[A1705]` |
| FR-007 | Yes | T005, T006 | `[A1709]`, `[A1710]` |
| FR-008 | Yes | T007, T008 | `[A1711]` |
| FR-009 | Yes | T004, T006 | `[A1708]`, `[A1710]` |
| FR-010 | Yes | T002 | `research.md` |
| FR-011 | Yes | T010 | `[A1712]`, by `git diff --stat` |
| FR-012 | Yes | T009, T011 | `pnpm run check`, grep, line splitter |
| SC-001 to SC-005 | Yes | T003 to T010 | SC-005 is `research.md` |

## Constitution alignment

- Principle I to IV: not touched.
- Principle V: the guards went red before the documents changed (reproduced from git in the audit). One exception, F4.
- Principle VI: harness independence is in scope (D-117, D-129). Tier 2 runs (H13) stay out, as the captain shelved them.

## Unmapped tasks

None. T001 and T002 are setup and foundational tasks; T015 to T019 are the audit's remediation.

## Metrics

- Requirements: 12 functional, 5 success criteria.
- Tasks: 19 (T001 to T019).
- Coverage: 12 of 12 requirements have at least one task (100%).
- Ambiguity count: 1 (F6, resolved by a test).
- Duplication count: 0.
- Critical issues: 0.

## Next actions

Proceed to `/speckit-converge`.
The captain's decision on F4 is the one open item.
