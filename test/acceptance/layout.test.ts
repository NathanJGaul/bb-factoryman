import { existsSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../", import.meta.url);

function isDirectory(path: string): boolean {
  const url = new URL(path, root);
  return existsSync(url) && statSync(url).isDirectory();
}

describe("repository layout", () => {
  it("has the milestone 1 to 3 directories and none for later milestones", () => {
    for (const dir of ["src/machine", "src/store", "spike", "docs"]) {
      expect(isDirectory(dir), `${dir} should exist`).toBe(true);
    }
    for (const dir of ["src/tools", "src/dispatch", "skills"]) {
      expect(isDirectory(dir), `${dir} should not exist yet`).toBe(false);
    }
  });
});
