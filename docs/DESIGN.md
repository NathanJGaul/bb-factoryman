# bbFactoryMan: design for a bb plugin

Nov 5, 2026 · @Nathan Gaul

## Summary

bbFactoryMan is a bb plugin that keeps firstmate's delivery contract and replaces its plumbing. The plugin enforces ship and scout tasks, per-project delivery modes, and your approval gates in code. bb supplies the threads, worktrees, and session management.

**Decisions made**

- Enforcement is a server-side state machine, not agent instructions. The plugin refuses an illegal transition, such as merging without your approval.
- v1 carries over four things: ship and scout tasks with delivery modes, authority gates, a single-interface supervisor thread, and dispatch profiles.
- v1 leaves out domain leads (the secondmate equivalent, planned for v2), the public relay, away mode, and quota-based routing. v1 does include placing workers on enrolled bb machines. The plugin is standalone: it owns its backlog, worker spawning, and review checks, and it calls no other plugin. Other plugins and agent-written extensions can build on it through published extension points.
- no-mistakes stays the default validator, behind a validator interface so other checks can be added later.

**What this design does not settle**

- bb removes a managed worktree with `git worktree remove --force` after its last thread is deleted or archived. That conflicts with firstmate's rule never to tear down unlanded work. The risks section lists the options.
- bb threads belong to one bb project, but firstmate supervises all your projects from one place. The design assumes one supervisor thread per bb project until you decide otherwise.

## Goals and non-goals

**Goals**

- Keep the delivery contract: every task has a type, a delivery mode, and an autonomy level before a worker starts.
- Make each authority gate a code path that fails closed, not a sentence in a prompt.
- Give you one thread to talk to. Workers report through it.
- Survive restarts by rebuilding task state from an append-only event log.
- Stay small. Reuse bb's built-in plugins before writing new code.

**Non-goals for v1**

- Replacing bb's thread, worktree, or provider handling.
- Domain leads (planned for v2), the public relay, and away mode.
- Quota-aware model selection across accounts.
- Running firstmate's bash scripts or its herdr backend under bb.

## Port mapping

Most of firstmate's machinery has a bb equivalent. The plugin owns only the rows marked Core.

| firstmate concept | bb equivalent | Plugin responsibility |
| --- | --- | --- |
| Session backend (tmux, herdr) | bb threads; the host daemon runs provider processes | None |
| Crewmate worktree (treehouse) | Managed worktree from the built-in worktree plugin, with `.worktreeinclude` and `.bb-env-setup.sh` | Request a worktree at spawn and record the branch |
| `fm-spawn.sh` | `bb.sdk.threads.spawn` and `bb thread spawn` | Validate the task contract, then spawn |
| Steering inbox (`fm-send`) | Steer messages on a thread | None in v1 |
| Bash watcher and Stop hook | Thread events: `thread.idle`, `thread.failed`, `interaction.pending` | Subscribe, advance the state machine, wake the supervisor |
| Backlog | Built-in `tasks` plugin (tasks, presets, delegate) | Own small table in the plugin database, with no dependency on the tasks plugin |
| Ship and scout tasks, delivery modes, `yolo` | None | Core |
| Hard rules and gates | None | Core |
| Dispatch profiles | `tasks` presets (provider, model, reasoning level, permission mode) | Core: rule-based resolver on top of presets |
| Restart is a non-event | bb resumes threads; plugins get a per-plugin database | Core: event log and reconcile on start |
| First mate `AGENTS.md` | Plugin skills and thread instructions | A short supervisor skill and a short worker skill |
| Relay, away mode | None | Out of scope for v1 |
| Secondmate (remote home over SSH) | bb machines and host daemons | Core: placement in v1, domain leads in v2 |

## Working alongside other bb plugins

The plugin is standalone. It owns its backlog, its worker spawning, and its review checks, and it calls no other plugin. You can still run other bb plugins beside it.

**Works alongside it with no integration**

- `agent-lanes` and `agent-traces` read thread state from bb, so they should show the supervisor and its workers as long as the plugin spawns real child threads. That is unverified.
- `inline-vis` renders HTML or Markdown that an agent writes in a reply. The supervisor skill can use it for fleet reports and falls back to plain Markdown when the plugin is absent.
- `concurrency-limit` holds new turns when a host is full, so it applies to our workers without any code from us. How it orders itself against our own message hook is unverified.

**Overlap to know about**

| Plugin | Overlap with bbFactoryMan | What we do |
| --- | --- | --- |
| `tasks` | Backlog, comments that steer a worker, presets, delegate | Keep our own small table. Copy the preset shape, not the plugin. |
| `workflows` | Durable fan-out to many agent threads | Out of scope for v1. Revisit for audit-style scouts. |
| `github-pr-status` | Pull request checks and a merge command | Read pull request state with the `gh` CLI. Its merge command and button stay outside our gate. |

Staying standalone costs code: a backlog table, spawn logic, and pull request checks that other plugins already provide. It buys one contract you can test and audit end to end, with no reliance on another plugin's internals. The marketplace pages for `tasks`, `workflows`, `agent-traces`, and `agent-lanes` don't document an integration API for other plugins.

## Extension points

The dependency runs one way. Other plugins can build on bbFactoryMan, and bbFactoryMan depends on none of them. Gates are code and stay fixed. Almost everything else is data or a file that you or a bb agent can change.

| Extension point | What you can change or build | Rule |
| --- | --- | --- |
| Workflow config | Task kinds, delivery modes, dispatch rules, and per-project overrides, in files under `.bb/factoryman/` | Config can add checks. It can't remove a gate. |
| Custom checks | A delivery mode lists commands that must pass before a task reaches review ready | Checks only tighten. |
| Thread metadata | The plugin stamps each worker thread with its task ID, kind, and state, so other plugins can group or label threads by task | Others read it. They don't write it. |
| Read RPC | A versioned contract with `listTasks`, `getTask`, and `listEvents(since)`, for boards, metrics, or mirrors | Reads only. No transitions. |
| Skills | The supervisor and worker skills are plain files you can edit or override per project | Gate behavior lives in code, not in skills. |
| Agent-written plugins | A bb agent can write a sibling plugin with the built-in `bb-plugin-authoring` skill, for example a board panel or a one-way mirror to `tasks` | Sibling plugins use the read RPC. |

The rule behind every row is that extensions can tighten the workflow and never loosen it. A sibling plugin can show a task or add a check. It can't approve a merge or tear down a worktree, because those transitions run only through the plugin's own tools.

**Bridges, outside the core.** An integration is a small separate extension that you add or remove. Examples: a `tasks` mirror that updates cards one way, a pull request check backed by `github-pr-status`, an `agent-traces` export attached as evidence, an `inline-vis` fleet board. v1 ships none of them.

Three things here are unverified: whether a plugin can read another plugin's thread metadata, whether another plugin's `callRpc` to ours needs the method marked discoverable, and whether bb lets a project override a plugin skill.

## Architecture

&#91;embedded content: architecture · plugin between supervisor and bb threads\]

You talk to the supervisor, which calls the plugin's tools. The tools ask the state machine for permission, the state machine records every transition in the event log, and bb threads carry the work out. Thread events flow back up and drive the next transition.

Proposed repository layout:

```text
bb-factoryman/
  package.json    # bb manifest: server, skills
  src/server.ts   # plugin factory
  src/machine/    # xstate machines, no bb imports
  src/store/      # SQLite event log and task cache
  src/tools/      # factoryman_* tools and CLI
  src/dispatch/   # rules table and resolver
  skills/         # supervisor and worker skills
```

Keeping `src/machine/` free of bb imports lets you test every gate without a running bb.

## Task state machine

&#91;embedded content: task states · ship and scout lanes, gates marked\]

Ship and scout tasks share the first two states and the last one. Any state before `torn_down` can move to `failed`, and that transition requires evidence.

The delivery mode decides what review ready means:

| Mode | Review ready means | Merge path |
| --- | --- | --- |
| `no-mistakes` | The no-mistakes pipeline has finished review, tests, docs, lint, push, and CI, and the pull request is open | Your approval, then the pull request merges |
| `direct-PR` | A pull request is open | Your approval, then the pull request merges |
| `local-only` | The worker's branch holds the landed commits | Your approval, then a local merge |

A project's `yolo` flag skips the approval form for that project only. Every other gate stays in force. As in firstmate, an unregistered project resolves to `no-mistakes` with `yolo` off.

**Validation with no-mistakes.** For `no-mistakes` projects, the ship machine gains two states. `validating` runs from the worker's handoff until the pipeline has opened a pull request and CI is green. `needs_decision` holds when the pipeline stops on a finding that needs a human call. The pipeline, not the plugin, reviews, fixes, tests, documents, pushes, opens the pull request, and watches CI. The plugin observes the run and wakes the supervisor. Review ready requires a finished pipeline. The diagram above doesn't show these two states yet.

**Validator interface.** The plugin reaches validators through a small interface: start a run, read its status, read its findings, answer a finding, and cancel. `no-mistakes` is the first implementation. The interface lets extra checks, such as a multi-model audit or a CodeRabbit pass, run before the push as tighten-only checks: they can add a failing check but can't skip the pipeline. Whether the `no-mistakes` CLI supports each call headlessly is unconfirmed. Who starts the run is also open. firstmate has the worker push through the gate while the supervisor watches, and the plugin could start runs itself. Milestone 0 settles both.

**Answering a finding.** The validation driver watches a run and never answers a gate on its own. `factoryman_decide` is the one path that does. It reads the pipeline's live gate, checks the supervisor's key against it, shows the owner the findings and the exact answer in a form, reads the gate again after the owner approves, and only then sends `approve`, `skip`, or `fix` through the validator interface. A run that finished with an override, skipped steps, or no pull request has no gate, so the only decision is `rerun`, which starts a new run. Accepting such an outcome and moving the task to review ready needs a new state machine event and is not built (D-141).

**Direct pushes.** Workers on a `no-mistakes` project commit and hand off. They never push to `origin`. The plugin can't enforce that alone, so the backstop is branch protection that requires the `no-mistakes` check on the default branch.

## Authority gates

Every gate is a refusal in the state machine. A gate that depends on the agent obeying a prompt does not count.

| Gate | firstmate rule | Enforcement in the plugin | Known gap |
| --- | --- | --- | --- |
| Merge | Never merge without your explicit word, except under a project's `yolo` posture | `factoryman_merge` is the only merge path. It opens a `bb.ui.requestInput` approval form and merges only on a submitted approval. | A worker with shell access can run a merge command directly. Pair the gate with branch protection and scoped GitHub tokens. |
| Teardown | Never tear down unlanded work | The `torn_down` transition checks for uncommitted changes and unpushed commits and refuses if any exist. | bb's own worktree cleanup runs outside the plugin. See the risks section. |
| Project writes | The supervisor never edits a project | The supervisor thread gets a read-only skill and no write tools from this plugin. | Whether bb can strip write tools from one thread is unverified. |
| Worker silence | Workers never address you | Workers report through `factoryman_report`. The supervisor decides what reaches you. | A worker's own question form still appears on its child thread in the bb app. |
| Faithful reporting | Report outcomes with evidence | `done` and `failed` transitions require a non-empty evidence field. | The plugin checks that evidence exists, not that it is true. |
| Pipeline finding | An `ask-user` finding belongs to the owner | `factoryman_decide` opens a `bb.ui.requestInput` form that shows the findings and the exact answer, and sends the answer to the pipeline only after the owner approves. The tool never reads `yolo`, and the pipeline's own gates stay as they are. | A worker with shell access can answer the form through bb, as with the merge form (D-030). A denied form leaves no row in the event log (D-140). |
| Evidence is not authorization | A report never authorizes a change | Promoting a scout to a ship task requires a recorded approval event. | None known. |

## Supervisor thread

You talk to one thread per bb project: the supervisor. It dispatches workers, reads their reports, and escalates only the decisions that need you.

**What wakes the supervisor.** The plugin, not the agent, watches thread events. It messages the supervisor only when a task reaches a state that needs attention: a decision, a review-ready pull request, a failure, or a credential problem. While workers run normally, the supervisor uses no tokens.

**What the supervisor can do.** The plugin gives the supervisor five tools.
None of them edits project files.
A worker gets a sixth, `factoryman_report`.

| Tool | Purpose | Who sees it |
| --- | --- | --- |
| `factoryman_dispatch` | Create a ship or scout task, resolve its profile, and spawn the worker | Supervisor |
| `factoryman_status` | Read current task states from the state machine | Supervisor |
| `factoryman_merge` | Ask for your approval, then merge | Supervisor |
| `factoryman_teardown` | Remove a finished worker's environment after the landed-work check | Supervisor |
| `factoryman_decide` | Ask your approval for an answer to a pipeline finding, then send it to the pipeline | Supervisor |
| `factoryman_report` | Hand back an outcome with evidence | Workers |

**What reaches you.** Outcomes, consequences, and decisions. Retries and internal mechanics stay out of the chat. Failures never do.

Showing each thread only its own tools relies on bb's per-thread agent configuration hook. The risks section lists this as unverified.

## Dispatch profiles

A profile is a provider, model, reasoning level, and permission mode. bb's `tasks` presets already hold these four fields, so the plugin copies that shape without depending on that plugin.
The provider is any bb provider, and the plugin names no harness of its own.
Claude Code, Codex, Pi, and omp pass the conformance suite (`docs/HARNESS-SUPPORT.md`), and a provider with no row in the contract table below can still run when the checks pass.

Resolution follows firstmate's precedence:

1. An explicit override on the task.
2. The best-fitting rule in the project's dispatch config.
3. The configured default.
4. No profile: dispatch blocks with the code `no_default_profile`, and the message names `bb factoryman dispatch init --provider <id>`, which writes a starter `dispatch.json` (D-112).
   The plugin picks no harness for you.

A deterministic resolver handles any task that matches exactly one rule. When several rules fit, the resolver returns `ambiguous` and the supervisor chooses. Scripts own the mechanics, and the agent owns the judgment.

Two constraints carry over from firstmate:

- The resolver never lowers the reasoning level to save quota without your standing permission.
  Reasoning levels belong to a provider, so `reasoningLevels` in the config is one list or a record from provider ID to its own list (D-113).
- A missing profile or a provider that bb does not report `ready` is a blocker you see, not a silent fallback to another provider.

The resolver is an interface, and a rules table is the first implementation. A faster classifier, such as Jev, can replace it later without touching the state machine.

The dispatch config is a JSON file under the project's `.bb/` directory, validated with `zod`. Plugin settings hold only strings, numbers, and booleans, so they can't carry a rules list.

**Checks before a spawn.** One function applies every check, and dispatch and the queue start both call it, so no path to a spawn skips one.
A blocked dispatch creates no task.

1. Admission, from the contract table.
   The table lists the delivery modes in which a harness is refused.
   Pi offers only the permission mode `full`, so a Pi worker has no sandbox, and dispatch refuses Pi in `local-only` mode with `provider_not_admitted` (D-111).
   A scout task counts too.
2. Readiness, from `bb.sdk.system.providerStates` on the host that runs the worker (D-109).
   Only `ready` passes.
   `not_installed`, `unauthenticated`, `expired`, `unsupported_version`, an unknown status, a missing state, and a failed read all block.
   The message carries bb's login command or the installed and minimum versions.
   The `available` flag of `bb provider list` means only that the CLI is installed, so the plugin does not trust it.
3. Permission mode: the provider must offer the profile's mode.
4. Model and level: when bb lists the model and knows its levels, the model's list decides.
   Otherwise the provider-wide list decides.
   A model that bb does not list follows the contract row: Claude Code and Codex accept it, and the other rows refuse it (D-114).

**Harness contract table.** `src/harness/contracts.ts` holds pinned facts for each bb provider, with the CLI and bb versions they were tested with.
The facts are the permission modes bb offered, the sandbox, the refused delivery modes, whether unlisted models are accepted, how the model sees `factoryman_report`, when a stamped role reaches a live thread (the next turn, or after `bb thread clear`), and where bb records the cause of a failure (D-110).
The table is data with no imports.
A provider with no row gets a generic row that claims nothing, so the runtime checks decide alone.
Only the refused modes act as a gate.
The rest feed advice and tests.

**Failures.** When a worker thread fails, the evidence quotes the cause that the provider recorded, and adds a remedy line for a missing sign-in or model (D-115).

**Roles.** The dispatch config has an optional `roles` block (D-124, D-127):

```json
{
  "version": 1,
  "profiles": { "claude-code": { "provider": "claude-code", "model": "<model>", "reasoningLevel": "medium", "permissionMode": "auto" } },
  "default": "claude-code",
  "roles": { "supervisor": { "profile": "claude-code" }, "validator": { "agent": "observe" } },
  "rules": []
}
```

- `roles.supervisor.profile` names the profile that the supervisor starts with.
  It must name a defined profile, and it is never `default`, which is the worker's.
- `roles.validator.agent` accepts `observe` only.
  The plugin never writes no-mistakes configuration, and other values are refused with a reason.

A file without `roles` behaves as it did before.

**Supervisor start.** `bb factoryman supervisor start` spawns the supervisor thread with `role: supervisor` in the spawn call, so the thread has its five tools and its skill from the first session on all four harnesses (D-130).
It takes `--project`, `--profile`, and `--prompt`.
The profile is `--profile`, then `roles.supervisor.profile`.
With neither, the command refuses and spawns nothing (D-124).
The command applies the readiness, mode, model, and level checks and skips admission, because admission confines workers (D-125).
For a thread that a person already made, `bb factoryman supervisor <thread>` stamps the role and prints advice from the contract table: the role applies on the next turn, or run `bb thread clear` first.
A provider with no row gets the clear advice.

**Validator observation.** For a `no-mistakes` project, the plugin reads which agent no-mistakes will use from the `agent` key of no-mistakes' global `config.yaml` (D-126), maps it to a bb provider, and checks that bb reports it `ready`.
It never writes that file.
The hand-off adds one line to its evidence and never refuses on it (D-128).
The remote-machine preflight reports a `validator_agent` problem when the agent is not ready or cannot be observed.
No test has read a real no-mistakes install (D-134).

## Data model and restart behavior

The plugin keeps state in its per-plugin SQLite database. The event log is the source of truth, and task rows are a cache of it.

| Table | Holds |
| --- | --- |
| `project_config` | bb project ID, delivery mode, `yolo` flag, branch prefix, base branch, default machine |
| `task` | Task ID, kind (ship or scout), current state, worker thread ID, branch, machine, pull request URL |
| `task_event` | Append-only: task ID, time, from state, to state, event, actor, evidence |
| `approval` | Task ID, what you approved, your decision, time |

Scout reports are stored in the database and exported to `.bb/factoryman/<task-id>/report.md` in the project, git-ignored. This mirrors firstmate's `data/<id>/report.md`. Where the file should live is an open question.

On start, the plugin replays the events of every non-terminal task to rebuild its state, then compares the result with live thread state from bb. A mismatch becomes a `reconcile` event and a message to the supervisor. The plugin never fixes a mismatch silently.

## Machines and domain leads

bb runs threads on any enrolled machine, so v1 places workers directly instead of porting firstmate's remote secondmate homes. Domain leads, the closer equivalent of a secondmate, are planned for v2.

**Placement in v1.** Every task carries a machine. The dispatch rules gain a machine column, and a project config can set a default machine. The plugin spawns the worker on that machine. State, gates, and the event log stay on the server, so a remote machine runs workers and nothing else. bb handles enrollment, daemon updates, and the per-machine permission limit. Whether a plugin's thread spawn accepts a machine is unverified, so milestone 0 checks it.

**Rules that carry over from firstmate.**

- A task pinned to an offline machine goes blocked and wakes the supervisor. It never falls back to another machine.
- `local-only` work stays on the machine that holds the clone.
- Merge authority stays on the server. Workers on any machine can't merge.
- Config stays in the server checkout, and the plugin injects it into the worker prompt, because a remote checkout doesn't have `.bb/factoryman/`.

**Remote machine setup.** The gate runs where the worktree lives.
Each remote machine needs the agent CLI installed and signed in so that bb reports its provider `ready`, no-mistakes installed and initialized for each repo with its configured agent ready, and its own scoped git credentials.
A preflight check reports what's missing before the first dispatch.

**Domain leads in v2.** A domain lead is a persistent thread with a short charter: a scope, the projects it covers, and a machine. It stays idle until the supervisor routes in-scope work to it. It plans that work, splits it into tasks, and dispatches workers only inside its scope and machine. It reports to the supervisor. It can't merge, tear down work, or contact you. The plugin's state machine still runs every task, so the gates don't depend on the lead behaving. Scope routing is a new column in the dispatch rules. v2 ships when a single supervisor becomes the bottleneck.

**Trade-off.** All state lives on the server machine, and bb's docs say running threads may stop while it's off. Firstmate's remote homes keep running on their own.

## Capacity, spend, notifications, and cutover

A gap review against firstmate added these four items to v1.

**Capacity.** Each project config sets a cap on running workers, and the plugin sets a global cap. At a cap, the plugin returns `wait` from its message dispatch hook and queues the task. The built-in `concurrency-limit` plugin uses the same hook, and I haven't confirmed how the two interact. The core enforces its own cap and doesn't depend on that plugin.

**Spend.** Each project config can set a per-task and a per-day budget. The dispatcher refuses new tasks over budget, and the supervisor reports why. firstmate tracks pipeline spend, so I'd record the same figures. Whether bb exposes token or cost data to plugins is unverified, so milestone 0 checks it. Without that data, v1 falls back to a cap on tasks per day.

**Notifications.** bb ships a push notifications plugin for its mobile app, and milestone 0 checks whether it can carry attention alerts. If it can't, a string setting holds a webhook URL and the plugin posts to it whenever a task enters an attention state, so you can route alerts to your phone. It's the only away-from-keyboard piece in v1, and firstmate's away mode stays out. Where bb runs, and whether you can reach it remotely, decides whether the webhook is enough.

**Cutover from firstmate.** A CLI command imports firstmate's project registry (modes, `yolo`, branch prefix) into `project_config`, as a dry run first. In-flight tasks aren't imported: finish them in firstmate. Then move projects one at a time, so no branch is ever driven by both systems. Where firstmate keeps its registry is a milestone 0 check.

## Risks, unverified assumptions, and open questions

I read bb's docs and source, but I haven't run bb or this plugin. Treat everything marked unverified as a task for milestone 0, the spike.

| Risk | Why it matters | Mitigation or check |
| --- | --- | --- |
| Worktree cleanup discards uncommitted work | bb removes a managed worktree with `git worktree remove --force` once its last thread is deleted, or five minutes after the last thread is archived. The branch survives; uncommitted changes don't. | Require workers to commit and push at checkpoints. Guard `torn_down` on a clean tree. Verify whether a plugin can veto removal, through the environment provider or an archive event. |
| Merge bypass | A worker with shell access can merge without calling `factoryman_merge`. | Branch protection that requires the no-mistakes check, plus scoped GitHub tokens. The plugin alone can't close this, so v1 includes the setup steps. |
| Per-thread tool visibility is unverified | The design shows workers only `factoryman_report`. I saw bb's agent configuration hook but haven't tested tool selection per thread. | Test in the fake plugin host, then in the app. |
| Supervisor write restriction is unverified | Hard rule 1 needs the supervisor to be read-only. | Check bb's permission modes. Fall back to instructions plus review. |
| One project per supervisor | `bb thread spawn` takes a project, so a cross-project supervisor has no obvious home. | Start with one supervisor per project. Revisit after use. |
| SDK churn | Several APIs the plugin needs carry an `experimental_` prefix, and bb's README says workflows are still evolving. | Pin the SDK version. Keep contract tests with `createFakePluginHost`. |
| Out-of-tree install path is unverified | bb's docs describe `bb plugin build`, but I haven't confirmed how an external built plugin is loaded. | Confirm in milestone 0. |
| Overlap with built-in plugins | `tasks`, `workflows`, `automations`, `concurrency-limit`, and `github-pr-status` may already cover parts of this. I read only the `tasks` and `workflows` overviews. | Read the rest before writing duplicate code. |
| `no-mistakes` headless interface is unconfirmed | The `no-mistakes` delivery mode depends on an external pipeline. I read its README summary, not its docs, so I haven't confirmed how a plugin reads run status or findings headlessly, or whether it runs inside bb-managed worktrees. | Milestone 0 spike. The design wraps it behind a validator interface. |
| no-mistakes in bb worktrees is unconfirmed | The gate adds its own git remote and disposable worktree. It should work inside a bb-managed worktree, but I haven't tested it. | Milestone 0 spike on a throwaway repo. |
| Parallel pipelines run up cost | Each task can start a full AI pipeline, and bb may not expose cost data to plugins. | Per-project caps and budgets. Fall back to a daily task cap. |
| Dual control during cutover | If firstmate and the plugin both drive one branch, their gates and state diverge. | Move projects one at a time. Never share a branch. |
| Server machine is a single point of failure | All task state lives on the server, and bb's docs say running threads may stop while it is off. | Run the server on a machine that stays up. Reconcile on restart. |
| Remote machines need their own gate and credentials | no-mistakes runs where the worktree lives, so each machine needs it installed, plus agent sign-in and scoped git credentials. | Preflight check before the first dispatch. |
| Removing a machine discards unpushed work | Forced removal of a disconnected machine marks its environments destroyed without teardown, and the files stay on its disk. | Workers push at checkpoints, as with worktree cleanup. |

**Questions for you**

1. Is one supervisor thread per bb project enough, or do you need one across all projects?
2. Do you want a board view of tasks inside the bb app, or is the supervisor's report enough for v1?
3. Where should scout reports live: in the database only, or also as a git-ignored file in the project?
4. Does `no-mistakes` stay your validation pipeline under bb? Decided: yes, as the default validator, behind a validator interface.
5. Decided: the plugin is bbFactoryMan (Factory Man, short for factory manager). Its package is bb-factoryman, its tools use the factoryman\_ prefix, and its config lives in .bb/factoryman/.
6. Where does bb run, and how will you reach it when you're away from your desk?
7. Should firstmate keep running alongside the plugin during cutover, and for how long?
8. Which machines do you want to enroll first, and which projects does each one hold?

## Build plan

Each milestone ends with a check that passes before the next one starts.

**Milestone 0: spike.** Before the scaffold, test the assumptions the design rests on, against a real bb install and a throwaway repo. Check per-thread tool visibility, a read-only supervisor, how an out-of-tree plugin loads, cross-plugin thread metadata reads, `callRpc` discoverability, whether bb exposes token or cost data, whether a plugin's thread spawn accepts a machine, how a plugin detects a machine disconnecting, and where firstmate keeps its project registry. For `no-mistakes`, check whether a plugin can read run status and findings headlessly, answer a finding, and run the gate inside a bb-managed worktree. Record each result as a contract test pinned to the bb version. Done when every item is confirmed, or refuted with a fallback chosen. A refuted item that changes the architecture comes back to you before milestone 1.

1. **Scaffold.** Create the `package.json` manifest with `bb.server` and `bb.skills`, pin `@get-bb/plugin-sdk`, and set up `vitest` with `createFakePluginHost`. Done when the empty plugin loads in the fake host and builds with `bb plugin build`.
2. **State machine.** Write the ship and scout machines in `xstate` with no bb imports, including delivery modes and gates. Done when table-driven tests show that every illegal transition is refused, including merge without approval and teardown with unlanded work.
3. **Storage.** Add the event log, the task cache, replay, and reconcile. Done when a test destroys the cache and rebuilds identical state from events.
4. **Tools and approval.** Register the five tools and wire merge approval through `bb.ui.requestInput`. Done when tests cover submitted, cancelled, and timed-out approvals. The sixth tool, `factoryman_decide`, came later (D-136).
5. **Event wiring.** Map thread events to transitions and send supervisor wake messages. Done when a replayed event sequence produces the expected messages and no others.
6. **Validator.** Define the validator interface and implement it for `no-mistakes`, including the `validating` and `needs_decision` states. Done when a fake validator and a recorded `no-mistakes` run each drive a task from handoff to review ready, and a finding pauses the task.
7. **Dispatch resolver.** Build the rules table, precedence, and the `ambiguous` result. Done when precedence tests pass.
8. **Machine placement.** Add the machine column to dispatch rules and tasks, spawn workers on the chosen machine, and add the remote preflight check. Done when tests show a task pinned to an offline machine goes blocked and wakes the supervisor, a `local-only` task refuses any machine but the one with the clone, and the preflight reports a missing gate install.
9. **Extension surface.** Load workflow config from `.bb/factoryman/`, stamp thread metadata, and publish the versioned read RPC. Done when a test plugin reads tasks and events through `callRpc` and can't trigger a transition, and a config that tries to remove a gate is rejected.
10. **Limits, backstop, and cutover.** Add the worker and spend caps, the webhook notification, the branch-protection setup steps, and the firstmate registry import. Done when tests show a cap queues a task, an over-budget task is refused, an attention state posts to the webhook, and the import dry run reports every project's mode.
11. **Skills and live check.** Write the supervisor and worker skills. Done when you install the plugin in bb and run one scout task and one ship task. I can't run bb here, so this step is yours.

