# Quickstart: validate the feature

Run these steps from the repository root.

## Prerequisites

- Node 26 and pnpm 12.
- Network access for the first install.

## 1. Install and verify the scaffold (user story 1)

```sh
pnpm install
pnpm run typecheck
pnpm run lint
pnpm test
```

Expected: all three commands exit 0.
The test run includes the fake-host load test and the lint-rule fixtures.

To see the isolation rule fire by hand, add a file `src/machine/probe.ts` containing `import "@get-bb/plugin-sdk";` and run `pnpm run lint`.
Expected: lint fails and names the restricted import.
Delete the file afterwards.

## 2. Exercise the state machine (user story 2)

```sh
pnpm vitest run src/machine test/acceptance/machine
```

Expected: the table-driven suite passes.
Every refusal case names its reason code.

## 3. Exercise storage and replay (user story 3)

```sh
pnpm vitest run src/store test/acceptance/store
```

Expected: the shared contract suite passes for both stores.
The rebuild test destroys the task cache and compares rebuilt rows with the originals.

## 4. Confirm the full gate

```sh
pnpm run check
```

Expected: type-check, lint, and tests pass in under 60 seconds.

## 5. Build the plugin

```sh
pnpm run build
```

Expected: `bb plugin build` writes `dist/server.js`, `dist/server.js.map`, and `dist/server.meta.json`.
This step needs the `bb` command-line tool (bb 0.48.1 or newer).
See `docs/DECISIONS.md` (D-001).
