# Data model: Agent-harness independence

The feature stores nothing new.
The types below are in-memory values, and the contract table is data in source.

## HarnessContract (`src/harness/contracts.ts`)

One row per harness, plus a generic row.
Every field is `readonly`.
The module has no imports, so the literal unions are written out.

| Field | Type | Meaning |
| --- | --- | --- |
| `provider` | `string` | The bb provider ID. The generic row uses `"*"`. |
| `testedWith` | `{ cli: string; bb: string } \| null` | The CLI and bb versions the report ran. `null` for the generic row. |
| `workerModes` | `readonly ("accept-edits" \| "auto" \| "full")[]` | The permission modes bb offered when tested. Information only. The runtime reads bb. |
| `sandbox` | `"available" \| "none" \| "unknown"` | `none` when the harness offers no sandboxed mode (Pi). |
| `refusedModes` | `readonly ("no-mistakes" \| "direct-PR" \| "local-only")[]` | The delivery modes in which `admit` refuses the harness. |
| `refusalReason` | `string \| null` | The sentence that explains the refusal. Null when `refusedModes` is empty. |
| `unlistedModels` | `"accepted" \| "refused"` | Whether the harness accepts a model ID that bb does not list. |
| `toolRoute` | `"function" \| "mcp-deferred" \| "xd-device" \| "unknown"` | How the model sees `factoryman_report`. |
| `toolHint` | `string \| null` | The one-line hint. Null for `function` and `unknown`. |
| `skillDelivery` | `"native-list" \| "system-prompt-list" \| "prompt-list"` | How the model sees the role skill. |
| `roleChange` | `"next-turn" \| "clear"` | When a stamped role reaches a live thread. |
| `failureCause` | `readonly ("provider/error" \| "system/error" \| "turn.failed")[]` | Where bb records the cause of a failure. |
| `failureLatency` | `"immediate" \| "retries" \| "unknown"` | How fast a start failure surfaces. |
| `steer` | `"inject" \| "queue" \| "unknown"` | The steering strategy. |
| `cost` | `"reported" \| "null" \| "unknown"` | Whether bb gets a cost from the harness. |

Rows (report section 6.2, plus the added columns):

| provider | testedWith | workerModes | sandbox | refusedModes | unlistedModels | toolRoute | skillDelivery | roleChange | failureCause | failureLatency | steer | cost |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `claude-code` | 2.1.316 / 0.49.0 | accept-edits, auto, full | available | none | accepted | `mcp-deferred` | `native-list` | `next-turn` | `provider/error` | `immediate` | `inject` | `null` |
| `codex` | 0.166.0 / 0.49.0 | accept-edits, auto, full | available | none | accepted | `function` | `native-list` | `clear` | `provider/error`, `turn.failed` | `retries` | `inject` | `unknown` |
| `pi` | 1.4.0 / 0.49.0 | full | none | `local-only` | refused | `function` | `system-prompt-list` | `next-turn` | `system/error` | `immediate` | `inject` | `unknown` |
| `acp-omp` | 18.14.1 / 0.49.0 | accept-edits, full | available | none | refused | `xd-device` | `prompt-list` | `clear` | `provider/error` | `immediate` | `inject` | `unknown` |
| generic (`*`) | none | none listed | unknown | none | refused | `unknown` | `prompt-list` | `clear` | `provider/error` | `unknown` | `unknown` | `unknown` |

Invariants that a test checks:

- `sandbox === "none"` exactly when `workerModes` holds no mode other than `full`, for the four named rows.
- `refusedModes` is non-empty exactly when `refusalReason` is non-null.
- `toolHint` is null exactly when `toolRoute` is `function` or `unknown`.
- `contractFor` returns the generic row for an ID that is in no row, and never throws.

Tool hints (constants):

- `mcp-deferred`: "In this harness the tool factoryman_report is listed as mcp__bb-bridge__factoryman_report and loads on demand: search for it with ToolSearch before you call it."
- `xd-device`: "In this harness factoryman_report has no function tool: write its JSON arguments to the device that your system prompt lists under MCP Tool Routes for factoryman_report."

## ProviderState (`src/bb/port.ts`)

| Field | Type | Notes |
| --- | --- | --- |
| `providerId` | `string` | |
| `status` | `"ready" \| "not_installed" \| "unauthenticated" \| "expired" \| "unsupported_version" \| "unknown"` | The adapter maps any other value to `unknown`. |
| `installedVersion` | `string \| null` | |
| `minimumSupportedVersion` | `string \| null` | |
| `localLoginCommand` | `string \| null` | The command to run on the host that holds the CLI. |
| `statusMessage` | `string \| null` | |

## ModelList and ModelEntry (`src/bb/port.ts`)

`ModelList = { models: ModelEntry[]; loadError: { code: string; detail: string | null } | null }`.

| Field of `ModelEntry` | Type | Notes |
| --- | --- | --- |
| `id` | `string` | |
| `model` | `string` | The model name. A profile matches `id` or `model`. |
| `isDefault` | `boolean` | |
| `defaultReasoningLevel` | `string` | May be empty. |
| `reasoningLevels` | `string[]` | From `supportedReasoningEfforts`. |
| `reasoningKnown` | `boolean` | `reasoningDiscovery === "known"`. |

## Gate result (`src/dispatch/gate.ts`)

```text
GateResult =
  | { ok: true }
  | { ok: false; code: "provider_unavailable" | "provider_not_admitted"; message: string; permanent: boolean }
  | { ok: false; code: "read_failed"; message: string }
```

`permanent` is true for `provider_not_admitted` only.

## Block codes (`src/dispatch/types.ts`)

`BlockCode` gains `no_default_profile` and `provider_not_admitted`.
`ProfileSource` becomes `"override" | "rule" | "default"`.

## Reasoning ladders (`src/dispatch/types.ts`, `config.ts`)

`reasoningLevels: readonly string[] | Readonly<Record<string, readonly string[]>>`.
`ladderFor(levels, providerId)` returns the array, the record's entry for the provider, or `DEFAULT_REASONING_LEVELS`.
Validation: a key is non-blank; an array is non-empty and has no duplicate.

## Starter config (`dispatch init`)

```json
{
  "version": 1,
  "profiles": { "<provider>": { "provider": "<provider>", "model": "<model>", "reasoningLevel": "<level>", "permissionMode": "<mode>" } },
  "default": "<provider>",
  "rules": []
}
```

The writer serializes with two-space indentation and a trailing newline.
`reasoningLevels` and `standingPermission` are left out, so the defaults apply.

## Failure evidence

```text
<today's evidence>. Provider-reported cause: "<bounded cause>"
Remedy: <one line>          (only when a remedy applies)
```

`boundCause`: replace each run of control characters (including line breaks and tabs) with one space, collapse repeated spaces, trim, and cut to 300 characters with `...` at the end when cut.
