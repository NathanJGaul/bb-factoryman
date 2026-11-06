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
pnpm test -- src/machine test/acceptance/machine
```

Expected: the table-driven suite passes.
Every refusal case names its reason code.

## 3. Exercise storage and replay (user story 3)

```sh
pnpm test -- src/store test/acceptance/store
```

Expected: the shared contract suite passes for both stores.
The rebuild test destroys the task cache and compares rebuilt rows with the originals.

## 4. Confirm the full gate

```sh
pnpm run check
```

Expected: type-check, lint, and tests pass in under 60 seconds.

## Known limit

`pnpm run build` calls `bb plugin build`.
The `bb` command-line tool is not installed in the build environment, so this step runs on the owner's machine.
See `docs/DECISIONS.md`.
