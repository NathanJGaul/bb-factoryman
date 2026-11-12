# Data model: Apply a base branch

No new entity, table, or column.

## Stored project config (unchanged shape)

`baseBranch: string | null` already exists. The apply may now write it.

## Apply plan (extended)

| Field | Type | Change |
| --- | --- | --- |
| `changes` | `FieldChange[]` | Gains a `baseBranch` entry when a value was given. Compared with the stored value like the other fields. |
| `untouched` | list | Holds `baseBranch` only when no value was given. Always holds `defaultMachine`. |
| `needsBaseBranch` | boolean | New. True when the resulting mode is `local-only` and the resulting base branch is null. |

## Branch name rules (`checkBranchName`)

Input: the raw `--base-branch` value. Output: a reason string, or null when valid.
The value is never trimmed or changed. A value with surrounding space is a refusal.
