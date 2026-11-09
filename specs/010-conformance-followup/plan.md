# Implementation plan: Conformance follow-up after the harness contracts landed

**Branch**: `fm/bb-factoryman-conformance-followup` | **Date**: 2026-11-09 | **Spec**: [spec.md](spec.md)

## Summary

Make the conformance suite green on master now that the harness contracts and the conformance harness are both merged.
Five small edits do it, and one real run proves it:

1. A driver names the delivery mode of its lab project. Pi names `direct-PR`. S4 follows the mode.
2. The omp driver asks for a reasoning level that its model lists.
3. Three stale known-gap entries go.
4. A guard test keeps the decision log unique and its citations valid.
5. A test setup file gives each test file its own temporary directory and removes it, so the fake plugin host leaks nothing.

Then the runner runs tier 1 and tier 1.5 for the four harnesses, offline, and the results and `docs/HARNESS-SUPPORT.md` are regenerated.
Nothing under `src/` changes except through tests.

## Technical context

- Language and tooling: TypeScript 6 (binary `tsc6`), ESM, Node 26, `pnpm` 12, `vitest` 5.
  The conformance tools run under Node's type stripping, with `.ts` extensions in relative imports and `import type` for types.
- Files that change:
  - `tools/conformance/drivers/types.ts`, `pi.ts`, `omp.ts`: the `deliveryMode` field, Pi's value, and omp's level.
  - `tools/conformance/real-lab.ts`: the project row takes the driver's mode.
  - `tools/conformance/scenarios/s04-ship.ts`: S4 follows the mode.
  - `test/fixtures/conformance-lab.ts`: the fake lab models the mode and Pi's refusal in `local-only`.
  - `conformance/known-gaps.json`, `conformance/results/*.json`, `docs/HARNESS-SUPPORT.md`, `docs/CONFORMANCE.md`.
  - `vitest.config.ts` and a new setup file `test/setup/private-tmpdir.ts`.
  - `docs/DECISIONS.md` (new entries) and a new guard test for it.
- Tests: `vitest` unit tests next to the sources, acceptance tests in `test/acceptance/`.
  The acceptance layer is in-process, except for the leak test, which starts a child `vitest` process.
- bb facts used (report sections 4 and 6, `src/harness/contracts.ts`):
  - Pi is refused in `local-only` (`provider_not_admitted`) and admitted in `direct-PR` and `no-mistakes`.
  - `direct-PR` accepts `review_ready` only with a pull request URL (`src/machine/guards.ts`, `readyModeCheck`).
  - bb 0.49.0 lists the reasoning levels `off` and `auto` for omp's lab model.
  - `os.tmpdir()` reads `TMPDIR` on every call on Linux, and the SDK calls `mkdtempSync(join(tmpdir(), "bb-fake-plugin-host-"))` when it builds a host.
- Constraints: no credential of any kind. The lab path is `/var/tmp/bblab-conformance-followup`, outside `/tmp` and outside any path with `firstmate`. The runs are sequential and offline.
- Scale: one interface field, two driver edits, one scenario, one fixture, one setup file, one config line, and five runs.

## Constitution check

| Principle | How the plan complies |
| --- | --- |
| I. Gates live in code | No gate changes. The runs observe the Pi admission gate and the `direct-PR` review-ready gate through the event log. |
| II. Machine core is pure | No change to `src/machine/`. |
| III. Event log is the source of truth | S4 still reads the event log and task rows through the read RPC. |
| IV. Storage behind an interface | No change. |
| V. Test first | Each behavior gets a failing test first, recorded in `tdd/cycle-log.md`. The pure parts (driver fields, the fake lab, S4, the decision-log guard) have unit tests. The leak fix has a process-level acceptance test. The live runs are the end-to-end acceptance of the lab changes. |
| VI. Scope | The captain's intent and the Firstmate spec for this task name every edit. The feature changes tests, tools, and documents, and nothing under `src/` that ships. It runs no tier 2 and handles no credential. The live install into the owner's bb stays the owner's step: every run happens in `bblab`. |
| Engineering constraints | No other bb plugin is called. Docs follow the Google developer documentation style, one sentence per line. Firstmate's scripts are not used. |

Result: no violation, so no complexity tracking.
No amendment of the constitution is needed.

## Decisions

### Q1. The delivery mode is a driver field, not a runner option

The mode depends on the harness, because the harness contract refuses it per mode.
So the driver owns it, next to `profile` and `shipProfile`.
A `--delivery-mode` flag would let a maintainer ask for a combination that the plugin refuses, and the support document would then depend on the command line.
The field is optional, and the default is `local-only`, so Claude Code, Codex, omp, and the stub keep today's behavior.
The runner reads the field when it writes the project row.

### Q2. `direct-PR` for Pi, not `no-mistakes`

`no-mistakes` needs a validator run, which the lab does not have.
`direct-PR` needs only a pull request URL on the report.
The report ran Pi scouts in both modes.

### Q3. S4 follows the driver's mode and states the mode

The report offers two options: run S4 in `direct-PR` for Pi, or assert the refusal.
This plan takes the first, because the refusal is already proven by the unit and acceptance tests of the gate (`test/acceptance/harness-admission.test.ts`) and by the live check.
S4 keeps its three facts: one commit on the task branch, the state `review_ready`, one wake.
In `direct-PR` mode the scripted worker reports a made-up pull request URL through the `pr=` flag that both brains already know.
S4 puts a note on `S4.review-ready` when the mode is not `local-only`, and the support document shows it.
The title becomes "Ship", so no row claims `local-only` for a harness that ran in another mode.

### Q4. The omp level is `auto`

The lab model lists `off` and `auto`.
`auto` leaves the choice to omp, and it is the level that bb uses when none is given.
`off` would also pass.
A live run checks that the unsupported profile (permission mode `auto`) is still refused for the permission mode.

### Q5. The decision log needs a guard, not a renumbering

Pull request 5 landed second and renumbered its entries when it was rebased (D-117 records this).
On master, the headings D-001 to D-117 are unique and every citation resolves.
A test keeps it that way: headings are unique, and every `D-nnn` in a tracked text file names a heading.
The test does not judge whether the meaning fits, so the plan adds a one-time manual check of the citations of D-100 to D-107 (done: all fit) and records it in the checklist.

### Q6. The leak fix is a per-file temporary directory

Options:

- **A. One setup file that points `TMPDIR` at a fresh directory for each test file, and removes it after the file.** It covers `loadWorld`, a direct `createFakePluginHost`, any future caller, and other temporary files of tests, with about fifteen lines.
- **B. A registry in `loadWorld` and an `afterEach` that disposes each world.** It misses the direct callers (`src/server.test.ts`, `src/tools/register.test.ts`, `src/bb/adapter.test.ts`, `test/acceptance/plugin.test.ts`) and every future one.
- **C. Wrap `createFakePluginHost` with `vi.mock` in a setup file.** It covers every caller but hides the SDK behind a mock, and a mock of the module under test is easy to get wrong.

The plan takes A.
Removing a directory does not need `dispose`, and `dispose` stays the way a test shuts a host down.
The setup file runs `afterAll`, so a failing or timing-out test still cleans up.
It removes only the directory it made.

### Q7. How the leak test proves the fix

The fix is invisible inside one test file, because the cleanup runs after the file.
So the acceptance test starts a child `vitest` run with a private `TMPDIR`.
The child runs a fixture file that builds a host through `loadWorld` and a host through `createFakePluginHost`, and disposes neither.
After the child exits, the test lists the private `TMPDIR` recursively and expects no `bb-fake-plugin-host-*` entry.
The fixture file is not named `*.test.ts`, and a second config file for the child lists it, so the main run never runs it by itself.
The red phase runs the child with the setup file left out and finds the directories.

### Q8. The real runs come last and use the committed code

The runs write `conformance/results/<tier>-<harness>.json` with the plugin commit.
So the code commits come first, then the runs, then one commit for the results and the document.
A failure in a real run is a finding.
It is fixed in the tools when the cause is in the tools, and it is recorded when the cause is in the plugin or in bb, because `src/` must not change.

## Project structure

### Documentation (this feature)

```text
specs/010-conformance-followup/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/driver-delivery-mode.md
├── tasks.md
├── checklist.md
├── analyze.md
├── converge.md
└── tdd/ (test-list.md, cycle-log.md, verification.md)
```

### Source code

```text
tools/conformance/
├── drivers/types.ts            # + deliveryMode
├── drivers/pi.ts               # deliveryMode: "direct-PR"
├── drivers/omp.ts              # reasoningLevel: "auto"
├── real-lab.ts                 # project row takes the driver's mode
└── scenarios/s04-ship.ts       # follows the mode
test/
├── fixtures/conformance-lab.ts # the fake lab models the mode
├── setup/private-tmpdir.ts     # new: per-file TMPDIR
└── acceptance/tmpdir-leak.test.ts + test/fixtures/leak/ (fixture and config)
docs/DECISIONS.md               # + D-118 onward, and a guard test
conformance/known-gaps.json     # - three entries
conformance/results/*.json      # regenerated by the runs
docs/HARNESS-SUPPORT.md         # regenerated
docs/CONFORMANCE.md             # S4 row, driver mode
vitest.config.ts                # + setupFiles
```

## Risks

- **A scripted `direct-PR` worker may meet a rule that `local-only` hid.**
  The teardown check for unpushed commits, or the machine placement rule, may differ by mode.
  The live Pi run shows it. If the cause is in `src/`, the run records the finding and the feature does not change `src/`.
- **omp's reasoning level may reach the fake model.**
  `auto` is not a model-side value, so a wire-level difference is possible. The live omp run shows it.
- **The private `TMPDIR` may break a test that assumes a path in `/tmp`.**
  The full suite run shows it. The setup file uses a directory under the real temporary directory, so a test that needs `/tmp` as a prefix still holds.
- **Removing the directory while a world is alive.**
  A world that never disposes keeps an open SQLite file. On Linux the unlink is safe, and the test file has ended.
- **The live runs take about 30 minutes** and need the pinned bb and its toolchain, which the first run downloads while the network is on.
