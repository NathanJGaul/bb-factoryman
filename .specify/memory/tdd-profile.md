---
detected_at: 22e6032
ecosystems: [typescript]
default: typescript
stacks:
  typescript:
    cwd: .
    runner: vitest
    single: 'pnpm vitest run {file} -t "{name}"'
    file: pnpm vitest run {file}
    suite: pnpm test
    watch: pnpm vitest
    coverage: null
    mutation: null
    acceptance: 'pnpm vitest run {file}'
    property: null
    approval: null
    contract: null
    test_glob: "{src,test}/**/*.test.ts"
    exemplar:
      unit: src/machine/guards.test.ts
      acceptance: test/acceptance/machine-gates.test.ts
    helpers:
      - test/fixtures/machine.ts
      - test/fixtures/legal-set.ts
      - test/fixtures/store.ts
      - test/fixtures/history.ts
      - test/store-contract.ts
verified: [single, file, suite]
suite_baseline: green
suite_seconds: 21
---

# TDD stack profile

## Conventions to match

- The stack is TypeScript, ESM, Node 26, `vitest` 5, and `pnpm` 12.
- Unit tests sit next to the source as `<name>.test.ts` under `src/`.
- Acceptance tests sit in `test/acceptance/` and enter through the public API: the plugin factory, `transition`, `createTask`, `TaskLog`, `replayTask`, and `reconcile`.
  No end-to-end runner exists. The acceptance layer is an in-process integration test, which is weaker than a browser or process-level test. Test lists must say so.
- Assertions use `expect` from `vitest`. Imports come from `vitest` explicitly (`describe`, `it`, `expect`); the config does not enable globals.
- Plugin-level tests use `createFakePluginHost` from `@get-bb/plugin-sdk/testing`.
- The clock is injected as a `now: () => string` option. Never call `Date.now()` or `new Date()` inside `src/`.
- `src/machine/` must not import `@get-bb/*`, `better-sqlite3`, `node:*`, or `src/store`. Its tests may import `vitest` and test fixtures.
- Use named exports. Use `import type` for type-only imports (`verbatimModuleSyntax` is on).
- The exemplar for a unit test is `src/machine/guards.test.ts`, and for an acceptance test it is `test/acceptance/machine-gates.test.ts`.
- Reuse the builders in `test/fixtures/` (`machine.ts` for events and snapshots, `legal-set.ts` for the hand-written legal set, `store.ts` for the fake clock and event paths, `history.ts` for hand-written log rows) and the shared store suite in `test/store-contract.ts`.
- Refreshed by hand after milestone 3 (the commands are unchanged and were all re-run): the suite took about 21 seconds, 336 tests.

## Verification notes

- The suite finished in under one second at detection: 1 file, 3 tests, all passing.
- The single-test command ran exactly one test when given a matching name (`1 passed | 2 skipped`).
  A name that matches nothing exits 0 and reports `3 skipped` with no passes.
  A silent zero is therefore possible. A red or green counts only when the output shows at least one `passed` or `failed` test for the named behavior.
- A missing file name exits 1 (`No test files found`).

## Missing capabilities

| Capability | State | Consequence | Default tool |
| --- | --- | --- | --- |
| Coverage | `null`: `@vitest/coverage-v8` is not installed | Coverage is unmeasured. The audit falls back to trace checking from each acceptance criterion to a named test. | `@vitest/coverage-v8` |
| Mutation | `null`: StrykerJS is not installed | `/speckit.tdd.verify` uses deliberate mutants on the highest-risk behaviors and records which ones. | StrykerJS |
| Property-based | `null`: `fast-check` is not installed | Invariants become example tests at the boundaries, plus one seeded random-walk test. They are sampled, not proven. | `fast-check` |
| Acceptance runner | Same `vitest` runner | The outer loop is an in-process integration test. | none needed |
| Contract and approval tools | `null` | Not needed for this feature. | none |

The setup step adds no dependency.
Adding any of these tools is the owner's decision.

## Constraints

- `better-sqlite3` is a native module. `pnpm-workspace.yaml` must keep `allowBuilds` set for it. The smoke test in `test/toolchain.test.ts` fails if the native build is missing.
- `pnpm run build` calls `bb plugin build`, which needs the `bb` command-line tool (bb 0.48.1 was installed mid-task). The profile does not cover the build, and the suite does not run it.
- Lint is `pnpm run lint`. Type-check is `pnpm run typecheck`. The combined gate is `pnpm run check`.
