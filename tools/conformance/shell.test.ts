import { describe, expect, it } from "vitest";
import { exec } from "./shell.ts";

const ENV = { PATH: process.env["PATH"] ?? "/usr/bin:/bin" };

describe("exec", () => {
  it("[U1415] returns when the command exits, even when a background child still holds its output pipe", async () => {
    const started = Date.now();
    const result = await exec("bash", ["-c", "sleep 2 & echo started"], { env: ENV });
    expect(result.stdout.trim()).toBe("started");
    expect(result.code).toBe(0);
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  it("[U1416] stops a command that outlives its time limit and says so", async () => {
    const result = await exec("bash", ["-c", "sleep 30"], { env: ENV, timeoutMs: 300 });
    expect(result.code).not.toBe(0);
    expect(result.stderr).toMatch(/timed out after 300 ms/);
  });

  it("collects output and the exit code of an ordinary command", async () => {
    const result = await exec("bash", ["-c", "echo out; echo err >&2; exit 3"], { env: ENV });
    expect(result).toMatchObject({ code: 3, stdout: "out\n", stderr: "err\n" });
  });
});
