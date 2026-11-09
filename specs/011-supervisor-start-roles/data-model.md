# Data model: Supervisor start command, role advice, and the dispatch roles block

The feature adds no stored data.
The event log, the task cache, and the approval records keep their shape.
The new shapes are types of the port, the dispatch config, and the pure modules.

## Port: `SpawnSupervisorRequest` (new, `src/bb/port.ts`)

| Field | Type | Meaning |
| --- | --- | --- |
| `projectId` | string | The project the thread belongs to. |
| `prompt` | string | The thread's first prompt. |
| `profile` | `Profile` | Provider, model, reasoning level, and permission mode, from the chosen profile. |
| `metadata` | `Record<string, Json>` | Plugin metadata set in the spawn call. The command sends `{ role: "supervisor" }`. |
| `baseBranch` | `string \| null` | The branch the worktree starts from, or null for the project default. The command sends null. |

`BbPort.spawnSupervisor(request): Promise<{ threadId: string }>`.
It sets no parent thread.
It uses the same project lookup, host choice, and managed-worktree environment as `spawnWorker`.

## Port: `ThreadInfo.providerId` (changed)

`providerId: string | null`.
The adapter reads it from the thread.
Null means bb did not say.

## Config: `DispatchConfig.roles` (new, `src/dispatch/types.ts`)

| Field | Type | Default | Rule |
| --- | --- | --- | --- |
| `roles.supervisor.profile` | `string \| null` | `null` | When set, it names a key of `profiles`. |
| `roles.validator.agent` | `"observe"` | `"observe"` | The only accepted value. |

The file shape is `{ "roles": { "supervisor": { "profile": "<name>" }, "validator": { "agent": "observe" } } }`.
Both inner objects and `roles` are optional and strict.
The parsed config always carries all three values.

## Pure: `RoleAdvice` input and output (new, `src/harness/advice.ts`)

`roleAdvice(threadId, providerId, contract)` returns the text after a successful stamp.
Input: the thread ID, the provider ID or null, and a `HarnessContract` row (the generic row when the provider has none).
Output: one string, a few lines, that always names the thread.

| `roleChange` | Provider read | Text says |
| --- | --- | --- |
| `clear` | yes | The harness applies a role only when the session is rebuilt, and the owner runs `bb thread clear <thread>`. |
| `next-turn` | yes | The tools and the skill arrive at the next turn. No clear. |
| `clear` (generic row) | no | The owner runs `bb thread clear <thread>`, and the text says that bb did not name the harness. |

## Pure: validator observation (new, `src/validator/agent.ts`)

```text
AgentSetting   = { kind: "auto" } | { kind: "agents"; names: string[] }
ParseResult    = { ok: true; setting: AgentSetting } | { ok: false; reason: string }

AgentReadiness = { kind: "ready"; provider: string }
               | { kind: "not_ready"; provider: string; problem: string }
               | { kind: "unchecked"; reason: string }

ObservedAgent  = { name: string; readiness: AgentReadiness }

Observation    = { status: "observed"; source: "file" | "default"; auto: boolean;
                   agents: ObservedAgent[]; readyProviders: string[]; ready: boolean }
               | { status: "unobserved"; reason: string }
```

| Field | Meaning |
| --- | --- |
| `source` | `file` when the configuration file was read, `default` when the host has none. |
| `auto` | True when the setting is `auto`, alone or in a list. |
| `agents` | The named agents in order, each with its readiness. Empty for plain `auto`. |
| `readyProviders` | For `auto`: the mapped providers that bb reports ready on the host. |
| `ready` | True when at least one agent is `ready`, or, for `auto`, when `readyProviders` is not empty. |
| `reason` (unobserved) | Why the read or the parse failed, in plain words. |

Validation rules:

- `ready` is false whenever the status is `unobserved`.
- An `unchecked` agent never makes `ready` true.
- The functions never throw. A failed read, a failed bb call, and a failed parse each give `unobserved` or a not-ready entry with its reason.

`describeObservation(observation, hostName)` turns an observation into the one-line evidence text.
`validatorProblem(observation, hostName)` returns the preflight message, or null when `ready`.

## Preflight: `PreflightReport` (new, `src/machines/preflight.ts`)

`{ problems: Problem[]; notes: string[] }`.
`notes` holds the validator line when the agent is ready.
`runPreflight` returns `problems` only, so existing callers do not change.

## Conformance: `Lab.startSupervisor` (changed, `tools/conformance/port.ts`)

`startSupervisor(label): Promise<{ code: number; text: string; threadId: string | null }>`.
The real lab reads the thread ID from the command's first line.
The fake lab returns the ID it made.
