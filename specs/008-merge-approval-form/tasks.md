---
description: "Task list for the merge approval form"
---

# Tasks: Merge approval form in the web UI

**Input**: `specs/008-merge-approval-form/spec.md`, `plan.md`, `quickstart.md`, `tdd/test-list.md`
**Tests**: Mandatory. Every behavior has its test task before its code task, and the test is observed failing first (constitution principle V).
A bracketed id such as `[U1201]` ties a task to a behavior in `tdd/test-list.md`. `/speckit.tdd.run` ticks the task when the behavior is done.
The cycle log records the red evidence. Tests are never weakened, skipped, or deleted to reach green.

## Phase 1: Setup

- [X] T1201 Add the dev dependencies `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@testing-library/react`, `@testing-library/dom`, and `jsdom` to `package.json` and `pnpm-lock.yaml` with `pnpm add -D`. Add no runtime dependency.
- [X] T1202 Add `jsx: "react-jsx"` and the `DOM` lib to `tsconfig.json`, and confirm `pnpm exec tsc6 --noEmit` still passes for the server code. If DOM and Node types clash, split a second configuration for the browser files and record it in `docs/DECISIONS.md`.
- [X] T1203 [P] Let `vitest.config.ts` run `src/**/*.test.tsx` and `test/**/*.test.tsx` with automatic JSX. Tests opt in to jsdom with `// @vitest-environment jsdom`.
- [X] T1204 [P] [A1221] Write the red lint test in `test/acceptance/lint-isolation.test.ts`, then add the browser-side import rule to `eslint.config.js` for `src/app.tsx`, `src/app/**`, and `src/approval/**`: no Node built-ins, `better-sqlite3`, `zod`, `@get-bb/plugin-sdk` (root), or server layers.

## Phase 2: Foundational (the contract)

- [X] T1205 [U1201] [U1202] [U1203] [U1204] [U1205] [U1206] [U1207] [U1208] [U1209] [U1210] [U1211] [U1212] Write `src/approval/contract.test.ts` with a stub `src/approval/contract.ts` that fails each test for the right reason: the payload reader accepts the real payload and rejects each wrong shape; the answer builder trims and drops a blank comment; every `answerFor` result passes `approvalAnswerSchema`; the id matches bb's pattern.
- [X] T1206 [U1201] [U1202] [U1203] [U1204] [U1205] [U1206] [U1207] [U1208] [U1209] [U1210] [U1211] [U1212] Implement `src/approval/contract.ts` (no imports) with `MERGE_RENDERER_ID`, `MergeRequestPayload`, `readMergePayload`, `ApprovalAnswer`, and `answerFor`.
- [ ] T1207 [U1213] Make `src/tools/merge.ts` import the id and the payload type from the contract module, and type `approvalAnswerSchema` against `ApprovalAnswer`. The existing `[U89]` test stays green.

## Phase 3: User story 1 - Approve a merge in the web UI (P1)

**Goal**: The owner sees the request in the plugin's own form and approves with one press.
**Independent test**: The acceptance test opens the form through the plugin factory, presses Approve in the registered renderer, and the task ends `merged`.

- [X] T1210 [US1] [U1220] [U1221] [U1223] [U1224] [U1225] [U1226] [U1229] [U1230] [U1237] Write the red tests in `src/app/merge-approval-form.test.tsx` for the labelled facts, the link, the "None" values, the kept line breaks, Approve with and without a comment, the in-flight state, and the accessible names.
- [X] T1211 [US1] [A1201] [A1202] [A1203] [A1204] [A1205] [A1220] Write the red acceptance tests in `test/acceptance/merge-approval-form.test.tsx` (load the app with `loadPluginApp`, open the form through `loadWorld` and `factoryman_merge`, render the registration against the pending request, press Approve) and the `bb.app` manifest test in `test/acceptance/manifest.test.ts`.
- [X] T1212 [US1] [U1220] [U1221] [U1223] [U1224] [U1225] [U1226] [U1229] [U1230] [U1237] Create `src/app/merge-approval-form.tsx` (the labelled list, the evidence block, the comment field, the Approve action, the in-flight state).
- [X] T1213 [US1] [A1201] [A1202] [A1203] [A1204] [A1205] [A1220] Create `src/app.tsx` (`definePluginApp` with the `pendingInteraction` slot) and set `bb.app` in `package.json`.
- [X] T1214 [US1] [A1201] [A1202] [A1203] [A1204] [A1205] [A1220] Outer loop: the story 1 acceptance tests are green and `pnpm test` is green.

## Phase 4: User story 2 - Deny a merge in the web UI (P1)

**Goal**: The owner denies, with an optional comment, and can cancel with no decision.
**Independent test**: The acceptance test presses Deny and the task stays `awaiting_approval` with a `denied` row.

- [X] T1220 [US2] [U1227] [U1228] Write the red tests in `src/app/merge-approval-form.test.tsx` for Deny (with and without a comment) and Cancel.
- [X] T1221 [US2] [A1206] [A1207] [A1208] Write the red acceptance tests in `test/acceptance/merge-approval-form.test.tsx`: Deny, Deny with a comment, and Cancel followed by a new form.
- [X] T1222 [US2] [U1227] [U1228] Add the Deny and Cancel actions to `src/app/merge-approval-form.tsx`.
- [X] T1223 [US2] [A1206] [A1207] [A1208] Outer loop: the story 2 acceptance tests are green and `pnpm test` is green.

## Phase 5: User story 3 - Never approve blind, never fail open (P1)

**Goal**: The form offers no Approve for an unreadable request and keeps the owner's work after an error.
**Independent test**: Render with a malformed payload and with a rejecting `submit`.

- [ ] T1230 [US3] [U1222] [U1231] [U1232] [U1233] [U1234] [U1235] [U1236] [U1238] [U1239] Write the red tests in `src/app/merge-approval-form.test.tsx` for the plain-text pull request, the rejected answer, the unreadable notice, the expiry, Enter in the comment field, the overflow classes, and the theme-token scan.
- [ ] T1231 [US3] [A1209] [A1210] [A1211] [A1212] [A1213] Write the red acceptance tests in `test/acceptance/merge-approval-form.test.tsx` for the unreadable request, the rejected answer, the plain-text pull request, the overflow classes, and the expiry.
- [ ] T1232 [US3] [U1222] [U1231] [U1232] [U1233] [U1234] [U1235] [U1236] [U1238] [U1239] Implement the unreadable state, the failure state, the link guard, the overflow handling, and the expiry line in `src/app/merge-approval-form.tsx`.
- [ ] T1233 [US3] [A1209] [A1210] [A1211] [A1212] [A1213] Outer loop: the story 3 acceptance tests are green and `pnpm test` is green.

## Phase 6: User story 4 - A clean machine can run the check (P2)

**Goal**: `pnpm run check` needs no global `tsc`.
**Independent test**: Run `pnpm run check` with a PATH that holds node and pnpm only.

- [X] T1240 [US4] [A1214] [A1215] Write the red tests in `test/acceptance/manifest.test.ts`: the `typecheck` script calls `tsc6`, `node_modules/.bin/tsc6` exists, and `tsconfig.json` includes `src`, the JSX transform, and the DOM library.
- [X] T1241 [US4] [A1214] [A1215] Change `package.json` `typecheck` to `tsc6 --noEmit`. Run `pnpm run check` under `env -i` with a PATH that holds no `tsc` and record the result in the cycle log.
- [X] T1242 [US4] [A1214] [A1215] Outer loop: the story 4 tests are green and `pnpm test` is green.

## Phase 7: User story 5 - The runbook matches what the owner sees (P2)

**Goal**: The runbook and the decision log are right.
**Independent test**: `test/acceptance/live-check.test.ts` passes.

- [ ] T1250 [US5] [A1216] [A1217] [A1218] Write the red tests in `test/acceptance/live-check.test.ts`: the preflight step reads the machine name and names no machine `server`; the ship step describes the form and keeps the "write down a scripted answer" rule; `docs/DECISIONS.md` holds D-094 to D-098 and says D-030 stays partly open and option 2 is deferred.
- [ ] T1251 [US5] [A1216] [A1217] [A1218] Edit `docs/LIVE-CHECK.md` (preflight row, the web step, the Chromium note, section 9) and add D-094 to D-098 to `docs/DECISIONS.md`. Note the `.tsx` tests and the new fixtures in `.specify/memory/tdd-profile.md`.
- [ ] T1252 [US5] [A1216] [A1217] [A1218] Outer loop: the story 5 tests are green and `pnpm test` is green.

## Phase 8: Live check in the lab

- [ ] T1260 [A1219] Build with `bb plugin build` (check `dist/app.js` and the classes in `dist/app.css`), bring up `bblab`, install the plugin, create the throwaway project, and drive a ship task to `review_ready` with the stub agent from the live check report (tier 1). Keep the lab outside the worktree and outside the firstmate home. Touch no shared daemon and no real bb.
- [ ] T1261 [A1219] Open the supervisor thread in the lab's web UI with `chrome-devtools-axi` (`CHROME_DEVTOOLS_AXI_EXECUTABLE_PATH=/usr/bin/chromium`). Check that the form shows, read the frame, and fix the Cancel duplication or any layout defect.
- [ ] T1262 [A1219] Click **Approve**, then check the task is `merged` with a `user` approval row. Click **Deny** with a comment on a second task and check a `denied` row and no merge. Click **Cancel** on a third and check no row. Save screenshots of the form (light and dark, wide and narrow), the Approve result, and the Deny result under `data/bb-factoryman-approval-form/` in the firstmate home.
- [ ] T1263 [A1219] Fix every pixel defect found (spacing, alignment, focus ring, contrast, wrapping), re-run the affected tests, rebuild, and re-check in the lab until the form is clean in both themes. A defect found only in the lab gets a new behavior in `tdd/test-list.md` first when jsdom can express it.
- [ ] T1264 [A1219] `bblab down`, `bblab-evidence snap after` and `diff`, and confirm the shared no-mistakes daemon, the hosted bb daemon, and the real `~/.bb` are untouched.

## Phase 9: Close-out

- [ ] T1270 `pnpm run check` and `pnpm run build` pass, the worktree holds no lab files, and the suite count is recorded in `tdd/cycle-log.md`.
- [ ] T1271 `/speckit.tdd.verify`, remediation, `/speckit.implement`, `/speckit.checklist`, `/speckit.analyze`, and `/speckit.converge`.
- [ ] T1272 Outer loop for the whole feature: every `A` behavior in `tdd/test-list.md` is `DONE`, and A1219 has its screenshots.

## Dependencies

- Phase 1 comes first. T1203 and T1204 can run beside each other.
- Phase 2 blocks every story, because the component and the backend share the contract.
- User stories 1, 2, and 3 build one component file, so they run in order (1, 2, 3).
- User stories 4 and 5 are independent of the component and can start after Phase 1. Story 5's decision text waits for the lab findings (T1262).
- Phase 8 needs stories 1 to 3 and the build. T1263 may reopen the component tasks.

## Parallel opportunities

- T1203 and T1204.
- Story 4 (T1240 to T1242) beside Phase 2 and stories 1 to 3.
- The stub agent extraction for T1260 beside any code task.

## Implementation strategy

- MVP is story 1 with the contract: the owner can approve in the web UI.
- Stories 2 and 3 complete the form. Story 3 is required before the lab run, because the lab must show the fail-closed behavior too.
- Stories 4 and 5 are small and ship in the same pull request.
