---
feature: 010-conformance-followup
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 18
planned_at: 3b827b8
updated_at: c089d6a
suite_baseline: green
---

# Test list: Conformance follow-up after the harness contracts landed

The acceptance layer is an in-process integration test.
It enters through the runner's `main(argv, deps)` with the fake lab behind `main`, through `loadGaps`, through the generated document, and through a child `vitest` process for the temporary-directory leak.
A fake lab cannot show that a real bb accepts a `direct-PR` Pi ship task, that omp's `auto` level reaches the harness, or that the full suite leaves no directory behind.
The only check of those is the live runs: behaviors A1511 to A1514 are manual live checks, run in `bblab` and logged in `cycle-log.md` and in the result files.
The fake lab uses the real contract table (`src/harness/contracts.ts`), so it refuses Pi in `local-only` as the plugin does.
That makes the existing Pi acceptance tests go red when the fake lab learns the rule, which is the reproduction of the live failure.
The suite baseline was 136 files and 1796 tests, all passing.
Tests carry their behavior id in the title, for example `[U1501]`.

## Outer loop: acceptance behaviors

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| A1501 | `main` with tier 1.5 and `--harness pi` against a fake lab that refuses Pi in `local-only` runs S1 to S9, S11, and S12 with every verdict `pass` and exits 0 | US1.1, FR-002, FR-003, SC-001 | example | DONE | `test/acceptance/conformance-tier15.test.ts::[A1501]` |
| A1502 | `main` with tier 1.5 for Claude Code, Codex, and omp still passes every scenario, and the fake lab's project mode for each is `local-only` | US1.2, FR-001 | example | DONE | `test/acceptance/conformance-tier15.test.ts::[A1502]` |
| A1503 | The result file of the Pi run holds S4 with the note that Pi ran in `direct-PR` mode, and the other harnesses' S4 results hold no note | US1.4, FR-006 | example | DONE | `test/acceptance/conformance-tier15.test.ts::[A1503]` |
| A1504 | The generated support document shows the `direct-PR` note next to Pi's passing S4, and the scenario name "Ship" | US1.4, FR-006, FR-007 | example | DONE | `test/acceptance/conformance-docs.test.ts::[A1504]` |
| A1505 | `main` with tier 1.5 and `--harness omp` against a fake lab that lists only `off` and `auto` for omp's model runs every scenario with verdict `pass` and exits 0 | US2.1, FR-008, SC-002 | example | DONE | `test/acceptance/conformance-tier15.test.ts::[A1505]` |
| A1506 | The omp unsupported profile is blocked with no task created, and the block comes from the permission mode and not from the reasoning level | US2.2, FR-008 | example | DONE | `test/acceptance/conformance-tier15.test.ts::[A1506]` |
| A1507 | `loadGaps` on the committed `conformance/known-gaps.json` returns exactly the three S9 entries | US3.1, US3.2, FR-009 | example | DONE | `test/acceptance/conformance-gaps.test.ts::[A1507]` |
| A1508 | `main` with tier 1 and the committed gap list against a fake lab where S9 fails as in the real lab exits 0 and prints no stale gap | US3.1, SC-003 | example | DONE | `test/acceptance/conformance-gaps.test.ts::[A1508]` |
| A1509 | The decision log has no duplicate heading number | US4.1, FR-010, SC-005 | example | DONE | `test/acceptance/decision-log.test.ts::[A1509]` |
| A1510 | Every `D-nnn` cited in a tracked text file names a heading in the decision log | US4.2, FR-010, SC-005 | example | DONE | `test/acceptance/decision-log.test.ts::[A1510]` |
| A1511 | A child `vitest` run with a private `TMPDIR` of two fixture files, one that builds hosts through `loadWorld` and `createFakePluginHost` and disposes none, and one that fails on purpose, leaves no `bb-fake-plugin-host-*` entry under that directory | US5.1, US5.2, US5.3, FR-011, FR-012 | example | DONE | `test/acceptance/tmpdir-leak.test.ts::[A1511]` |
| A1512 | Live: a full `pnpm run test` adds no `bb-fake-plugin-host-*` directory to the temporary directory | US5.4, SC-006 | example | DONE | measured: 394 directories left before the setup file, 0 after (`cycle-log.md`, group 5) |
| A1513 | Live: tier 1 exits 0 with S9 as the only known gap, and tier 1.5 for Claude Code, Codex, Pi, and omp each exit 0 with S9 as the only known gap and S10 skipped | US6.1, US6.2, FR-014, SC-001 to SC-004 | example | DONE | live runs: `conformance/results/*.json`, five exits of 0 (`cycle-log.md`, live runs) |
| A1514 | Live: each of the five runs reports isolation clean and a tripwire with no event | US6.3 | example | DONE | live runs: `isolation.clean` is true in all five result files |
| A1515 | The decision log holds headings that the checker can read, and the last one is not older than D-117 | US4.1, FR-010 | example | PENDING | |

## Inner loop: unit behaviors

### `tools/conformance/drivers/types.ts` and the drivers

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1501 | `deliveryModeOf` returns `local-only` for a driver that names no mode | FR-001 | example | DONE | `tools/conformance/drivers/drivers.test.ts::[U1501]` |
| U1502 | `deliveryModeOf` returns the mode a driver names | FR-001 | example | DONE | `tools/conformance/drivers/drivers.test.ts::[U1502]` |
| U1503 | The Pi driver names `direct-PR`, a mode that the Pi contract admits | FR-002 | example | DONE | `tools/conformance/drivers/drivers.test.ts::[U1503]` |
| U1504 | Claude Code, Codex, omp, and the stub name no delivery mode | FR-001 | example | DONE | `tools/conformance/drivers/drivers.test.ts::[U1504]` |
| U1505 | The omp profile names reasoning level `auto` | FR-008 | example | DONE | `tools/conformance/drivers/drivers.test.ts::[U1505]` |
| U1506 | The omp unsupported profile differs from its profile in the permission mode only | FR-008 | example | DONE | `tools/conformance/drivers/drivers.test.ts::[U1506]` |

### `tools/conformance/lab-env.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1507 | `projectRowScript` for `direct-PR` carries the mode, the project ID, base branch `main`, and `yolo` 0, and no `local-only` literal | FR-003 | example | DONE | `tools/conformance/lab-env.test.ts::[U1507]` |
| U1508 | `projectRowScript` for `local-only` carries the mode `local-only` | FR-003 | example | DONE | `tools/conformance/lab-env.test.ts::[U1508]` |

### `tools/conformance/scenarios/s04-ship.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1509 | S4 in `local-only` dispatches with no pull request flag, passes its three checks, and sets no note | FR-004 | example | DONE | `tools/conformance/scenarios/scenarios.test.ts::[U1509]` |
| U1510 | S4 in `direct-PR` dispatches with the `pr=` flag, passes its three checks, and sets the mode note on `S4.review-ready` | FR-004, FR-005, FR-006 | example | DONE | `tools/conformance/scenarios/scenarios.test.ts::[U1510]` |
| U1511 | S4 in `direct-PR` fails `S4.review-ready` when the worker reports no pull request | FR-004, FR-005 | example | DONE | `tools/conformance/scenarios/scenarios.test.ts::[U1511]` |
| U1512 | S4 for a `no-mistakes` driver fails with a message that says S4 does not run in that mode | FR-004 | example | DONE | `tools/conformance/scenarios/scenarios.test.ts::[U1512]` |
| U1513 | The S4 scenario title is "Ship" and names no delivery mode | FR-007 | example | DONE | `tools/conformance/scenarios/scenarios.test.ts::[U1513]` |

### `test/fixtures/conformance-lab.ts` (the fake lab)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1514 | The fake lab takes the task mode from the driver and `local-only` when the driver names none | FR-001, FR-003 | example | DONE | `test/fixtures/conformance-lab.test.ts::[U1514]` |
| U1515 | The fake lab blocks a dispatch of a provider whose contract refuses the project's mode, with code `provider_not_admitted` and no task | FR-002 | example | DONE | `test/fixtures/conformance-lab.test.ts::[U1515]` |
| U1516 | A fake `direct-PR` ship task reaches `review_ready` with a pull request URL and stays `working` without one | FR-005 | example | DONE | `test/fixtures/conformance-lab.test.ts::[U1516]` |
| U1517 | A fake `local-only` ship task reaches `review_ready` with a commit, as before | FR-004 | example | DONE | `tools/conformance/scenarios/scenarios.test.ts::[U1387]` (existing) |
| U1518 | The fake lab blocks a profile whose reasoning level the model does not list, and names the levels it lists | FR-008 | example | DONE | `test/fixtures/conformance-lab.test.ts::[U1518]` |
| U1529 | Every harness driver's delivery mode is admitted by its provider's contract, checked against the real table | FR-002 | example | DONE | `test/fixtures/conformance-lab.test.ts::[U1529]` |
| U1530 | The fake lab refuses a `local-only` ship report that carries a pull request and no landed commits, and the task stays `working` | FR-004, FR-005 | example | PENDING | |
| U1533 | The fake lab words the block of an unsupported profile by what differs: the permission mode, or the reasoning level | FR-008 | example | PENDING | |

### `tools/conformance/lab-env.ts` against the real store

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1531 | The script of `projectRowScript`, run against a database made by the plugin's store, writes a row that `getProjectConfig` reads back with the given mode, project ID, base branch `main`, and `yolo` false | FR-003 | example | PENDING | |

### `conformance/known-gaps.json`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1519 | The file lists no entry for S1.unready-blocks, S1.remedy, or S7.cause | FR-009 | example | DONE | `tools/conformance/gaps.test.ts::[U1519]` |
| U1520 | The file still lists S9.start-command (all harnesses), S9.stamp-advice for codex, and S9.stamp-advice for omp, each with task H4 | FR-009 | example | DONE | `tools/conformance/gaps.test.ts::[U1520]` |

### `test/fixtures/decision-log.ts` (the checker that the guard uses)

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1521 | The checker reports a heading number that appears twice, with both line numbers | FR-010 | example | DONE | `test/fixtures/decision-log.test.ts::[U1521]` |
| U1522 | The checker reports a citation whose number has no heading, with the file and line | FR-010 | example | DONE | `test/fixtures/decision-log.test.ts::[U1522]` |
| U1523 | The checker reports nothing for a log with unique headings and valid citations | FR-010 | example | DONE | `test/fixtures/decision-log.test.ts::[U1523]` |

### `test/setup/private-tmpdir.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1524 | `createPrivateTmpdir` makes a new directory inside the current temporary directory and points `TMPDIR` at it | FR-011 | example | DONE | `test/setup/private-tmpdir.test.ts::[U1524]` |
| U1525 | Its `restore` removes the directory with everything inside it and puts the earlier `TMPDIR` back | FR-011 | example | DONE | `test/setup/private-tmpdir.test.ts::[U1525]` |
| U1526 | When `TMPDIR` was unset, `restore` unsets it again | FR-011 | example | DONE | `test/setup/private-tmpdir.test.ts::[U1526]` |
| U1527 | `restore` removes only the directory it made: a sibling directory in the same parent stays | FR-013 | example | DONE | `test/setup/private-tmpdir.test.ts::[U1527]` |
| U1528 | `restore` called twice does not throw | FR-011 | example | DONE | `test/setup/private-tmpdir.test.ts::[U1528]` |
| U1532 | A test file of the main run starts with `TMPDIR` pointing at a directory named `bb-factoryman-test-*` that exists, so the root config wires the setup file | FR-011, FR-012 | example | PENDING | |
| U1534 | `createPrivateTmpdir` with `TMPDIR` set to the empty string makes its directory inside the platform's temporary directory, and not in the working directory | FR-011 | example | PENDING | |
| U1535 | `restore` called twice leaves a `TMPDIR` that was changed between the two calls alone | FR-011 | example | PENDING | |

## Invariants and edge cases still to place

- `src/` has no changed non-test file (FR-013): checked by `git diff --stat origin/master -- src` in the checklist, because the existing layering test only covers `tools/`.
- A `no-mistakes` driver mode is not used by any driver today: U1512 covers the refusal and no live run exists.

## Out of scope

- Tier 2 runs and credentials: the captain's.
- The supervisor start command (H4) and validator readiness: other tasks. The three S9 gap entries stay for H4.
- Deleting directories that earlier runs leaked: the fix stops new leaks only.
- The `dispatch init` dirty-checkout note: low severity, not listed in the captain's intent.

## Verification commands

Copied verbatim from `.specify/memory/tdd-profile.md` at planning time:

- Single test: `pnpm vitest run {file} -t "{name}"`
- File: `pnpm vitest run {file}`
- Full suite: `pnpm test`
- Acceptance: `pnpm vitest run {file}`
- Coverage: none
- Mutation: none (deliberate mutants are used, as in the earlier features)
