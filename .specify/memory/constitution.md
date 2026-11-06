# bb-factoryman Constitution

## Core principles

### I. Gates live in code and fail closed

Every authority gate is a refusal in the state machine.
A gate that depends on an agent obeying a prompt does not count.
The eight hard rules in `CLAUDE.md` are binding:

1. Merge needs a recorded approval. Only a project's `yolo` flag skips the approval form, and only for that project.
2. Teardown is refused while the worktree has uncommitted changes or unpushed commits.
3. `done` and `failed` transitions need a non-empty evidence field.
4. Promoting a scout task to a ship task needs a recorded approval event.
5. A task pinned to an offline machine goes `blocked`. It never falls back to another machine.
6. `local-only` work stays on the machine that holds the clone.
7. Extensions can add checks and never remove a gate.
8. Illegal transitions are refused and logged. Nothing fails open.

Rationale: the plugin exists to enforce the delivery contract in code.
A gate that fails open defeats the purpose of the plugin.

### II. The machine core is pure

`src/machine/` MUST NOT import from `@get-bb/*`.
An ESLint `no-restricted-imports` rule enforces this, and the lint run MUST fail when the rule is violated.
Machine code takes plain data in and returns plain data out.
Every gate MUST be testable without a running bb.

### III. The event log is the source of truth

`task_event` is append-only.
`task` rows are a cache that replay can rebuild exactly.
On start, the plugin replays events for every non-terminal task and compares the result with live bb state.
A mismatch becomes a `reconcile` event and is never fixed silently.

### IV. Storage sits behind an interface

The store interface has two implementations: `better-sqlite3` for production and an in-memory one for tests.
Both implementations MUST pass the same contract test suite.

### V. Test first (non-negotiable)

- Every behavior change is driven by a test that failed first.
- The failure is recorded in `specs/<feature>/tdd/cycle-log.md`.
- Test tasks precede implementation tasks.
- Tests are never weakened, skipped, deleted, or filtered to reach green.
- Every acceptance criterion has a real-entry-point acceptance test.
- Refactoring happens only on green.
- Test strength is verified with mutation testing or deliberate mutants.

### VI. Scope discipline

Milestones 1 to 3 (scaffold, state machine, storage) are the only milestones in scope until `spike/RESULTS.md` confirms the bb assumptions.
No tools, event wiring, machine placement, or validator code ships before then.
Features from the design's non-goals list need approval first.
Every deviation from `docs/DESIGN.md` is recorded in `docs/DECISIONS.md` with the reason.
If a spike result contradicts the design, the conflict is recorded and the owner decides.

## Engineering constraints

- Stack: TypeScript, `xstate`, `vitest`, `zod`, `better-sqlite3`, and a pinned `@get-bb/plugin-sdk`.
- Plugin-level tests use `createFakePluginHost` from `@get-bb/plugin-sdk/testing`.
- The plugin calls no other bb plugin.
- Do not run or port firstmate's bash scripts, its herdr backend, secondmates, relay, or away mode.
- Docs and code comments follow the Google developer documentation style: sentence case headings, active voice, short sentences, no filler.
- In long Markdown files, each sentence sits on its own line.

## Development workflow

- Commits are small and carry one concern each.
- Commit messages carry no agent co-author line.
- Generated files, including `CHANGELOG.md`, are never edited by hand.
- Lint, type-check, and test failures are fixed when found, even when an earlier change caused them.

## Governance

This constitution supersedes other practices for this repository.
`docs/DESIGN.md` stays authoritative for product design.
An amendment needs a written reason in `docs/DECISIONS.md` and a version bump here.
Version bumps follow semantic versioning: major for removed or redefined principles, minor for added principles or materially expanded guidance, patch for wording fixes.
Every plan includes a constitution check, and every review verifies compliance.

**Version**: 1.0.0 | **Ratified**: 2026-11-05 | **Last amended**: 2026-11-05
