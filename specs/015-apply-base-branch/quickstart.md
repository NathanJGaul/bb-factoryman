# Quickstart: Apply a base branch

## Run the tests

```sh
pnpm vitest run src/limits/registry-apply.test.ts src/tools/supervisor-command.test.ts test/acceptance/registry-apply-base-branch.test.ts
pnpm run check
```

## Try it in a lab

1. Apply a `local-only` line without the flag. The output ends with the warning.
2. Run `bb factoryman import-registry --file <registry> --apply --project <name> --base-branch main`. The output lists `baseBranch: (none) -> main` as written and has no warning.
3. Run it again. It prints `Nothing was written.` and the field as unchanged.
4. Tear down a scout task in that project. The "needs a base branch" refusal does not appear (manual test plan case E-01).

See [contracts/cli.md](contracts/cli.md) for the rules.
