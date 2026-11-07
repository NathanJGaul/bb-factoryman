import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { nodeFiles } from "./files";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("nodeFiles.readText", () => {
  function setup(): string {
    const dir = mkdtempSync(join(tmpdir(), "factoryman-files-"));
    dirs.push(dir);
    writeFileSync(join(dir, "a.json"), '{"a":1}');
    return dir;
  }

  it("[U743] returns the text of a file", async () => {
    expect(await nodeFiles.readText(join(setup(), "a.json"))).toBe('{"a":1}');
  });

  it("[U743] returns null for a missing file, and for a path below a file", async () => {
    const dir = setup();
    expect(await nodeFiles.readText(join(dir, "missing.json"))).toBeNull();
    expect(await nodeFiles.readText(join(dir, "a.json", "below.json"))).toBeNull();
  });

  it("[U743] throws for a failure that is not a missing file", async () => {
    await expect(nodeFiles.readText(setup())).rejects.toThrow();
  });
});
