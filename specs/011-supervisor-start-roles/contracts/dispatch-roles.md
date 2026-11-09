# Contract: the `roles` block of `dispatch.json`

The file stays at version 1.
A file with no `roles` block is valid and behaves as before.

```json
{
  "version": 1,
  "profiles": {
    "claude": { "provider": "claude-code", "model": "claude-sonnet-5-5", "reasoningLevel": "medium", "permissionMode": "auto" },
    "codex":  { "provider": "codex", "model": "gpt-6-luna", "reasoningLevel": "medium", "permissionMode": "auto" }
  },
  "default": "claude",
  "roles": {
    "supervisor": { "profile": "codex" },
    "validator":  { "agent": "observe" }
  },
  "rules": []
}
```

## Fields

| Path | Type | Default | Rule |
| --- | --- | --- | --- |
| `roles` | object | `{}` | Optional. Strict: an unknown key is invalid. |
| `roles.supervisor` | object | `{}` | Optional. Strict. |
| `roles.supervisor.profile` | string | none | Optional. When present it must be a key of `profiles`. Not blank. |
| `roles.validator` | object | `{}` | Optional. Strict. |
| `roles.validator.agent` | string | `"observe"` | Optional. The only accepted value is `"observe"`. |

## Parsed form

Every parsed config carries `roles`, with the defaults filled in:

```text
roles: { supervisor: { profile: string | null }, validator: { agent: "observe" } }
```

The config of a project with no file carries the defaults too.

## Error messages

The loader prefixes the message with `dispatch.json is invalid: `.
Each message ends with the path in backticks, as every existing message does.

| Input | Message |
| --- | --- |
| `roles.supervisor.profile: "ghost"`, no such profile | ``roles.supervisor.profile names the undefined profile `ghost` at `roles.supervisor.profile` `` |
| `roles.validator.agent: "set"` | ``roles.validator.agent must be "observe": the plugin reads the validator's agent and never writes no-mistakes configuration at `roles.validator.agent` `` |
| An unknown key under `roles` | The strict-object message of `zod`, with the path. |
| `roles.supervisor.profile: ""` | ``must not be blank at `roles.supervisor.profile` `` |

## What the block does

- `roles.supervisor.profile` chooses the profile of `bb factoryman supervisor start` when `--profile` is absent.
- `roles.validator.agent` has one value, so the plugin always observes the validator's agent.
  The field exists so that a project can state the choice, and so that `inherit` and `set` are refused with a reason until the captain decides on them.
- Neither field changes how a worker is dispatched, how a rule matches, or how a gate decides.
