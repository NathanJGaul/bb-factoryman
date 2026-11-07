import { mkdtempSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { runCommand } from "./exec";

const node = process.execPath;

describe("runCommand", () => {
  it("[U1] returns stdout, stderr, and exit code 0 for a finished command", async () => {
    const result = await runCommand(node, ["-e", "console.log('out'); console.error('err')"]);
    expect(result).toEqual({ code: 0, stdout: "out\n", stderr: "err\n" });
  });

  it("[U2] returns the exit code and output of a failing command without throwing", async () => {
    const result = await runCommand(node, ["-e", "console.error('bad'); process.exit(3)"]);
    expect(result.code).toBe(3);
    expect(result.stderr).toBe("bad\n");
  });

  it("[U3] runs the command in the given cwd", async () => {
    const dir = realpathSync(mkdtempSync(`${tmpdir()}/exec-`));
    const result = await runCommand(node, ["-e", "console.log(process.cwd())"], { cwd: dir });
    expect(result.stdout.trim()).toBe(dir);
  });

  it("[U4] returns a failed result for a missing binary without throwing", async () => {
    const result = await runCommand("factoryman-no-such-binary", []);
    expect(result.code).toBeNull();
    expect(result.error).toMatch(/ENOENT|not found/i);
  });

  it("[U5] passes arguments literally with no shell interpretation", async () => {
    const result = await runCommand(node, ["-e", "console.log(process.argv[1])", "a; echo $(whoami) `id` | cat"]);
    expect(result.stdout.trim()).toBe("a; echo $(whoami) `id` | cat");
  });
});
