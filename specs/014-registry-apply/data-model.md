# Data model: Registry apply

The feature adds no stored data.
It writes one existing row.

## Inputs

| Name | Source | Notes |
| --- | --- | --- |
| `RegistryEntry` | `parseRegistry` | `name`, `mode` (null when unknown), `yolo`, `branchPrefix`, `forge`, `flags`, `notes`. Unchanged. |
| bb projects | `bb.listProjects()` | `{ id, name }` list. |
| Stored config | `store.getProjectConfig(id)` | The default config when no row exists. |

## Apply plan (new, in memory)

```ts
type ApplyRefusal = { ok: false; code: ApplyRefusalCode; message: string };
type FieldChange = { field: "deliveryMode" | "yolo" | "branchPrefix"; from: unknown; to: unknown; changed: boolean };
type ApplyPlan = {
  ok: true;
  projectId: string;
  entryName: string;
  changes: FieldChange[];          // always three, in this order
  untouched: string[];             // baseBranch and defaultMachine, with their stored values
  notes: string[];                 // the entry's notes, plus the forge line
  next: ProjectConfig | null;      // the row to write, or null when nothing changes
};
```

`ApplyRefusalCode` is one of `no_entry`, `ambiguous_entry`, `flagged`, `unknown_project`, `ambiguous_project`.

## Rules

- `to.deliveryMode` is `entry.mode` (never null in a plan, because a null mode is flagged).
- `to.yolo` is `entry.yolo`.
- `to.branchPrefix` is `entry.branchPrefix`, with `""` becoming `null`.
- `next` is `{ ...stored, deliveryMode, yolo, branchPrefix, projectId }` when any change has `changed: true`, else null.
- A refusal never carries a `next`.
