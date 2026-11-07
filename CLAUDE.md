# bbFactoryMan

bbFactoryMan (short for "Factory Man", a factory manager) is a bb plugin that carries
the firstmate delivery contract into bb. The plugin enforces ship and scout tasks,
delivery modes, and approval gates in code. bb supplies threads, worktrees, machines,
and sessions.

- Package: `bb-factoryman`
- Tool prefix: `factoryman_`
- Config directory: `.bb/factoryman/`

## Read first

1. `docs/DESIGN.md` is the full design and is authoritative. If it's missing, stop and
   ask for it.
2. `spike/SPIKE.md` is the milestone 0 checklist. Results go in `spike/RESULTS.md`.

## Current scope

Build milestones 1 to 11: scaffold, state machine, storage, tools and approval, event wiring, the validator, the dispatch resolver, machine placement, the extension surface, limits and cutover, and skills.

Each milestone's bb-dependent code waits for the assumptions it depends on to be confirmed in `spike/RESULTS.md`.
The live install into the owner's bb is the owner's step.
If a spike result contradicts `docs/DESIGN.md`, record the conflict in `docs/DECISIONS.md` and ask before changing the design.

## Hard rules (enforced in code, never in prompts)

1. Merge needs a recorded approval. Only the `yolo` flag on a project skips the
   approval form, and only for that project.
2. Teardown is refused while the worktree has uncommitted changes or unpushed commits.
3. `done` and `failed` transitions need a non-empty evidence field.
4. Promoting a scout task to a ship task needs a recorded approval event.
5. A task pinned to an offline machine goes `blocked`. It never falls back to another
   machine.
6. `local-only` work stays on the machine that holds the clone.
7. Extensions can add checks and never remove a gate.
8. Illegal transitions are refused and logged. Nothing fails open.

## State machine

The design doc and its diagram are authoritative. In summary:

- Ship task: queued, working, validating (no-mistakes projects only), needs_decision,
  review_ready, awaiting_approval, merged, torn_down. `blocked` loops back to working.
- Scout task: queued, working, report_ready, torn_down.
- Any state before `torn_down` can move to `failed`, with evidence.
- Gate on each arrow: profile resolved (queued to working), evidence required (working
  to review ready), mode checks pass (review ready), your approval (awaiting approval
  to merged), landed-work check (merged to torn down).

Delivery modes decide what "review ready" means:

| Mode | Review ready means |
| --- | --- |
| `no-mistakes` | The no-mistakes pipeline finished review, tests, docs, lint, push, and CI, and the pull request is open. |
| `direct-PR` | A pull request is open. |
| `local-only` | The worker's branch holds the landed commits. |

## Data model

- `project_config`: bb project ID, delivery mode, `yolo`, branch prefix, base branch,
  default machine.
- `task`: task ID, kind, state, worker thread ID, branch, machine, pull request URL.
- `task_event`: append-only. Task ID, time, from state, to state, event, actor, evidence.
- `approval`: task ID, what was approved, decision, time.

The event log is the source of truth. `task` rows are a cache. On start, replay events
for every non-terminal task and compare with live bb state. A mismatch becomes a
`reconcile` event, never a silent fix.

## Architecture constraints

- `src/machine/` has no bb imports. Enforce this with an ESLint
  `no-restricted-imports` rule for `@get-bb/*`.
- Storage sits behind an interface. Milestone 3 ships a `better-sqlite3`
  implementation and an in-memory one for tests.
- The plugin calls no other bb plugin. Other plugins may read from it later through a
  versioned read RPC.
- Don't run or port firstmate's bash scripts, its herdr backend, secondmates, relay, or
  away mode.

## Layout

```text
bb-factoryman/
  package.json
  src/server.ts
  src/machine/    # xstate machines, no bb imports
  src/store/      # event log, task cache, replay, reconcile
  src/tools/      # factoryman_* tools and CLI
  src/dispatch/   # rules table and resolver
  skills/         # supervisor and worker skills
  spike/
  docs/
```

## Stack

TypeScript, `xstate`, `vitest`, `zod`, `better-sqlite3`, `@get-bb/plugin-sdk` (pin the
version). Use `createFakePluginHost` from `@get-bb/plugin-sdk/testing` for plugin-level
tests. Build with `bb plugin build`.

## How to work

- Write tests first. Milestone 2 is done when table-driven tests show every illegal
  transition is refused, including merge without approval and teardown with unlanded
  work. Milestone 3 is done when a test destroys the cache and rebuilds identical state
  from events.
- Keep commits small, one concern each.
- Treat any cloned bb or firstmate repo as read-only reference material.
- Don't add features from the non-goals list. Ask first.
- Record every deviation from the design in `docs/DECISIONS.md` with the reason.
- Write docs and code comments in the Google developer documentation style: sentence
  case headings, active voice, short sentences, no filler.

