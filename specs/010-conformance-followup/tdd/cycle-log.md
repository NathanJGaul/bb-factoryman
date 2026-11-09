# Cycle log: Conformance follow-up after the harness contracts landed

Append only.
Newest last.
Every entry's `red` block is the evidence that the test existed and failed before the implementation.

## Baseline

- suite: `pnpm vitest run` -> 136 files, 1796 passed, 0 failed (31 s)
- commit: `3b827b8`
- leak baseline: see the entry for task T002

## Group 1: the driver's delivery mode and the project row (U1501 to U1504, U1507, U1508)

Tests and two stubs came first: `deliveryModeOf` returned `"no-mistakes"` and `projectRowScript` returned an empty string, so the tests fail on an assertion and not on a missing symbol.

- red: `pnpm vitest run tools/conformance/drivers/drivers.test.ts tools/conformance/lab-env.test.ts` -> 6 failed, 12 passed
  - U1501 `AssertionError: expected 'no-mistakes' to be 'local-only'`
  - U1502 `AssertionError: expected 'no-mistakes' to be 'direct-PR'`
  - U1503 `AssertionError: expected undefined to be 'direct-PR'`
  - U1504 `AssertionError: claude-code: expected 'no-mistakes' to be 'local-only'`
  - U1507 `AssertionError: expected '' to contain 'INSERT OR REPLACE INTO project_config'`
  - U1508 `AssertionError: expected '' to contain '\'proj_abc123\',\'local-only\',\'main…'`
- green: `deliveryModeOf` returns `driver.deliveryMode ?? "local-only"`, the Pi driver names `direct-PR`, `projectRowScript` builds the row script, and `real-lab.ts` calls it. Suite `pnpm vitest run` -> 136 files, 1802 passed, 0 failed. `pnpm run typecheck` and `pnpm run lint` clean.
- refactor: none needed. The inline script moved from `real-lab.ts` into `projectRowScript` unchanged except for the two parameters.
- commit: `14854dd`

## Group 2: the fake lab, S4, and omp (U1505, U1506, U1509 to U1516, U1518, U1529, A1501 to A1506)

Step 1, the fake lab tests (`test/fixtures/conformance-lab.test.ts`, new):

- red: `pnpm vitest run test/fixtures/conformance-lab.test.ts` -> 4 failed, 1 passed
  - U1514 `AssertionError: expected 'local-only' to be 'direct-PR'`
  - U1515 `AssertionError: expected 't-0001' to be null`
  - U1516 `AssertionError: expected null to be 'https://github.com/conformance/lab/pu…'`
  - U1518 `AssertionError: expected 't-0001' to be null`
- U1529 passed on its first run, because Pi already named `direct-PR` after group 1. Deliberate mutant: Pi set to `local-only` -> `AssertionError: pi: expected [ 'local-only' ] to not include 'local-only'`. The mutant was reverted with `git checkout`.

Step 2, the fake lab learned the plugin's rules (the mode from the driver, `provider_not_admitted` from the real contract table, `direct-PR` review ready only with a pull request, the levels that omp's model lists).
This reproduced the live failure in the unit tests: seven existing tests went red, for the reasons the live check found.

- red (existing tests, unchanged): `pnpm vitest run` -> 7 failed, 1800 passed
  - U1383 and U1424 (omp): `The dispatch created no task: Dispatch blocked (provider_unavailable): The model \`mock/mock-1\` of the provider \`acp-omp\` does not list the reasoning level \`low\`. It lists: off, auto.`
  - U1387, U1388, A1313, A1308, U1406 (Pi): S4 went red because the worker reported no pull request in a `direct-PR` project (`S4.review-ready: state: none within the wait`).

Step 3, the S4, omp, and acceptance tests, written before the scenario and driver changed:

- red: `pnpm vitest run tools/conformance test/acceptance/conformance-tier15.test.ts test/acceptance/conformance-docs.test.ts` -> 17 failed, 100 passed
  - U1505 `AssertionError: expected 'low' to be 'auto'`
  - U1510 `AssertionError: S4.branch-commit: git rev-list --count main..fm/t-0001: 0; S4.review-ready: state: none within the wait; S4.wake: 0 wake(s)`
  - U1511 `AssertionError: expected [ 'S4.branch-commit', …(2) ] to deeply equal [ 'S4.review-ready', 'S4.wake' ]`
  - U1512 `AssertionError: expected [] to deeply equal [ 'S4.review-ready' ]`
  - U1513 `AssertionError: expected 'Ship in local-only mode' to be 'Ship'`
  - A1501, A1502, A1503, A1505 `AssertionError: expected 1 to be +0`
  - A1504 `AssertionError: expected '| S4 | fail | Ship in local-only mode…' to match /^\| S4 \| pass \| Ship \| This harnes…/`
  - A1506 `AssertionError: expected 'Dispatch blocked (provider_unavailabl…' to match /permission mode \`auto\`/`
  - U1506 and U1509 passed on their first run (see the mutant checks below).

Step 4, green:

- `s04-ship.ts` follows `deliveryModeOf(lab.driver)`, sends the `pr=` flag in `direct-PR`, sets the note, and has the title "Ship".
- `omp.ts` asks for `auto`.
- The fake lab words its unsupported-profile block by what differs (the permission mode or the reasoning level), and records a commit as a fact of the task (`committed`) so a ship task that never reports still has its commit.
- `pnpm run conformance:docs` regenerated `docs/HARNESS-SUPPORT.md`, because the S4 name comes from the scenario title (A1329 stayed red until then).
- Two reds remained after the first green attempt and each got its own fix: U1511 (the fake lab counted the commit only after `review_ready`, which hid the commit of a worker that reports no pull request, fixed with the `committed` fact) and A1329 (the document, regenerated).
- Suite: 137 files, 1820 passed, 0 failed. `pnpm run typecheck` and `pnpm run lint` clean.

Mutant checks for the behaviors that passed on their first run:

- U1506 (omp unsupported profile differs in the permission mode only): passed because the driver already had that shape. Mutant: `unsupportedProfile: { ...profile, reasoningLevel: "off" }` is out of reach of this test file, so the mutant is the two-key difference `{ ...profile, permissionMode: "auto", reasoningLevel: "off" }`. Not run separately: the assertion is `differing` equals `["permissionMode"]`, so a second differing key fails it by construction.
- U1509 (local-only S4 sends no pull request): the first mutant, S4 always sending the `pr=` flag, survived, because the fake lab ignored the flag in `local-only`. The fake lab then learned the real rule (a `local-only` report with a pull request and no landed commits is refused with `mode_check_failed`). The same mutant then failed: `AssertionError: S4.review-ready: state: none within the wait; S4.wake: 0 wake(s): expected [ 'S4.review-ready', 'S4.wake' ] to deeply equal []`. The mutant was reverted.

Refactor: none needed.

## Correction to group 2: the U1506 mutant was run

The group 2 entry said that the U1506 mutant was not run separately.
It was run afterwards: `unsupportedProfile: { ...profile, permissionMode: "auto", reasoningLevel: "off" }` in `omp.ts` gives `AssertionError: expected [ 'reasoningLevel', 'permissionMode' ] to deeply equal [ 'permissionMode' ]`.
The change was reverted with `git checkout`.

## Group 3: the known-gap file (U1519, U1520, A1507, A1508)

- red: `pnpm vitest run tools/conformance/gaps.test.ts test/acceptance/conformance-gaps.test.ts` -> 4 failed, 8 passed
  - U1519 `AssertionError: S1.unready-blocks: expected [ 'S1.unready-blocks', …(5) ] to not include 'S1.unready-blocks'`
  - U1520 `AssertionError: expected [ 'S1.remedy *', …(5) ] to deeply equal [ 'S9.stamp-advice codex', …(2) ]`
  - A1507 `AssertionError: expected [ 'S1.remedy * H1', …(5) ] to deeply equal [ 'S9.stamp-advice codex H4', …(2) ]`
  - A1508 `AssertionError: --tier 1: expected 1 to be +0` (the stale gaps S1.unready-blocks, S1.remedy, and S7.cause)
- green: `conformance/known-gaps.json` lost the three entries. Suite -> 137 files, 1824 passed, 0 failed. Lint clean.
- mutant: the file cut to its first two entries (a deleted S9 entry) -> U1520, A1507, and A1508 fail (3 failed, 9 passed). Restored.
- refactor: none needed.
- commit: see `git log` ("fix(conformance): remove the three known gaps")

## Setup notes (tasks T001 and T002), recorded after the fact from the planning runs

- T001: `pnpm install --frozen-lockfile` was already satisfied. The planning run `pnpm vitest run` on `3b827b8` gave 136 files, 1796 passed, 0 failed (31 s). `pnpm run typecheck` and `pnpm run lint` were clean.
- T002, leak baseline: the suite run with a fresh `TMPDIR` and the setup file left out (a scratch config with the same `include`) left 394 `bb-fake-plugin-host-*` directories directly under that `TMPDIR`. The live-check report counted 394 too. See group 5 for the run with the fix.

## Group 4: the decision log guard (U1521 to U1523, A1509, A1510)

Tests and three stubs came first. The stubs return a sentinel number so the tests fail on an assertion.

- red: `pnpm vitest run test/fixtures/decision-log.test.ts` -> 3 failed
  - U1521 `AssertionError: expected [ { number: <sentinel>, lines: [] } ] to deeply equal [ Array(1) ]`
  - U1522 `AssertionError: expected [ { path: 'stub', line: +0, …(1) } ] to deeply equal [ { path: 'docs/a.md', …(2) }, …(1) ]`
  - U1523 `AssertionError: expected [ { number: <sentinel>, lines: [] } ] to deeply equal []`
- green: `test/fixtures/decision-log.ts` finds duplicate headings and dangling citations. The guard `test/acceptance/decision-log.test.ts` applies it to the real `docs/DECISIONS.md` and to the tracked text files.
- A1510 went red on the real repository for a true reason: `specs/010-conformance-followup/plan.md:156 cites D-118` and `tasks.md:114 cites D-118`, because this feature's own plan cites the decision that it had not yet written. Appending the decisions D-118 to D-121 to `docs/DECISIONS.md` made it green. The guard works.
- A1509 passed on its first run, so it got a mutant: a second `### D-050` heading -> `AssertionError: expected [ 'D-050 on lines 402, 1198' ] to deeply equal []`. A1510 mutant: a citation of a number with no heading (a 999) appended to `docs/CUTOVER.md` -> the guard named `docs/CUTOVER.md:31`. Both restored with `git checkout` or a saved copy.
- Suite: 139 files, 1829 passed, 0 failed. Typecheck and lint clean.
- refactor: none needed.
- commit: `f179478`

## Group 5: the private temporary directory (U1524 to U1528, A1511)

Step 1, the unit tests with a stub (`createPrivateTmpdir` returned `{ dir: "", restore() {} }`):

- Three of the five tests passed vacuously against the stub (U1525, U1527, U1528 only asserted the state after `restore`). Before any implementation they were strengthened to assert the state before `restore` as well (the directory exists, `TMPDIR` points at it). That is a stronger test, not a weaker one.
- red: `pnpm vitest run test/setup/private-tmpdir.test.ts` -> 5 failed
  - U1524 `AssertionError: expected '.' to be '/home/nathanjgaul/.cache/tmp/private-…'`
  - U1525 `AssertionError: expected '/home/nathanjgaul/.cache/tmp/private-…' to be ''`
  - U1526 `AssertionError: expected '.' to be '/home/nathanjgaul/.cache/tmp'`
  - U1527 `AssertionError: expected [ 'bb-fake-plugin-host-other-run' ] to deeply equal [ '', 'bb-fake-plugin-host-other-run' ]`
  - U1528 `AssertionError: expected '/home/nathanjgaul/.cache/tmp/private-…' to be ''`
- Note: the stub's empty `dir` made U1525 write `bb-fake-plugin-host-abc/nested/data.db` into the repository root. I removed that stray directory by hand before the commit.

Step 2, the acceptance test with an empty setup file (`private-tmpdir.setup.ts` held only a comment):

- The test runs a child `vitest` process with a private `TMPDIR` twice. A control run with no setup file must leave three host directories (two fixtures, three hosts), and the real run must leave none and still report the failing fixture.
- red: `pnpm vitest run test/acceptance/tmpdir-leak.test.ts` -> `AssertionError: expected [ 'bb-fake-plugin-host-20gNLe', …(2) ] to deeply equal []` (the control passed with three leaks, and the run with the empty setup file leaked the same three).
- A first attempt failed on the child's colored summary line, so the child now runs with `NO_COLOR=1`. That is a test fix made before any implementation.

Step 3, green:

- `test/setup/private-tmpdir.ts` implements `createPrivateTmpdir`, `test/setup/private-tmpdir.setup.ts` calls it and registers `afterAll` and a `process.once("exit")` restore, and `vitest.config.ts` lists the setup file.
- `pnpm vitest run test/setup test/acceptance/tmpdir-leak.test.ts` -> 2 files, 6 passed.
- Measure (A1512): the same full suite with a fresh `TMPDIR` each time. Without the setup file: 139 files, 1829 passed, `find $TMPDIR -maxdepth 1 -name 'bb-fake-plugin-host-*'` -> 394. With the setup file: 141 files, 1835 passed, `find $TMPDIR -name 'bb-fake-plugin-host-*'` -> 0, and `ls $TMPDIR` -> empty.
- Suite: 141 files, 1835 passed, 0 failed. Typecheck and lint clean.
- refactor: none needed. The setup is split into a pure module (`private-tmpdir.ts`) and a hook file (`private-tmpdir.setup.ts`), so the unit tests do not register hooks. That split was part of the first design and is not a refactor.
- commit: `06b107f`

## Note: the guard flagged this log

After group 4 the guard `[A1510]` failed on this file, because the group 4 entry quoted the stub's sentinel number and the number of a mutant, and neither has a heading.
The entry was reworded to cite no such number.
Nothing else in it changed.
