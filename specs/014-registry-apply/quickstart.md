# Quickstart: Registry apply

All checks run offline.

## Run the tests

```sh
pnpm vitest run src/limits/registry-apply.test.ts
pnpm vitest run src/tools/supervisor-command.test.ts
pnpm vitest run test/acceptance/registry-apply.test.ts test/acceptance/limits-cutover.test.ts
pnpm run check
```

## Walk through the command in the fake host

1. Load the plugin with `loadWorld({ projectList: [{ id: "proj-gizmos", name: "gizmos" }] })` and a registry file that holds `- gizmos [direct-PR +yolo branch=wip/] - ...`.
2. Run `import-registry --file <path>`. The store is unchanged.
3. Run `import-registry --file <path> --apply --project gizmos`. The stored config for `proj-gizmos` holds `direct-PR`, `yolo` on, and `wip/`.
4. Run the same command again. The output says nothing was written.
5. Run it with a flagged line (`- mystery [wibble]`). The command exits 1 and the store is unchanged.

See [contracts/cli.md](contracts/cli.md) for the exit codes and [data-model.md](data-model.md) for the plan.
