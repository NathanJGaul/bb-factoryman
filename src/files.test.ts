import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

describe("nodeFiles.writeNew", () => {
  function tempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "factoryman-files-"));
    dirs.push(dir);
    return dir;
  }

  it("[U1405] creates the missing directory and the file, and returns written", async () => {
    const path = join(tempDir(), ".bb", "factoryman", "dispatch.json");
    expect(await nodeFiles.writeNew(path, '{"a":1}\n')).toBe("written");
    expect(readFileSync(path, "utf8")).toBe('{"a":1}\n');
  });

  it("[U1406] returns exists for an existing file and leaves its content unchanged", async () => {
    const path = join(tempDir(), "dispatch.json");
    writeFileSync(path, "original");
    expect(await nodeFiles.writeNew(path, "replacement")).toBe("exists");
    expect(readFileSync(path, "utf8")).toBe("original");
  });

  it("[U1407] rethrows a failure that is not exists", async () => {
    const dir = tempDir();
    writeFileSync(join(dir, "a-file"), "x");
    // `mkdir` fails first with EEXIST (a file is in the way), and that error must not be read as "the file exists".
    await expect(nodeFiles.writeNew(join(dir, "a-file", "below.json"), "x")).rejects.toMatchObject({ code: "EEXIST" });
    // The directory is fine here and the write itself fails, so only the write's own error handling is tested.
    const PAST_THE_NAME_LIMIT = 300; // past the 255-byte file name limit of the common filesystems
    await expect(nodeFiles.writeNew(join(dir, "x".repeat(PAST_THE_NAME_LIMIT)), "x")).rejects.toMatchObject({ code: "ENAMETOOLONG" });
  });
});
