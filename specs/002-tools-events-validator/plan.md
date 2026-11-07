# Implementation plan: Tools and approval, event wiring, and the validator

**Branch**: `fm/bb-factoryman-milestones-4-6` | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-tools-events-validator/spec.md`

## Summary

Build milestones 4 to 6 of `docs/DESIGN.md` on top of the merged state machine and store.
Milestone 4 registers the five `factoryman_*` tools and wires the merge approval through `bb.ui.requestInput`.
Milestone 5 turns bb thread events into transitions and sends the supervisor a wake message only for the states that need attention.
Milestone 6 defines the validator interface, implements it for no-mistakes, and adds the driver that moves a task through `validating` and `needs_decision`.

All bb calls go through one small port, so the tool logic, the wake logic, and the driver run in unit tests with hand-written fakes.
The fake plugin host then proves the wiring: tool registration, per-thread visibility, event delivery, the approval form, and the background service.
Every gate keeps living in `src/machine/`.
The new code decides who is calling, gathers the facts that the machine's events need, and records what happened.

## Technical context

**Language/Version**: TypeScript 6 through the `@typescript/typescript6` alias, ESM, Node 26 (unchanged from milestones 1 to 3).

**Primary dependencies**: `xstate` 5, `zod` 4, `better-sqlite3` 12.10.0, `@get-bb/plugin-sdk` 0.6.104 (exact pin).
One new runtime dependency: `@toon-format/toon` 4.4.0, pinned exactly, to decode the output of `no-mistakes axi` (D-038).

**Storage**: The existing `Store`, opened on `bb.storage.database()` in production (spike item 23) and on the in-memory store in unit tests.
No new table and no schema change.

**Testing**: `vitest` 5, `createFakePluginHost`, recorded fixtures under `test/fixtures/recorded/`, temporary git repositories for the git facts, and a fake `exec` for the command runners.

**Target platform**: The bb plugin server runtime on Linux or macOS, where `git`, `gh`, and `no-mistakes` are on the path.

**Project type**: Library that ships as a bb plugin.

**Performance goals**: The full suite, lint, and type-check finish in under 90 seconds (SC-007).

**Constraints**: `src/machine/` gains nothing.
Gates fail closed.
The plugin calls no other bb plugin.
The five-tool list is closed.
No code reads the clock directly: `now`, `sleep`, and ID generation are injected.

**Scale/Scope**: Tens of live tasks per project.
Each live validating task holds one background loop.

## Constitution check

*Gate: must pass before research.
Re-checked after design.*

The constitution is at version 1.1.0 (D-032).
Principle VI now covers milestones 1 to 6.

| Principle | Status | Evidence |
| --- | --- | --- |
| I. Gates live in code and fail closed | Pass | Tools only build events. The machine's guards decide. A merge runs only after the machine would accept it (FR-115), and the approval form accepts only an exact answer (FR-113). |
| II. The machine core is pure | Pass | `src/machine/` gains no file. The lint rule and its test stay in force. The new code reads the machine through `transition`, `replayTask`, and `TaskLog`. |
| III. The event log is the source of truth | Pass | Every change goes through `TaskLog.apply`. Start-up runs `recover` and `reconcile` and repairs nothing silently (FR-212). |
| IV. Storage sits behind an interface | Pass | The new code takes a `Store` and never opens SQLite itself except in `server.ts`. |
| V. Test first | Pass | `/speckit.tdd.plan` orders test tasks first, and `/speckit.tdd.run` records every red. |
| VI. Scope discipline | Pass | No resolver, placement, extension surface, limits, or skills. The two gaps the design leaves go to `docs/DECISIONS.md` (D-030, D-031). |

No violations, so the complexity table is empty.

## Design decisions

The full reasoning sits in [research.md](research.md).
The decisions that shape the code:

1. **One port to bb.**
   `src/bb/port.ts` lists every call the plugin makes to bb: spawn a worker, read a thread, send a message, read an environment path, remove an environment, open an input form, and stamp metadata.
   `src/bb/adapter.ts` implements it over `BbPluginApi` and is the only file that touches `bb.sdk` or `bb.ui`.
   SDK churn then has one place to land.
2. **Authority comes from the store.**
   `identify(store, threadId)` answers "worker of task X" or "not a worker".
   Supervisor tools need "not a worker" and a task in the caller's project.
   The report tool needs "worker".
   Plugin metadata only decides which tools bb offers.
3. **Tools build events, nothing else.**
   Each tool is a plain async function from a context and parsed arguments to a text result.
   `src/tools/register.ts` binds them to `bb.agents.registerTool` and `bb.agents.configure`, with JSON schemas made from the `zod` schemas so that a bad call reaches the tool and gets its refusal text (D-044).
4. **One apply path.**
   `Runtime.apply(taskId, event)` calls `TaskLog.apply`, then the notifier, then the driver hook.
   The tools, the event handlers, and the driver all use it, so a wake message follows every attention state exactly once.
5. **The merge runs between a preview and a record.**
   The tool previews the `merge` event with the pure `transition`, runs the executor, then records the event.
   A failed executor records nothing.
6. **Facts come from git, not from agents.**
   `GitPort.worktreeReport` runs `git status --porcelain` and `git rev-list` in the worker's worktree.
   Teardown never accepts the report as an argument (FR-118).
7. **Events map to transitions through one table.**
   `src/wiring/handlers.ts` holds the table from the contract in [contracts/events.md](contracts/events.md).
   Every handler loads the recorded worker first and exits quietly when there is none.
8. **Wake messages follow states, not events.**
   The notifier looks at the state after each applied event.
   Idle and archive wakes are the only wakes that are not transitions, and they are explicit handlers.
9. **The validator is an interface with two implementations.**
   The no-mistakes adapter runs `no-mistakes axi` through an injected `exec`, reads stdout only, and decodes TOON.
   Unreadable output is a typed result, never a success.
10. **The driver is a loop per task.**
    `ValidationDriver.ensure(taskId)` starts one loop for a `validating` or `needs_decision` task.
    The loop reattaches through `axi run`, maps gates and outcomes to `finding`, `resolve`, `validated`, and `fail`, and sleeps through an injected delay.
    It never answers a finding on its own, and it never cancels a run on shutdown.
11. **The supervisor role has one writer.**
    `bb factoryman supervisor <thread-id>` stamps the role on a thread that is not a recorded worker (FR-122).

## Project structure

### Documentation (this feature)

```text
specs/002-tools-events-validator/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── tools.md
│   ├── events.md
│   └── validator.md
├── checklists/requirements.md
├── tasks.md
├── tdd/
│   ├── test-list.md
│   ├── cycle-log.md
│   └── verification.md
├── checklist.md
├── analyze.md
└── converge.md
```

### Source code (repository root)

```text
src/
├── server.ts               # plugin factory: builds the runtime, registers tools, handlers, CLI, service
├── runtime.ts              # Runtime: deps bundle and the one apply path
├── machine/                # unchanged, no bb imports
├── store/                  # unchanged
├── bb/
│   ├── port.ts             # BbPort interface and its plain-data types
│   └── adapter.ts          # BbPort over BbPluginApi (the only bb.sdk and bb.ui caller)
├── exec.ts                 # Exec type and the child_process runner
├── git/
│   ├── report.ts           # worktree report from git
│   └── merge.ts            # MergeExecutor: gh pull request merge and local merge
├── tools/
│   ├── access.ts           # identify(): worker or not
│   ├── preview.ts          # would the machine accept this event
│   ├── results.ts          # text results and refusal formatting
│   ├── prompt.ts           # worker prompt
│   ├── dispatch.ts
│   ├── report.ts
│   ├── status.ts
│   ├── merge.ts            # approval form and merge
│   ├── teardown.ts
│   ├── register.ts         # registerTool and configure bindings, with zod schemas
│   └── supervisor-command.ts  # bb factoryman supervisor <thread-id>
├── wiring/
│   ├── wake.ts             # attention states, message text, send
│   ├── handlers.ts         # thread event handlers
│   └── startup.ts          # observe, reconcile, resume
└── validator/
    ├── types.ts            # Validator interface, RunView, Gate, Finding, Outcome
    ├── fake.ts             # scripted fake validator
    ├── toon.ts             # decode stdout into a typed RunView
    ├── no-mistakes.ts      # NoMistakesValidator over Exec
    └── driver.ts           # ValidationDriver
test/
├── acceptance/             # real-entry-point tests through the fake host
├── fixtures/
│   ├── recorded/           # real bb and no-mistakes payloads
│   ├── bb-port.ts          # hand-written BbPort fake
│   ├── runtime.ts          # runtime builder over the memory store
│   └── git-repo.ts         # temporary git repository builders
└── ...
spike/
├── RESULTS.md
└── probe/server.ts
```

**Structure decision**: Single project that follows the layout in `CLAUDE.md`.
`src/tools/` holds the tools and the command.
`src/wiring/` and `src/validator/` are new directories for milestones 5 and 6, and `src/bb/`, `src/git/`, and `src/exec.ts` hold the edges.
`src/dispatch/` and `skills/` still do not exist.
Unit tests sit next to their module.
Acceptance tests that enter through the fake host sit in `test/acceptance/`.

## Milestone commits

| Milestone | Commit scope |
| --- | --- |
| Spike | `spike/RESULTS.md`, the probe source, recorded fixtures, and the version test (done). |
| Plan | Spec, plan, tasks, test list, and the scope amendment (this commit). |
| 4. Tools and approval | `src/bb/`, `src/exec.ts`, `src/git/`, `src/runtime.ts`, `src/tools/`, `src/server.ts`, and their tests. |
| 5. Event wiring | `src/wiring/` and its tests, plus the recorded bb replay test. |
| 6. Validator | `src/validator/` and its tests, the `@toon-format/toon` dependency, and the recorded no-mistakes replay test. |
| Close-out | Verification, checklist, analysis, and convergence artifacts. |

Each TDD cycle also gets its own focused commit, as the workflow requires.

## Risks

| Risk | Mitigation |
| --- | --- |
| The fake host differs from real bb. | Spike items 2, 20, 21, 22, and 23 recorded the real behavior, and the recorded fixtures replay through the same handlers. |
| A real merge or git command misbehaves, and nothing here runs it against a real forge. | The executors sit behind interfaces. The git facts and the local merge run against temporary repositories. The `gh` call is tested for its command line only, and the owner's live check covers the rest (milestone 11). |
| A submitted form is not proof of a human. | Strict answer schema, no recorded approval for anything else, and D-030. |
| `thread.failed` can race bb's own provider retry. | Fail closed and tell the supervisor. D-040 records the limit. |
| `bb plugin build` bundles the new dependencies differently. | Spike item 24 loaded a build that imports `xstate`, `zod`, and `better-sqlite3`. The build task re-runs `pnpm run build` and a bundle check. |
| TOON output varies by no-mistakes version. | The adapter reads the header it is given. The version test pins the recorded version, and an unknown shape is `unreadable`. |
