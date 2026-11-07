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
