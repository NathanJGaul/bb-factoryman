import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { section } from "../fixtures/markdown";

const root = new URL("../../", import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), "utf8");
const decisions = (): string => read("docs/DECISIONS.md");

const HEADING = /^### D-(\d+): (.+) \((.+)\)$/;
const decisionHeadings = (text: string) =>
  text
    .split("\n")
    .map((line) => HEADING.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({ number: Number(match[1]), title: match[2] as string, status: match[3] as string }));

/** Every Markdown file under a directory of the repository, as a path relative to the repository root. */
function markdownIn(dir: string): string[] {
  const base = new URL(`${dir}/`, root);
  const walk = (current: string): string[] =>
    readdirSync(current).flatMap((entry) => {
      const full = join(current, entry);
      return statSync(full).isDirectory() ? walk(full) : full.endsWith(".md") ? [full] : [];
    });
  return walk(base.pathname).map((full) => full.slice(new URL(".", root).pathname.length));
}

describe("the decision record of the harness work", () => {
  it("[A1345] holds D-100 to D-108 in order after D-099, each with a status", () => {
    const found = decisionHeadings(decisions());
    const numbers = found.map((entry) => entry.number);
    expect(numbers.slice(numbers.indexOf(99), numbers.indexOf(99) + 10)).toEqual([99, 100, 101, 102, 103, 104, 105, 106, 107, 108]);
    expect(found.find((entry) => entry.number === 100)?.status).toMatch(/Decided by the captain/);
    expect(found.find((entry) => entry.number === 108)?.status).toMatch(/for the captain to accept/);
  });

  it("[A1345] records the five decisions in D-100, and the tasks built in one sentence and the tasks left open in another", () => {
    const text = section(decisions(), "### D-100:");
    for (const decision of ["D1 A", "D2 A", "D3 A", "D4 B", "D5 A"]) expect(text, decision).toMatch(new RegExp(`^- ${decision}:`, "m"));
    const built = /^This release builds[^\n]*/m.exec(text)?.[0] ?? "";
    const open = /^The tasks H4[^\n]*/m.exec(text)?.[0] ?? "";
    expect(built, "the sentence that lists the tasks built").not.toBe("");
    expect(open, "the sentence that lists the tasks left open").not.toBe("");
    const mentions = (sentence: string, task: string) => new RegExp(`\\b${task}\\b`).test(sentence);
    for (const task of ["H5", "H1", "H11", "H10", "H2", "H3"]) {
      expect(mentions(built, task), `${task} is built`).toBe(true);
      expect(mentions(open, task), `${task} is not open`).toBe(false);
    }
    for (const task of ["H4", "H6", "H9", "H12", "H13", "H14"]) {
      expect(mentions(open, task), `${task} is open`).toBe(true);
      expect(mentions(built, task), `${task} is not built`).toBe(false);
    }
    expect(open).toMatch(/stay open/);
  });

  it("[A1346] keeps the text of D-063 and adds an Amended by D-104 line", () => {
    const text = section(decisions(), "### D-063:");
    expect(text).toContain('The design lists "the plugin\'s built-in default" as the last rung and does not name one.');
    expect(text).toContain("If the built-in provider is unavailable, dispatch blocks (FR-708).");
    expect(text).toContain("It never falls back to another provider.");
    expect(text).toMatch(/Amended by D-104/);
  });

  it("[A1347] adds an Amended by D-105 line to D-064 that records the per-provider ladder", () => {
    const text = section(decisions(), "### D-064:");
    expect(text).toContain("Reasoning level IDs are provider-specific (spike item 29), so the ladder lives in the config");
    expect(text).toMatch(/Amended by D-105/);
    const amendment = section(decisions(), "### D-105:");
    expect(amendment).toMatch(/record/i);
    expect(amendment).toMatch(/provider ID/i);
    expect(amendment).toMatch(/cannot be ranked/);
  });

  it("[A1348] names no built-in default profile in the docs outside the decision log, nor in the skills", () => {
    const files = [...markdownIn("docs"), ...markdownIn("skills")].filter((path) => path !== "docs/DECISIONS.md");
    expect(files).toEqual(expect.arrayContaining(["docs/DESIGN.md", "docs/LIVE-CHECK.md", "skills/factoryman-worker/SKILL.md", "skills/factoryman-supervisor/SKILL.md"]));
    for (const path of files) expect(read(path), path).not.toMatch(/built-in default/i);
  });

  it("[A1348] states the new last rung in the design: dispatch blocks and names the init command", () => {
    const design = read("docs/DESIGN.md");
    expect(design).toContain("bb factoryman dispatch init");
    expect(design).toMatch(/4\. No profile: dispatch blocks/);
  });

  it("[A1348] tells the runbook reader to stop when dispatch blocks with no_default_profile though dispatch.json exists", () => {
    expect(read("docs/LIVE-CHECK.md")).toContain("If dispatch blocks with `no_default_profile` although `dispatch.json` exists, stop and record it.");
  });
});
