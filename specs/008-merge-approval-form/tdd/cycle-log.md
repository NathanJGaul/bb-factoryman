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
