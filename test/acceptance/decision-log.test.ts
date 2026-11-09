import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findDanglingCitations, findDuplicateHeadings, headingNumbers, type TextFile } from "../fixtures/decision-log";

const ROOT = new URL("../../", import.meta.url).pathname;
const TEXT = /\.(md|ts|tsx|json|ya?ml)$/;
const log = () => readFileSync(join(ROOT, "docs/DECISIONS.md"), "utf8");

/** The tracked text files of the repository, except the lock file. */
function trackedText(): TextFile[] {
  const listed = spawnSync("git", ["ls-files", "-z"], { cwd: ROOT, encoding: "utf8" });
  expect(listed.status, listed.stderr).toBe(0);
  return listed.stdout
    .split("\0")
    .filter((path) => path !== "" && TEXT.test(path) && path !== "pnpm-lock.yaml")
    .map((path) => ({ path, text: readFileSync(join(ROOT, path), "utf8") }));
}

describe("docs/DECISIONS.md", () => {
  it("[A1509] gives every decision number one heading", () => {
    const duplicates = findDuplicateHeadings(log());
    expect(duplicates.map((d) => `${d.number} on lines ${d.lines.join(", ")}`)).toEqual([]);
  });

  it("[A1510] has a heading for every decision number that a tracked file cites", () => {
    const dangling = findDanglingCitations(log(), trackedText());
    expect(dangling.map((d) => `${d.path}:${d.line} cites ${d.number}`)).toEqual([]);
  });

  it("[A1515] holds headings that the checker can read, from D-001 to a number that is not older than D-117", () => {
    const numbers = headingNumbers(log());
    expect(numbers[0]).toBe("D-001");
    expect((numbers.at(-1) ?? "") >= "D-117").toBe(true);
  });

  it("[A1618] holds the headings of this feature from D-123 on, and the constitution is at 1.4.0 with Principle VI naming H4 and H12", () => {
    const numbers = headingNumbers(log());
    expect(numbers).toContain("D-123");
    expect((numbers.at(-1) ?? "") >= "D-123").toBe(true);
    const constitution = readFileSync(join(ROOT, ".specify/memory/constitution.md"), "utf8");
    expect(constitution).toMatch(/\*\*Version\*\*: 1\.4\.0 /);
    const principle = constitution.split("### VI.")[1]?.split("\n### ")[0] ?? "";
    expect(principle).toMatch(/\bH4\b/);
    expect(principle).toMatch(/\bH12\b/);
    expect(principle).toMatch(/D-129/);
  });
});
