import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findDanglingCitations, findDuplicateHeadings, type TextFile } from "../fixtures/decision-log.ts";

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
});
