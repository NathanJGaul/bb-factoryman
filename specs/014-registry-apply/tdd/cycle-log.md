# Cycle log: Registry apply

Append only. Newest last. Every entry's `red` block is the evidence that the test existed and failed before the implementation.

## Baseline

- suite: `pnpm run check` -> type check and lint clean, 159 files, 2270 tests passed, 0 failed (about 134 s of test wall time, 3.5 minutes in all)
- commit: `04d8272`
- temp directory leak baseline for [A1911]: 3159 `bb-fake-plugin-host-*` directories under `/tmp` before this feature's tests (shared with other lanes)
- recorded: cycle 0, before any change

## Cycle 1: U1901, U1902, U1903 the pure apply plan (one group, 22 test cases)

- test: `src/limits/registry-apply.test.ts` `[U1901]` (5 cases), `[U1902]` (11 cases), `[U1903]` (6 cases)
- red: `pnpm vitest run src/limits/registry-apply.test.ts` with only the exported types in `registry-apply.ts` -> `TypeError: planApply is not a function`, 22 failed
- green: `planApply` added. `pnpm vitest run src/limits/registry-apply.test.ts` -> 22 passed
- note: `[U1902]` includes the bare `yolo` line in two forms (alone, and after a mode); both are flagged by `parseRegistry`, so `planApply` refuses them through the flag check and has no `yolo` rule of its own.
- note: the first red run was made with `TMPDIR` pointed at the pool directory by mistake; it created nothing there (checked), and later runs use the default.
- refactor: none needed
