# Milestone 0: spike results for milestones 4 to 6

This file records the bb and no-mistakes facts that milestones 4 to 6 depend on.
It follows the format in `spike/SPIKE.md`.
It covers only the assumptions that those three milestones need.
Items that belong to later milestones are listed at the end as not checked.

## Environment

| Part | Version |
| --- | --- |
| bb CLI and server | 0.48.1 |
| `@get-bb/plugin-sdk` | 0.6.104 |
| no-mistakes | v1.84.0 |
| Provider used for live threads | `claude-code`, model `claude-haiku-5-5` |
| Date | 2026-11-06 |

## Method

The checks ran against a real bb server on a throwaway data directory.
The server started with `bb-app --data-dir <dir> --server-port 39871 --host-daemon-port 39872`, so it never touched the owner's `~/.bb`.
The `bb` CLI reached it through `BB_SERVER_URL=http://127.0.0.1:39871` and `BB_HOST_DAEMON_PORT=39872`.
The project was a throwaway git repository with a local bare repository as `origin`.
A probe plugin recorded what bb did.
Its source is `spike/probe/server.ts`.
To repeat the checks, build the probe with `bb plugin build`, install it from its path, and set `PROBE_LOG` to a writable file.

Recorded real payloads live in `test/fixtures/recorded/`.
Each contract test pins one of these facts to the versions in the Environment table:

- `test/acceptance/contract-versions.test.ts` fails when the pinned SDK version differs from this table, so an upgrade forces a new spike.
- `test/acceptance/wiring-recorded.test.ts` replays the recorded bb event payloads in `bb-0.48.1/thread-events.json` through the plugin factory, and `test/acceptance/validator-recorded.test.ts` and `src/validator/toon.test.ts` replay the recorded no-mistakes files in `no-mistakes-1.84.0/`.
  A shape change in either tool then fails a named test.

## 1. Out-of-tree install

Result: confirmed

Evidence: `bb plugin new probe` scaffolded a package outside any bb checkout.
`bb plugin build .` wrote `dist/server.js`.
`bb plugin install . --yes` printed `probe@0.1.0 running` with `source: path:<directory>`.
`bb plugin reload probe` picked up a rebuilt bundle.
A path source stays on disk, so the owner can install `bb-factoryman` the same way in milestone 11.

Fallback: none needed.
The live install into the owner's bb remains the owner's step.

## 2. Per-thread tool visibility

Result: confirmed

Evidence: the probe registered `probe_merge` and `probe_report`, and `bb.agents.configure` chose the tools from the thread's plugin metadata.
`bb.sdk.threads.spawn({ pluginMetadata: { role } })` seeded the metadata.
A thread with `role: supervisor` listed both tools.
A thread with `role: worker` listed only `probe_report`.
The agent sees each tool as `mcp__bb-bridge__<name>`.
`configure` is synchronous and runs at thread start and at turn submit.

Fallback: the plugin metadata is writable by any API client and by the thread's own agent, so the SDK documents it as untrusted.
Tool visibility is therefore a hint and not a gate.
Each tool re-checks the caller at call time against the plugin's own store, where `task.worker_thread_id` names the worker threads.

## 14. Worktree fit for no-mistakes

Result: confirmed

Evidence: `no-mistakes init` ran inside a bb-managed worktree.
It found the main repository, created the `no-mistakes` remote, and exited 0.
It printed that `git config --worktree` is unavailable with several worktrees, and it continued.
`no-mistakes axi run` then ran on the worktree's branch.
bb names its worktree branches `bb/<slug>-<thread-id>`, and a plugin cannot choose the name.

Fallback: the worker creates the task's branch itself.
The dispatch prompt gives the branch name, and the task records that planned name.

## 15. no-mistakes headless status and findings

Result: confirmed

Evidence: `no-mistakes axi` prints TOON on stdout and progress on stderr.
The recorded stdout is in `test/fixtures/recorded/no-mistakes-1.84.0/`.
`@toon-format/toon` 4.4.0 decodes every recorded file.

- `axi run --intent <text> [--skip <steps>] [--wait <duration>]` starts a run and blocks until a gate, a decision point, an outcome, or the wait elapses.
  A second call reattaches to the run for the current HEAD.
- `axi status [--run <id>]` prints `run:` (or `other_branch_run:` for a run named with `--run` on another branch), `gate:` when a gate waits, and `outcome:` plus `error:` for a final state.
- A gate has `step`, `status`, `risk`, `note`, and `findings[N]{id,severity,file,action,description}`.
  The columns vary (the documented example adds `line`), so the parser reads the header.
  `action` is `auto-fix`, `ask-user`, or `no-op`.
- The outcome is one of `checks-passed`, `passed`, `passed-with-override`, `passed-with-skips`, `failed`, or `cancelled`.
  I recorded `cancelled`.
  The other outcomes come from the CLI's own documentation and could not be recorded without a forge.
- Exit codes, from the CLI's documentation: 0 for success and normal gates, 1 for a failed or cancelled final outcome, 2 for bad usage.
  I observed 0 at a gate, 0 for `abort`, and 1 with `error: "run \"bogus\" not found"` for an unknown run.
- Errors print as `error: ...` on stdout.

Fallback: the parser treats an unknown outcome as a refusal to advance, so nothing fails open.

## 16. Answer a finding

Result: confirmed

Evidence: `axi respond --action fix --findings review-1 --instructions <text>` ran a fix round.
The run then parked at a new gate with `status: fix_review` and the one remaining finding.
`--action approve` and `--action skip` are documented in the same command.
`axi answer --question question-<id> --answer <text>` answers a reviewer question, and I read its help but did not run it.
`axi abort [--run <id>]` cancelled the run and left it with `outcome: cancelled`.

Fallback: none needed.

## 17. Who starts the run

Result: confirmed, with a decision

Evidence: every `axi` command resolves its branch from the current directory, so the caller must run it in the worker's worktree.
`axi run` reattaches when a run already exists for the current HEAD, so a plugin that starts the run and a worker that started it are interchangeable for observation.

Decision: the plugin starts the run, in the worker's worktree, when the task reaches `validating`.
The worker only commits and hands off, which matches the design's rule that workers never push.
Trade-off: the plugin process needs a shell on the host that holds the worktree.
That holds for local workers.
Milestone 8 must decide how a remote machine runs the command.
If a worker already started the run, the plugin's `axi run` reattaches to it.

## 20. `bb.ui.requestInput` outcomes

Result: partial

Evidence: the form opened a pending plugin interaction on the named thread and the timeline.
`bb thread interactions respond <id> --value <json>` submitted it.
The three outcomes below were all observed.
They are recorded in `test/fixtures/recorded/bb-0.48.1/request-input-outcomes.json`.

| Trigger | Result |
| --- | --- |
| `respond` with a JSON value | `{ outcome: "submitted", value: <the JSON> }` |
| `timeoutMs` elapsed | `{ outcome: "cancelled", reason: "timeout" }` after the full wait |
| `bb thread stop` | `{ outcome: "cancelled", reason: "thread-stopped" }` |

Inside a tool call, `requestInput` answers the tool at once with a waiting notice.
The real result arrives later as a system message, and the thread becomes active again.
The thread went idle while the form was still open.

The gap: the interaction row records `resolution: { kind: "plugin_submitted" }` and no submitter.
Anything that can call the bb HTTP API or CLI, including an agent with a shell, can submit the form.
bb does not prove that a person answered.

Fallback: validate the submitted value strictly with a schema, and treat anything that is not an exact approval as no approval.
Record the `user` actor only for a validated submission.
State the remaining gap plainly: the design already lists "a worker with shell access" as a known gap on the merge gate, and branch protection plus scoped tokens are the backstop.
This is not a change to the architecture, but the owner should know that the form is not proof of a human.

## 21. Thread event shapes

Result: confirmed

Evidence: recorded in `test/fixtures/recorded/bb-0.48.1/thread-events.json`.

- `thread.idle` carries `thread` and `lastAssistantText`.
- `thread.failed` carries `thread` (with `status: "error"`) and `error`, and `error` was `null` for a provider 404.
  The cause arrives in the separate `turn.failed` event as `errorInfo: { category, providerCode, httpStatusCode }`.
- `interaction.pending` carries `thread` and `interaction`.
  The interaction has `origin: { kind: "plugin", pluginId, rendererId }` for a plugin form.
- Every `thread` is the full thread DTO, including `parentThreadId` and `status`.

Fallback: build the failure evidence from `error` when present and from the last `turn.failed` category otherwise.
Never rely on `error` being set.

## 22. Supervisor wake messages

Result: confirmed

Evidence: `bb.sdk.threads.send({ threadId, mode: "auto", input: [{ type: "text", text, mentions: [] }] })` returned `{ ok: true, delivery: "sent" }` for an idle thread.
The thread became active, ran one turn on the message, and went idle.
The message shows as a user message.

bb also wakes a parent on its own.
A child spawned with `parentNotifications: "auto"` woke its parent about two seconds after the child went idle.
A child spawned with `parentNotifications: "off"` woke nobody.

Fallback: the plugin spawns workers with `parentNotifications: "off"` and a `parentThreadId`.
The plugin then sends the only wake messages, which keeps the design's promise that the supervisor uses no tokens while workers run normally.
The wake target is the worker thread's `parentThreadId`.

## 23. Per-plugin database

Result: confirmed

Evidence: `bb.storage.database()` returned a `better-sqlite3` handle on `<data-dir>/plugins/<id>/data.db`.
SQLite was 3.53.4, `journal_mode` was `wal`, `busy_timeout` was 5000, and `foreign_keys` was on.
Writes and reads worked in a plugin CLI call.
This settles D-027: the plugin passes `bb.storage.database()` to `openSqliteStore`.

Fallback: none needed.

## 24. Bundling

Result: confirmed

Evidence: a probe plugin that imports `better-sqlite3`, `xstate`, and `zod` built with `bb plugin build` and loaded in bb 0.48.1.
The build bundled `xstate` and `zod` into `dist/server.js` and left `better-sqlite3` as an external import that the server resolved.
The plugin ran `new Database(":memory:")`, an `xstate` machine, a `zod` parse, and `bb.storage.database()` in one load.

Fallback: none needed.

## 25. Removing a worker's environment

Result: confirmed

Evidence: `bb.sdk.environments.delete({ environmentId })` on an environment with a live thread failed with `HTTP 409: Environment still has live threads`.
After `bb.sdk.threads.archive({ threadId })`, the same call returned `{ ok: true }`, and bb removed the worktree directory and its `git worktree` entry within a few seconds.
The branch `bb/<slug>-<thread-id>` stayed in the repository.

Fallback: teardown archives the worker thread and then deletes the environment.
If the environment still has another live thread, the removal fails after the `teardown` event is recorded, and the tool result says so.
The landed-work check has already passed by then, so nothing is lost.

## 26. Spawning a worker in a managed worktree

Result: partial

Evidence: the live smoke test of the built plugin on the throwaway bb 0.48.1 server called `bb.sdk.threads.spawn` with `environment: { type: "host", workspace: { type: "managed-worktree", ... } }`.
bb answered `HTTP 400: hostId is required unless workspace.type is personal`.
The fake plugin host accepted the same call, so only the real server showed the difference.

Fallback: the adapter reads the project's default source and sends its `hostId`.
It refuses to spawn when bb reports no host.

## 27. Live smoke of the built plugin

Result: confirmed (after the fix in item 26)

Evidence: `pnpm run build` produced `dist/server.js`, and `bb plugin install <worktree> --yes` loaded it into the throwaway bb 0.48.1 server (`bb-factoryman running`, service `factoryman-startup running`, command `bb factoryman`).
`bb factoryman supervisor <thread>` stamped a haiku thread, and the thread then saw the four supervisor tools.

- Scout task: the supervisor called `factoryman_dispatch`. bb created a worker in a managed worktree on the project's host with the planned branch `fm/<task-id>`.
  The worker called `factoryman_report`, the task became `report_ready`, and the plugin woke the supervisor with a `[factoryman] Task ... is now report_ready` message.
- Ship task through the real pipeline: the worker committed on its branch and reported `done`.
  The plugin recorded `handoff`, started `no-mistakes axi run` in the worker's worktree, and received a real review gate with two `ask-user` findings.
  The task became `needs_decision`, and the supervisor received both findings verbatim in a wake message.
  It then asked its owner to decide, which is the intended flow.
- I then disabled the plugin so that the driver would not start a second run, and aborted the run with `no-mistakes axi abort`.
- The plugin's SQLite store ran on `bb.storage.database()` with the schema from milestone 3 (`user_version` 1).

Not exercised live: the merge form, because the pull request modes need a forge; teardown; and a real `checks-passed` outcome.
Those paths are covered by the fake host and the recorded output (D-049).

Fallback: none needed.

## 28. Live validation of the review fixes

Result: partial

Evidence: a second throwaway bb 0.48.1 server ran the plugin built from commit bb5dae3, with haiku supervisor and worker threads and a recording stand-in for the `gh` command on its PATH.
Project A used the reserved remote `git@git.invalid:acme/widgets.git`, so nothing could reach a forge.
Project B used a throwaway repo with a local bare origin.

- Concurrent merge calls for one task: confirmed for the guard, inconclusive for the exact race window.
  With `yolo` off, two supervisors called `factoryman_merge` at once. One approval form opened. The other call was refused with "A merge approval for task t-3b76e1f5 is already waiting for the owner." The log has one `request_approval` row and no `merge` row.
  With `yolo` on, the stub recorded exactly one `gh pr merge https://git.invalid/acme/widgets/pull/8 --squash`. The other call was refused. The log has one `merge` row.
  The race window is a few milliseconds wide between the check and the claim. Two model-driven threads cannot land in it on demand. The unit tests written first for review-1 cover it.
- Pull request URL outside the project's repository: confirmed live with `yolo` off.
  The reported URL was `https://github.com/other-owner/other-repo/pull/9`. The tool refused with "is not a pull request in this project's repository (git.invalid/acme/widgets)".
  No form opened, the stub saw no `pr merge`, and the log has no `request_approval` row.
  The in-repo URL on the sibling task passed the same check.
  The `yolo` on refusal for an out-of-repo URL is covered by unit tests only, because the live `yolo` task used an in-repo URL.
- A merged task survives thread deletion: confirmed live.
  After the worker thread was archived and then deleted, the task stayed `merged`. The log gained no `fail` row (5 rows before and after). The supervisor received only the archive warning.
- Wiring: confirmed live.
  A worker with a model that does not exist produced `thread.failed` and then `turn.failed`. The task became `failed` with the evidence "worker thread failed: provider error (category bad-request, HTTP 404)", and the supervisor woke.
  An idle worker that had not reported woke the supervisor with "the worker finished a turn without reporting".
- Start-up reconcile: partial.
  With the plugin disabled, the worker thread of a working task was deleted, and the plugin was enabled again.
  It wrote one `reconcile` row ("The log says the task is working, but bb reports missing.") and changed no state.
  It sent no message, because bb answers HTTP 404 for a deleted thread, so the parent is unknown. The plugin logged "No parent thread ...".
  This is the limit that D-047 and FR-213 record. It was not changed.
- Validator: confirmed live on the fixed build.
  A ship task in `no-mistakes` mode ran the real `no-mistakes axi run` in the worker's worktree.
  The review gate had two `ask-user` findings, the task became `needs_decision`, and the supervisor received both findings verbatim.
  The throwaway run was then aborted.

Not driven live: the exact race window of the concurrent merge guard, the reconcile message for a deleted worker thread, and the `yolo` on refusal of an out-of-repo URL.
Also not driven live: `gh pr merge` against a real forge, a person answering the merge form, and a real `checks-passed` outcome.

Fallback: the unit and acceptance tests cover the paths that could not be driven live.
No production code was added to make them drivable.

## Milestone 7: dispatch resolver

The checks in this section ran on 2026-11-07 against a throwaway bb 0.48.1 server.
`bb-app` started it with `--data-dir <scratch>/bb-data --server-port 39971 --host-daemon-port 39972`, and `BB_SERVER_URL` pointed the `bb` CLI at it.
The owner's `~/.bb` and the shared bb stayed untouched.

## 29. Provider availability and catalog

Result: confirmed

Evidence: `bb provider list --json` on the throwaway server returned seven providers.
Each entry has an `available` boolean, `capabilities.permissionModes`, and an ordered `reasoningLevels` list of `{ id, label }`.
`bb.sdk.providers.list()` returns the same `ProviderInfo[]` (`ProvidersArea.list` in `@get-bb/plugin-sdk` 0.6.104).

- `pi` offers only the `full` permission mode, so a profile can name a mode that its provider rejects.
- Reasoning level IDs are provider-specific strings: `codex` lists `none` and `ultra`, and `claude-code` lists `ultracode`.
  No shared enum exists, so the resolver compares levels with a ladder from the dispatch config.
- `bb thread spawn --reasoning-level` accepts "low, medium, high, xhigh, max, or a provider-specific id".

Fallback: none needed.
A provider that the list omits, or that reports `available: false`, counts as unavailable, so the check fails closed.

## Milestone 8: machine placement

These checks ran on 2026-11-07 against the same throwaway bb 0.48.1 server as milestone 7.
It had one machine, the local host, and a throwaway project (a git repository with a local bare `origin`) whose only source sat on that host.
A second enrolled daemon would write enrollment credentials outside the throwaway data directory, so no check enrolled one.

## 6. Spawn on a machine

Result: confirmed

Evidence: `bb thread spawn --project <id> --machine <host-id> --new-environment worktree ...` created a thread on the local host (`status: starting`).
The SDK call is the one the adapter already makes: `environment: { type: "host", hostId, workspace }` (D-053).
Two refusals show the contract:

- An unknown machine: `Machine 'host_bogus' was not found. Available machines: ...`.
- A machine with no source of the project: `HTTP 409: No project source configured for this host`.

A project therefore needs a source on the chosen machine, and the plugin reads `bb.sdk.projects.get().sources` to check it before the spawn.

Fallback: none needed.

## 7. Disconnect detection

Result: partial

Evidence: a machine is a `Host`.
`bb.sdk.hosts.list()` and `.get()` return `status: "connected" | "disconnected"`, `lastSeenAt`, and `lifecycle.phase` (`creating`, `active`, `suspending`, `suspended`, `resuming`, `removing`, `destroyed`).
`bb machine create --provider manual --no-wait` made a host that was `disconnected` with `lastSeenAt: null`, in phase `creating` and then `removing`.
The plugin event list (`PluginThreadEventPayloads`) has no connect or disconnect event.
It has `experimental_host.deleted`, which fires once after a machine is removed.

Not driven: a real enrolled daemon that stops and comes back, because enrolling a second daemon would write outside the throwaway directory.

Fallback: poll `hosts.list()` on an interval, and treat `status !== "connected"` or `phase !== "active"` as offline.
Handle `experimental_host.deleted` at once.
A host that bb no longer lists counts as offline.

## 8. Remote prerequisites

Result: partial

Evidence: two mechanisms exist, both checked on the local host of the throwaway server.

- `bb.sdk.providers.list({ hostId })` (CLI: `bb provider list --machine <id>`) reports `available` for a provider on that machine.
- `bb.sdk.terminals.create({ scope: { kind: "host_path", hostId, cwd }, start: { mode: "argv", argv }, cols, rows })` runs one command on a host.
  `terminals.get` reports `status: "exited"` and `exitCode`, and `terminals.output` returns base64 chunks, `exitCode`, `truncated`, and `closeReason`.
  `bb terminal create --machine <id> --cwd <dir> --command "echo probe-ok; command -v no-mistakes; exit 3"` printed both lines and exited with code 3.
- A terminal is a PTY, so it merges standard error into standard output and ends lines with a carriage return.
  Wrapping the command in `sh` with `mktemp`, `base64`, and `tr -d '\n'` returned one line, `FMX1 <code> <stdout base64> <stderr base64>`, and a command that wrote to both streams and exited with 4 came back as `FMX1 4 b3V0LWxpbmUK ZXJyLWxpbmUK`.

So the plugin can check the agent CLI per machine, `no-mistakes` (installed, and a `no-mistakes` git remote in the source), and `gh auth status`, and it can run the validator and the landed-work check where the worktree lives.

Not driven: a real remote machine, so the sign-in state of an agent CLI and the scope of `gh` credentials were not read from one.

Fallback: a failed, timed-out, or truncated terminal command is a failed command, so every caller fails closed.

## Not checked

These items belong to milestones 7 to 11, or to the owner's live install, and the task brief excludes them.

| Item | Why it was skipped |
| --- | --- |
| 3. Read-only supervisor | Not needed for milestones 4 to 6. |
| 4. Worktree removal veto | Not needed for milestones 4 to 6. |
| 5. Dispatch hook ordering | Capacity is milestone 10. |
| 6 to 8. Machines | Machine placement is milestone 8. |
| 9 to 11. Extension surface | Milestone 9. |
| 12 to 13. Cost and notifications | Milestone 10. |
| 18. Branch protection | Needs a forge. It is the owner's setup step. |
| 19. firstmate registry | Cutover is milestone 10. |
