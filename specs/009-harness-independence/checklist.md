# Quality gates: agent-harness independence

**Purpose**: Record the quality gates for the finished implementation, with the evidence for each.
**Created**: 2026-11-08
**Feature**: [spec.md](spec.md)

This file follows the form of the earlier features' `checklist.md`, which records the gates of the finished work.
It is not a requirements-quality checklist, so the usual rule that a generated checklist leaves its boxes unchecked does not apply here.
A checked item has evidence that I ran or read in this worktree at `85af53e`.
An unchecked item names what is missing and who owns it.

## Hard rules and fail-closed behavior

- [x] CHK1301 The state machine, the store, the tools' authority checks, the merge and teardown gates, the validator, and the read RPC did not change.
      Evidence: `git diff --stat b4e462a..HEAD` over `src/machine`, `src/store`, `src/validator`, `src/git`, `src/rpc`, `src/workflow`, `src/tools/access.ts`, `merge.ts`, `teardown.ts`, `report.ts`, and `status.ts` is empty.
      The acceptance suites for those layers (`machine-gates`, `machine-matrix`, `tools-authority`, `tools-merge`, `tools-teardown`, `store-*`, `validator-*`) have no diff and pass.
- [x] CHK1302 A provider passes only when bb reports it `ready` on the host that runs the worker.
      A status of `not_installed`, `unauthenticated`, `expired`, `unsupported_version`, or `unknown`, a missing state, a status the plugin does not know, and a failed read each block.
      Evidence: `[A1301]` to `[A1304]`, `[U1323]` to `[U1332]`, `[U1320]`; mutants L01 to L04 and L08 (all killed).
- [x] CHK1303 A blocked dispatch creates no task, spawns no worker, and uses no slot of the day cap.
      Evidence: `[A1301]` to `[A1304]` and `[A1309]` (store empty, `threads.spawn` not called, a second dispatch fits under `maxTasksPerDay: 1`); mutant L09 (a task created before the block) is killed.
- [x] CHK1304 A task pinned to a remote machine is judged by that machine's own states, in the dispatch and in the preflight.
      Evidence: `[A1305]`, `[A1306]`, `[U1340]`, `[U1346]` to `[U1350]`; mutants L05 and L06 (killed).
- [x] CHK1305 The queue start applies the same gate as dispatch, through the one function `gateProfile`.
      A readiness or model problem keeps the task queued, and a permanent refusal fails it with evidence.
      Evidence: `[A1307]`, `[A1320]`, `[A1350]`, `[U1351]`, `[U1352]`, `[U1367]`, `[U1368]`, `[U1473]`; mutants L07, L20, L21 (killed).
- [x] CHK1306 Pi is refused in `local-only` mode and admitted in `direct-PR` and `no-mistakes` modes, for every profile source, for scout and ship tasks, and at the queue start.
      Evidence: `[A1316]` to `[A1321]`, `[U1358]` to `[U1366]`; mutants L17, L22, L23, L25 (killed).
- [x] CHK1307 No check falls back to another provider.
      Evidence: the refusal and readiness messages end "No other provider was tried." (`[U1364]`, `[U1323]` to `[U1330]`), and `[A1321]` shows no spawn on any provider.
- [x] CHK1308 The plugin has no built-in default profile.
      A project with no `default`, no matching rule, and no override gets a block that names `bb factoryman dispatch init`, and no task.
      Evidence: `[U1408]`, `[U1410]`, `[A1322]`, `[A713]`; mutant L26 (a built-in returns) is killed.
- [x] CHK1309 Config only tightens, and the one file the plugin now writes is never overwritten.
      Evidence: `src/workflow` has no diff; `dispatch init` creates the file with the `wx` flag and exits 1 on an existing file, valid or not (`[U1406]`, `[U1435]`, `[A1326]`); mutant L27 (flag `w`) is killed.
- [x] CHK1310 A model and its reasoning level are checked against what bb lists, and an unlisted model follows the contract row.
      A failed read of the models blocks.
      Evidence: `[A1330]` to `[A1338]`, `[A1350]`, `[U1374]` to `[U1388]`, `[U1344]`; mutants L32 to L36 and L43 (killed).
- [x] CHK1311 A worker's failure evidence quotes the provider's cause as bounded, flattened data, adds an advisory remedy, and stays non-empty when the read fails.
      Evidence: `[A1339]` to `[A1344]`, `[U1445]` to `[U1471]`; mutants L45 to L54 (killed).
- [x] CHK1312 The tool hint is off by default and never carries a metadata value.
      Evidence: `[U1312]` to `[U1317]`, `[A1313]` to `[A1315]`; mutants L13 to L16 (killed).
- [x] CHK1313 The plugin still calls no other bb plugin.
      Evidence: the existing server test that filters the SDK calls for `plugins.` passes unchanged (`src/server.test.ts`).

## Scope and out-of-scope guards

- [x] CHK1320 Only the six tasks of the captain's brief are built: H5, H1, H11, H2, H10, and H3.
      Evidence: `docs/DECISIONS.md` D-108 lists them; `grep` finds no `supervisor start` command, no `roles` field in the config schema, no conformance runner, and no offline lab script in `src` or the repository.
- [x] CHK1321 The supervisor and validator role handling did not change.
      Evidence: `src/validator`, `src/wiring/stamp.ts`, and `src/tools/access.ts` have no diff; `src/tools/supervisor-command.ts` gained only the `dispatch init` route and its usage line.
- [x] CHK1322 No credential is handled.
      Evidence: the added production code has no line that matches `password`, `secret`, `apikey`, `token`, or `credential`; `dispatch init` makes only read calls to bb and writes one profile (`[U1440]`, `[A1329]`).
- [x] CHK1323 No dependency, build setting, or test configuration changed.
      Evidence: `git diff b4e462a..HEAD -- package.json pnpm-lock.yaml tsconfig.json vitest.config.ts` is empty.
- [x] CHK1324 `CLAUDE.md`, the constitution, and `CHANGELOG.md` are unchanged.
      Evidence: `git diff --quiet b4e462a..HEAD -- CLAUDE.md .specify/memory/constitution.md CHANGELOG.md` exits 0.
      D-108 records that the captain's task extends the constitution's scope text, as D-068 did.
- [x] CHK1325 The state machine's eight hard rules are untouched, and none of the new checks can weaken a gate.
      Evidence: CHK1301, and the gate only adds refusals before a task exists.

## Tests and TDD evidence

- [x] CHK1330 The whole suite passes with no skipped test.
      Evidence: `pnpm run check` at `85af53e` -> 107 files, 1624 tests, 0 failed; `grep` finds no `.skip`, `.only`, `.todo`, or `xit` in any test file.
- [x] CHK1331 Every one of the 47 acceptance criteria reaches a test, and the AC-3.3 default leg is judged.
      Evidence: `tdd/verification.md`, "Traceability"; `[A1318]` and `[A1321]` use a config with no rule.
- [x] CHK1332 No behavior on the test list is `PENDING`.
      Evidence: `tdd/test-list.md` holds 224 `DONE` and 3 `BASELINE` behaviors (U1474 to U1476, characterization of existing branches), and the 92 tasks of `tasks.md` are ticked.
- [x] CHK1333 137 behaviors have a recorded red (the command and the failure line) in the cycle log, and no commit puts source before its test.
      Evidence: `tdd/cycle-log.md`, groups 1 to 8; `tdd/verification.md`, "Test-first evidence".
- [x] CHK1334 Every one of the 71 behaviors without a recorded red has a deliberate mutant that makes its test fail.
      Evidence: the ledger in `tdd/cycle-log.md` ("Remediation 1", 71 rows, 58 mutants, no survivor); the runner is `tdd/ledger-mutants.py`.
- [x] CHK1335 No existing assertion was weakened, and each changed one is recorded.
      Evidence: `tdd/verification.md` lists the changes (all forced by D-112 or D-109); the one loosening that the second audit found (U1440) was restored in T1418.
- [x] CHK1336 No `HIGH` smell is open.
      Evidence: `tdd/verification.md` (second run): `high_smells: 0`; findings 2 and 3 of the first run are fixed.
- [x] CHK1337 The second audit's open findings of `MED` and `LOW` severity (17 to 24) were repaired.
      Evidence: `tdd/cycle-log.md`, "Remediation 3", tasks T1415 to T1422.
- [x] CHK1338 The captain accepts D-116, or orders the 71 behaviors redone test-first.
      Evidence: the captain accepted D-116 on 2026-11-08 through firstmate's steering message; `docs/DECISIONS.md` D-116 reads "Deviation, accepted by the captain", and `tdd/verification.md` ends with the owner's decision, as feature 008's does for D-099.
- [ ] CHK1339 The TDD verdict reads `PASS` or `PASS_WITH_GAPS`.
      Owner: no one. The captain accepted D-116, but the rubric has no class for an accepted deviation, so the verdict stays `FAIL` for the 71 `TEST_AFTER` behaviors, as feature 008's does for D-099. A later audit has to say how it counts D-116.
- [ ] CHK1340 A third audit re-reads the follow-up changes of T1415 to T1422, which the second audit did not see.
      Owner: optional; the follow-up changed tests and records only.

## Docs and the decision record

- [x] CHK1341 `docs/DECISIONS.md` records the captain's five decisions, the amendments of D-063 and D-064 (their text kept), and the deviations, as D-108 to D-116.
      Evidence: `[A1345]` to `[A1347]`; D-110 (five columns that the report did not list) and D-115 (the existing tests that changed) are the deviations.
- [x] CHK1342 No doc outside the decision log, and no skill, says that the plugin has a built-in default profile.
      Evidence: `[A1348]`; `docs/DESIGN.md` rung 4 and the `docs/LIVE-CHECK.md` line now name the block and `dispatch init`.
- [x] CHK1343 The sentence-per-line rule and the Google style hold in the new docs.
      Evidence: read in this worktree; the decision entries, the spec, the plan, and the contracts put one sentence on a line.
- [x] CHK1344 The TDD profile names the new fixtures and options.
      Evidence: `.specify/memory/tdd-profile.md` (feature 009 note, and `test/fixtures/models.ts` in `helpers`).

## Build and gate commands

- [x] CHK1350 `pnpm run check` passes (type check with `tsc6`, lint, and the suite).
      Evidence: exit 0 at `85af53e`, 107 files, 1624 tests, about 33 to 48 seconds.
- [x] CHK1351 `pnpm run build` (`bb plugin build`, bb CLI 0.48.1) writes the server and the frontend bundles.
      Evidence: `dist/server.js`, `dist/app.js`, `dist/app.css`, and their maps; `dist/` is git-ignored.
- [x] CHK1352 The branch holds small commits that each carry one concern, no commit carries a co-author line, and the tree is clean.
      Evidence: `git log b4e462a..HEAD`; `git status --short` is empty.

## The owner's live check (not built here)

The captain's brief excludes a real-model run and any credential.
These items need a bb 0.49.0 lab (`docs/LIVE-CHECK.md`, `quickstart.md` part 2) and are the owner's step.

- [ ] CHK1360 `providerStates` answers for every provider that the lab uses, including the tier 1 stub agent.
      If it omits an ACP agent, the gate blocks it, and the follow-up is an explicit contract-row opt-in (D-109).
- [ ] CHK1361 A dispatch to a signed-out provider (Codex works) blocks in real bb with the login command, and no task exists.
- [ ] CHK1362 `bb factoryman dispatch init` writes a usable file in a lab project, and the next dispatch resolves "from the configured default".
- [ ] CHK1363 Pi is refused in a `local-only` lab project and admitted in a `direct-PR` or `no-mistakes` one.
- [ ] CHK1364 An unlisted Pi model gets the list of models bb offers, or "no models" with the load error, in real bb.
- [ ] CHK1365 A worker that fails to start carries the harness's own cause text in the evidence of the task, read from a real event log.
- [ ] CHK1366 The model field that a spawn resolves (`id` or `model`) is recorded in `spike/RESULTS.md`.
- [ ] CHK1367 Tier 2 runs, credentials, and the open tasks H4, H6 to H9, and H12 to H14.
      Owner: the captain (D-108 lists them).

## Update after convergence

`/speckit.converge` appended Phase 12 (`T1423` to `T1426`), and the worker did it.
The items above keep their evidence from `85af53e`, and these facts replace the counts they quote:

- The test list holds 225 `DONE` and 3 `BASELINE` behaviors (228), with U1478 added by `T1423`, and none is `PENDING`.
- `pnpm run check` at `ce6b382` exits 0 with 107 files and 1628 tests, and `pnpm run build` writes the bundles.
- `src/harness/contracts.ts` now freezes its rows (U1478). The layers that `CHK1301` lists did not change.
- No item changed state. `CHK1338`, `CHK1339`, `CHK1340`, and `CHK1360` to `CHK1367` stay unchecked, with the same owners.

## Update after the captain's decisions

- `CHK1338` is checked: the captain accepted D-116 (2026-11-08).
  The pull request description names the revert-red ledger (`tdd/cycle-log.md`, 58 mutants, no survivor).
- Analyze U1 is settled: the captain kept the Pi rule as built, and D-111 records that a harness behind another provider ID gets its own contract row when it is admitted.
- Analyze C2 stays open: the constitution and its version are untouched, the captain owns that wording, and the pull request description lists it as an open item.
