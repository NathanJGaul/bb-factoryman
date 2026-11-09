# Convergence: agent-harness independence

**Run**: after `/speckit.analyze`, at `b4e9fdd`.
**Inputs**: `spec.md`, `plan.md`, and `tasks.md` as the only source of intent, the constitution, and the code in the worktree.
**Method**: for each requirement, acceptance criterion, plan decision, and constitution principle, a read of the code and of the test that covers it.
The author of the code ran this, so the run is not independent.

## Result

The implementation satisfies the specification, the plan, and the tasks, with three open decisions that are not the worker's to make.
It has one gap against the plan: the plan says the generic contract row is a frozen object, and the code does not freeze it.
`/speckit.converge` appended four tasks under `## Phase 12: Convergence`.
`T1423` freezes the contract rows.
`T1424` to `T1426` correct three documents that lag the code.
The four tasks are open when this file is written.
The "Update" section at the end records their outcome.

## Merge readiness

| Question | Answer |
| --- | --- |
| Does the feature do what the captain asked? | Yes. Readiness comes from bb's provider states, Pi is admitted in `direct-PR` and `no-mistakes` modes and refused in `local-only`, models and reasoning levels are checked against what bb lists, the built-in Claude default is gone and a block names `bb factoryman dispatch init`, and a failed worker's evidence quotes the provider's own cause. Decisions D1 to D5 of the report are implemented as the captain accepted them (D-100, D-103, D-104). |
| Is the scope the captain's? | Yes. Only H5, H1, H11, H2, H10, and H3 are built. There is no `supervisor start`, no `roles` field, no conformance runner, no tier 2 run, and no credential handling. |
| Did a hard rule or gate change? | No. `src/machine`, `src/store`, `src/validator`, `src/git`, `src/rpc`, `src/workflow`, and the authority, merge, and teardown tools have no diff. Every new check refuses before a task exists, and a failed read blocks (hard rule 8). |
| Does the gate pass? | Yes. `pnpm run check` exits 0 with 107 files and 1624 tests, and `pnpm run build` writes the server and frontend bundles. |
| Is the history clean? | 35 commits since the base, each with one concern, no co-author line, and a clean tree. |
| Does the TDD audit pass? | No. The verdict is `FAIL` for one reason: 71 of 227 behaviors came after their code (D-108). The captain decides. |
| Can the pull request go to the pipeline? | Yes, once Phase 12 is done. The pull request description must name D-108, U1, and C2 as open for the captain. |

## What is open

### The captain's decisions

1. **D-108 (constitution V).**
   71 behaviors have no recorded red: 42 acceptance tests written after their code and 29 unit tests that passed on the first run.
   Each has a killing mutant in the ledger (58 mutants, no survivor, runner at `tdd/ledger-mutants.py`).
   The captain accepts D-108, as feature 008's D-099 was accepted, or orders the 71 redone test first.
   The worker did not mark it accepted.
2. **Analyze U1 (admission rule).**
   The Pi refusal keys on the bb provider ID `pi`.
   The same harness behind another provider ID, such as an ACP registry entry, gets the generic row (`sandbox: "unknown"`, no refused mode) and is admitted in `local-only`.
   FR-1326 and decision D3 name Pi only.
   The captain decides whether a harness with an unknown sandbox is also refused in `local-only`, and records the choice in D-103.
3. **Analyze C2 (constitution scope text).**
   Principle VI lists milestones 1 to 11.
   This feature extends the scope by the captain's task, and D-100 leaves the text as it is (precedent D-068).
   Governance says an amendment needs a reason and a version bump.
   The captain decides whether to bump the constitution to 1.3.0 with a scope line for harness independence.

### The TDD verdict

The verdict is `FAIL` for the 71 `TEST_AFTER` behaviors, and it stays `FAIL` until the captain accepts D-108.
The rubric has no class for an accepted deviation, so a later audit has to say how it counts D-108.
`tdd/verification.md` was written at `2c4ee15`.
The follow-up tasks T1415 to T1422 changed tests and records after it, and no audit has read them.
That is `CHK1340`, and it is optional.

### The other analyze findings

| ID | Severity | Disposition |
| --- | --- | --- |
| U2 | MEDIUM | Left open for the live check. When bb writes the error event after it sends `thread.failed` and the error text is not empty, the evidence lacks the cause. The fail-closed fallback keeps today's text. A fake cannot show this race. `CHK1365` covers it. |
| U3 | LOW | Left open for the live check. Each dispatch and each queue drain makes three bb reads. The latency is not measured, and nothing is cached before there is a number. |
| I1 | MEDIUM | Task `T1424`. |

### The optional document drifts

| ID | Disposition |
| --- | --- |
| I1 | Task `T1424`. The contract over-claims the closing sentence, and no requirement asks for it. |
| I2 | Task `T1423`. The plan says the generic row is frozen, and the code does not freeze it. This is the one gap against the plan. |
| I3 | Left as is. D-105 records the move of `ladderFor` to `types.ts` (test A718 limits the resolver's imports). The plan is not edited by this command. |
| I4 | Task `T1425`. |
| I5 | Task `T1426`. |
| I6 | Left as is. The cycle log is append only, and its notes already say that the repository commits on green. |
| I7 | Left as is. `permanent` is typed `boolean`, which is the type `data-model.md` gives. The behavior matches the prose, so there is no gap. |
| I8 | Left as is. The brief puts the supervisor's role handling out of scope, and the present sentence in `skills/factoryman-supervisor/SKILL.md:38` already covers the new blocks. |

### The owner's live check

These items need a bb 0.49.0 lab (`docs/LIVE-CHECK.md`, `quickstart.md` part 2).
The captain's brief excludes a real-model run and any credential, so they stay unchecked in `checklist.md`.

- `CHK1360`: `providerStates` answers for every provider in the lab, including the tier 1 stub agent.
- `CHK1361`: a dispatch to a signed-out provider blocks in real bb with the login command, and no task exists.
- `CHK1362`: `bb factoryman dispatch init` writes a usable file in a lab project.
- `CHK1363`: Pi is refused in a `local-only` project and admitted in a `direct-PR` or `no-mistakes` one.
- `CHK1364`: an unlisted Pi model gets the list of models that bb offers.
- `CHK1365`: a worker that fails to start carries the harness's own cause text, read from a real event log.
- `CHK1366`: the model field that a spawn resolves (`id` or `model`) goes into `spike/RESULTS.md`.
- `CHK1367`: tier 2 runs, credentials, and the open tasks H4, H6 to H9, and H12 to H14 (the captain's).

## Evidence

- `tdd/test-list.md`: 224 behaviors `DONE` and 3 `BASELINE` (U1474 to U1476).
- `tdd/cycle-log.md`: 137 behaviors with a recorded red, and the revert-red ledger for the other 71.
- `tdd/verification.md` (second run): 0 `HIGH` smells, all 47 acceptance criteria covered, and no existing assertion weakened.
- `checklist.md`: the quality gates with their evidence. The unchecked items are `CHK1338`, `CHK1339`, `CHK1340`, and `CHK1360` to `CHK1367`.
- `analyze.md`: one critical finding (constitution V, D-108, known), four open findings of medium severity (C2, U1, U2, I1), and no coverage gap.
- The diff against the base: 53 files outside `specs`, `docs`, and `.specify` (3349 lines added). 19 are production files under `src` (628 lines added), 33 are tests and fixtures (2697 lines added), and one is `eslint.config.js`.

## Risk

- **D-108 stays open.** The tests are strong (every one of the 71 has a killing mutant), but the order cannot be shown in the history. The pull request should say so.
- **U1 is a real hole in the Pi refusal.** It is narrow: the same harness must run under another bb provider ID. A new provider that the captain admits later needs its own contract row, or a decision on U1.
- **Nothing ran in a real bb.** All 1624 tests use `createFakePluginHost` and `FakeBbPort`. The first real run can show that `providerStates` omits an ACP agent. The gate then blocks that agent, and the follow-up is an explicit row opt-in (D-101).
- **Three bb reads per dispatch and per queue drain.** The latency is unmeasured (U3).
- **The failure cause can be missing.** The race of U2 loses the cause and keeps today's evidence text, so the failure mode is safe.
- **The first plugin write into a checkout.** `dispatch init` creates `.bb/factoryman/dispatch.json` with an exclusive create and never overwrites. It is the only write, and `[U1406]`, `[U1435]`, and `[A1326]` pin it.
- **Existing tests changed.** Many acceptance tests relied on the built-in profile, so `loadWorld` now supplies it as a default `dispatch.json`. D-107 lists every changed test, and the second TDD audit found none weakened (one loosening, U1440, was restored in T1418).

## Remaining work

- `T1423` to `T1426` (Phase 12): freeze the contract rows, and correct two contracts and the test list's `updated_at`.
- The captain's decisions on D-108, U1, and C2. Not implementation tasks.
- The owner's live check, `CHK1360` to `CHK1367`. Not built here.
- The no-mistakes pipeline: review, tests, docs, lint, push, and the pull request. Firstmate starts it.

## Update: Phase 12 is done

The worker did the four convergence tasks after this file was written.
All 96 tasks of `tasks.md` are ticked, and no behavior is `PENDING`.

| Task | Result | Commit |
| --- | --- | --- |
| `T1423` | `deepFreeze` in `src/harness/contracts.ts` freezes the table, the generic row, and everything inside them. U1478 (4 tests) failed first and passes now. Three mutants (a shallow freeze, an unfrozen generic row, an unfrozen table) each fail U1478. | `6da1716` |
| `T1424` | `contracts/dispatch-gate.md` names the messages that end with `No other provider was tried.` (readiness, not listed, admission). The "Not listed" row shows the sentence that the old text already had. | `54f1f03` |
| `T1425` | `contracts/cli-dispatch-init.md` lists the value-is-a-flag case and points at `[U1412]` to `[U1417]`. | `f309821` |
| `T1426` | `updated_at` in `tdd/test-list.md` is `6da1716`. | `ce6b382` |

The gate after the tasks: `pnpm run check` exits 0 with 107 files and 1628 tests, and `pnpm run build` writes the bundles.
The test list holds 225 `DONE` and 3 `BASELINE` behaviors (228), and none is `PENDING`.
The 71 `TEST_AFTER` behaviors are the same 71, so the TDD verdict is still `FAIL` until the captain accepts D-108.
U1478 has a recorded red in `tdd/cycle-log.md` ("Convergence: the frozen contract rows"), so it is not one of the 71.

A second converge run would find no gap that a worker can close.
What stays open is the captain's (D-108, U1, C2), the owner's live check (`CHK1360` to `CHK1367`), and the optional drifts that I left as they are on purpose (I3, I6, I7, I8).

## Update: the captain's decisions

The captain decided the three open items (2026-11-08).

| Item | Decision | Record |
| --- | --- | --- |
| D-108 | Accepted as a recorded deviation, as for the earlier milestones. The ledger of killing mutants stays and goes into the pull request description. The TDD verdict stays `FAIL` as the rubric computes it. | `docs/DECISIONS.md` D-108, `tdd/verification.md` ("Owner decision on the verdict") |
| U1 | Keep the rule as built. D3 names Pi only, and a harness behind another provider ID gets its own contract row when it is admitted. | `docs/DECISIONS.md` D-103 |
| C2 | The constitution and its version stay untouched. The captain owns that wording and is asked separately. It is an open item in the pull request description. | None in the repository |

The only code-side change is the status check of `[A1345]` in `test/acceptance/harness-docs.test.ts`.
It matched "for the captain to accept" and now matches "accepted by the captain", which is the same strictness.

What is open now: C2 (the captain), the owner's live check (`CHK1360` to `CHK1367`), U2 and U3 (the live check), and the optional drifts I3, I6, I7, and I8 that were left on purpose.
