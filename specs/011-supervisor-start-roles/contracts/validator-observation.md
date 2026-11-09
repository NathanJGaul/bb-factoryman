# Contract: the validator agent observation

The plugin observes which agent no-mistakes will use and whether bb reports its provider ready.
It reads, and it never writes.

## What runs

One command, through the plugin's `exec`, on the host that runs the pipeline:

```text
sh -c 'f="${NM_HOME:-$HOME/.no-mistakes}/config.yaml"; if [ -f "$f" ]; then cat "$f"; else exit 3; fi'
```

- The host is the task's machine when it is not the host that holds the clone, and the server otherwise (`hostFor`).
- The read stops after 30 seconds (`timeoutMs: 30000`).
- Exit 0: the standard output is the configuration text.
- Exit 3: the host has no configuration file. The setting is `auto`, and the source is `default`.
- Any other exit, a command that did not run, or a timeout: the status is `unobserved`, with the reason.

Then one bb call: `getProviderStates(hostId)`, for the same host.
A failure of that call makes the status `unobserved`.

## Reading the `agent` key

Only a top-level key counts: the line starts at column 0 with `agent:`.
Comments (`#` at the start of a value, or after whitespace) are not part of the value.
Quotes around a name are removed.

| Shape | Example | Result |
| --- | --- | --- |
| Absent | no `agent:` line | `auto`, source `file` |
| Scalar | `agent: claude` | one name |
| Flow list | `agent: [codex, grok]` | names in order |
| Block list | `agent:` then `  - codex` lines | names in order |
| Empty or broken | `agent: [codex`, `agent:` with no items, two `agent:` lines | `unobserved`: the reason names the shape |

## Mapping to a bb provider

| no-mistakes agent | bb provider |
| --- | --- |
| `claude` | `claude-code` |
| `codex` | `codex` |
| `pi` | `pi` |
| `acp:omp` | `acp-omp` |
| `opencode` | `acp-opencode` |
| `grok` | `acp-grok` |
| `cursor` | `acp-cursor` |
| any other name, including `acp:<other>`, `copilot`, `rovodev`, `devin`, `antigravity` | none |

## Readiness

For a mapped agent, the readiness is the existing `readinessProblem` result for its provider on the host:

- `ready`: bb reports the status `ready`.
- `not_ready`: every other status, a state that bb does not report for the provider, and a status the plugin does not know.
  The problem text is the one dispatch gives, with bb's remedy.
- `unchecked`: the agent has no mapped provider.

The observation is ready when at least one named agent is `ready`.
For `auto` it is ready when at least one mapped provider is ready on the host.
An `unchecked` agent never makes it ready.

## Evidence line

One line, appended after the worker's evidence with a blank line between them.
`<host>` is the machine's name, or "the default host".

| Case | Line |
| --- | --- |
| One agent, ready | `Validator agent: claude (bb provider claude-code) is ready on <host>.` |
| One agent, not ready | `Validator agent: codex (bb provider codex) is not ready on <host>: <problem>` |
| List | `Validator agents, in order: codex (bb provider codex) is ready on <host>; grok (bb provider acp-grok) is not ready on <host>: <problem>` |
| `auto`, some ready | `Validator agent: auto. no-mistakes picks the first runnable agent when the run starts. bb reports ready on <host>: claude-code, codex.` |
| `auto`, none ready | `Validator agent: auto. no-mistakes picks the first runnable agent when the run starts. bb reports no ready provider that no-mistakes can use on <host>.` |
| Default (no file) | The `auto` line with `(the host has no no-mistakes configuration file, so the default applies)` after the word `auto`, so that the line still starts with `Validator agent:`. |
| Unmapped agent | `Validator agent: <name> has no known bb provider, so its readiness was not checked.` |
| Unobserved | `Validator agent: could not be observed on <host> (<reason>), so its readiness is not known.` |

No line says "ready" for an `unchecked` or `unobserved` result.

## Preflight

`bb factoryman preflight <machine> --project <id>` for a remote machine and a `no-mistakes` project runs the observation after the checks that no-mistakes is installed and initialized.

- Ready: the report gets the evidence line as a note after the headline.
- Not ready or unobserved: the report lists the problem `validator_agent: <the line without its "Validator agent:" prefix>`, and the command exits 1.
- Other modes: no observation runs.

A dispatch to a remote machine runs the same preflight, so a `validator_agent` problem refuses the dispatch with `preflight_failed`, and no task is created.

## Hand-off evidence

When a worker reports `done` for a `no-mistakes` ship task, the plugin appends the evidence line to the event that moves the task into `validating`.
The hand-off is never refused because of the observation, and a failure inside it becomes the `unobserved` line.

## Read-only guarantee

The only command the observation runs is the `sh -c` read above.
Tests record every `exec` call during an observation and assert that the commands are this one.
