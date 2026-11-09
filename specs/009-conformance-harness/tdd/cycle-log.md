# Cycle log: Conformance harness for agent harnesses

Append only.
Newest last.
Every entry's `red` block is the evidence that the test existed and failed before the implementation.

## Baseline

- suite: `pnpm test` -> 95 files, 1307 passed, 0 failed
- commit: `8148863`

## Setup before the first cycle (tasks T1301 to T1304)

Commit `2a901a4`: `tools` joins the type check through `tools/tsconfig.json` (with `erasableSyntaxOnly`, so Node's type stripping can run the files), `allowImportingTsExtensions` in the root `tsconfig.json`, `tools/**/*.test.ts` in the `vitest` include, and the scripts `conformance` and `conformance:docs`.
The root config cannot take `erasableSyntaxOnly`, because `src/` uses constructor parameter properties.
`pnpm run typecheck` and `pnpm run lint` stay green.
No dependency was added.

## Group 1: the verdict rules and the known-gap loader (U1301 to U1316)

Tests and stubs came first: `judge` returned an empty run, `parseGaps` and `loadGaps` returned `[]`.
All 16 tests ran red for the right reason (an assertion about the missing behavior).

- red: `pnpm vitest run tools/conformance` -> 16 failed
  - U1301 `AssertionError: expected [] to deeply equal [ [ 'S3', 'pass' ] ]`
  - U1302 `AssertionError: expected undefined to be 'fail'`
  - U1303 `AssertionError: expected undefined to be 'known-gap'`
  - U1305 `AssertionError: expected [] to deeply equal [ { check: 'S1.remedy', …(3) } ]`
  - U1312 `AssertionError: expected [] to deeply equal [ { check: 'S1.remedy', …(3) }, …(1) ]`
  - U1313 to U1315 `AssertionError: expected [Function] to throw an error`
  - U1316 `AssertionError: promise resolved "[]" instead of rejecting`
- green: `tools/conformance/verdict.ts` (`judge`, `applicable`, `judgeScenario`) and `tools/conformance/gaps.ts` (a `zod` schema, the duplicate check, a loader that fails on a missing file). `pnpm vitest run tools/conformance` -> 16 passed.
- refactor: none needed.

## Group 2: the result file and the command line (U1317 to U1326)

Tests and stubs first: `parseResult` threw "not implemented", `serializeResult` and `resultFileName` returned `""`, `parseArgs` refused everything.

- red: `pnpm vitest run tools/conformance/result.test.ts tools/conformance/args.test.ts` -> 14 failed
  - U1317 `Error: not implemented`
  - U1318 `AssertionError: expected false to be true // Object.is equality` (the trailing newline)
  - U1319 `SyntaxError: Unexpected end of JSON input` (the stub wrote nothing, so the damage step could not run; the check below shows the real reason)
  - U1320 `AssertionError: expected '' to be '1.5-claude-code.json'`
  - U1321 to U1325 `Error: expected ok, got: not implemented`
  - U1322 `AssertionError: expected 'not implemented' to match /--harness/`
  - U1323 `AssertionError: expected 'not implemented' to match /tier 2/i`
  - U1326 `AssertionError: expected 'not implemented' to match /firstmate/`
- green: `tools/conformance/result.ts` (a `zod` schema for the file, strict, with the verdict values) and `tools/conformance/args.ts` (the flags, the tier rules, the lab-directory refusal, offline by default at tier 1.5). `pnpm vitest run tools/conformance` -> 30 passed. `pnpm run typecheck` and `pnpm run lint` pass.
- note on U1319: its red came from the stub's empty output and not from a missing validator, so the audit must prove the test with a mutant (a loosened schema) and not by the red alone.
- refactor: none needed.
