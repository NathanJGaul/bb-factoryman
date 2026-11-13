import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { prose, section } from "../fixtures/markdown";
import { loadWorld } from "../fixtures/plugin-host";

const root = new URL("../../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");
const decision = (number: string): string => read("docs/DECISIONS.md").split(new RegExp(`^### ${number}:`, "m"))[1]?.split(/^### /m)[0] ?? "";

describe("the base branch apply documents and help", () => {
  it("[A1506] the registered import-registry command shows --base-branch in its usage", async () => {
    const world = await loadWorld();
    const command = (world.host.harness.inspection.registrations.cli?.commands ?? []).find((entry) => entry.name === "import-registry");
    expect(command?.usage).toContain("--apply --project <name> [--base-branch <name>]");
  });

  it("[A1507] CUTOVER shows the flag, says a local-only project needs it, and no longer says the base branch is never written", () => {
    const cutover = read("docs/CUTOVER.md");
    expect(cutover).toContain("--apply --project <name> --base-branch <branch>");
    expect(cutover).toMatch(/local-only.*needs a base branch|needs a base branch.*local-only/is);
    const limits = prose(section(cutover, "## What the import does not do"));
    expect(limits).not.toMatch(/base branch and the default machine stay as stored/i);
    expect(limits).toMatch(/default machine/);
    expect(limits).toMatch(/base branch/);
  });

  it("[A1507] D-150 records the decision, and D-037, D-078, and D-148 point to it", () => {
    const text = decision("D-150");
    for (const needle of ["--base-branch", "workflow.json", "local-only", "checkBranchName", "Warning:", "no process", "D-148"]) expect(text, needle).toContain(needle);
    for (const number of ["D-037", "D-078", "D-148"]) expect(decision(number), number).toContain("D-150");
  });

  it("[A1507] LIVE-CHECK and the supervisor skill mention the flag", () => {
    expect(read("docs/LIVE-CHECK.md")).toContain("--base-branch");
    expect(read("skills/factoryman-supervisor/SKILL.md")).toContain("--base-branch");
  });
});
