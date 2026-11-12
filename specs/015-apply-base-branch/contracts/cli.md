# Contract: `import-registry --base-branch`

## Usage

```text
bb factoryman import-registry --file <path> --apply --project <name> [--base-branch <name>]
```

## Argument rules

| Call | Result |
| --- | --- |
| `--apply --project <name>` | Apply as in D-148. `baseBranch` stays as stored. |
| `--apply --project <name> --base-branch <name>` | Apply, and store the name as `baseBranch`. |
| `--base-branch` without `--apply` | Usage, exit 2, no read. |
| `--base-branch` with no value, a value that starts with `--`, or given twice | Usage, exit 2, no read. |
| A value that breaks a branch name rule | Exit 2, message names the rule, no read, no write. |

## Output

With the flag, the field joins the others:

```text
written:
  baseBranch: (none) -> main
```

or, when equal, under `unchanged:` as `  baseBranch: main`.

Without the flag the `unchanged:` block is as before:

```text
  baseBranch: (none) (not in the registry)
```

When the resulting mode is `local-only` and the resulting base branch is none, the output ends with:

```text
Warning: this project is local-only and has no base branch, so merge and teardown refuse until you run this command again with --base-branch <name>.
```

The line appears on a rerun that writes nothing.
Exit codes: 0 on success and no-op, 1 on the existing refusals and a failed write, 2 on usage and name errors.
