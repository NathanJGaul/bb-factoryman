# Implementation plan: Merge approval form in the web UI

**Branch**: `fm/bb-factoryman-approval-form` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)

## Summary

Add a frontend bundle to the plugin with one renderer, for the form id `factoryman-merge-approval`.
The renderer shows the request, collects an optional comment, and answers Approve or Deny with the exact value that `factoryman_merge` already reads.
The backend, the state machine, and the approval record do not change.
Two small fixes ride along: the `typecheck` script calls `tsc6`, and the runbook reads the machine name.
The live check clicks Approve and Deny in the web UI of an isolated `bblab`.

## Technical context

- Language and tooling: TypeScript 6 (the pinned alias, binary `tsc6`), ESM, Node 26, `pnpm` 12, `vitest` 5.
- bb facts (SDK 0.6.104 and a scaffold built with `bb plugin new` and `bb plugin build`):
  - The manifest field `bb.app` names the frontend entry.
    `bb plugin build` writes `dist/app.js`, `dist/app.css`, and `dist/app.meta.json` beside the server bundle.
  - The entry default-exports `definePluginApp((app) => { ... })` from `@get-bb/plugin-sdk/app`.
  - `app.slots.pendingInteraction({ id, component })` registers a renderer.
    `id` is the `rendererId` that the backend passes to `bb.ui.requestInput`.
    It matches `/^[a-zA-Z0-9_-]+$/`.
  - The component gets `{ interaction: { id, threadId, title, payload, createdAt, expiresAt }, submit(value): Promise<void>, cancel(): Promise<void> }`.
  - React, the JSX runtime, `class-variance-authority`, `clsx`, `tailwind-merge`, and the SDK app runtime come from bb at load time and are never bundled.
    Tailwind classes in the source compile against the host theme's CSS variables.
  - The SDK's frontend test harness, `@get-bb/plugin-sdk/testing/app` (`loadPluginApp`, `renderSlot`), mounts a registration under `vitest` and jsdom.
    It does not reproduce bb's layout or theme.
- New dev dependencies: `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@testing-library/react`, `@testing-library/dom`, and `jsdom`.
  No runtime dependency is added, so the frontend bundle carries none.
- Storage: none.
- Target: the bb web UI and the desktop app, in the light and dark themes.
- Constraint: the frontend must not pull in server code, Node built-ins, or `zod`, because it loads in the browser on every page of the app.

## Constitution check

| Principle | How the plan complies |
| --- | --- |
| I. Gates live in code | The renderer is a view. The gate stays in `factoryman_merge`, which still validates the answer with a strict schema and records the approval. The renderer offers no Approve for a payload it cannot read, but the backend does not rely on that. |
| II. Machine core is pure | No change to `src/machine/`. |
| III. Event log is the source of truth | No change. |
| IV. Storage behind an interface | No change. |
| V. Test first | Each behavior gets a failing test before code, recorded in `tdd/cycle-log.md`. The acceptance test enters through the plugin factory and the registered renderer. |
| VI. Scope | The feature adds a view for an existing gate. It adds no tool, no check, and no owner-typed code. `factoryman_decide` stays out (D-057). The live install stays the owner's step. |

Result: no violation, so no complexity tracking.

## Source layout

```text
src/app.tsx                         # new: the frontend entry, definePluginApp + pendingInteraction slot
src/app/merge-approval-form.tsx     # new: the component
src/app/merge-approval-form.test.tsx
src/approval/contract.ts            # new: renderer id, payload reader, answer builder (no imports)
src/approval/contract.test.ts
src/tools/merge.ts                  # uses the contract module for the id and the payload type
test/acceptance/merge-approval-form.test.tsx   # new: plugin factory + renderer, end to end in process
test/acceptance/manifest.test.ts    # + bb.app, + typecheck script
test/acceptance/lint-isolation.test.ts          # + the browser-side import rule
package.json                        # bb.app, typecheck script, dev dependencies
tsconfig.json                       # jsx, DOM lib, tsx include
vitest.config.ts                    # tsx tests, automatic JSX
eslint.config.js                    # browser-side import restrictions
docs/DECISIONS.md                   # D-094 to D-097
docs/LIVE-CHECK.md                  # machine name, working web step
.specify/memory/tdd-profile.md      # note the tsx tests and the new fixtures
```

## Design

**Contract module (`src/approval/contract.ts`).**
It has no imports, so the browser bundle stays small and server code cannot leak in.
It holds:

- `MERGE_RENDERER_ID = "factoryman-merge-approval"`.
- `MergeRequestPayload`: `{ taskId, branch, prUrl, evidence }`, all strings.
- `readMergePayload(value: unknown): MergeRequestPayload | null`: returns the payload only when the value is a plain object with exactly those four string fields.
- `ApprovalAnswer`: `{ decision: "approved" | "denied"; comment?: string }`.
- `answerFor(decision, comment): ApprovalAnswer`: trims the comment and leaves it out when blank.

`src/tools/merge.ts` imports the id and the payload type and keeps `approvalAnswerSchema` (the strict `zod` schema), typed against `ApprovalAnswer`.
A contract test feeds the payload that `factoryman_merge` really builds into `readMergePayload`, and feeds every `answerFor` result into `approvalAnswerSchema`, so the two sides cannot drift.

**Component (`src/app/merge-approval-form.tsx`).**
It reads `interaction.payload` with `readMergePayload`.

- Readable payload: a labelled list of Task, Branch, Pull request, and Evidence.
  Branch and task id are monospace and wrap.
  A pull request that parses as an `http` or `https` URL is an SDK `UrlLink`, anything else is plain text, and an empty value reads "None".
  Evidence sits in a pre-wrapped block with a maximum height and its own scroll, and an empty value reads "None".
  An optional comment sits in a labelled text area.
  When `expiresAt` is set, the form shows the expiry in a `<time>` element.
- Actions: Approve (primary), Deny (outline), and Cancel (ghost).
  Approve and Deny call `submit(answerFor(...))`.
  Cancel calls `cancel()`.
- State: `idle`, `sending`, and `failed`.
  While `sending`, every control is disabled and the form has `aria-busy`.
  A rejected `submit` or `cancel` moves to `failed`, shows the error text in a `role="alert"` line, and re-enables the controls with the comment intact.
  After a settled `submit`, the controls stay disabled, because bb closes the form.
- Unreadable payload: an alert that says the request is unreadable and that Approve is not offered, then Deny and Cancel only.
- No `<form>` element, so Enter in the text area cannot approve.
  Every press is a button press.
- Styling: Tailwind classes built from theme tokens (`bg-foreground`, `text-background`, `border-border`, `text-muted-foreground`, `text-destructive`, `bg-card`), never fixed colors, so both themes work.
  A visible focus ring on every control.
  Buttons wrap on a narrow width.
  The exact look is checked in the lab.
- The host's `experimental_useQuestionFormHost` shortcuts are not used.
  The API is experimental, and a shortcut that approves is a risk that the owner did not ask for.

**Entry (`src/app.tsx`).**
`export default definePluginApp((app) => { app.slots.pendingInteraction({ id: MERGE_RENDERER_ID, component: MergeApprovalForm }); })`.

**Build and manifest.**
`bb.app` becomes `./src/app.tsx`.
`bb plugin build` produces the frontend bundle.
`tsconfig.json` gains `jsx: react-jsx` and the `DOM` lib, and its `include` already covers `src` and `test`.
One configuration keeps the editor and `tsc6` agreeing.
DOM globals now type-check in server code too.
Lint closes that hole for what matters: the browser-side files may not import Node built-ins, `better-sqlite3`, `zod`, `@get-bb/plugin-sdk` (the backend root), or any server layer (`store`, `tools`, `runtime`, `wiring`, `git`, `bb`, and so on).

**Type check script.**
`"typecheck": "tsc6 --noEmit"`.
`tsc6` is the binary that the pinned `npm:@typescript/typescript6` alias installs, so the script no longer needs a global `tsc`.
A manifest test pins the script and checks that the binary exists in `node_modules/.bin`.

**Tests.**

- Unit (`contract.test.ts`): payload reader accepts the real payload and rejects each wrong shape; answer builder trims and drops blank comments.
- Unit (`merge-approval-form.test.tsx`, jsdom, `renderSlot`): each acceptance scenario of stories 1 to 3.
- Acceptance (`merge-approval-form.test.tsx` in `test/acceptance/`): `loadPluginApp(() => import("../../src/app"))` finds the renderer under the id that `factoryman_merge` opens through the plugin factory and the fake host.
  The test renders the form from the pending request, presses Approve, hands the submitted value to the fake host's `submitInteraction`, and the task ends `merged`.
  Another case presses Deny and the task stays `awaiting_approval`.
  This is in process and weaker than a browser, so the live check covers the real UI.
- Manifest and lint: `bb.app`, the `typecheck` script, and the browser-side import rule.
- Live (the lab): build, install, click Approve and Deny in the web UI, screenshots.
  See [quickstart.md](quickstart.md).

**Runbook.**
The preflight row reads the machine name with `bb machine list --json` instead of assuming `server`.
The ship task step describes the form and what the owner presses, and keeps the rule that a scripted answer is written down as scripted.
Section 9 changes the line "A person answering the merge form in the app, and not a script" to say that the form renders and takes a click (checked by browser automation in the lab), and that a person's click is still the owner's check at tier 2.

## Decisions to record

- D-094: the merge approval has a frontend renderer in the plugin (option 1 of the live check report, decided by the captain).
- D-095: D-030 stays partly open.
  The form is now answerable by a person, and a worker with a shell can still answer through the command line.
  The owner-typed code (option 2) is deferred, and `factoryman_decide` stays out of scope.
- D-096: the contract module has no imports and the browser bundle ships no `zod`.
  The strict `zod` schema stays on the server, and a contract test ties the two sides.
- D-097: an unreadable payload offers no Approve (fail closed in the view), and a single `tsconfig.json` with the DOM library type-checks both sides, with lint keeping the browser side apart from the server.
- D-098: `typecheck` calls `tsc6`.

## Risks

- **The frame.** bb may draw its own title, requester line, and Cancel button around the plugin's body.
  If it does, the plugin's Cancel would repeat the host's.
  The lab settles it, and the form keeps only one Cancel.
- **Tailwind scan.** The build must find the classes in `src/app/`.
  The lab checks `dist/app.css` and the rendered look.
- **Type conflicts.** Adding the DOM lib beside `@types/node` can clash on a few globals.
  If `tsc6` shows clashes in server code, the fallback is a second configuration for the browser files.
- **Cancel on the host's own button.** If bb's frame has a Cancel that bypasses the renderer, the backend already treats a cancel as no answer.
