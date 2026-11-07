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
  it("[U743] returns the text of a file, null for a missing file, and throws for another failure", async () => {
    const dir = mkdtempSync(join(tmpdir(), "factoryman-files-"));
    dirs.push(dir);
    writeFileSync(join(dir, "a.json"), '{"a":1}');
    expect(await nodeFiles.readText(join(dir, "a.json"))).toBe('{"a":1}');
    expect(await nodeFiles.readText(join(dir, "missing.json"))).toBeNull();
    expect(await nodeFiles.readText(join(dir, "a.json", "below.json"))).toBeNull();
    await expect(nodeFiles.readText(dir)).rejects.toThrow();
  });
});
