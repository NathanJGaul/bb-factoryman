# Quickstart: check the merge approval form

This guide proves the feature in two layers.
The first layer runs in the repository and needs no bb.
The second layer runs in the isolated lab and uses the real bb web UI.

## Prerequisites

- `pnpm install --frozen-lockfile` has run in the worktree.
- `bblab` and `bblab-evidence` are in `~/.local/bin` (see `docs/LIVE-CHECK.md`, section 1).
- Chromium is at `/usr/bin/chromium`. Set `CHROME_DEVTOOLS_AXI_EXECUTABLE_PATH=/usr/bin/chromium` for `chrome-devtools-axi`.
- Never touch the shared no-mistakes daemon, the hosted bb daemon on `127.0.0.1:38888`, or your own `~/.bb`.

## Layer 1: the repository

```sh
env -i HOME="$HOME" PATH="<node bin>:/usr/bin:/bin" pnpm run check
```

Expect: the type check, lint, and the whole suite pass with no global `tsc` on the PATH.

```sh
pnpm vitest run src/approval src/app test/acceptance/merge-approval-form.test.tsx
```

Expect: the contract tests, the component tests, and the in-process acceptance test pass.

```sh
pnpm run build
ls dist
```

Expect: `server.js`, `app.js`, `app.css`, and `app.meta.json`. `app.css` holds the form's classes.

## Layer 2: the lab

Follow `docs/LIVE-CHECK.md` sections 4 and 5 for the bring-up, the plugin install, and the throwaway project.
Then:

1. Create a `local-only` ship task and move it to `review_ready` with the stub agent (tier 1).
2. Ask the supervisor thread to call `factoryman_merge`.
3. Open the supervisor thread in the lab's web UI (`http://127.0.0.1:<lab port>`).
4. Expect the plugin's form, not the text "The plugin form is unavailable".
5. Press **Approve**. Expect the task to reach `merged`, one `record_approval` event with `actor: user`, and a merge commit in the clone.
6. Repeat with a second ship task and press **Deny**, with a comment. Expect a `denied` approval row with the comment, no merge, and the task in `awaiting_approval`.
7. Repeat once and press **Cancel**. Expect no approval row.
8. Take screenshots of the form (light and dark themes, a narrow width), the Approve result, and the Deny result.
9. `bblab down`, then `bblab-evidence snap after` and `diff`, as in the runbook's section 10.

The screenshots go to `data/bb-factoryman-approval-form/` in the firstmate home.
