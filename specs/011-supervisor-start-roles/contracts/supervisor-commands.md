# Contract: the supervisor commands

Both commands are subcommands of `bb factoryman supervisor`.
The dispatcher routes on the first argument: the word `start` selects the new command, and anything else is a thread ID, as today.

## `bb factoryman supervisor start`

```text
bb factoryman supervisor start [--project <id>] [--profile <name>] [--prompt <text>]
```

| Flag | Required | Meaning |
| --- | --- | --- |
| `--project` | Yes, unless bb names the project in the command context | The bb project ID. |
| `--profile` | No | A key of `profiles` in the project's `dispatch.json`. It wins over `roles.supervisor.profile`. |
| `--prompt` | No | The thread's first prompt. The default is "You are the factoryman supervisor. Wait for instructions." |

Each flag takes one value.
A repeated flag, a flag without a value, a value that is blank, or an unknown flag is a usage error.
A thread ID cannot be the word `start`.

### Steps, in order

1. Parse the arguments. A usage error exits 2 and prints the usage text.
2. Read the project's checkout, then `dispatch.json` through the existing loader. A missing checkout reads as an empty config.
3. Choose the profile name: `--profile`, else `roles.supervisor.profile`, else refuse.
4. Look the name up in `profiles`. An undefined name refuses.
5. Run the readiness gate (`gateReadiness`) for the profile on the project's default host. A refusal prints the gate's message.
6. Call `spawnSupervisor` once, with the profile and the metadata `{ role: "supervisor" }`.
7. Print the result.

The command never calls `spawnSupervisor` after a refusal.
It writes no store row, no event, and no file.

### Output

Success, exit 0, standard output:

```text
Started factoryman supervisor thread <thread-id> with the profile <name> (<provider>, <model>).
The role is set at spawn, so the thread has the four supervisor tools and the factoryman-supervisor skill from its first turn.
```

The thread ID is the first token after `thread` on the first line.
The conformance lab reads it from there.

Refusals and failures, exit 1, standard error, always ending with the line `Nothing was spawned.` when the command refused before the spawn:

| Case | First line |
| --- | --- |
| No profile | `No supervisor profile is set for project <id>. Pass --profile <name> or set roles.supervisor.profile in .bb/factoryman/dispatch.json. The profile "default" is the worker's and is not used. Defined profiles: <names or none>.` |
| Undefined profile | `The supervisor profile "<name>" is not defined in dispatch.json. Defined profiles: <names or none>.` |
| File problem | `Cannot start a supervisor: <loader message>.` |
| Gate refusal | `Cannot start a supervisor: <gate message>` |
| Spawn failure | `Could not start the supervisor: <bb message>.` (no `Nothing was spawned.` line, because the spawn call was made) |
| Checkout read failure | `Cannot start a supervisor: could not read the project (<message>).` |

## `bb factoryman supervisor <thread-id>`

Unchanged: it stamps `{ role: "supervisor" }` on an existing thread and refuses a recorded worker thread.
New: after a successful stamp it reads the thread's provider and prints the advice.

### Output after a successful stamp

Standard output, exit 0.
The first line is always `Thread <thread-id> is now a factoryman supervisor.`

| Provider's `roleChange` | Lines after the first |
| --- | --- |
| `next-turn` | `It gets the four supervisor tools and the factoryman-supervisor skill on its next turn.` |
| `clear` | `This harness (<provider>) applies a new role only when its session is rebuilt.` and `Run \`bb thread clear <thread-id>\` so the thread gets the four supervisor tools and the factoryman-supervisor skill.` |
| Provider unknown (no row) | `The harness <provider> has no recorded role-change behavior.` and the `Run \`bb thread clear ...\`` line. |
| Provider not read | `bb did not say which harness the thread uses (<reason>).` and the `Run \`bb thread clear ...\`` line. |

No output contains the words "from its next session".
A stamp that bb rejects prints no advice and exits 1 with `Could not stamp thread <id>: <message>`, as today.

## Usage text

The usage text lists, in this order:

```text
Usage: bb factoryman supervisor <thread-id>
Usage: bb factoryman supervisor start [--project <id>] [--profile <name>] [--prompt <text>]
Usage: bb factoryman preflight <machine> --project <project-id> [--provider <provider-id>]
...
```

`src/server.ts` registers the same two supervisor lines in the CLI summary.
