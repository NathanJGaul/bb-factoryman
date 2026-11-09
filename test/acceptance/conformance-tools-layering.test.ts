import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../../", import.meta.url).pathname;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

describe("the tools and the plugin", () => {
  it("[A1330] has no file under tools/ that imports from src/ or from @get-bb/*", () => {
    const sources = files(join(ROOT, "tools")).filter((path) => /\.ts$/.test(path) && !path.endsWith(".test.ts"));
    expect(sources.length).toBeGreaterThan(20);
    for (const path of sources) {
      const imports = [...readFileSync(path, "utf8").matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1] as string);
      for (const target of imports) {
        expect(target, `${relative(ROOT, path)} imports ${target}`).not.toMatch(/(^|\/)src(\/|$)|^@get-bb\//);
      }
    }
  });
});
