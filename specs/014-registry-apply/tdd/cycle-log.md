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

## Cycle 4: A1901 to A1909 the outer loop through the plugin (written after the units, so most passed at once)

- tests: `test/acceptance/registry-apply.test.ts` (16 cases for `[A1901]` to `[A1909]`), and `[A1023]` in `test/acceptance/limits-cutover.test.ts`, which now checks that the dry run is the default and that `--apply` needs `--project`
- order: the plan and the command (cycles 1 and 3) were test-driven at unit level, so the acceptance tests were written against working code. This is a deviation from the outside-in order: the outer tests were not red first.
  - the stale `[A1023]` was red: it asserted `--apply` is refused as a dry run, and after cycle 3 the command prints the usage instead (the old test fails on `expect(result.stderr).toMatch(/dry run/)`). It was replaced with the new truth, for the reason that D-148 changes the rule it pinned.
  - first run of the new file: 13 passed, 3 failed, all three from errors in the tests themselves and not in the code: `[A1902]` expected `unknown mode` for `[direct-PR yolo]` (the parser reports `unexpected token`), `[A1904]` used a regex that matched across the `unchanged:` heading, `[A1906]` needed a way to make `projects.list` fail. The test expectations were corrected, and the fixture `test/fixtures/plugin-host.ts` gained a `projectListError` option. No assertion was loosened: each was made more exact.
- mutants (each applied to the source, run on the three apply test files, then reverted with `git checkout`); every one fails at least one test:
  - skip the flag check -> 4 failed (`[U1902]`, `[A1902]`, `[A1906]`)
  - `yolo` always on -> 11 failed
  - always write on a no-op -> 3 failed (`[U1903]`, `[U1906]`)
  - no bb project ambiguity check -> 3 failed (`[U1902]`, `[U1907]`, `[A1906]`)
  - no registry line ambiguity check -> 3 failed
  - clobber the stored base branch -> 4 failed (`[U1901]`, `[U1903]`, `[U1905]`, `[A1904]`)
  - allow `--project` without `--apply` -> 2 failed (`[U1904]`, `[A1907]`)
  - let `--apply` run without `--project` -> 3 failed
  - store an empty prefix as `""` -> 3 failed
- green: `pnpm vitest run test/acceptance/registry-apply.test.ts test/acceptance/limits-cutover.test.ts` -> 24 passed
- refactor: none needed

## Cycle 5: U1910 the command registration

- test: `src/server.test.ts::[U1910]`
- red: `pnpm vitest run src/server.test.ts -t U1910` -> `AssertionError: expected 'bb factoryman import-registry --file …' to contain 'bb factoryman import-registry --file …'` (1 failed)
- green: the summary and usage in `src/server.ts` changed; the `allowedFlags` of `import-registry` in `test/acceptance/live-check.test.ts` gained `--project` (that test is the owner of the live-check flag list, and it passes with the new flag).
- refactor: none needed
- green: `pnpm vitest run src/server.test.ts test/acceptance/live-check.test.ts` -> 28 passed

## Cycle 6: A1910 the documents

- test: `test/acceptance/registry-apply-docs.test.ts::[A1910]` (3 cases)
- red: `pnpm vitest run test/acceptance/registry-apply-docs.test.ts` -> 3 failed. Decisive lines: `AssertionError: expected '# Cutover from firstmate\n\nMove proj…' to contain 'bb factoryman import-registry --file …'`, `AssertionError: expected '' not to be '' // Object.is equality` (no D-148 yet), `AssertionError: expected '# Live check runbook…' not to match /--apply` is refused/`
- green: `docs/CUTOVER.md` (step 3 and "What the import does not do"), `docs/DECISIONS.md` (D-148, with D-078 and D-088 now pointing to it), `docs/LIVE-CHECK.md` (a new "The import apply" row, and the dry-run row no longer says that apply is refused), and `skills/factoryman-supervisor/SKILL.md`. `test/acceptance/live-check.test.ts` `[A1108]` pins the row labels of the tier 0 table, so the new row's label was added to that list (an addition, no row removed).
- note: two of my own expectations were corrected while going green and are not weakened: the D-148 text now uses the words `flagged` and `idempotent` that the check names, and the skill check asserts that the dry-run line is still there (the dry run still changes nothing) instead of asserting it is gone.
- refactor: none needed

## Cycle 7: A1911 no temporary directory leaks

- check, made by hand because a shared `/tmp` makes a fixed baseline meaningless: the count of `/tmp/bb-fake-plugin-host-*` before and after a run of the four new test files was 1672 and 1672, and no `/tmp/factoryman-registry-apply-*` directory remained.
- full gate: `pnpm run check` -> type check and lint clean, 162 files, 2331 tests passed (about 156 s)
