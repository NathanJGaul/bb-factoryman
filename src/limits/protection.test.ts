import { describe, expect, it } from "vitest";
import { protectionSteps } from "./protection";

const steps = (repo = "acme/widgets", branch = "main", check = "no-mistakes") => {
  const result = protectionSteps({ repo, branch, check });
  if (!result.ok) throw new Error(result.message);
  return result.text;
};

describe("protectionSteps", () => {
  it("[U1020] names the repo, the branch, the check, and the gh api commands", () => {
    const text = steps("acme/widgets", "trunk", "ci/no-mistakes");
    expect(text).toContain("gh api --method PUT repos/acme/widgets/branches/trunk/protection");
    expect(text).toContain('"contexts": ["ci/no-mistakes"]');
    expect(text).toContain('"enforce_admins": true');
    expect(text).toContain('"allow_force_pushes": false');
    expect(text).toContain("gh api repos/acme/widgets/branches/trunk/protection");
    expect(text).toMatch(/Administration/);
    expect(text).toMatch(/git push origin HEAD:trunk/);
  });

  it("[U1021] says it ran nothing, and rejects a repo that is not owner/name or a name with odd characters", () => {
    expect(steps()).toMatch(/ran nothing and changed no setting/);
    for (const repo of ["acme", "acme/", "/widgets", "a/b/c", "acme/wid gets", "acme/widgets; rm -rf /", ""]) {
      expect(protectionSteps({ repo, branch: "main", check: "no-mistakes" }).ok, repo).toBe(false);
    }
    for (const branch of ["", "-x", "a b", "main;ls", "../x"]) {
      expect(protectionSteps({ repo: "acme/widgets", branch, check: "no-mistakes" }).ok, branch).toBe(false);
    }
    expect(protectionSteps({ repo: "acme/widgets", branch: "main", check: 'bad"check' }).ok).toBe(false);
  });
});
