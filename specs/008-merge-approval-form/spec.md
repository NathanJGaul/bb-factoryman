# Feature specification: Merge approval form in the web UI

**Feature branch**: `fm/bb-factoryman-approval-form`

**Created**: 2026-11-08

**Status**: Approved (scope fixed by the captain's intent for this task)

**Input**: The live check (`data/bb-factoryman-live-check-t01/report.md` in the firstmate home, sections 5, 8, and 9) found that bb's web UI shows "The plugin form is unavailable. Cancel to continue." for the `factoryman-merge-approval` form.
The plugin ships no frontend renderer, so a person cannot approve or deny a merge in the app.
The only way to approve is `bb thread interactions respond`, which any agent with a shell can also run.
The captain decided to add a frontend renderer so the owner can approve and deny in the web UI (option 1 of the report's section 9).
The same report found two smaller defects that this feature also fixes: the `typecheck` script needs a global `tsc` (finding 5.2), and the runbook names the lab machine `server` (finding 5.3).

## User scenarios and testing

The person who uses this feature is the owner, who answers a merge request that a supervisor agent raised.
The owner reads the request in the bb web UI, on the supervisor thread, and decides.
The feature has one screen: the merge approval form.
Its real entry points are the form that `factoryman_merge` opens through bb, the frontend bundle that `bb plugin build` produces, and the bb web UI that renders the bundle.
The bb facts it depends on are the plugin frontend mechanism in `@get-bb/plugin-sdk` (`app.slots.pendingInteraction`) and the form's payload and answer shapes in `src/tools/merge.ts`.

### User story 1 - Approve a merge in the web UI (priority: P1)

The owner opens the supervisor thread, reads which task, branch, pull request, and evidence the request is about, and presses Approve.
The plugin records the approval and the merge runs.

**Why this priority**: Without it, no person can approve a merge.
Every approval today is a script.

**Independent test**: Open a merge form in the lab's web UI, press Approve, and check that the task reaches `merged` with an `actor: user` approval row.

**Acceptance scenarios**:

1. **Given** a pending merge form, **When** the owner opens the supervisor thread, **Then** the web UI shows the plugin's own form and not the text "The plugin form is unavailable". (AC-1.1)
2. **Given** the form, **Then** it shows the task id, the branch, the pull request link (when the task has one), and the evidence, and it shows a plain "none" line for a value that is empty. (AC-1.2)
3. **Given** the form, **When** the owner presses Approve, **Then** bb receives the answer `{"decision":"approved"}`, the plugin records one approval, and the merge runs. (AC-1.3)
4. **Given** the owner typed a comment, **When** the owner presses Approve, **Then** the answer also carries the comment, and a comment that is empty or only spaces is left out. (AC-1.4)
5. **Given** the owner pressed Approve, **Then** the buttons are disabled until bb settles the request, so one press sends one answer. (AC-1.5)

### User story 2 - Deny a merge in the web UI (priority: P1)

The owner presses Deny, optionally with a comment that says why.

**Why this priority**: A person must be able to refuse as well as accept, and refusal must work the same way.

**Independent test**: Open a merge form, type a comment, press Deny, and check that the approval row says `denied` with the comment, and that the clone did not change.

**Acceptance scenarios**:

1. **Given** a pending merge form, **When** the owner presses Deny, **Then** bb receives `{"decision":"denied"}`, the plugin records a denial, and nothing merges. (AC-2.1)
2. **Given** the owner typed a comment, **When** the owner presses Deny, **Then** the answer carries the comment. (AC-2.2)
3. **Given** the form, **When** the owner presses Cancel, **Then** no decision is recorded and the task stays `awaiting_approval`. (AC-2.3)

### User story 3 - The form never approves blind and never fails open (priority: P1)

Approval is a gate, so the form must refuse to offer Approve when it cannot show what is being approved, and it must not lose the owner's decision on an error.

**Why this priority**: Hard rule 1 says a merge needs a recorded approval, and rule 8 says nothing fails open.

**Independent test**: Render the form with a malformed payload and with a submit that rejects, and check the offered buttons and the message.

**Acceptance scenarios**:

1. **Given** a payload that the form cannot read (a missing field or a field of the wrong type), **Then** the form shows a notice that the request is unreadable, shows no Approve button, and still offers Cancel and Deny. (AC-3.1)
2. **Given** bb rejects the answer, **Then** the form shows the error text, re-enables the buttons, and keeps the typed comment. (AC-3.2)
3. **Given** a pull request value that is not an `http` or `https` URL, **Then** the form shows it as plain text and not as a link. (AC-3.3)
4. **Given** a very long evidence text or a long branch name, **Then** the form scrolls or wraps it inside the form and does not overflow the thread view. (AC-3.4)
5. **Given** the request has an expiry time, **Then** the form shows when it expires. (AC-3.5)

### User story 4 - A clean machine can run the full check (priority: P2)

A maintainer without a global `tsc` runs `pnpm run check` and gets a real type check.

**Why this priority**: `pnpm run check` is the gate before anyone installs a build, and it passes today only by accident of the PATH.

**Independent test**: Run `pnpm run typecheck` with a PATH that holds no `tsc`.

**Acceptance scenarios**:

1. **Given** a PATH with node and pnpm but no global `tsc`, **When** `pnpm run check` runs, **Then** the type check runs with the pinned TypeScript and the whole command passes. (AC-4.1)
2. **Given** the type check, **Then** it covers the frontend source as well as the server source. (AC-4.2)

### User story 5 - The runbook matches what the owner sees (priority: P2)

The owner follows `docs/LIVE-CHECK.md` and every step works as written.

**Why this priority**: The runbook is the owner's only guide, and it is wrong in two places.

**Independent test**: Read the runbook against the lab: the preflight command names the real machine, and the merge step describes the form that now exists.

**Acceptance scenarios**:

1. **Given** the preflight step, **Then** it reads the machine name from `bb machine list` and does not assume the name `server`. (AC-5.1)
2. **Given** the ship task step, **Then** it describes the approval form in the web UI, says what the owner sees and presses, and says that a scripted answer through `bb thread interactions respond` must be written down as scripted. (AC-5.2)
3. **Given** `docs/DECISIONS.md`, **Then** it records the decision to add the renderer, records that D-030 stays partly open because a worker can still answer through the command line, and records that the owner-typed code (option 2) is deferred. (AC-5.3)
4. **Given** the lab, **Then** the live check of this feature ran in `bblab` with a real click on Approve and a real click on Deny, and the screenshots are kept in the task's data directory. (AC-5.4)

### Edge cases

- The owner answers from the CLI while the form is open. bb settles the request, and the form closes. The plugin does not need to handle this.
- The form is open when the request times out. bb cancels the request, and the form goes away. The backend already reports this to the supervisor as a failure.
- The payload carries an empty `prUrl`, which the backend sends for a `local-only` task. The form shows "none" for the pull request.
- The payload carries an empty `evidence` string. The form shows "none" and still offers Approve, because the evidence is context and the owner may know the work.
- The owner switches the bb theme between light and dark. The form stays readable in both.
- The form is narrow (a small window or a side panel). The buttons wrap and no text is cut off.

## Requirements

- **FR-1201**: The plugin MUST ship a frontend bundle that registers a renderer for the id `factoryman-merge-approval`, the same id that `factoryman_merge` passes to bb.
- **FR-1202**: The renderer MUST show the task id, the branch, the pull request, and the evidence from the payload.
- **FR-1203**: The renderer MUST answer with exactly the shape that `approvalAnswerSchema` accepts: `{ "decision": "approved" | "denied", "comment"?: string }`. It MUST leave out a blank comment and MUST NOT send any other field.
- **FR-1204**: The renderer MUST offer Approve, Deny, and Cancel. Cancel MUST record no decision.
- **FR-1205**: The renderer MUST NOT offer Approve when the payload is unreadable.
- **FR-1206**: The renderer MUST disable its buttons while an answer is in flight, MUST show a failure, and MUST keep the comment after a failure.
- **FR-1207**: The renderer MUST show a pull request value as a link only when it is an `http` or `https` URL.
- **FR-1208**: The renderer MUST NOT change the approval design. It asks for no owner-typed code, and the backend, the state machine, the tools, and the approval record stay as they are. `factoryman_decide` stays out of scope (D-057).
- **FR-1209**: The renderer MUST be keyboard operable, MUST label every control, and MUST stay readable in the light and dark themes and at a narrow width.
- **FR-1210**: The `typecheck` script MUST use the TypeScript that `package.json` pins and MUST type-check the frontend source.
- **FR-1211**: `docs/LIVE-CHECK.md` MUST read the machine name instead of assuming it, and MUST describe the working web step.
- **FR-1212**: `docs/DECISIONS.md` MUST record the renderer decision, that D-030 stays partly open, and that option 2 is deferred.

## Key entities

- **Approval request**: What `factoryman_merge` opens through bb: a title, an expiry time, and a payload of task id, branch, pull request, and evidence.
- **Approval answer**: What the owner sends back: a decision (`approved` or `denied`) and an optional comment.

## Success criteria

- **SC-1201**: In the lab's web UI, the merge form shows the plugin's form and never the text "The plugin form is unavailable".
- **SC-1202**: An owner approves a merge with one press after reading the form, and the log shows one `record_approval` event with `actor: user` and the decision the owner chose.
- **SC-1203**: An owner who presses Deny sees nothing merge, and the log shows a `denied` approval with the typed comment.
- **SC-1204**: With a PATH that holds no global `tsc`, `pnpm run check` passes.
- **SC-1205**: The suite, type check, lint, and `bb plugin build` pass, and the build output holds a frontend bundle beside the server bundle.
- **SC-1206**: A reviewer can open the kept screenshots and see the form, the Approve result, and the Deny result.

## Assumptions

- The web UI renders a plugin renderer inside its own frame (title, requester, and the form), so the plugin draws the body and the buttons and relies on bb for the frame. The live check settles the exact split.
- `bb plugin build` supplies the React runtime and the SDK's frontend runtime, so the plugin adds no runtime dependency for them. A type or test-only dependency may be needed.
- A frontend test uses the SDK's frontend test harness (`@get-bb/plugin-sdk/testing/app`) with a DOM test environment. That harness does not reproduce bb's layout or theme, so the live check covers those.
- The answer shape does not change. A denial or a cancel still reaches the supervisor only as the backend sends it today (report finding 5.5 stays out of scope).
- D-030 stays partly open: the form is not proof of a human, because a worker with a shell can still run the CLI.
- The owner-typed code (report option 2), `factoryman_decide`, and the other report findings (5.4 to 5.15) are out of scope.
