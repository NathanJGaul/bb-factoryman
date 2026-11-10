import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { prose, section } from "../fixtures/markdown";

const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const decision = (number: string): string => read("docs/DECISIONS.md").split(new RegExp(`^### ${number}:`, "m"))[1]?.split(/^### /m)[0] ?? "";

describe("the registry apply documents", () => {
  it("[A1910] CUTOVER shows the apply command and keeps what the import does not do", () => {
    const cutover = read("docs/CUTOVER.md");
    expect(cutover).toContain("bb factoryman import-registry --file /path/to/firstmate/data/projects.md --apply --project <name>");
    const limits = section(cutover, "## What the import does not do");
    expect(prose(limits)).not.toMatch(/follow-up|does not write the project's config/i);
    expect(limits).toMatch(/tasks, approvals, or history/);
    expect(limits).toMatch(/does not touch firstmate/i);
    expect(limits).toMatch(/one project/);
    expect(limits).toMatch(/base branch/);
    expect(limits).toMatch(/default machine/);
    expect(cutover).toMatch(/one at a time/);
  });

  it("[A1910] D-148 records the decision, and D-078 and D-088 point to it", () => {
    const text = decision("D-148");
    expect(text).not.toBe("");
    for (const needle of ["--apply", "--project", "flagged", "yolo", "no-mistakes-prod-only", "idempotent", "baseBranch", "defaultMachine", "no event"]) {
      expect(text, needle).toContain(needle);
    }
    expect(decision("D-078")).toContain("D-148");
    expect(decision("D-088")).toContain("D-148");
    expect(decision("D-088")).not.toMatch(/`--apply` is refused/);
  });

  it("[A1910] LIVE-CHECK and the supervisor skill no longer say that apply is refused or that the import changes nothing", () => {
    const live = read("docs/LIVE-CHECK.md");
    expect(live).not.toMatch(/--apply` is refused/);
    expect(live).toContain("import-registry --file <registry copy> --apply --project");
    const skill = read("skills/factoryman-supervisor/SKILL.md");
    expect(skill).toContain("--apply --project");
    expect(skill).toContain("previews the move from firstmate. It changes nothing.");
  });
});
