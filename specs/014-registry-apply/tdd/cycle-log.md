# Cycle log: Registry apply

Append only. Newest last. Every entry's `red` block is the evidence that the test existed and failed before the implementation.

## Baseline

- suite: `pnpm run check` -> type check and lint clean, 159 files, 2270 tests passed, 0 failed (about 134 s of test wall time, 3.5 minutes in all)
- commit: `04d8272`
- temp directory leak baseline for [A1911]: 3159 `bb-fake-plugin-host-*` directories under `/tmp` before this feature's tests (shared with other lanes)
- recorded: cycle 0, before any change
