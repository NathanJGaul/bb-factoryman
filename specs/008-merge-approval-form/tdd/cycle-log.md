# Cycle log: Merge approval form in the web UI

Append only.
Newest last.
Every entry's `red` block is the evidence that the test existed and failed before the implementation.
The group commits its tests with stubs first, so git history shows the order.

## Baseline

- suite: `pnpm test` -> 92 files, 1134 passed, 0 failed
- commit: `bbfdb15`

## Setup before the first cycle (tasks T1201 to T1203)

The plan fixed these dependency and configuration changes, and they carry no behavior of their own.
Commit `576154c`: `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@testing-library/react`, `@testing-library/dom`, and `jsdom` as dev dependencies; `jsx` and the `DOM` lib in `tsconfig.json`; `*.test.tsx` in the `vitest` include.
A throwaway `.tsx` test confirmed that JSX runs under jsdom and was deleted before the commit.
The suite stayed green (92 files, 1134 passed), and `tsc6 --noEmit` and `eslint .` passed.
The profile says setup adds no dependency "as a side effect"; this was not a side effect but a step of the approved plan (`plan.md`, technical context).

## Group 1: the type check runs with `tsc6` (A1214, A1215)

The `tsconfig.json` change of the setup commit existed before the test for A1215, which would have made the test pass on its first run.
To get a real red, the cycle reverted `lib` and `jsx` in `tsconfig.json` to their old values, wrote the tests, observed them fail, and then restored the file.

- test: `test/acceptance/manifest.test.ts` `[A1214]` and `[A1215]` (new)
- red: `pnpm vitest run test/acceptance/manifest.test.ts` -> 2 failed, 2 passed
  - `[A1214]`: `AssertionError: expected 'tsc --noEmit' to match /^tsc6(\s|$)/`
  - `[A1215]`: `AssertionError: expected undefined to be 'react-jsx'`
- bug reproduction (T1241): `env -i HOME=$HOME PATH=<node bin>:/usr/bin:/bin pnpm exec sh -c 'tsc --noEmit'` -> `tsc: command not found`
- green: `package.json` `typecheck` is now `tsc6 --noEmit`, and `tsconfig.json` is back to the setup state.
  - `env -i HOME=$HOME PATH=<node bin>:/usr/bin:/bin pnpm run check` -> typecheck, lint, and `vitest` pass: 92 files, 1136 passed, 0 failed.
- refactor: none needed
- commit: see git history, "fix: type-check with tsc6 so pnpm run check needs no global tsc"

## Group 2: the browser side imports no server code (A1221, task T1204)

- test: `test/acceptance/lint-isolation.test.ts` `[A1221]` (three tests, new): server imports fail lint in each browser-side file, the frontend's own imports pass, and the same imports pass in server files and in the browser side's tests.
- red: `pnpm vitest run test/acceptance/lint-isolation.test.ts` -> 1 failed, 13 passed
  - `[A1221] fails lint on a server-side import in each browser-side file`: `AssertionError: src/app.tsx importing a node: built-in: expected [] to have a length of 1 but got +0`
  - The other two `[A1221]` tests passed on their first run. They guard against a rule that restricts too much, so there was nothing to fail before the rule existed.
- deliberate mutants, run after green (the tests must fail with the rule broken, and the rule was restored byte for byte):
  - allow-list entry for `@get-bb/plugin-sdk/app` removed -> `[A1221] passes lint on the imports that the frontend needs` failed: `src/app.tsx: import { definePluginApp } from "@get-bb/plugin-sdk/app";: expected [ Array(1) ] to deeply equal []`
  - test-file exemption removed -> `[A1221] passes lint on the same server-side imports outside the browser side, and in the browser side's own tests` failed: `expected [ …(2) ] to deeply equal []`
- green: `eslint.config.js` gained a browser-side block for `src/app.tsx`, `src/app/**`, and `src/approval/**` (tests excluded). It bans Node built-ins, `better-sqlite3`, `zod`, the backend SDK root and every SDK subpath except `app`, and every other entry of `src/`, read from the directory.
  - One lint error on the way: `URL` is undefined in the config file, so it uses `import.meta.dirname`.
  - `pnpm run check` -> 92 files, 1139 passed, 0 failed
- refactor: none needed
- commit: see git history, "feat: keep the frontend free of server imports with a lint rule"

## Group 3: the contract module (U1201 to U1212)

One red run for the whole group, because the twelve behaviors share one small file and each test fails or passes alone.
The stub `src/approval/contract.ts` had the real exports with wrong bodies: an empty renderer id, a reader that returns `null`, and a builder that returns only the decision.

- test: `src/approval/contract.test.ts` (new, twelve tests, `[U1201]` to `[U1212]`)
- red: `pnpm vitest run src/approval/contract.test.ts` -> 6 failed, 6 passed
  - `[U1201]`, `[U1206]`: `AssertionError: expected null to deeply equal { taskId: 't1', branch: 'fm/t1', …(2) }` and `... { taskId: '', branch: '', …(2) }`
  - `[U1208]`: `AssertionError: expected { decision: 'approved' } to strictly equal { decision: 'approved', …(1) }`
  - `[U1209]`: `AssertionError: expected { decision: 'approved' } to strictly equal { decision: 'approved', comment: 'a' }`
  - `[U1211]`: `AssertionError: expected null to deeply equal { taskId: 't1', branch: Any<String>, … }`, and the renderer id check before it passed because the stub's id is read from the real form
  - `[U1212]`: `AssertionError: expected '' to be 'factoryman-merge-approval'`
  - Passed against the stub, as expected for a stub that returns `null` and drops the comment: `[U1202]` to `[U1205]` (a `null` answer is right for a wrong shape), `[U1207]`, `[U1210]`. The deliberate mutants below show that these tests can fail.
- deliberate mutants, run after green on the finished module (the file was restored byte for byte after each):
  - field-count check removed -> `[U1205]` failed
  - `evidence` type check removed -> `[U1204]` failed
  - `null` check removed -> `[U1202]` failed (`Object.keys(null)` throws)
  - blank comment kept as an `undefined` key -> `[U1207]`, `[U1209]` failed
  - stray field added to the answer -> `[U1208]`, `[U1209]`, `[U1210]` failed
  - comment not trimmed -> `[U1208]`, `[U1209]` failed
  - `[U1203]` (a missing field) is also caught by the field-count check, so no single-line mutant isolates it; `[U1204]` and `[U1205]` cover the checks beneath it.
- green: `src/approval/contract.ts` (no imports) with the id, `MergeRequestPayload`, `readMergePayload`, `ApprovalAnswer`, and `answerFor`.
  - The first `pnpm run check` after the module failed lint: `27:24 error '_omitted' is assigned a value but never used` in the `[U1203]` test. This entry first claimed a passing check before that run was read, and the commit that carried the claim was amended. The test now builds the incomplete object with `delete`, and the re-run of `pnpm run check` exited 0: 93 files, 1151 passed, 0 failed.
- refactor: none needed
- not done in this group: U1213 stays `BASELINE` and task T1207 (make `src/tools/merge.ts` use the contract module) is left for `/speckit.implement`, because the loop never ticks a task whose behavior is a baseline. `src/tools/merge.ts` keeps its own copy of the id until then, and `[U1211]` pins that both sides agree.
- commit: see git history, "feat: add the approval contract module shared by the merge tool and the form"

## Group 4: approve in the form (A1201 to A1205, A1220, U1220, U1221, U1223 to U1226, U1229, U1230)

User story 1. The tests came first, against stubs: `src/app/merge-approval-form.tsx` rendered `null`, and `src/app.tsx` registered nothing.
U1237 (accessible names of Approve, Deny, and Cancel) waits for group 5, because Deny and Cancel do not exist yet.

- tests: `src/app/merge-approval-form.test.tsx` (eight tests, new), `test/acceptance/merge-approval-form.test.tsx` (five tests, new), `[A1220]` in `test/acceptance/manifest.test.ts`, and the fixture `test/fixtures/approval-form.ts`
- red 1: the acceptance file failed in `loadWorld` with `TypeError: The URL must be of scheme file` (`test/fixtures/skills.ts:13`). Under jsdom the global `URL` is not Node's class, and `fs` rejects it. That is a broken fixture and not a red for the behavior, so the cycle fixed the fixture first (commit "test: read skill names by path so the plugin host loads under jsdom", a structural change: the suite did not change) and ran again.
- red 2: `pnpm vitest run src/app/merge-approval-form.test.tsx test/acceptance/merge-approval-form.test.tsx test/acceptance/manifest.test.ts` -> 14 failed
  - the eight component tests, against the `null` stub: `TestingLibraryElementError: Unable to find an element with the text: Task, which matches selector 'dt'`, `Unable to find an accessible element with the role "button" and name "Approve"`, and `... the role "textbox"`
  - `[A1201]`: `AssertionError: expected [] to deeply equal [ 'factoryman-merge-approval' ]`
  - `[A1202]` to `[A1205]`: `Error: no renderer is registered for factoryman-merge-approval`
  - `[A1220]`: `AssertionError: expected undefined to be './src/app.tsx'`
- green: `src/app/merge-approval-form.tsx` (the request list, the comment field, Approve, the in-flight state), `src/app.tsx` (`definePluginApp` with the `pendingInteraction` slot), and `bb.app` in `package.json`.
  - A first green attempt showed two things the unit tests could not. The acceptance test mounted the renderer with plain `render`, and `UrlLink` needs the harness: `Error: UrlLink() needs the test slot environment — mount the component via renderSlot(...)`. The test was wrong, and it now mounts through `renderSlot`, as the SDK documents.
  - `pnpm run check` then failed in `tsc6`: `src/app/merge-approval-form.tsx(56,18): error TS2345: Argument of type 'ApprovalAnswer' is not assignable to parameter of type 'JsonValue'`. vitest does not type-check, so only the gate saw it. `ApprovalAnswer` became a type alias, which is assignable to a JSON object type (an interface is not).
  - A leftover helper tripped lint (`'Fact' is defined but never used`) and was deleted.
  - Final: `pnpm run check` exited 0 -> 95 files, 1165 passed, 0 failed.
- refactor: none beyond deleting the unused helper
- not done on purpose: the pull request link is not yet guarded against non-`http(s)` values (U1222, group 6 writes that test first), a rejected answer is not caught (U1231, group 6), and the Deny and Cancel buttons come in group 5.
- commit: see git history, "feat: show the merge approval form in the web UI and approve from it"

## Group 5: deny and cancel (A1206 to A1208, U1227, U1228, U1237)

User story 2. The tests were written against the group 4 form, which has only Approve.

- tests: `[U1227]`, `[U1228]`, `[U1237]` in `src/app/merge-approval-form.test.tsx`, and `[A1206]` to `[A1208]` in `test/acceptance/merge-approval-form.test.tsx`
- red: `pnpm vitest run src/app test/acceptance/merge-approval-form.test.tsx` -> 6 failed, 25 passed
  - `[U1227]`, `[A1206]`, `[A1207]`: `TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Deny"`
  - `[U1228]`, `[A1208]`: `... the role "button" and name "Cancel"`
  - `[U1237]`: `AssertionError: expected [ 'Approve' ] to deeply equal [ 'Approve', 'Deny', 'Cancel' ]`
- green: `src/app/merge-approval-form.tsx` shares one `run(action)` for the three buttons (the in-flight guard and the phase), and adds Deny (outline) and Cancel (ghost). `pnpm run check` exited 0 -> 95 files, 1171 passed, 0 failed.
- refactor: the single `approve()` became `run(action)` in the same step, because the second and third button would have copied it. The suite stayed green.
- commit: see git history, "feat: deny or cancel a merge from the approval form"

## Group 6: never approve blind, never fail open (A1209 to A1213, U1222, U1231 to U1236, U1238, U1239)

User story 3. The tests ran against the group 5 form.

- tests: `[U1222]`, `[U1231]` to `[U1236]`, `[U1238]`, `[U1239]` in `src/app/merge-approval-form.test.tsx`, and `[A1209]` to `[A1213]` in `test/acceptance/merge-approval-form.test.tsx` (the mount helper gained a payload override, an expiry, and a first-submit failure)
- red: `pnpm vitest run src/app test/acceptance/merge-approval-form.test.tsx` -> 10 failed, 35 passed
  - `[U1222]`, `[A1211]`: `AssertionError: javascript:alert(1): expected <a …(1)></a> to be null` (the form linked every value; React replaces the `javascript:` href with a throwing stub, and the anchor still exists)
  - `[U1231]`, `[U1232]`, `[A1210]`: `TestingLibraryElementError: Unable to find an accessible element with the role "alert"`, plus an unhandled `Error: bb said no` from the rejected `submit`
  - `[U1233]`, `[A1209]`: `Unable to find an accessible element with the role "alert"`
  - `[U1234]`: `Unable to find an accessible element with the role "button" and name "Deny"` (an unreadable payload rendered nothing)
  - `[U1235]`, `[A1213]`: `AssertionError: expected undefined to be '2026-11-08T15:30:00.000Z'`
  - Passed against the group 5 form on the first run: `[U1236]`, `[U1238]`, `[U1239]`, `[A1212]`. They guard properties that the markup already had (no `<form>`, wrapping and scrolling classes, theme tokens), so the deliberate mutants below show that they can fail.
- deliberate mutants, run after green on the finished component (restored byte for byte after each):
  - the root element becomes a `<form>` that approves on submit -> `[U1236]` failed
  - `max-h-64` removed from the evidence -> `[U1238]`, `[A1212]` failed
  - `overflow-y-auto` removed -> `[U1238]`, `[A1212]` failed
  - `break-all` removed from the branch -> `[U1238]`, `[A1212]` failed
  - `text-muted-foreground` swapped for `text-red-500` -> `[U1239]` failed
  - the in-flight flag not reset after a failure -> `[U1231]`, `[A1210]` failed
  - the comment cleared on a press -> `[U1231]`, `[A1210]` failed
- green: `src/app/merge-approval-form.tsx` gained `isWebUrl` (only `http:` and `https:` become links), a `try`/`catch` in `run` that shows the failure in a `role="alert"` line and re-enables the controls, the unreadable notice with no Approve, and the expiry line in a `<time>` element. `pnpm run check` exited 0 -> 95 files, 1185 passed, 0 failed.
- refactor: the pull request cell moved into its own `PullRequest` component and the request list into `Request`, in the same step, to keep `MergeApprovalForm` readable. The suite stayed green.
- commit: see git history, "feat: make the approval form fail closed on an unreadable request and keep the owner's work on error"

## Group 7: the runbook and the decision log (A1216 to A1218, task T1250 to T1252)

User story 5. One existing test was wrong, and it was fixed as its own step before the docs changed.

- test change with a stated reason: `[A1109]` in `test/acceptance/live-check.test.ts` asserted `expect(text).toMatch(/bb factoryman preflight server --project \$PROJ/)`, which pinned the defect that the live check found (finding 5.3: the lab's machine is named after the host, not `server`). The assertion became `expect(text).not.toMatch(/preflight server\b/)`. This tightens the test: it failed against the old runbook (`AssertionError: expected '# Live check runbook ...' not to match /preflight server\b/`) and passes against the new one. Nothing was loosened, skipped, or deleted.
- tests: `[A1216]`, `[A1217]`, `[A1218]` (new, in the same file)
- red: `pnpm vitest run test/acceptance/live-check.test.ts` -> 4 failed, 9 passed
  - `[A1109]`: `AssertionError: expected '# Live check runbook ...' not to match /preflight server\b/`
  - `[A1216]`: `AssertionError: a command that reads the machine name: expected [] to have a length of 1 but got +0`
  - `[A1217]`: `AssertionError: Approve: expected '**Ship task.**\nSend the supervisor: …' to contain 'Approve'`
  - `[A1218]`: `AssertionError: D-094 should have an entry: expected -1 to be greater than -1`
- green: `docs/LIVE-CHECK.md` reads the machine name with `MACHINE=$(bblab x bb machine list --json | jq -r '.[0].name')`, the preflight row uses `"$MACHINE"`, the ship task step describes the form and its three buttons (and the Chromium note for a browser tool), and the section 9 bullet says that a browser tool drove the form and that nobody has watched a person use it. `docs/DECISIONS.md` has D-094 to D-098. `.specify/memory/tdd-profile.md` notes the `.tsx` tests, the new fixture, and the `tsc6` type check.
  - `pnpm run check` exited 0 -> 95 files, 1188 passed, 0 failed.
- refactor: none needed
- open: the runbook text and D-094 to D-098 are written from what the plan and the tests know. The lab run (A1219, tasks T1260 to T1264) may change the frame and Cancel decision, and then D-097 and the ship step change with it.
- commit: see git history, "docs: describe the approval form in the runbook, read the machine name, and record D-094 to D-098"

## Group 8: the live check in the lab, and the pixel pass (A1219, U1240, tasks T1260 to T1264)

The outer loop closes in the isolated lab, with a real browser tool clicking in bb's real web UI. The report is `data/bb-factoryman-approval-form/lab-check.md` in the firstmate home, and the screenshots sit beside it.

- setup: `bblab` with bb 0.49.0, the plugin built and installed from a clean copy of the worktree with `bb plugin build` (`dist/app.js` 8.4 KB with no `zod`, `dist/app.css` 24.6 KB with the form's classes compiled to the host's CSS variables), the stub agent from the live check report, a `local-only` project and a `direct-PR` project.
  - The first lab directory was under `/tmp`, and the plugin build failed there: `npm error TAR_ENTRY_ERROR Unknown system error -122` (a quota-limited tmpfs). The lab moved to `/var/tmp/bblab-approval-form` and was removed after the run.
- the original defect, reproduced: with `bb.app` removed from the lab copy, bb shows "The plugin form is unavailable. Cancel to continue." and one Cancel button (`00-before-no-frontend-form-unavailable.png`).
- A1219, clicked in the real UI (first build, before the pixel pass):
  - **Deny** with the comment `Not before the release.` -> `approval` row `denied`, `record_approval` with `actor: user`, no merge, task `awaiting_approval`.
  - **Cancel** -> no new approval row, task `awaiting_approval`.
  - **Approve** with the comment `Reviewed the diff. Ship it.` -> `approval` row `approved`, `record_approval` (`user`), `merge`, task `merged`, merge commit `6a38db3` in the clone.
- the pixel pass found one defect that jsdom can express:
  - the pull request URL was an anchor with no underline and no color, so it read as plain text. New behavior `U1240` went on the list first.
  - red: `pnpm vitest run src/app/merge-approval-form.test.tsx -t "U1240"` -> `AssertionError: expected '' to contain 'underline'`
  - green: the link got `underline underline-offset-2` and a focus ring. `pnpm run check` exited 0 -> 95 files, 1189 passed, 0 failed.
- layout-only changes, made with the suite green and no test changed: the expiry line moved from between the evidence and the comment field to below the buttons, as a small muted line, and the comment label lost its bold weight, to match the other labels.
- final bundle, clicked again on a second task: **Deny** (`Final check: denied from the real UI.`), then **Approve** (`Final check: approved from the real UI.`) -> two approval rows, `merge`, task `merged`, merge commit `527ff71`.
- checked and fine in the real UI: dark theme, a 420 px width, long evidence (24 lines and a 260-character unbroken token scroll and wrap inside the block), the keyboard focus ring on the link and on Approve.
- isolation: `bblab down`; ports 48886 and 48887 free; tripwire 0 file-level events; the shared no-mistakes daemon unchanged (pid 970, active); the real `~/.bb` and the hosted daemon untouched. The `bblab-evidence diff` line "LEAK: lab process visible on host" names another lane's lab (worktree slot 3, ports 48896 and 48897), not this one: no process of this lab was left.
- not covered by the lab: an unreadable request and a rejected answer (the tests cover both), and a person's own click (tier 2).
- commit: see git history, "feat: underline the pull request link in the approval form and tidy its layout"

## Group 9: two behaviors that the audit found unpinned (U1241, U1242)

The audit (`tdd/verification.md`, finding 6, task T1285) found two mutants that no test caught.
Both behaviors already existed in the component, so a new test passes on its first run.
The cycle therefore follows the playbook's rule for code that predates its test: revert the behavior, write the test, observe the red, restore.
Neither behavior was implemented test-first in the first place, and both are admitted here as test-after code with a revert-red.
The two cycles share one commit, because both tests sit in one file.

### Cycle U1241: a retry that succeeds clears the failure banner

- test: `src/app/merge-approval-form.test.tsx::[U1241]` (new)
- revert: `setFailure(null);` removed from `run` in `src/app/merge-approval-form.tsx` (the audit's mutant M26)
- red: `pnpm vitest run src/app/merge-approval-form.test.tsx -t "U1241"` -> `AssertionError: expected <p role="alert" …(1)></p> to be null` (1 failed)
- restore: `git checkout -- src/app/merge-approval-form.tsx`, and `git diff --quiet` on the file confirmed it. Same command -> 1 passed.
- refactor: none needed

### Cycle U1242: the pull request link goes through bb's navigation

- test: `src/app/merge-approval-form.test.tsx::[U1242]` (new). It clicks the link and reads `slot.inspection.navigateCalls` from the harness.
- revert: `<UrlLink ...>` replaced by a plain `<a ...>` (the audit's mutant M27)
- red: `pnpm vitest run src/app/merge-approval-form.test.tsx -t "U1242"` -> `AssertionError: expected [] to deeply equal [ { method: 'openUrl', …(1) } ]` (1 failed)
- restore: `git checkout -- src/app/merge-approval-form.tsx`, clean. Same command -> 1 passed.
- refactor: none needed

- suite after both: `pnpm run check` exited 0 -> 95 files, 1191 passed, 0 failed.
- commit: see git history, "test: pin the retry banner and the link navigation that the audit found unpinned"

## Remediation 1: the four weak-test findings of the audit (tasks T1280 to T1283)

These strengthen tests that already exist. No behavior changed and no test was weakened.
Each strengthened test was checked against the mutant that had survived it, re-applied by hand and restored with `git checkout`.

- finding 1, `[U1240]` (`src/app/merge-approval-form.test.tsx`): the test asserted `className` contains the text `underline`, which `underline-offset-2` also contains. It now asserts `link.classList.contains("underline")`. Mutant M22 (the `underline` class deleted) now fails `[U1240]`.
- finding 2, `[U1235]` and `[A1213]`: the expected `datetime` is now the literal `2026-11-08T15:30:00.000Z` and no longer `new Date(expiresAt).toISOString()`, the call that the component makes. Both tests also assert that the visible `<time>` text contains `2026`. Mutant M28 (the visible date from `new Date(0)`) now fails `[U1235]` and `[A1213]`.
- finding 3: the three `toBeTruthy()` assertions after a `getByRole` are gone. `[U1233]` now asserts that Deny and Cancel are not disabled, and `grep -n toBeTruthy src/app/merge-approval-form.test.tsx` prints nothing.
- finding 4, `[A1210]`: the three lines that the test's own `submit` wrapper guaranteed (no approvals, `awaiting_approval`, one pending form) are gone. After the successful retry the test asserts that exactly one approval row exists, `approved`, and that the task is `merged`. The test name now says so.
- mutants M26 and M27, the survivors of finding 6, are killed by the group 9 tests (`[U1241]`, `[U1242]`).
- gate: `pnpm run check` exited 0 -> 95 files, 1191 passed, 0 failed.
- commit: see git history, "test: strengthen the underline, expiry, and retry tests and drop vacuous assertions"

## Retroactive red for the five behaviors that the audit classed test-after (task T1284)

The audit (`tdd/verification.md`, finding 5) classed A1215, U1236, U1238, U1239, and A1212 as `TEST_AFTER`, because the code that they check was committed before the test.
The history cannot change. This entry re-proves, for each one, that the test fails when the property it guards is removed.
Each mutant was applied by hand to the committed file, the command below ran against it, and `git checkout` restored the file (and `git diff --quiet` confirmed it). The failure lines are copied from the run.

- `[A1215]`, mutant: `tsconfig.json` without the `jsx` line
  - command: `pnpm vitest run test/acceptance/manifest.test.ts -t "A1215"`
  - failure: `AssertionError: expected undefined to be 'react-jsx' // Object.is equality` (Tests  1 failed | 4 skipped (5))
  - restored and clean: yes
- `[U1236]`, mutant: the root element is a `<form>` (the closing tag is left as it is, which React tolerates in a test)
  - command: `pnpm vitest run src/app/merge-approval-form.test.tsx -t "U1236"`
  - failure: `Error: Transform failed with 1 error:` (Tests  no tests)
  - restored and clean: yes
- `[U1238]`, mutant: `max-h-64` removed from the evidence
  - command: `pnpm vitest run src/app/merge-approval-form.test.tsx -t "U1238"`
  - failure: `AssertionError: expected 'col-span-2 m-0 min-w-0 overflow-y-aut…' to contain 'max-h-64'` (Tests  1 failed | 22 skipped (23))
  - restored and clean: yes
- `[U1238]`, mutant: `overflow-y-auto` removed from the evidence
  - command: `pnpm vitest run src/app/merge-approval-form.test.tsx -t "U1238"`
  - failure: `AssertionError: expected 'col-span-2 m-0 max-h-64 min-w-0 white…' to contain 'overflow-y-auto'` (Tests  1 failed | 22 skipped (23))
  - restored and clean: yes
- `[U1238]`, mutant: `break-all` removed from the branch
  - command: `pnpm vitest run src/app/merge-approval-form.test.tsx -t "U1238"`
  - failure: `AssertionError: expected 'm-0 min-w-0 font-mono' to contain 'break-all'` (Tests  1 failed | 22 skipped (23))
  - restored and clean: yes
- `[U1239]`, mutant: a fixed palette color (`text-red-500`) on the Task label
  - command: `pnpm vitest run src/app/merge-approval-form.test.tsx -t "U1239"`
  - failure: `AssertionError: expected 'import { useId, useRef, useState, typ…' not to match /\b(?:bg|text|border|ring|fill|stroke|…/` (Tests  1 failed | 22 skipped (23))
  - restored and clean: yes
- `[A1212]`, mutant: `max-h-64` removed from the evidence
  - command: `pnpm vitest run test/acceptance/merge-approval-form.test.tsx -t "A1212"`
  - failure: `AssertionError: expected 'col-span-2 m-0 min-w-0 overflow-y-aut…' to match /max-h-\d+/` (Tests  1 failed | 12 skipped (13))
  - restored and clean: yes

### Correction to the `[U1236]` line above

The `[U1236]` mutant above changed the opening tag of the root element and left the closing tag as `</div>`. That is a syntax error, and the run failed with `Error: Transform failed with 1 error:` and `Tests  no tests`. It is not a red for the behavior, and the sentence that "React tolerates" the mismatch is wrong. This run replaces it: the opening and the closing tag both became `form`.

- `[U1236]`, mutant: the root element is a `<form>` (both tags)
  - command: `pnpm vitest run src/app/merge-approval-form.test.tsx -t "U1236"`
  - failure: `AssertionError: expected <form role="group" …(3)>…(3)</form> to be null` (Tests  1 failed | 22 skipped (23))
  - restored and clean: yes

## Structural change T1207: `src/tools/merge.ts` takes the renderer id and the payload type from the contract module

A refactor on green code (behavior `U1213` stays a `BASELINE`, and its test `src/tools/merge.test.ts::[U89]` stayed green and unchanged).

- `src/tools/merge.ts` no longer declares `MERGE_RENDERER_ID`. It imports the id from `src/approval/contract.ts`, builds the form's payload in a function typed `MergeRequestPayload`, and types `approvalAnswerSchema` with `satisfies z.ZodType<ApprovalAnswer>`.
- One compile error on the way: `src/tools/merge.ts(88,7): error TS2322: Type 'MergeRequestPayload' is not assignable to type 'Record<string, Json>'`. An interface is not assignable to a JSON object type, so `MergeRequestPayload` became a type alias (as `ApprovalAnswer` did in group 4). The suite does not type-check, so only `pnpm run check` showed it.
- gate: `pnpm run check` exited 0 -> 95 files, 1191 passed, 0 failed. No test changed.
- commit: see git history, "refactor: let the merge tool take the renderer id and the payload type from the contract module"

## Remediation 2: the medium and low findings of the audit (tasks T1286 to T1293)

These change tests that already exist, and none of them weakens one. The suite grew from 1191 to 1254 tests, because `it.each` reports each case on its own.
The audit's mutants were re-applied by hand and restored with `git checkout`.

- finding 7, `[U1239]` (`src/app/merge-approval-form.test.tsx`): the color check is now a list of patterns: hex colors, a fixed palette color in any utility (`-red-500`, so `border-t-red-500` and `shadow-red-500` too), `-white` and `-black`, arbitrary color values (`[rgb(`, `[#`), and inline `style={`. A test per sample proves that the patterns flag `text-red-500`, `border-t-red-500`, `shadow-red-500`, `bg-white`, `text-[rgb(1,2,3)]`, `style={{ color: "red" }}`, and `#fff`, and that they accept `bg-foreground`, `hover:bg-state-hover`, `whitespace-pre-wrap`, and the other tokens that the form uses. Each of the four forms that the old pattern missed (`border-t-red-500`, `shadow-red-500`, `text-[rgb(1,2,3)]`, an inline `style`), and `bg-white`, was put into the component and fails `[U1239]`. `[U1220]` and `[U1238]` are renamed to say that they check class tokens.
- finding 8: the case loops in `src/approval/contract.test.ts` and `merge-approval-form.test.tsx` became `it.each` (`[U1202]` to `[U1204]`, `[U1207]`, `[U1209]`, `[U1210]`, `[U1221]`, `[U1222]`, `[U1233]`), and the tests with two scenarios were split (`[U1226]`, `[U1227]`, `[U1234]`, `[U1235]`, `[A1204]`, `[A1209]`, `[A1213]`). `[A1208]` is one scenario (cancel, then ask again), so it keeps both forms and unmounts the first renderer with its own `unmount`. No `cleanup()` call is left inside a test. The `act(click)` block became a `press` helper.
- finding 9: removed the repeated assertions: the `build` line of `[A1220]`, the `preflight server` line of `[A1216]` (`[A1109]` holds it), the `gh pr merge --squash` line of `[A1203]` (`tools-merge` `[A8]` holds it), and the second renderer-id regular expression of `[U1212]`. `[A1211]` to `[A1213]` stay: each is the one acceptance test of its criterion that reaches the renderer through the app's registry, and the audit's note that an acceptance test and a unit test for one criterion are not a duplicate applies.
- finding 10: `mountRenderer` builds the renderer's props with `formHarness`, which gained `id`, `threadId`, and `title` options.
- finding 11: the `zod` stray-field assertion of `[U1210]` and the `node_modules/.bin/tsc6` check of `[A1214]` are gone. `pnpm run check` under `env -i` still passes with no global `tsc` (see the first group).
- finding 12: `[A1215]` reads `include`, `exclude`, and `lib`, compares `DOM` without regard to case, and fails when `exclude` hides part of `src`. A mutant that adds `"exclude": ["src/app"]` fails it, and a lower-case `dom` passes, as intended.
- finding 13: `[A1217]` asserts that the web UI sentence comes before the scripted-answer sentence, and `[A1218]` asserts that D-095 is an `Open` decision. A mutant that swaps the two sentences fails `[A1217]`, and one that marks D-095 `Decided` fails `[A1218]`.
- finding 14: named the literals (`CREATED_AT`, `EXPIRES_AT`), added `disabledControls()` so that a failure names the control, and gave the three `[A1221]` tests the ids `[A1221a]`, `[A1221b]`, and `[A1221c]` (the test list names all three).
- regression sample after all of it: mutants M01, M02, M03, M05, M09, M14, M19, M22, M26, M27, and M28 are still killed (M09 now also by `[U1241]`).
- gate: `pnpm run check` exited 0 -> 95 files, 1254 passed, 0 failed.
- commit: see git history, "test: name each case, split multi-scenario tests, and tighten the config and docs checks"

## Close-out checks (tasks T1270 and T1272)

- `pnpm run check` exited 0 -> typecheck (`tsc6`), lint, and 95 files with 1254 tests passed, 0 failed (the audit's run at `497f69c` had 1189 tests; the groups 9 and the remediations added behaviors U1241 and U1242 and turned case loops into `it.each`).
- `BB_CLI_ERROR_LOG=0 pnpm run build` exited 0 and wrote `dist/server.js`, `dist/app.js` (8.4 KB, no `zod`), `dist/app.css`, and the three `*.meta.json` files. `dist/` is git-ignored, and I removed it afterwards. The real `~/.bb/plugins` listing is unchanged (only the `toolchain-0.28.1-4.3.0-4.3.0-4.3.0` cache from 2026-11-05).
- The worktree holds no lab file: the lab ran in `/var/tmp/bblab-approval-form`, which I removed, and the scratch files sit in the scratchpad.
- every acceptance behavior (`A1201` to `A1221`) is `DONE` in `tdd/test-list.md`. `A1219` has its 20 screenshots and `lab-check.md` in `data/bb-factoryman-approval-form/` in the firstmate home. `U1213` stays a baseline.

## Remediation 3: survivors and defects from the second audit

The second audit (a fresh-context subagent plus my own 45 mutants) found two weak spots, one structural defect of mine, and several smaller items. The subagent's mutant run stopped early, because `/tmp` hit its per-user disk quota. I ran the contract and entry mutants myself.

- survivor, `onChange` trims the typed text (`setComment(event.target.value.trim())`, mutant M35): the field would not let the owner type a space between words, and every test passed, because the answer is trimmed anyway. `[U1226]` and `[A1204]` now assert that the field keeps the text exactly as typed, spaces included. M35 now fails `[U1226]` and `[A1204]`.
- survivor, `protocol.startsWith("http")` (M36): `httpx://...` would render as a link, against FR-1207. `[U1222]` and `[A1211]` now include `httpx://forge.example/pull/7` (and `[U1222]` also `http-x://forge.example/pull/7`). M36 now fails both.
- survivor, the in-flight guard removed (M29): the second click in the old test landed on an already disabled button. A new `[U1230]` test fires two clicks inside one batch, before the form re-renders. M29 now fails `[U1230]`.
- survivor, a non-`Error` rejection shown as a fixed text (M37), and `aria-busy` left on after the answer settled (M38), and the pull request cell without `break-all` (M39): new assertions in `[U1231]` (a rejection that is a plain string), `[U1229]` (`aria-busy` is off once the answer settles), and `[U1238]` (the pull request cell breaks long URLs). Each mutant now fails its test.
- my own defect, from remediation 2: a string replace that I wrote with the wrong end marker inserted the three new `[U1239]` tests at the top of `src/app/merge-approval-form.test.tsx`, before the `// @vitest-environment jsdom` line and outside any `describe`, and it left the old, weaker `[U1239]` test in place. The suite stayed green, so only the audit saw it. The pragma is on line 1 again, the three tests sit in their own `describe`, and the old test is gone (the new source scan covers everything it checked, and more).
- `[A1109]` now requires every `bb factoryman preflight` call in the runbook to name `"$MACHINE"`. The old assertion (a negative match of one name) passed for any other hard-coded machine name.
- smaller items: `[A1214]` is renamed to what it checks, and the list rows of `A1214` and `U1210` say what the tests assert (no claim about the binary or about a stray field). `[U1231]` is split into three tests. `[A1210]` lost its claim that the fake guarantees by construction. `press`, `typeComment`, and `valueOf` moved into `test/fixtures/approval-form.ts`. The `[A1221]` loops became `it.each`. `[U1242]` cancels the jsdom navigation, which removes a "Not implemented" message. The month argument of `EXPIRES_AT` has a note.
- not changed, with the reason: the class-token tests (`[U1220]`, `[U1238]`, `[A1212]`, `[U1239]`) stay as labelled proxies, because jsdom has no layout and the lab owns the look; `[U1235]` pins the year and not the time of day, because the visible text is locale text; the prose checks of `[A1217]` and `[A1218]` stay phrase checks with an order check and a status check; `[A1211]` to `[A1213]` stay as the registry-level acceptance tests of their criteria; `submitted` in `mountRenderer` stays a hand-kept array; the wording of the failure prefix and of the unreadable notice is unpinned on purpose.
- mutants: the 45 hand-picked mutants (M01 to M39, C01 to C06) are all killed. The first pass of M01 to M08 ran while the quota failure was active and failed whole files for the wrong reason, so those eight were run again alone and are killed for the right reason.
- gate: `pnpm run check` exited 0 -> 95 files, 1310 passed, 0 failed.
- commit: see git history, "test: close the survivors of the second audit and repair the misplaced color tests"
