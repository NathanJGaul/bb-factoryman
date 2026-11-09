import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tmpDir } from "../fixtures/git-repo";

const ROOT = new URL("../../", import.meta.url).pathname;
const VITEST = join(ROOT, "node_modules/vitest/vitest.mjs");
const CONFIG = "test/fixtures/leak/vitest.config.ts";

/** Every path under `dir`, so a directory that sits one level down still shows. */
const entries = (dir: string): string[] => readdirSync(dir, { recursive: true, encoding: "utf8" });
const leaks = (dir: string) => entries(dir).filter((entry) => /(^|\/)bb-fake-plugin-host-[^/]+$/.test(entry));

/**
 * Run the two leaky fixtures in a child `vitest` process with its own temporary directory.
 * The cleanup runs after a test file, so only a second process can look at what is left.
 */
function child(withSetup: boolean): { output: string; remaining: string[] } {
  const tmp = tmpDir("leak-child-");
  mkdirSync(tmp, { recursive: true });
  const env: Record<string, string> = { PATH: process.env["PATH"] ?? "/usr/bin:/bin", HOME: process.env["HOME"] ?? tmp, TMPDIR: tmp, NO_COLOR: "1", ...(withSetup ? {} : { LEAK_WITHOUT_SETUP: "1" }) };
  const run = spawnSync(process.execPath, [VITEST, "run", "--config", CONFIG], { cwd: ROOT, env, encoding: "utf8", timeout: 120_000 });
  return { output: `${run.stdout}${run.stderr}`, remaining: leaks(tmp) };
}

describe("the temporary directories of the fake plugin host", () => {
  it("[A1511] are gone after a test file that builds hosts and disposes none, and after a test that fails", () => {
    // The control run proves that the fixtures leak: with no setup file, a host directory stays for each of the three hosts.
    const control = child(false);
    expect(control.output).toMatch(/Test Files\s+1 failed \| 1 passed \(2\)/);
    expect(control.remaining).toHaveLength(3);
    // With the setup file, the same fixtures leave nothing, and the failing fixture still reports its failure.
    const fixed = child(true);
    expect(fixed.output).toMatch(/Test Files\s+1 failed \| 1 passed \(2\)/);
    expect(fixed.remaining).toEqual([]);
  }, 180_000);
});
