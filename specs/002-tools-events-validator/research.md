# Research: Tools and approval, event wiring, and the validator

Every open question from the technical context is settled here.
The bb and no-mistakes facts come from `spike/RESULTS.md`, recorded against bb 0.48.1, SDK 0.6.104, and no-mistakes v1.84.0.

## R1. One port to bb

**Decision**: Every bb call goes through `BbPort`, and `src/bb/adapter.ts` is the only file that calls `bb.sdk` or `bb.ui`.

**Rationale**: The design lists SDK churn as a risk, and several SDK areas carry an `experimental_` prefix.
One adapter keeps a rename to one file.
Tool, wake, and driver logic then test against a hand-written fake with no SDK stubbing.
The fake host still tests the adapter and the wiring.

**Alternatives considered**: Call `bb.sdk` from each tool.
That spreads SDK knowledge over many files and makes every unit test stub SDK paths by string.

## R2. Authority comes from the store

**Decision**: A caller is a worker only when the store records its thread ID as a task's `workerThreadId`.
Supervisor tools run for any other thread, and only in that thread's own project.
Plugin metadata chooses which tools bb offers, and nothing else.

**Rationale**: Spike item 2 shows that `pluginMetadata` is writable by the thread's own agent, and the SDK calls it untrusted.
A worker that rewrites its metadata could otherwise reach the supervisor tools.
The store is written only by this plugin.

**Alternatives considered**: Read the metadata at call time.
That makes the agent the authority over its own role, which is the failure the design warns about.
Keep a separate supervisor table.
That adds a table the design does not list, and it still needs a writer.

## R3. Approval form payload and answer

**Decision**: The form uses renderer ID `factoryman-merge-approval` and a payload of `{ taskId, branch, prUrl, evidence }`.
The accepted answers are `{ decision: "approved", comment? }` and `{ decision: "denied", comment? }`, checked with a strict `zod` schema.
The default timeout is 10 minutes (the bb default) and can be set in a plugin setting.

**Rationale**: Spike item 20 shows that a submitted value is arbitrary JSON from anyone who can reach the form.
A strict schema keeps a typo, an extra field, or a hostile value from counting as approval.
A denial is recorded because the owner said it, and everything else records nothing.

**Alternatives considered**: Treat any truthy value as approval.
That fails open.
Record cancelled forms as denials.
A timeout is not a decision, and the machine keeps the last real decision.

## R4. Always ask the owner

**Decision**: Every `factoryman_merge` call on a project without `yolo` opens a new form, even if the task already holds an approval.

**Rationale**: The worker keeps running during `awaiting_approval`, so the pull request can change after an approval.
A retry after a failed merge is rare, and a second question costs the owner a click.
The machine's context still stores the latest decision.

**Alternatives considered**: Reuse the stored approval for a retry.
That risks merging commits the owner never saw.

## R5. Merge executors

**Decision**: `MergeExecutor` has two real implementations behind one interface.
The pull request modes run `gh pr merge <url> --squash` (or `--merge` or `--rebase`, from a `mergeMethod` setting that defaults to `squash`).
The `local-only` mode runs `git merge --no-ff --no-edit <branch>` in the project checkout, after it checks that the checkout is clean and on the configured base branch, and runs `git merge --abort` after a failed merge.

**Rationale**: The design names a pull request merge and a local merge.
`gh pr merge` needs a strategy flag when it runs without a terminal.
Strings are a type that plugin settings allow.
The local merge touches the owner's checkout, so it checks first and refuses on any doubt.

**Alternatives considered**: Merge through a bb plugin such as `github-pr-status`.
The plugin calls no other plugin.
Leave `local-only` unbuilt.
That would make one delivery mode unusable.

## R6. Worktree report from git

**Decision**: `worktreeReport` runs `git status --porcelain` and counts a change when the output is not empty.
For the pull request modes it counts unpushed commits with `git rev-list --count HEAD --not --remotes`.
For `local-only` it counts `git rev-list --count <base>..HEAD`.
Any failed command makes the report an error, and teardown refuses.

**Rationale**: Hard rule 2 depends on these facts.
A branch that was never pushed has commits on no remote ref, which the first count catches.
A squash-merged branch keeps its commits on the remote branch, so the remote-ref rule passes it, and a base-branch rule would not.
A `local-only` branch has no remote, so only the base branch can say that its work landed.

**Alternatives considered**: Ask the worker to report the facts.
That lets the agent vouch for itself.
Use `git cherry`.
It needs an upstream and fails on branches without one.

## R7. Branch name and prefix

**Decision**: The planned branch is `<branchPrefix ?? "fm/"><taskId>`.
The dispatch prompt tells the worker to create that branch first.

**Rationale**: Spike item 14 shows that bb names its worktree branches itself and a plugin cannot choose the name.
`start` needs a branch.
D-026 left the prefix null with no default, so the tool layer supplies the firstmate convention `fm/`.

**Alternatives considered**: Read bb's branch name after the environment is ready.
The environment is provisioned after the spawn returns, so `start` would wait on a second event.

## R8. Dispatch description as `start` evidence

**Decision**: The description is stored as the `evidence` of the `start` event.
The driver reads it back for the no-mistakes intent, and `factoryman_status` shows its first line.

**Rationale**: The machine's `create` and `start` events are strict and carry no description.
Changing them is a design change in milestone 2.
`evidence` is optional on every event and the row stores it.

**Alternatives considered**: Add a field to the `create` event, which edits the merged machine.
Add a table, which the design does not list.

## R9. Wake messages

**Decision**: The notifier sends one plain-text message with `threads.send({ mode: "auto" })` to the worker thread's `parentThreadId`.
Workers spawn with `parentNotifications: "off"`.
The wake states are `needs_decision`, `review_ready`, `report_ready`, `blocked`, and `failed`.
Two extra wakes are not transitions: an idle worker that has not reported, and a worker interaction raised by another source.

**Rationale**: Spike item 22 shows that `auto` starts a turn on an idle thread and that bb wakes a parent on every child outcome unless notifications are off.
The design promises that the supervisor uses no tokens while workers run normally.
The parent link comes from bb, so no new column is needed.

**Alternatives considered**: Leave bb's notifications on.
That wakes the supervisor on every worker turn.
Store the supervisor thread in the task row, which changes the merged schema.

## R10. Event handlers

**Decision**: The plugin handles five thread events and ignores the rest.
A handler loads the recorded worker for the event's thread and exits quietly when there is none.
The table is in [contracts/events.md](contracts/events.md).

**Rationale**: bb delivers every thread's events to every plugin.
Handlers must be cheap and silent for threads that are not workers.
The wake rule follows states, so duplicate events produce no duplicate messages: the second event meets an illegal transition and the machine refuses it.

**Alternatives considered**: Subscribe to `message.*` and `turn.failed` for richer state.
`turn.failed` is only needed for evidence text, and the plugin remembers the last category per thread in memory.
Because the real server sends `turn.failed` after `thread.failed`, a `thread.failed` with an empty error waits 500 ms before it reads that memory (D-047).

## R11. Decoding no-mistakes output

**Decision**: Use `@toon-format/toon` 4.4.0, pinned exactly, to decode stdout.

**Rationale**: Spike item 15 shows that every recorded file decodes.
TOON has quoting and escaping rules that a hand parser gets wrong for finding descriptions with commas and quotes.
The library is small, MIT-licensed, and has no dependencies.

**Alternatives considered**: A hand-written parser for the subset.
It costs less to install and more to trust.

## R12. Validator driver

**Decision**: One loop per live task.
`validating` calls `start` (which reattaches), and `needs_decision` calls `status` every poll interval.
A gate becomes `finding`, a gone gate becomes `resolve`, and a finished run becomes `validated`, `finding`, or `fail`.
After a fixed number of unreadable results the loop records `finding` with the error, so a human looks.
The loop stops when the task leaves its two states or when the plugin is disposed, and it never cancels a run.

**Rationale**: `axi run` blocks until a gate or an outcome and reattaches when called again, so a loop of reattaches follows a run without storing a run ID.
The run belongs to the pipeline, which survives a plugin restart.

**Alternatives considered**: Store the run ID.
That needs a new table or event field.
Poll `axi status` only.
It cannot start a run.

## R13. Findings answer path

**Decision**: The driver exposes `answer(taskId, response)`, and no tool calls it.
D-031 records the gap.

**Rationale**: The design lists five tools and none answers a finding.
The driver still observes an answer made in no-mistakes directly and records `resolve`.
Adding a sixth tool is a design change for the owner.

**Alternatives considered**: Add `factoryman_decide`.
It is small, but it changes a design table and the constitution's closed list.

## R14. Supervisor designation

**Decision**: One command, `bb factoryman supervisor <thread-id>`, stamps `{ role: "supervisor" }` on a thread that is not a recorded worker.

**Rationale**: Without it nothing offers the four supervisor tools to any thread, and the plugin cannot run.
The command grants only tool visibility, because authority comes from the store (R2).

**Alternatives considered**: Offer the supervisor tools to every thread without a worker record.
That adds four tool descriptions to every thread in every project.

## R15. Bundling

**Decision**: Import `better-sqlite3` as the existing store does and let `bb plugin build` leave it external.

**Rationale**: Spike item 24 built and loaded a plugin that imports `better-sqlite3`, `xstate`, and `zod` in bb 0.48.1.
The build bundles `xstate` and `zod`, and the server resolves `better-sqlite3`.

**Alternatives considered**: None needed.
