# Cycle log: The `factoryman_decide` tool

Append only. Newest last. Every entry's `red` block is the evidence that the test existed and failed before the implementation.

## Baseline

- suite: `pnpm run check` -> type check and lint clean, 152 files, 2076 tests passed, 0 failed (about 85 s of test wall time)
- commit: `c275f91` plus the decision-log commit that adds D-136 to D-143
- recorded: cycle 0, before any change
- note: the first run of `pnpm test` on `c275f91` had one red, `test/acceptance/decision-log.test.ts [A1510]`, because the new spec files cited D-136 to D-143 and the log had no such headings. The headings were written as plan-time decisions, and the suite was green again. This was a red caused by this feature's own documents, not a pre-existing failure.
