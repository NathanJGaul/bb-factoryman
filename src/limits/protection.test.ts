import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  it.each([";", "&", "|", "$", "`", "(", ")", "<", ">", "\"", "'", "\\", "*", "!", " ", "\n"])("[U1054] rejects the character %j in the repo owner, the repo name, the branch, and the check", (character) => {
    expect(protectionSteps({ repo: `ac${character}me/widgets`, branch: "main", check: "no-mistakes" }).ok, "owner").toBe(false);
    expect(protectionSteps({ repo: `acme/wid${character}gets`, branch: "main", check: "no-mistakes" }).ok, "name").toBe(false);
    expect(protectionSteps({ repo: "acme/widgets", branch: `ma${character}in`, check: "no-mistakes" }).ok, "branch").toBe(false);
    if (character !== " ") expect(protectionSteps({ repo: "acme/widgets", branch: "main", check: `no${character}mistakes` }).ok, "check").toBe(false);
  });

  it("[U1055] rejects a double dot in the repo and in the branch", () => {
    expect(protectionSteps({ repo: "acme/wid..gets", branch: "main", check: "no-mistakes" }).ok).toBe(false);
    expect(protectionSteps({ repo: "ac..me/widgets", branch: "main", check: "no-mistakes" }).ok).toBe(false);
    expect(protectionSteps({ repo: "acme/widgets", branch: "ma..in", check: "no-mistakes" }).ok).toBe(false);
  });

  it("[U1056] prints a here-document that a shell can run: the end marker starts its line, and gh receives the whole JSON", () => {
    const text = steps("acme/widgets", "main", "no-mistakes");
    const start = text.split("\n").findIndex((line) => line.startsWith("gh api --method PUT"));
    expect(start, "the command starts its line").toBeGreaterThanOrEqual(0);
    const lines = text.split("\n");
    const end = lines.findIndex((line, index) => index > start && line === "JSON");
    expect(end, "the end marker starts its line").toBeGreaterThan(start);
    const script = lines.slice(start, end + 1).join("\n");
    const dir = mkdtempSync(join(tmpdir(), "factoryman-gh-"));
    try {
      writeFileSync(join(dir, "gh"), '#!/bin/sh\ncat > "$GH_STDIN"\necho "$@" > "$GH_ARGS"\n', { mode: 0o755 });
      const run = spawnSync("bash", ["-c", script], { env: { ...process.env, PATH: `${dir}:${process.env["PATH"]}`, GH_STDIN: join(dir, "stdin"), GH_ARGS: join(dir, "args") }, encoding: "utf8" });
      expect(run.status, run.stderr).toBe(0);
      const body = JSON.parse(readFileSync(join(dir, "stdin"), "utf8")) as { required_status_checks: { contexts: string[] }; enforce_admins: boolean };
      expect(body.required_status_checks.contexts).toEqual(["no-mistakes"]);
      expect(body.enforce_admins).toBe(true);
      expect(readFileSync(join(dir, "args"), "utf8")).toContain("repos/acme/widgets/branches/main/protection");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
