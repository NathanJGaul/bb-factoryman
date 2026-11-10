# Data model: The `factoryman_decide` tool

The feature adds no table and no event type.
It adds value shapes that the tool, the driver, and the form share.

## Decision key

A string, `nm-<runId or "unknown">-<step or outcome or "running">-<8 hex>`.

- Derived from a `RunView` by `decisionKey(view)` (`src/validator/key.ts`).
- Stable for equal views: the driver's signature (phase, gate step, gate status, finding IDs in order, outcome, run ID) decides equality.
- Written once per park into the evidence of the `finding` event as the last line `Decision key: <key>`.
- Checked twice by the tool: before the form and after the owner approves.

## Decision call (the tool's arguments)

| Field | Type | Rule |
| --- | --- | --- |
| `taskId` | string, non-empty | A ship task in the caller's project, in `needs_decision`. |
| `key` | string, non-empty | Equals the live view's key. |
| `action` | `approve`, `skip`, `fix`, `rerun` | `approve`, `skip`, `fix` for a gate; `rerun` for a parked finished run. |
| `findingIds` | array of non-empty strings, optional | Required and non-empty for `fix`; distinct; each is in the live gate. Not allowed for the other actions. |
| `instructions` | string, optional | Allowed for `fix` only; blank counts as absent. |

The object is strict: an unknown key is refused.
The advertised JSON schema is one flat object.

## Decision request (the form payload)

A plain JSON object with exactly these keys.

| Field | Type | Meaning |
| --- | --- | --- |
| `taskId` | string | The task. |
| `key` | string | The decision key the owner approves. |
| `kind` | `gate` or `finished` | What is parked. |
| `step` | string | The gate step, or `""` for a finished run. |
| `status` | string | The gate status, or `""`. |
| `outcome` | string | The finished run's outcome, or `""` for a gate. |
| `findings` | array of finding | The live gate's findings, verbatim. Empty for a finished run. |
| `answer` | object | The exact answer: `action`, `findingIds` (array), `instructions` (string, `""` when none). |

Finding: `id`, `severity`, `file`, `action`, `description`, all strings.

Reader rules (`readDecisionPayload`): exact keys at each level, string types, `kind` and `answer.action` in their sets, every `answer.findingIds` entry present in `findings`, and at least one ID for `fix`.
A payload that breaks a rule is unreadable, and the form offers no Approve.

## Owner approval (the form reply)

The existing `ApprovalAnswer`: `{ decision: "approved" | "denied", comment?: string }`.
The server checks it with the strict `approvalAnswerSchema` of the merge tool.
Only an exact `approved` counts.

## Log effects

| Situation | Event | Actor | Evidence |
| --- | --- | --- | --- |
| A gate or a finished run parks the task | `finding` (existing) | `system` | The existing gate text, plus `Decision key: <key>`. |
| The owner approved and the validator accepted the answer | `resolve` (existing) | `supervisor` | The exact answer and the owner's approval. |
| The owner approved a new run | `resolve` (existing) | `supervisor` | The approval and the run's outcome. |
| A denial, cancel, timeout, or refusal | none | | The plugin log and the tool result only (gap, D-140). |

## State changes

None to the machine.
`needs_decision` to `validating` through `resolve` is the only transition this feature causes.
