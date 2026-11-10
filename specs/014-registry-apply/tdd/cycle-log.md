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

## Cycle 2: U1909 the dry run is pinned (characterization, before any change to the command)

- test: `src/tools/supervisor-command.test.ts::[U1909]` pins the whole `CommandResult` of a dry run (exit code and stdout, byte for byte) and checks the stored config is unchanged
- run: `pnpm vitest run src/tools/supervisor-command.test.ts -t U1909` -> passed at once against the untouched command, as a characterization test should
- state: `BASELINE`. The deliberate-mutant check for it is in `tdd/verification.md` (change the "Dry run" line and the pin fails).

## Cycle 3: U1904, U1905, U1906, U1907, U1908 the apply flow (one group)

- test: `src/tools/supervisor-command.test.ts` `[U1904]` (8 cases), `[U1905]` (2), `[U1906]` (1), `[U1907]` (5), `[U1908]` (1). The old `[U1030]` test that asserted the `--apply` refusal lost its refusal assertions, with the reason that `--apply` is now a real flag (D-148). Its usage and unreadable-file checks stay.
- red: `pnpm vitest run src/tools/supervisor-command.test.ts` -> 18 failed, 38 passed. Decisive lines: `[U1904]` `AssertionError: expected 'bb factoryman import-registry is a dr…' to contain 'Usage: bb factoryman import-registry …'`; `[U1905]` `AssertionError: expected 2 to be +0 // Object.is equality`; `[U1907]` `AssertionError: expected 2 to be 1 // Object.is equality`
- green: `parseImportArgs`, `applyReport`, and `applyRegistry` in `src/tools/supervisor-command.ts`; the old `DRY_RUN_ONLY` constant is gone. `pnpm vitest run src/tools/supervisor-command.test.ts` -> 56 passed. `pnpm run typecheck` and `pnpm run lint` clean.
- note: the acceptance test `[A1023]` in `test/acceptance/limits-cutover.test.ts` still asserts the old refusal and fails now; it is replaced in the next cycle, with its reason recorded.
- refactor: none needed
