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
