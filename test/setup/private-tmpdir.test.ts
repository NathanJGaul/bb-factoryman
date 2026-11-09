import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { tmpDir } from "../fixtures/git-repo";
import { createPrivateTmpdir } from "./private-tmpdir.ts";

describe("createPrivateTmpdir", () => {
  it("[U1524] makes a new directory inside the current temporary directory and points TMPDIR at it", () => {
    const parent = tmpDir("private-parent-");
    const env: NodeJS.ProcessEnv = { TMPDIR: parent };
    const handle = createPrivateTmpdir(env);
    expect(dirname(handle.dir)).toBe(parent);
    expect(basename(handle.dir)).toMatch(/^bb-factoryman-test-/);
    expect(existsSync(handle.dir)).toBe(true);
    expect(env["TMPDIR"]).toBe(handle.dir);
    handle.restore();
  });

  it("[U1525] removes the directory with everything inside it on restore, and puts the earlier TMPDIR back", () => {
    const parent = tmpDir("private-parent-");
    const env: NodeJS.ProcessEnv = { TMPDIR: parent };
    const handle = createPrivateTmpdir(env);
    expect(env["TMPDIR"]).toBe(handle.dir);
    mkdirSync(join(handle.dir, "bb-fake-plugin-host-abc", "nested"), { recursive: true });
    writeFileSync(join(handle.dir, "bb-fake-plugin-host-abc", "nested", "data.db"), "x");
    handle.restore();
    expect(existsSync(handle.dir)).toBe(false);
    expect(env["TMPDIR"]).toBe(parent);
    expect(readdirSync(parent)).toEqual([]);
  });

  it("[U1526] unsets TMPDIR on restore when it was unset before, and makes the directory in the platform's temporary directory", () => {
    const env: NodeJS.ProcessEnv = {};
    const handle = createPrivateTmpdir(env);
    expect(dirname(handle.dir)).toBe(tmpdir());
    expect(env["TMPDIR"]).toBe(handle.dir);
    handle.restore();
    expect("TMPDIR" in env).toBe(false);
    expect(existsSync(handle.dir)).toBe(false);
  });

  it("[U1527] removes only the directory it made, and leaves a sibling in the same parent", () => {
    const parent = tmpDir("private-parent-");
    const sibling = join(parent, "bb-fake-plugin-host-other-run");
    mkdirSync(sibling);
    const handle = createPrivateTmpdir({ TMPDIR: parent });
    expect(readdirSync(parent).sort()).toEqual([basename(handle.dir), "bb-fake-plugin-host-other-run"].sort());
    handle.restore();
    expect(existsSync(sibling)).toBe(true);
    expect(readdirSync(parent)).toEqual(["bb-fake-plugin-host-other-run"]);
  });

  it("[U1528] does not throw when restore is called twice, and keeps the restored TMPDIR", () => {
    const parent = tmpDir("private-parent-");
    const env: NodeJS.ProcessEnv = { TMPDIR: parent };
    const handle = createPrivateTmpdir(env);
    expect(env["TMPDIR"]).toBe(handle.dir);
    handle.restore();
    expect(existsSync(handle.dir)).toBe(false);
    expect(() => handle.restore()).not.toThrow();
    expect(env["TMPDIR"]).toBe(parent);
  });

  it("[U1534] makes its directory in the platform's temporary directory when TMPDIR is the empty string, and puts the empty string back", () => {
    const env: NodeJS.ProcessEnv = { TMPDIR: "" };
    const handle = createPrivateTmpdir(env);
    expect(dirname(handle.dir)).toBe(tmpdir());
    handle.restore();
    expect(env["TMPDIR"]).toBe("");
    expect(existsSync(handle.dir)).toBe(false);
  });

  it("[U1535] leaves a TMPDIR that changed between two restore calls alone", () => {
    const parent = tmpDir("private-parent-");
    const env: NodeJS.ProcessEnv = { TMPDIR: parent };
    const handle = createPrivateTmpdir(env);
    handle.restore();
    env["TMPDIR"] = "/changed/by/another/hook";
    handle.restore();
    expect(env["TMPDIR"]).toBe("/changed/by/another/hook");
  });
});

