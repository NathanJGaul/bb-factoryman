# Branch protection: the backstop for the merge gate

The plugin's merge gate lives in code.
`factoryman_merge` is the only merge path that the plugin offers, and it merges only after the owner approves in a form.
Two gaps remain, and the plugin cannot close them by itself.

1. **A submitted approval form is not proof of a human.**
   bb's `requestInput` returns `submitted` with whatever JSON reached `bb thread interactions respond`.
   The interaction row records no submitter, so an agent with a shell can answer the form (`spike/RESULTS.md` item 20, decision D-030).
2. **A worker with a shell can merge without the tool.**
   A worker can run `gh pr merge` or `git push` directly.
   The design lists this as a known gap on the merge gate.

Branch protection on the forge, together with scoped tokens, is the backstop for both.
This file is the setup checklist.
The plugin changes no GitHub setting.
`bb factoryman protection <owner/repo>` prints the same steps with your repository filled in, and runs nothing.

## What the protection does

- The default branch accepts changes only through a pull request whose required status check passed.
- The required check is `no-mistakes`, so a push that skipped the pipeline cannot reach the default branch.
- Administrators follow the same rule, so the owner's own token cannot skip it by accident.
- Force pushes and branch deletion are off.

## Steps

Run these as the repository owner, once per repository.
Replace `OWNER/REPO` and `main` as needed.

1. Confirm that the pipeline reports a status check named `no-mistakes` on pull requests.
   Open a recent pull request and read its checks. Use the exact name that you see.
2. Require the check on the default branch:

   ```sh
   gh api --method PUT repos/OWNER/REPO/branches/main/protection --input - <<'JSON'
   {
     "required_status_checks": { "strict": true, "contexts": ["no-mistakes"] },
     "enforce_admins": true,
     "required_pull_request_reviews": null,
     "restrictions": null,
     "allow_force_pushes": false,
     "allow_deletions": false
   }
   JSON
   ```

3. Give agents a token that cannot bypass the rule (next section).
4. Verify it (the section after that).

## Scoped tokens

- Give each machine its own fine-grained token, limited to the repositories that machine works on.
- Grant `Contents: read and write` and `Pull requests: read and write`. Grant nothing else.
- Do not give any agent a token with the `Administration` permission. That permission can edit or remove the protection.
- Keep the owner's own administrator token off the machines that run workers.
- The merge itself runs on the server machine, with the token that `gh` holds there. Keep that token separate from the workers' tokens.

## Verify

1. On a throwaway branch with no pull request, run `git push origin HEAD:main`. The forge must refuse it.
2. Open a pull request without the `no-mistakes` check and try to merge it. The merge button must stay blocked.
3. Run `gh api repos/OWNER/REPO/branches/main/protection` and read `required_status_checks.contexts`. It must list `no-mistakes`.
4. Record the date and the result in your cutover notes.

## What this does not cover

- A person with administrator rights on the forge can still change the rule.
- A `local-only` project has no forge. Its merge gate is the approval form alone, so the form gap in point 1 stays open for those projects.
