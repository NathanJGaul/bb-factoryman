---
feature: 008-merge-approval-form
loop: outside-in
profile: .specify/memory/tdd-profile.md
spec_criteria: 19
planned_at: bbfdb15
updated_at: bbfdb15
suite_baseline: green
---

# Test list: Merge approval form in the web UI

The acceptance layer is an in-process integration test, which is weaker than a browser test.
It enters through the plugin factory (`loadWorld`, `factoryman_merge`) and through the frontend entry (`loadPluginApp`, `renderSlot` from `@get-bb/plugin-sdk/testing/app` under jsdom).
jsdom does not lay out or style anything, so it cannot show the form's look, its fit in a narrow frame, either theme, or what bb draws around it.
The only check of those is the live check in the lab (A1219), which is manual: no automated browser runner is installed, and `chrome-devtools-axi` is driven by hand.
The suite baseline was 92 files and 1134 tests, all passing.

## Outer loop: acceptance behaviors

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| A1201 | The frontend registers exactly one pending-interaction renderer, under the id that `factoryman_merge` passes when it opens the form | AC-1.1, FR-1201 | example | DONE | `test/acceptance/merge-approval-form.test.tsx::[A1201]` |
| A1202 | The renderer, given the request that `factoryman_merge` really opened, shows the task id, branch, pull request, and evidence | AC-1.2, FR-1202 | example | DONE | `test/acceptance/merge-approval-form.test.tsx::[A1202]` |
| A1203 | Pressing Approve in the renderer ends the task `merged`, with one `user` approval row that says `approved` | AC-1.3, FR-1203 | example | DONE | `test/acceptance/merge-approval-form.test.tsx::[A1203]` |
| A1204 | A typed comment travels with Approve into the approval record, and a blank comment leaves the record without one | AC-1.4, FR-1203 | example | DONE | `test/acceptance/merge-approval-form.test.tsx::[A1204]` |
| A1205 | While an answer is in flight every control is disabled, and two presses send one answer | AC-1.5, FR-1206 | example | DONE | `test/acceptance/merge-approval-form.test.tsx::[A1205]` |
| A1206 | Pressing Deny merges nothing, records a `denied` row, and leaves the task `awaiting_approval` | AC-2.1, FR-1203 | example | DONE | `test/acceptance/merge-approval-form.test.tsx::[A1206]` |
| A1207 | A typed comment travels with Deny into the denial record | AC-2.2, FR-1203 | example | DONE | `test/acceptance/merge-approval-form.test.tsx::[A1207]` |
| A1208 | Pressing Cancel records no approval, runs no merge, and leaves the task `awaiting_approval`, and a later call opens a new form | AC-2.3, FR-1204 | example | DONE | `test/acceptance/merge-approval-form.test.tsx::[A1208]` |
| A1209 | A request the renderer cannot read offers no Approve, and Deny and Cancel still work | AC-3.1, FR-1205 | example | DONE | `test/acceptance/merge-approval-form.test.tsx::[A1209]` |
| A1210 | A rejected answer shows an error, re-enables the controls, keeps the typed comment, and records nothing | AC-3.2, FR-1206 | example | DONE | `test/acceptance/merge-approval-form.test.tsx::[A1210]` |
| A1211 | A pull request value that is not an `http` or `https` URL shows as plain text | AC-3.3, FR-1207 | example | DONE | `test/acceptance/merge-approval-form.test.tsx::[A1211]` |
| A1212 | Long evidence and a long branch name sit inside a wrapping or scrolling block (class level only; the real fit is A1219) | AC-3.4, FR-1209 | example | DONE | `test/acceptance/merge-approval-form.test.tsx::[A1212]` |
| A1213 | A request with an expiry time shows when it expires, and one without shows no expiry line | AC-3.5 | example | DONE | `test/acceptance/merge-approval-form.test.tsx::[A1213]` |
| A1214 | The `typecheck` script calls `tsc6`, the binary exists in `node_modules/.bin`, and a run with a PATH that holds no `tsc` passes (the run is task T1241; the suite pins the script and the binary) | AC-4.1, FR-1210 | example | DONE | `test/acceptance/manifest.test.ts::[A1214]` |
| A1215 | The type check covers the frontend source: `tsconfig.json` includes `src`, sets the JSX transform, and has the DOM library | AC-4.2, FR-1210 | example | DONE | `test/acceptance/manifest.test.ts::[A1215]` |
| A1216 | The runbook's preflight step reads the machine name from `bb machine list` and names no machine called `server` | AC-5.1, FR-1211 | example | DONE | `test/acceptance/live-check.test.ts::[A1216]` |
| A1217 | The runbook's ship step describes the approval form in the web UI and keeps the rule that a scripted answer is written down as scripted | AC-5.2, FR-1211 | example | DONE | `test/acceptance/live-check.test.ts::[A1217]` |
| A1218 | The decision log records the renderer (D-094), that D-030 stays partly open (D-095), the dependency-free contract (D-096), the fail-closed view (D-097), and the `tsc6` script (D-098), and says option 2 is deferred | AC-5.3, FR-1212 | example | DONE | `test/acceptance/live-check.test.ts::[A1218]` |
| A1219 | In the isolated lab, a click on Approve and a click on Deny in the real web UI record the approval and the denial, and the screenshots are kept | AC-5.4, SC-1201 to SC-1203, SC-1206 | example | DONE | live check, task T1262; evidence in `cycle-log.md` and under `data/bb-factoryman-approval-form/` |
| A1220 | The manifest declares `bb.app` as `./src/app.tsx`, the file exists, and the build script is `bb plugin build` | FR-1201, SC-1205 | example | DONE | `test/acceptance/manifest.test.ts::[A1220]` |
| A1221 | Lint rejects a Node built-in, `zod`, a server layer, or the backend SDK in the browser-side files, and accepts the same imports in server files | plan constraint: the frontend carries no server code | example | DONE | `test/acceptance/lint-isolation.test.ts::[A1221]` |

## Inner loop: unit behaviors

### `src/approval/contract.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1201 | `readMergePayload` returns the payload for an object with exactly the four string fields | FR-1202, FR-1205 | example | DONE | `src/approval/contract.test.ts::[U1201]` |
| U1202 | It returns `null` for `null`, a string, a number, and an array | FR-1205 | example | DONE | `src/approval/contract.test.ts::[U1202]` |
| U1203 | It returns `null` when any one of the four fields is missing | FR-1205 | example | DONE | `src/approval/contract.test.ts::[U1203]` |
| U1204 | It returns `null` when a field is a number, `null`, or an object | FR-1205 | example | DONE | `src/approval/contract.test.ts::[U1204]` |
| U1205 | It returns `null` when the object carries a fifth field | FR-1205 | example | DONE | `src/approval/contract.test.ts::[U1205]` |
| U1206 | It accepts empty strings in every field, because a `local-only` task has no pull request | FR-1202 | example | DONE | `src/approval/contract.test.ts::[U1206]` |
| U1207 | `answerFor("approved")` and `answerFor("denied")` without a comment carry only the decision | FR-1203 | example | DONE | `src/approval/contract.test.ts::[U1207]` |
| U1208 | `answerFor` trims the comment and keeps the text between | FR-1203 | example | DONE | `src/approval/contract.test.ts::[U1208]` |
| U1209 | `answerFor` leaves out a comment that is empty, spaces, or a line break, and keeps a one-character comment | FR-1203 | example | DONE | `src/approval/contract.test.ts::[U1209]` |
| U1210 | Every `answerFor` result passes `approvalAnswerSchema`, and a result with a stray field would not | FR-1203, FR-1208 | example | DONE | `src/approval/contract.test.ts::[U1210]` |
| U1211 | The payload that `factoryman_merge` builds for a ship task passes `readMergePayload` | FR-1202, FR-1208 | example | DONE | `src/approval/contract.test.ts::[U1211]` |
| U1212 | `MERGE_RENDERER_ID` is `factoryman-merge-approval` and matches bb's renderer id pattern | FR-1201 | example | DONE | `src/approval/contract.test.ts::[U1212]` |

### `src/tools/merge.ts`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1213 | The form opens on the caller's thread with the renderer id, task, branch, pull request, and evidence (the existing test stays green through the move to the contract module) | FR-1208 | characterization | BASELINE | `src/tools/merge.test.ts::[U89]` |

### `src/app/merge-approval-form.tsx`

| id | behavior | traces | kind | state | test |
| --- | --- | --- | --- | --- | --- |
| U1220 | Shows the task id and the branch under their labels, in a monospace face | AC-1.2, FR-1202 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1220]` |
| U1221 | Shows an `http` pull request URL and an `https` one as links to that URL | AC-1.2, AC-3.3, FR-1207 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1221]` |
| U1222 | Shows a `javascript:`, `ftp:`, or non-URL pull request value as plain text with no link | AC-3.3, FR-1207 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1222]` |
| U1223 | Shows "None" for an empty pull request and for empty evidence, and still offers Approve | AC-1.2, FR-1202 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1223]` |
| U1224 | Shows the evidence with its line breaks kept | AC-1.2, FR-1202 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1224]` |
| U1225 | Pressing Approve calls `submit` once with `{ "decision": "approved" }` | AC-1.3, FR-1203 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1225]` |
| U1226 | Pressing Approve after typing a comment submits the trimmed comment, and a blank comment is left out | AC-1.4, FR-1203 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1226]` |
| U1227 | Pressing Deny calls `submit` once with `{ "decision": "denied" }`, with the trimmed comment when typed | AC-2.1, AC-2.2, FR-1203 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1227]` |
| U1228 | Pressing Cancel calls `cancel` once and never calls `submit` | AC-2.3, FR-1204 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1228]` |
| U1229 | The controls are enabled before a press, disabled while `submit` is pending, and stay disabled after it resolves; the form is `aria-busy` while pending | AC-1.5, FR-1206 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1229]` |
| U1230 | A second press while an answer is pending sends no second answer | AC-1.5, FR-1206 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1230]` |
| U1231 | A rejected `submit` shows its message in an alert, re-enables the controls, and keeps the typed comment | AC-3.2, FR-1206 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1231]` |
| U1232 | A rejected `cancel` shows its message in an alert and re-enables the controls | AC-3.2, FR-1206 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1232]` |
| U1233 | A payload that is `null`, lacks a field, has a field of the wrong type, or has an extra field shows the unreadable notice, no Approve, and both Deny and Cancel | AC-3.1, FR-1205 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1233]` |
| U1234 | Pressing Deny on the unreadable notice submits `{ "decision": "denied" }`, and pressing Cancel calls `cancel` | AC-3.1, FR-1204, FR-1205 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1234]` |
| U1235 | Shows the expiry in a `<time>` element when `expiresAt` is set, and no expiry line when it is `null` | AC-3.5 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1235]` |
| U1236 | Pressing Enter in the comment field submits nothing | FR-1203, FR-1209 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1236]` |
| U1237 | The comment field has a label, and Approve, Deny, and Cancel have accessible names | FR-1209 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1237]` |
| U1238 | The evidence block and the branch carry the wrapping and scrolling classes that keep long text inside the form | AC-3.4, FR-1209 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1238]` |
| U1239 | The component source names theme tokens only: no hex color and no fixed Tailwind palette color | FR-1209 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1239]` |
| U1240 | Underlines the pull request link, so that it reads as a link (found in the lab: the anchor had no styling and looked like plain text) | AC-1.2, FR-1209 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1240]` |
| U1241 | A retry that succeeds clears the failure banner (found by the audit: a stale "Your answer was not sent" banner stayed after a good retry) | AC-3.2 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1241]` |
| U1242 | The pull request link is the SDK's `UrlLink`, so a click goes through bb's navigation with the URL (found by the audit: a plain anchor passed every test) | AC-1.2 | example | DONE | `src/app/merge-approval-form.test.tsx::[U1242]` |

## Invariants and edge cases still to place

- The exact look, spacing, focus ring, both themes, and the narrow width cannot be tested in jsdom. They belong to A1219 and the pixel pass in task T1263.
- Whether bb draws its own title, requester line, and Cancel around the plugin's body is unknown until the lab. If it does, the plugin drops its own Cancel, and U1228, U1232, U1234, and A1208 change with that decision (a new behavior, not a silent edit).
- Whether `bb plugin build` finds the Tailwind classes in `src/app/` is checked by reading `dist/app.css` in the lab (task T1260).

## Out of scope

- The owner-typed code (report option 2), `factoryman_decide`, and any other change to the approval design: deferred by the captain.
- Waking the supervisor on a denial, a cancel, or a timeout (report finding 5.5), and report findings 5.4 and 5.6 to 5.15: separate tasks.
- The host's experimental question-form shortcuts (`experimental_useQuestionFormHost`): the API is experimental, and a shortcut that approves is a risk nobody asked for.
- A person's own click in the app: tier 2 of the live check. This feature's live check drives the UI with a browser tool.
- Translation of the form's text: the plugin has one language.

## Verification commands

Copied from `.specify/memory/tdd-profile.md` at planning time:

- Single test: `pnpm vitest run {file} -t "{name}"`
- File: `pnpm vitest run {file}`
- Full suite: `pnpm test`
- Coverage: none installed
- Mutation: none installed (the audit uses deliberate mutants)
- Acceptance: `pnpm vitest run {file}`
- Whole gate: `pnpm run check`
