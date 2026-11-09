# Contract: `bb factoryman dispatch init`

```text
bb factoryman dispatch init --provider <id> [--project <id>] [--model <id>] [--level <id>] [--mode <accept-edits|auto|full>]
```

## Arguments

| Flag | Required | Meaning |
| --- | --- | --- |
| `--provider` | yes | The bb provider ID of the harness. |
| `--project` | no | The bb project ID. The command context supplies it when the flag is absent. One of the two is required. |
| `--model` | no | Replaces bb's default model. |
| `--level` | no | Replaces the model's default reasoning level. |
| `--mode` | no | Replaces the chosen permission mode. |

A flag without a value, a blank value, a repeated flag, an unknown flag, or a missing required value prints the usage text on stderr and exits with code 2.
The usage text gains `Usage: bb factoryman dispatch init --provider <id> [--project <id>] [--model <id>] [--level <id>] [--mode <mode>]`.
`server.ts` registers a `dispatch` entry in `bb.cli.register` with that usage.

## Steps and exits

| Step | On failure |
| --- | --- |
| Read the project's checkout (`getProjectCheckout`). | Exit 1: `The project <id> has no local checkout on the server, so no dispatch.json can be written there.` |
| Read `listProviders()` and find the provider. | Exit 1: `bb does not list the provider \`<id>\`. It lists: <ids>.` |
| Read `listModels(provider)`. | Exit 1: `Could not read bb's models: <error>.` |
| Pick the model: `--model`, else the model with `isDefault`, else the first listed. | Exit 1 when none: `bb lists no models for \`<id>\`. Pass --model <id>.` |
| Pick the level: `--level`, else the model's `defaultReasoningLevel` when non-empty, else `medium` when the model lists it, else its first listed level. | Exit 1 when none: `Pass --level <id>.` |
| Pick the mode: `--mode`, else the first of `auto`, `accept-edits`, `full` that the provider offers. | Exit 1 when none: `The provider offers no permission mode.` |
| Check the profile with `checkProfile` minus readiness (listing, mode, model, level). | Exit 1 with the same message that dispatch prints. |
| Build the file and read it back with `parseDispatchConfig`. | Exit 1: `The starter file would be invalid: <message>.` This is a bug guard and has no expected path. |
| `Files.writeNew(<checkout>/.bb/factoryman/dispatch.json, text)`. | `exists`: exit 1, `<path> already exists, so nothing was written. Set \`default\` in it instead.` A throw: exit 1, `Could not write <path>: <error>.` |

On success the command exits 0 and prints:

```text
Wrote <path>.
Profile "<provider>": <provider> <model> <level> <mode>. It is the default for this project.
Dispatch checks readiness, the model, and the delivery mode each time, so this file does not make the harness ready.
```

## Side effects

- It writes one file and creates `.bb/factoryman/` when that directory is missing.
- It reads no credential and writes no credential.
- It calls no bb method that changes state.
- It is not a tool, so a supervisor cannot call it.

## Tests

- Unit (`init.test.ts`): argument parsing; defaults; each flag override; each failure exit; the `exists` result; that the written text parses.
- Unit (`files.test.ts`): `writeNew` creates the directory, creates the file, returns `exists` for an existing file without changing it, and rethrows other errors.
- Acceptance (`harness-default.test.ts`): block with no config; run the command against a temporary checkout through the registered handler; dispatch again and read `Profile: ... from the configured default`.
