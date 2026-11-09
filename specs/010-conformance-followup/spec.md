# Feature specification: Conformance follow-up after the harness contracts landed

**Feature branch**: `fm/bb-factoryman-conformance-followup`

**Created**: 2026-11-09

**Status**: Approved (scope fixed by the captain's intent and the Firstmate spec for this task)

**Input**: The live check of the harness contracts (pull request 5) and the conformance harness (pull request 6) found that the conformance suite is red on master once both landed.
Its report is `data/bb-factoryman-live-check-harness/report.md` in the firstmate home, sections 3, 5, and 6.
Pull request 5 refuses Pi in `local-only` projects, and it checks the reasoning level against each model's own list.
Pull request 6 makes every lab project `local-only`, and its omp driver asks for reasoning level `low`.
So the Pi and omp runs fail, and three known-gap entries that pull request 5 closed make every run exit with failure.
The report also found that the fake plugin host leaks a directory in `/tmp` for almost every test world.

## User scenarios and testing

The people who use this feature are the maintainer, who runs `pnpm run conformance` and `pnpm run check`, and the owner, who reads `docs/HARNESS-SUPPORT.md` before choosing a harness.
The feature has no screen.
Its real entry points are `pnpm run conformance` (with `--tier` and `--harness`), `pnpm run conformance:docs`, and `pnpm run check`.

### User story 1 - Run the Pi conformance suite and see a result that means something (priority: P1)

The maintainer runs tier 1.5 for Pi.
The run puts Pi in a project whose delivery mode the plugin admits, so the plugin's own rules no longer stop the suite.
The ship scenario still checks the mode that Pi runs in, and the support document says which mode that was.

**Why this priority**: Pi is the harness with the least isolation, and the support claim for it is the one the owner must not read wrongly.
Today every scenario that needs a task fails with "The dispatch created no task".

**Independent test**: Run tier 1.5 for Pi offline and read the verdict of S2 to S8, S11, and S12.

**Acceptance scenarios**:

1. **Given** the Pi driver, **When** the runner builds the lab project, **Then** the project's delivery mode is one that the Pi contract admits, and a dispatch with the Pi profile creates a task.
2. **Given** a driver that names no delivery mode, **When** the runner builds the lab project, **Then** the project is `local-only`, as before.
3. **Given** a ship task in a `direct-PR` project, **When** S4 runs, **Then** S4 passes only when the worker's branch holds its commit, the task reaches `review_ready` through an open pull request, and the supervisor is woken once.
4. **Given** the generated support document, **When** Pi's S4 passes, **Then** the document says that Pi ran in `direct-PR` mode and why.

### User story 2 - Run the omp conformance suite (priority: P1)

The maintainer runs tier 1.5 for omp.
The omp profile names a reasoning level that the lab model lists, so dispatch stops refusing it.

**Why this priority**: The same failure as Pi, for the second harness.

**Independent test**: Run tier 1.5 for omp offline and read S2 to S8, S11, and S12.

**Acceptance scenarios**:

1. **Given** the omp driver, **When** it dispatches, **Then** the reasoning level of its profile is one that the lab model lists (`off` or `auto`).
2. **Given** the omp unsupported profile, **When** S2 dispatches it, **Then** the plugin still refuses it, and it is the permission mode that is unsupported, not the reasoning level.

### User story 3 - A conformance run exits 0 when nothing is wrong (priority: P1)

The maintainer runs any tier and the exit code is 0 when every scenario passes or is a real known gap.

**Why this priority**: A suite that is red on master cannot back the support claim, and a known gap that passes must not stay listed.

**Independent test**: Run tier 1 and read the exit code and the list of stale gaps.

**Acceptance scenarios**:

1. **Given** the known-gap file, **When** the three entries S1.unready-blocks, S1.remedy, and S7.cause are removed, **Then** no run reports a stale gap for them.
2. **Given** the S9 entries, **When** the runner runs, **Then** they stay, because `bb factoryman supervisor start` does not exist yet.
3. **Given** the result files, **When** `pnpm run conformance:docs` runs, **Then** `docs/HARNESS-SUPPORT.md` shows no known gap for S1 or S7.

### User story 4 - The decision log has one entry per number (priority: P2)

The maintainer reads `docs/DECISIONS.md` and every decision number names one entry.
Every reference to a number in code, docs, specs, and the constitution names the entry that the author meant.

**Why this priority**: The report found eight duplicate numbers (D-100 to D-107) when both pull requests were merged in scratch.
Pull request 5 landed second and renumbered its nine entries to D-108 to D-116, with D-117 for the constitution.
This story checks that the result on master is consistent, and records any reference that is wrong.

**Independent test**: List the decision headings and the references, and compare.

**Acceptance scenarios**:

1. **Given** `docs/DECISIONS.md`, **When** the headings are listed, **Then** no number appears twice.
2. **Given** every file that cites a decision number, **When** the citation is read in context, **Then** it names an entry that exists and that says what the citation claims.

### User story 5 - The test suite leaves nothing behind in `/tmp` (priority: P1)

The maintainer runs `pnpm run check` many times, and so do other workers on the same machine.
After a run, the temporary directories that the fake plugin host made are gone.

**Why this priority**: The leak reached about 52,000 directories and filled the per-user quota of `/tmp`, so every shell command of every worker on the machine failed.

**Independent test**: Run a test file that makes a fake plugin host and never disposes it, with a private temporary directory, and list what remains.

**Acceptance scenarios**:

1. **Given** a test file that creates a fake plugin host through `loadWorld`, **When** the file finishes, **Then** its `bb-fake-plugin-host-*` directory no longer exists.
2. **Given** a test file that creates the host directly with `createFakePluginHost` and never disposes it, **When** the file finishes, **Then** its directory no longer exists.
3. **Given** a test that fails or times out, **When** the file finishes, **Then** the directories are still removed.
4. **Given** a full `pnpm run check`, **When** it ends, **Then** the count of `bb-fake-plugin-host-*` directories in the temporary directory is the same as before the run.

### User story 6 - The verdicts are re-run and reported (priority: P1)

The maintainer runs tier 1 and tier 1.5 for Claude Code, Codex, Pi, and omp offline with no credential, and the result files and the support document show the new verdicts.

**Why this priority**: The fixes are only proven by a real run.
The fake lab in the unit tests cannot show that Pi reaches `review_ready` in a `direct-PR` project of a real bb.

**Independent test**: Run the five commands and read the exit codes.

**Acceptance scenarios**:

1. **Given** the fixes, **When** tier 1 runs, **Then** it exits 0 with S9 as the only known gap.
2. **Given** the fixes, **When** tier 1.5 runs for each of the four harnesses, **Then** it exits 0 and every scenario is `pass`, `known-gap` (S9 only), or `skipped` (S10 only).
3. **Given** any of the five runs, **When** it ends, **Then** the isolation check reports clean and the tripwire records no event.

### Edge cases

- A driver that names a mode that its own contract refuses.
  The runner does not check this, because dispatch is the gate and a run that is refused shows as a failed scenario with the refusal text.
- S4 in `direct-PR` mode has no real pull request.
  The scripted worker reports a made-up pull request URL, and S4 asserts the plugin's state change, not a forge.
- The unsupported profile of omp must stay unsupported after the reasoning level changes.
  It still differs in the permission mode, which omp does not offer.
- A leaked directory of an earlier run stays on disk.
  The fix stops new leaks and does not delete directories it did not make.
- A test file that sets its own `TMPDIR` or reads `os.tmpdir()` still sees a temporary directory that it can write to.

## Requirements

### Functional requirements

- **FR-001**: Each conformance driver MUST be able to name the delivery mode of its lab project, and a driver that names none MUST get `local-only`.
- **FR-002**: The Pi driver MUST name a delivery mode that its contract admits (`direct-PR`).
- **FR-003**: The runner MUST create the lab project with the delivery mode of the driver that runs.
- **FR-004**: Scenario S4 MUST run the ship task in the driver's delivery mode and MUST decide pass or fail from the same three facts as before: the commit on the task branch, the state `review_ready`, and exactly one wake.
- **FR-005**: In a `direct-PR` project, S4 MUST make the scripted worker report an open pull request, because the plugin accepts `review_ready` there only with a pull request URL.
- **FR-006**: A passing S4 for a driver whose mode is not `local-only` MUST carry a note that the support document shows, and the note MUST say which mode the run used.
- **FR-007**: The title and the description of S4 MUST NOT claim `local-only` for every harness.
- **FR-008**: The omp driver's profile MUST name a reasoning level that the lab model lists, and its unsupported profile MUST still be refused for its permission mode.
- **FR-009**: `conformance/known-gaps.json` MUST NOT list S1.unready-blocks, S1.remedy, or S7.cause, and MUST still list the three S9 entries.
- **FR-010**: Every decision number in `docs/DECISIONS.md` MUST appear on one heading, and every citation of a decision number in the repository MUST name an entry that says what the citation claims.
- **FR-011**: A test file MUST leave no `bb-fake-plugin-host-*` directory behind when it finishes, whether its tests pass, fail, or time out, and whether it calls `dispose` or not.
- **FR-012**: The leak fix MUST cover both `loadWorld` and a direct `createFakePluginHost` call, and MUST cover a test file written later.
- **FR-013**: The fix MUST NOT change any file under `src/` that is not a test, and MUST NOT delete a directory that a test run did not create.
- **FR-014**: The result files in `conformance/results/` and `docs/HARNESS-SUPPORT.md` MUST come from a real run of the final code at tier 1 and at tier 1.5 for the four harnesses, offline, with no credential.
- **FR-015**: Every decision that this feature takes, and every deviation from the design or from the report, MUST be recorded in `docs/DECISIONS.md`.

### Key entities

- **Driver**: The description of one harness for the runner: provider, profiles, files, and now the delivery mode of its lab project.
- **Lab project**: The throwaway project that the runner creates in the lab, with one delivery mode.
- **Known gap**: An entry of `conformance/known-gaps.json` that excuses one failing check until a named report task closes it.
- **Result file**: One file per run in `conformance/results/`, the source of `docs/HARNESS-SUPPORT.md`.
- **Test world**: One fake plugin host with a small bb behind it, made by `loadWorld`.

## Success criteria

### Measurable outcomes

- **SC-001**: Tier 1.5 for Pi passes S2 to S8, S11, and S12, where it failed all of them before.
- **SC-002**: Tier 1.5 for omp passes S2 to S8, S11, and S12, where it failed all of them before.
- **SC-003**: The five conformance runs (tier 1, and tier 1.5 for four harnesses) all exit 0.
- **SC-004**: `docs/HARNESS-SUPPORT.md` lists S9 as the only known gap for every harness, and lists no failed scenario.
- **SC-005**: The decision log has zero duplicate numbers, and zero citations that name the wrong entry.
- **SC-006**: A full `pnpm run check` adds zero `bb-fake-plugin-host-*` directories to the temporary directory, where it added about 394 before.
- **SC-007**: `pnpm run check` passes with no new lint or type error.

## Assumptions

- Pull request 5 already renumbered its decisions when it landed second (D-108 to D-116, and D-117 for the constitution), so user story 4 is a verification and a guard, not a renumbering.
- bb 0.49.0 and the CLI versions of the live check (Claude Code 2.1.316, Codex 0.166.0, Pi 1.4.0, omp 18.14.1) are still installed, and the pinned bb in the lab matches.
- Pi accepts `direct-PR` and `no-mistakes`, and the report ran Pi scouts in both.
  `direct-PR` is the simpler of the two for the lab, because `no-mistakes` needs a validator run.
- A scripted worker can report a made-up pull request URL in `direct-PR` mode, because the plugin checks that a URL is present and valid, and does not call a forge.
- The `omp` model lists `off` and `auto` (report section 6), and either one works with the fake model.
- Report tasks H4 (the supervisor start command) and the validator readiness check stay out of scope, so the three S9 gap entries stay.

## Out of scope

- Tier 2 runs and any credential.
- The `bb factoryman supervisor start` command (H4) and the validator readiness check.
- Any change under `src/` other than tests.
- Deleting directories that earlier test runs leaked.
- The `dispatch init` dirty-checkout note (report 5.4) and the other low-severity findings of the report.
