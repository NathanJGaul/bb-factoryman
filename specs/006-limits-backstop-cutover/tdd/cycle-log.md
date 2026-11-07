# Cycle log: Limits, backstop, and cutover

Append only.
Newest last.
Every entry's `red` block is the evidence that the test existed and failed before the implementation.
Each group commits its tests with stubs first, so git history shows the order.

## Baseline

- suite: `pnpm test` -> 80 files, 975 passed, 0 failed
- commit: `529574d`
