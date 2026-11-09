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
