# Contract: new `BbPort` methods

`src/bb/port.ts` lists every call the plugin makes to bb.
This feature adds three reads.
Only `src/bb/adapter.ts` implements them against the real SDK.
Two test doubles implement them: `FakeBbPort` (`test/fixtures/bb-port.ts`) and the fake SDK behind `loadWorld` (`test/fixtures/plugin-host.ts`).

## `getProviderStates(hostId?: string): Promise<ProviderState[]>`

| Item | Behavior |
| --- | --- |
| SDK call | `bb.sdk.system.providerStates(hostId === undefined ? undefined : { hostId })` |
| Result | One `ProviderState` for each entry of `response.providers`, in order |
| Mapping | `providerId`, `status`, `installedVersion`, `minimumSupportedVersion`, `localLoginCommand`, `statusMessage` are copied. A `status` outside the six known values becomes `unknown`. |
| Errors | The adapter does not catch. The caller turns a throw into a read failure and a block. |
| `FakeBbPort` | `states: ProviderState[]` and `statesByHost: Map<string, ProviderState[]>` (as `providers`), `statesError: Error \| null`. When `states` is unset, it derives one state per listed provider: `ready` when `available`, `not_installed` otherwise. |
| `loadWorld` | `system.providerStates` with options `providerStates`, `providerStatesByHost`, `providerStatesError`. The default derives from the `providers.list` fixture the same way. |

## `listModels(providerId: string, hostId?: string): Promise<ModelList>`

| Item | Behavior |
| --- | --- |
| SDK call | `bb.sdk.providers.models({ providerId, ...(hostId === undefined ? {} : { hostId }) })` |
| Result | `{ models, loadError }`. Each `ModelEntry` has `id`, `model`, `isDefault`, `defaultReasoningLevel`, `reasoningLevels` (the `reasoningEffort` of each `supportedReasoningEfforts` entry), and `reasoningKnown` (`reasoningDiscovery === "known"`). `loadError` is `{ code, detail }` from `modelLoadError`, or `null`. |
| Errors | Not caught. A throw is a read failure. |
| `FakeBbPort` | `models: Map<string, ModelList>` by provider ID, `modelsByHost: Map<string, ModelList>` keyed `<host>/<provider>`, `modelsError: Error \| null`. The default for any provider is the generous list in the plan (low to max, all known). |
| `loadWorld` | `providers.models` with options `models`, `modelsByHost`, `modelsError`, same default. |

## `getFailureCause(threadId: string): Promise<string | null>`

| Item | Behavior |
| --- | --- |
| SDK call | `bb.sdk.threads.events.list({ threadId, types: ["provider/error", "system/error"], order: "desc", limit: "1" })` |
| Result | The first row's `data.detail` when it is a non-blank string, else `data.message` when it is a non-blank string, else `null`. An empty result is `null`. |
| Errors | Not caught. The handler catches, logs, and keeps today's evidence. |
| `FakeBbPort` | `failureCauses: Map<string, string \| null>` by thread ID, `failureCauseError: Error \| null`. The default is no cause. |
| `loadWorld` | `threads.events.list` reads `world.threadEvents: Map<string, Array<{ type, seq, data }>>`, applies `types`, `order`, and `limit`, and fails with `eventsError` when set. |

## Not changed

`listProviders` keeps its shape.
It still supplies each provider's permission modes and coarse reasoning levels.
