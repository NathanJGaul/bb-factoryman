# Quality gates: merge approval form in the web UI

**Purpose**: Record the quality gates for the finished implementation, with the evidence for each.
**Created**: 2026-11-08
**Feature**: [spec.md](spec.md)

A checked item has evidence that I ran or read in this worktree.
An unchecked item names what is missing and who owns it.

## Build and static checks

- [x] CHK1201 `pnpm run typecheck` passes with the pinned TypeScript, and the script calls `tsc6`. Evidence: `pnpm run check` at `579b982` (exit 0).
- [x] CHK1202 `pnpm run check` passes with a PATH that holds no global `tsc` (finding 5.2). Evidence: `env -i HOME=$HOME PATH=<node bin>:/usr/bin:/bin pnpm run check` -> exit 0, 95 files, 1310 tests. Before the fix the same command stopped with `tsc: command not found`.
- [x] CHK1203 `pnpm run lint` passes, and the browser-side import rule is active. Evidence: `pnpm run check`, and `[A1221a]` to `[A1221c]` (the rule rejects Node built-ins, `zod`, `better-sqlite3`, the backend SDK, and every server layer in `src/app.tsx`, `src/app/`, and `src/approval/`).
- [x] CHK1204 `pnpm test` passes with no skipped test. Evidence: 95 files, 1310 tests, 0 failed. `grep` finds no `skip`, `only`, or `todo` in the new tests.
- [x] CHK1205 `pnpm run build` writes the frontend bundle beside the server bundle. Evidence: `dist/app.js` (8.4 KB, no `zod`), `dist/app.css` (28 KB), `dist/app.meta.json`, and the server files. `dist/` is git-ignored and I removed it.
- [x] CHK1206 A real bb 0.49.0 loads the plugin, builds the frontend, and shows the form. Evidence: `data/bb-factoryman-approval-form/lab-check.md` in the firstmate home (the plugin was installed in the isolated lab only).

## The form, in the real web UI

- [x] CHK1210 The web UI shows the plugin's form and no longer the text "The plugin form is unavailable". Evidence: screenshots `01` and `04` against `00` (the same lab with `bb.app` removed).
- [x] CHK1211 A click on **Approve** records an approval with `actor: user` and merges. Evidence: lab report, two tasks (merge commits `6a38db3` and `527ff71` in the lab clone).
- [x] CHK1212 A click on **Deny**, with a comment, records a denial with the comment and merges nothing. Evidence: lab report, screenshots `05`, `06`, `18`.
- [x] CHK1213 A click on **Cancel** records nothing. Evidence: lab report, screenshot `07`.
- [x] CHK1214 The form is clean in the light and dark themes, at a wide and a narrow (420 px) width, with long evidence, and with a keyboard focus ring. Evidence: screenshots `10` to `17`. One pixel defect (an unstyled pull request link) was found there and fixed (`[U1240]`).
- [ ] CHK1215 A person (and not a browser tool) answers the form. Owner: tier 2 of the live check. The lab used `chrome-devtools-axi`, and `docs/LIVE-CHECK.md` section 9 says so.
- [ ] CHK1216 An unreadable request and a rejected answer show up in the real UI. The backend always sends a readable request and bb gives no way to reject a submit, so `[U1233]`, `[A1209]`, `[U1231]`, and `[A1210]` cover them in process. Owner: nobody; the tests are the evidence.

## Hard rules and the design

- [x] CHK1220 Merge still needs a recorded approval, and the backend gate did not change. Evidence: `git diff bbfdb15 HEAD -- src` outside `src/app`, `src/approval`, and `src/app.tsx` is one file, `src/tools/merge.ts` (8 lines added, 3 removed: the renderer id and the payload type come from the contract module). The `tools-merge` acceptance tests (`[A8]` to `[A11]`) pass unchanged.
- [x] CHK1221 The approval design is unchanged: no owner-typed code, no `factoryman_decide`. Evidence: `grep -rn factoryman_decide src` finds nothing, and the plugin registers the same five tools.
- [x] CHK1222 The form fails closed. A request that it cannot read gets no Approve button, a pull request that is not an `http` or `https` URL is never a link, and a rejected answer keeps the owner's comment. Evidence: `[U1222]`, `[U1231]`, `[U1233]`, `[U1234]`, `[A1209]` to `[A1211]`, and mutants M04, M05, M36 (all killed).
- [x] CHK1223 The frontend bundle carries no server code. Evidence: the lint rule (CHK1203), `grep -c zod dist/app.js` is 0, and the bundle is 8.4 KB.
- [x] CHK1224 D-030 stays partly open and is recorded. Evidence: `docs/DECISIONS.md` D-095 (status Open), and `[A1218]` pins it.
- [x] CHK1225 Nothing shared was touched. Evidence: the lab ran in `/var/tmp/bblab-approval-form` and was removed. The shared no-mistakes daemon stayed at pid 970 and active. The real `~/.bb/plugins` holds only its old toolchain cache. No credential or token was used. The hosted bb daemon on 127.0.0.1:38888 was never contacted.
- [ ] CHK1226 The TDD audit passes. It does not: the verdict is `FAIL` for one reason, seven behaviors whose tests came after their code (`A1215`, `U1236`, `U1238`, `U1239`, `A1212`, `U1241`, `U1242`). Each has a revert-red and a killing mutant. Owner: the owner, who decides in D-099 whether to accept the exception.

## Spec coverage

- [x] CHK1230 Every acceptance scenario has a test. Evidence: `tdd/test-list.md`, 19 of 19 (`AC-5.4` is the manual lab run).
- [x] CHK1231 Every functional requirement traces to a behavior (12 of 12, FR-1201 to FR-1212).
- [x] CHK1232 Every behavior on the list is `DONE`, except the baseline. Evidence: 56 of 57 `DONE`, and `U1213` is a `BASELINE` (`src/tools/merge.test.ts::[U89]`).
- [x] CHK1233 Test strength was measured with deliberate mutants. Evidence: `tdd/verification.md` (45 of 45 killed), the first run (24 of 29, with 5 survivors that are closed), and the fresh-context subagent's own set (10 survivors, all closed or judged copy text).
- [x] CHK1234 The two smaller findings of the live check are fixed. Evidence: `typecheck` calls `tsc6` (CHK1202), and the runbook reads the machine name (`[A1216]`, and `[A1109]` requires `"$MACHINE"` in every preflight call).

## Docs

- [x] CHK1240 Every deviation and gap has a `docs/DECISIONS.md` entry. Evidence: D-094 to D-099.
- [x] CHK1241 `docs/LIVE-CHECK.md` describes the working web step, reads the machine name, and says that a person's click is still unchecked. Evidence: `[A1216]` to `[A1218]`.
- [x] CHK1242 `.specify/memory/tdd-profile.md` notes the `.tsx` tests, the new fixture, and the `tsc6` type check.
- [x] CHK1243 Docs follow the Google developer documentation style, with one sentence per line.
- [ ] CHK1244 The runbook's new `MACHINE=$(bblab x bb machine list --json | jq -r '.[0].name')` line and the preflight call with `"$MACHINE"` ran against a real bb. They did not. The lab of this task ran the plugin install, the stub flow, and the form, and not tier 0. The earlier live check ran `preflight` with the real machine name and it passed (its check 0.10). Owner: the next tier 0 run.
