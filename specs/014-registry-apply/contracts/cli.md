# Contract: `bb factoryman import-registry`

## Usage

```text
bb factoryman import-registry --file <path>
bb factoryman import-registry --file <path> --apply --project <name>
```

The first form is the dry run (D-088) and does not change.
The second form writes the stored config of one project.

## Argument rules

| Call | Result |
| --- | --- |
| `--file <path>` | Dry run. |
| `--file <path> --apply --project <name>` | Apply. |
| `--apply` without `--project` | Usage, exit 2, no read. |
| `--project <name>` without `--apply` | Usage, exit 2, no read. |
| `--project` twice, a missing value, a value that starts with `--`, an unknown flag, or a stray argument | Usage, exit 2, no read. |
| No `--file` | Usage, exit 2. |

## Apply outcomes

| Situation | Exit | Stored config |
| --- | --- | --- |
| File missing or unreadable | 1 | unchanged |
| No registry line for the name, or more than one | 1 | unchanged |
| The line has a flag | 1, flags printed | unchanged |
| bb cannot list projects | 1 | unchanged |
| No bb project with the name | 1 | unchanged |
| More than one bb project with the name | 1 | unchanged |
| The write fails | 1 | unchanged |
| Every field already equals the target | 0, all fields "unchanged" | unchanged |
| At least one field differs | 0 | those fields replaced |

## Output of a successful apply

```text
Applied registry line "gizmos" to bb project proj-gizmos.
written:
  deliveryMode: no-mistakes -> direct-PR
  yolo: off -> on
unchanged:
  branchPrefix: wip/
  baseBranch: main (not in the registry)
  defaultMachine: (none) (not in the registry)
Notes:
- ...
Forge none is not stored.
```

A rerun prints every field under "unchanged" and the line "Nothing was written."
