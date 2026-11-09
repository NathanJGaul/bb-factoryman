# Contract: the dispatch gate and its messages

`gateProfile(bb, profile, mode, host)` in `src/dispatch/gate.ts` is the only function that applies profile checks.
`factoryman_dispatch` and the queue start call it.

## Order

1. `admit(profile.provider, mode)`: no bb call. A refusal returns `provider_not_admitted`, `permanent: true`.
2. Read `listProviders(host)`, `getProviderStates(host)`, and `listModels(profile.provider, host)` together.
   A throw from any of them returns `read_failed`.
3. `checkProfile(profile, facts)`, which stops at the first problem:
   1. Readiness (R1, R2).
   2. The provider appears in the list.
   3. The permission mode (R3).
   4. The model and the level (R4).
   A problem returns `provider_unavailable`, `permanent: false`.

`host` is the placed `MachineInfo`, or `null` for the default host.
The host label in messages is the machine name, or "the default host".

## Dispatch output

| Result | Text |
| --- | --- |
| Block | `Dispatch blocked (<code>): <message> No task was created.` |
| Read failure | `Dispatch failed: <message>. No task was created.` |

## Messages

`<h>` is the host label and `<p>` the provider ID.
Every `provider_unavailable` message ends with `No other provider was tried.`

| Case | Message |
| --- | --- |
| `not_installed` | `The provider \`<p>\` is not installed on <h> (bb status: not_installed). Install its CLI there.` |
| `unauthenticated` | `The provider \`<p>\` is not signed in on <h> (bb status: unauthenticated). Run \`<localLoginCommand>\` on that machine.` Without a login command: `Sign in to it on that machine.` |
| `expired` | `The provider \`<p>\` has an expired login on <h> (bb status: expired). Run \`<localLoginCommand>\` on that machine.` Same fallback. |
| `unsupported_version` | `The provider \`<p>\` is too old on <h> (bb status: unsupported_version): installed <installedVersion or "unknown">, minimum <minimumSupportedVersion or "unknown">. Update its CLI there.` |
| `unknown` | `The provider \`<p>\` is in a state that bb does not describe on <h> (bb status: unknown)<: statusMessage>.` |
| No state | `bb reports no state for the provider \`<p>\` on <h>. It reports: <ids or "none">.` |
| Not listed | `The provider \`<p>\` is not available in bb. Available providers: <ids or "none".>` (today's text, kept) |
| Mode | `The provider \`<p>\` does not offer the permission mode \`<m>\`. It offers: <modes>.` (today's text, kept) |
| Coarse level | `The provider \`<p>\` does not list the reasoning level \`<l>\`. It lists: <levels>.` (today's text, kept) |
| Model unlisted | `The model \`<m>\` is not listed for the provider \`<p>\` on <h>. It lists: <ids, or "no models">.` plus, when bb gives a load error, ` bb could not load the models (<code>: <detail>).` |
| Model level | `The model \`<m>\` of the provider \`<p>\` does not list the reasoning level \`<l>\`. It lists: <levels>.` |
| Admission | `The provider \`<p>\` is not admitted for <mode> projects. <refusalReason> It is allowed in: <modes not refused>. No other provider was tried.` |
| Read failure, providers | `could not read bb's providers (<error>)` |
| Read failure, states | `could not read bb's provider states (<error>)` |
| Read failure, models | `could not read bb's models (<error>)` |

The Pi `refusalReason`: `It runs workers with no sandbox (it offers only the permission mode \`full\`), so a worker can answer the owner's merge form with \`bb thread interactions respond\` (D-030), and local-only mode has no pull request backstop.`

## Resolver block

When no override, rule, or default applies, the resolver returns `blocked` with the code `no_default_profile` and this message, and dispatch prints it with `Dispatch blocked (no_default_profile): ... No task was created.`:

```text
No profile applies to this task. The project has no `default` in `.bb/factoryman/dispatch.json`, and no rule matches. The plugin does not choose a harness for you. Run `bb factoryman dispatch init --provider <id>` to write a starter file, set `default` in dispatch.json, or pass `profile`.
```

## Queue start

| Result | Action |
| --- | --- |
| `ok` | Continue to the preflight and the launch. |
| `permanent` block | `rt.apply(taskId, { type: "fail", actor: "system", evidence: "The queued task can no longer start: <message>" })`. |
| Any other block, or `read_failed` | The task stays queued. `log.warn("Task <id> stays queued: <message>")`. |

## Preflight

`runPreflight` reuses the readiness function (R1, R2), so the `agent_cli` problem for a remote machine carries the same text.
For a provider-less preflight the problem stays `No agent CLI is available on <host>. Install one and sign in on that machine.`, and it fires when no listed provider is `ready`.
