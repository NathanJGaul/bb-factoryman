import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../", import.meta.url);

function isDirectory(path: string): boolean {
  const url = new URL(path, root);
  return existsSync(url) && statSync(url).isDirectory();
}

describe("repository layout", () => {
  it("[U208] has the milestone 1 to 7 directories and none for the later milestones", () => {
    for (const dir of ["src/machine", "src/store", "src/dispatch", "spike", "docs"]) {
      expect(isDirectory(dir), `${dir} should exist`).toBe(true);
    }
    for (const dir of ["skills"]) {
      expect(isDirectory(dir), `${dir} should not exist yet`).toBe(false);
    }
  });

  it("[A714] keeps src/machine free of any import from src/dispatch", () => {
    const dir = new URL("src/machine/", root);
    for (const name of readdirSync(dir)) {
      expect(readFileSync(new URL(name, dir), "utf8"), `${name} must not import from dispatch`).not.toMatch(/(?:from|import\()\s*["'][^"']*dispatch/);
    }
  });
});
