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
    test_glob: "{src,test}/**/*.test.{ts,tsx}"
    exemplar:
      unit: src/machine/guards.test.ts
      acceptance: test/acceptance/machine-gates.test.ts
    helpers:
      - test/fixtures/machine.ts
      - test/fixtures/legal-set.ts
      - test/fixtures/store.ts
      - test/fixtures/history.ts
      - test/store-contract.ts
      - test/fixtures/bb-port.ts
      - test/fixtures/runtime.ts
      - test/fixtures/git-repo.ts
      - test/fixtures/plugin-host.ts
      - test/fixtures/recorded.ts
      - test/fixtures/checkout.ts
      - test/fixtures/files.ts
      - test/fixtures/frame.ts
      - test/fixtures/queue.ts
      - test/fixtures/registry.ts
      - test/fixtures/approval-form.ts
      - test/fixtures/models.ts
verified: [single, file, suite]
suite_baseline: green
suite_seconds: 13
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
- Feature 008 (the merge approval form) adds frontend tests. Files named `*.test.tsx` run under jsdom with `// @vitest-environment jsdom` on the first line, and mount a registered renderer with `renderSlot` from `@get-bb/plugin-sdk/testing/app`. `test/fixtures/approval-form.ts` builds the renderer's props with spies on `submit` and `cancel`. The dev dependencies `react`, `react-dom`, `@testing-library/react`, `@testing-library/dom`, `jsdom`, `@types/react`, and `@types/react-dom` came with it (plan.md). jsdom has no layout and no styles, so a test cannot see the form's look; the live check in the lab does. Under jsdom the global `URL` is not Node's class, so fixtures that call `fs` build paths from `fileURLToPath(import.meta.url)`.
- The type check runs as `tsc6 --noEmit`: the pinned TypeScript alias installs `tsc6` and no `tsc`.
- Refreshed by hand after milestone 3 (the commands are unchanged and were all re-run): the suite took about 21 seconds, 336 tests.
- Refreshed by hand after milestone 6 (the commands are unchanged and `pnpm run check` re-ran): 57 files, 604 tests, about 13 seconds of wall time.
- Feature 013 (the `factoryman_decide` tool) adds `test/fixtures/decider.ts` (`FakeDecider`, a scripted stand-in for the driver's read and send paths) and `test/fixtures/decision-world.ts` (builders for run views, and `parked`, a no-mistakes ship task that the real driver parks in `needs_decision` on a `FakeValidator`). New test files are `src/validator/key.test.ts`, `src/tools/decide.test.ts`, `src/app/decision-approval-form.test.tsx`, `src/app.test.tsx`, `test/acceptance/tools-decide.test.ts`, `test/acceptance/decision-approval-form.test.tsx`, and `test/acceptance/decide-docs.test.ts`. The suite after the feature: 159 files, 2260 tests, about 46 s for `pnpm run check`. `FakeLab` (the conformance fake) models task kinds and the decide refusals. A test that needs a leaf module under `tools/` type-checking must import only modules with no runtime imports (`src/tools/decide-text.ts`), because `tsc6 -p tools/tsconfig.json` runs with `erasableSyntaxOnly`.
- Feature 014 (registry apply) adds `src/limits/registry-apply.test.ts` (the pure plan), `test/acceptance/registry-apply.test.ts` (the command through the plugin factory, with a temporary registry file and the store tables compared before and after), and `test/acceptance/registry-apply-docs.test.ts`. The plugin host fixture gains a `projectListError` option next to `projectList`. The suite after the feature: 162 files, 2331 tests, about 156 s for `pnpm run check`. A store method can be spied or made to throw by assigning to it on the store object that `testRuntime().runtime.deps.store` returns.
- Feature 009 (harness independence) extends the fixtures, and adds `test/fixtures/models.ts` (the default model list, defined once) and `test/fixtures/defaults.test.ts` (it pins the defaults below). `FakeBbPort` gains `states`, `statesByHost`, `statesError`, `models`, `modelsByHost`, `modelsError`, `failureCauses`, and `failureCauseError`, and the builders `providerState` and `modelEntry`. `FakeFiles` gains `writeNew`, `writes`, and `writeErrors`. `loadWorld` gains `providerStates`, `providerStatesByHost`, `providerStatesError`, `models`, `modelsByHost`, `modelsError`, `eventsError`, `toolHints`, `bareConfig`, the world fields `threadEvents`, `setProviderStates`, and `setModels`, and the builders `stateFixture` and `modelFixture`. By default every listed provider is `ready`, a generous list of model IDs is listed, and a checkout with no `dispatch.json` gets `TEST_DEFAULT_DISPATCH` (the old built-in profile as a `default`); pass `bareConfig: true` to test the real block. The fake host reports "no instructions" as `instructions: null`, and a plugin reload gives it a new call log. New test files are `src/harness/contracts.test.ts`, `src/dispatch/gate.test.ts`, `src/dispatch/init.test.ts`, `src/wiring/failure-cause.test.ts`, and `test/acceptance/harness-*.test.ts`.
- Milestone 10 adds `test/fixtures/queue.ts` and `test/fixtures/registry.ts`, and extends the plugin host fixture with `costs`, `webhook`, `projectList`, and `skewClock`, and `FakeBbPort` with `costs`, `costError`, and `projectList`.
- Milestone 9 extends `test/fixtures/checkout.ts` with a `workflow.json`, `test/fixtures/plugin-host.ts` with `failMetadata`, and `FakeBbPort` with `setMetadataError`.
- Milestone 8 adds `test/fixtures/frame.ts` (the `FMX1` line) and extends the plugin host fixture with machines, sources, per-host providers, a fake terminal behind `bb.sdk.terminals` (`world.remote`), and `world.startMonitor()`.
- Milestone 7 adds `test/fixtures/checkout.ts` (temporary project checkouts with a `dispatch.json`) and `test/fixtures/files.ts` (an in-memory `Files`).
- Milestones 4 to 6 add five fixtures. `test/fixtures/runtime.ts` builds a runtime over the memory store and the fake `BbPort` (`test/fixtures/bb-port.ts`). `test/fixtures/plugin-host.ts` loads the real plugin factory into the fake host with a small in-memory bb behind `bb.sdk`. `test/fixtures/git-repo.ts` builds temporary git repositories. `test/fixtures/recorded.ts` loads the real bb and no-mistakes recordings.

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
