export interface ProtectionInput {
  repo: string;
  branch: string;
  check: string;
}

const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
/** A branch name with only safe characters: it goes into a shell command that a person copies. */
const BRANCH = /^[A-Za-z0-9_][A-Za-z0-9_./-]*$/;
const CHECK = /^[A-Za-z0-9_][A-Za-z0-9_ ./:@-]*$/;

/**
 * The branch-protection checklist for one repository (docs/BRANCH-PROTECTION.md).
 * It builds text and nothing else: it runs no command and changes no setting
 * (hard rule 8 and the milestone 10 brief). Inputs go into shell commands that
 * a person will paste, so each one is checked against a strict pattern.
 */
export function protectionSteps(input: ProtectionInput): { ok: true; text: string } | { ok: false; message: string } {
  const { repo, branch, check } = input;
  if (!REPO.test(repo) || repo.includes("..")) return { ok: false, message: "The repository must look like owner/name, with letters, digits, dots, dashes, and underscores only." };
  if (!BRANCH.test(branch) || branch.includes("..")) return { ok: false, message: "The branch name has characters that are not allowed." };
  if (!CHECK.test(check)) return { ok: false, message: "The check name has characters that are not allowed." };
  const body = JSON.stringify(
    { required_status_checks: { strict: true, contexts: [check] }, enforce_admins: true, required_pull_request_reviews: null, restrictions: null, allow_force_pushes: false, allow_deletions: false },
    null,
    2,
  ).replace(`"contexts": [\n      "${check}"\n    ]`, `"contexts": ["${check}"]`);
  return {
    ok: true,
    text: [
      `Branch protection for ${repo}, branch ${branch}`,
      "",
      "This command printed these steps. It ran nothing and changed no setting.",
      "Run the commands yourself as the repository owner. See docs/BRANCH-PROTECTION.md for the reasons.",
      "",
      `1. Confirm that pull requests on ${repo} report a status check named \`${check}\`. Open a recent pull request and read its checks.`,
      "",
      "2. Require the check on the branch:",
      "",
      `gh api --method PUT repos/${repo}/branches/${branch}/protection --input - <<'JSON'`,
      ...body.split("\n"),
      "JSON",
      "",
      "3. Give each machine its own fine-grained token, limited to the repositories it works on.",
      "   Grant Contents and Pull requests (read and write) and nothing else.",
      "   Never give an agent a token with the Administration permission: it can edit or remove this rule.",
      "",
      "4. Verify it:",
      "",
      `git push origin HEAD:${branch}     # on a throwaway branch with no pull request. The forge must refuse it.`,
      `gh api repos/${repo}/branches/${branch}/protection     # required_status_checks.contexts must list \`${check}\`.`,
      "",
      "A submitted approval form is not proof of a human. This protection and scoped tokens are the backstop for the merge gate.",
      "",
    ].join("\n"),
  };
}
