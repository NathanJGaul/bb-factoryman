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
  it("[A718] keeps the resolver pure: it imports only types and the machine vocabulary", () => {
    for (const file of ["src/dispatch/resolver.ts", "src/dispatch/types.ts"]) {
      const text = readFileSync(new URL(file, root), "utf8");
      const imports = [...text.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1] as string);
      for (const target of imports) {
        expect(["../machine/types", "./types"], `${file} imports ${target}`).toContain(target);
      }
    }
  });
  it("[A918] keeps src/machine free of any import from the layers above it", () => {
    const above = ["bb", "dispatch", "workflow", "machines", "rpc", "wiring", "tools", "limits", "store", "git", "validator", "runtime", "server", "exec", "files"];
    const dir = new URL("src/machine/", root);
    for (const name of readdirSync(dir).filter((file) => !file.endsWith(".test.ts"))) {
      const imports = [...readFileSync(new URL(name, dir), "utf8").matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1] as string);
      for (const target of imports) {
        const first = target.replace(/^(\.\.\/)+/, "").split("/")[0] ?? "";
        expect(above, `${name} imports ${target}`).not.toContain(first);
      }
    }
  });
});
