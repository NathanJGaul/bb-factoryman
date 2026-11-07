import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { frame } from "../../test/fixtures/frame";
import { FakeBbPort } from "../../test/fixtures/bb-port";
import type { Exec, ExecResult } from "../exec";
import { createRemoteRunner, decodeFrame, routeExec, WRAPPER } from "./remote-exec";

function setup(options: { pollMs?: number; timeoutMs?: number } = {}) {
  const bb = new FakeBbPort();
  const sleeps: number[] = [];
  const run = createRemoteRunner(bb, async (ms) => void sleeps.push(ms), { pollMs: 100, timeoutMs: 1000, ...options });
  return { bb, run, sleeps };
}

const exited = (output: string, exitCode = 0) => ({ status: "exited", exitCode, output, truncated: false });

describe("createRemoteRunner", () => {
  it("[U824] starts one terminal on the host with sh -c <wrapper> sh <command> <args> in the given directory", async () => {
    const { bb, run } = setup();
    bb.terminalReads = [exited(frame(0))];
    await run("host_gpu", "git", ["status", "--porcelain"], { cwd: "/work/gpu" });
    expect(bb.terminalRuns).toHaveLength(1);
    const [terminal] = bb.terminalRuns;
    expect(terminal?.hostId).toBe("host_gpu");
    expect(terminal?.cwd).toBe("/work/gpu");
    expect(terminal?.argv.slice(0, 2)).toEqual(["sh", "-c"]);
    expect(terminal?.argv[2]).toMatch(/mktemp/);
    expect(terminal?.argv.slice(3)).toEqual(["sh", "git", "status", "--porcelain"]);
  });

  it("[U825] decodes the FMX1 frame into exit code, standard output, and standard error", async () => {
    const { bb, run } = setup();
    bb.terminalReads = [exited(`some noise\r\n${frame(4, "out-line\n", "err-line\n")}`)];
    expect(await run("h", "sh", ["-c", "x"])).toEqual({ code: 4, stdout: "out-line\n", stderr: "err-line\n" });
    bb.terminalReads = [exited(frame(0))];
    expect(await run("h", "true", [])).toEqual({ code: 0, stdout: "", stderr: "" });
    bb.terminalReads = [exited(frame(0, "héllo ✓\n"))];
    expect(await run("h", "echo", [])).toMatchObject({ stdout: "héllo ✓\n" });
  });

  it("[U826] polls until the terminal leaves running and sleeps between reads", async () => {
    const { bb, run, sleeps } = setup();
    bb.terminalReads = [
      { status: "running", exitCode: null, output: "", truncated: false },
      { status: "running", exitCode: null, output: "", truncated: false },
      exited(frame(0, "done")),
    ];
    expect(await run("h", "x", [])).toMatchObject({ code: 0, stdout: "done" });
    expect(sleeps).toEqual([100, 100]);
  });

  it("[U827] closes a terminal that never exits and reports a timeout", async () => {
    const { bb, run } = setup({ pollMs: 100, timeoutMs: 300 });
    bb.terminalReads = [{ status: "running", exitCode: null, output: "", truncated: false }];
    const result = await run("h", "slow", []);
    expect(result).toMatchObject({ code: null });
    expect(result.error).toMatch(/timed out after 300 ms/);
    expect(bb.terminalClosed).toEqual(["term-1"]);
  });

  it("[U828] reports output with no frame as an error that quotes its tail", async () => {
    const { bb, run } = setup();
    bb.terminalReads = [exited("sh: 1: base64: not found\r\n", 0)];
    const result = await run("h", "x", []);
    expect(result.code).toBeNull();
    expect(result.error).toMatch(/no result frame/);
    expect(result.error).toContain("base64: not found");
  });

  it("[U829] treats truncated output as an error", async () => {
    const { bb, run } = setup();
    bb.terminalReads = [{ status: "exited", exitCode: 0, output: frame(0, "x"), truncated: true }];
    const result = await run("h", "x", []);
    expect(result.code).toBeNull();
    expect(result.error).toMatch(/truncated/);
  });

  it("[U830] returns an error result, and does not throw, when the terminal cannot start or be read", async () => {
    const { bb, run } = setup();
    bb.terminalStartError = new Error("host is gone");
    expect(await run("h", "x", [])).toMatchObject({ code: null, error: expect.stringContaining("host is gone") });
    bb.terminalStartError = null;
    bb.terminalReadError = new Error("read failed");
    expect(await run("h", "x", [])).toMatchObject({ code: null, error: expect.stringContaining("read failed") });
  });

  it("[U831] closes the terminal after a result and after an error", async () => {
    const { bb, run } = setup();
    bb.terminalReads = [exited(frame(0))];
    await run("h", "x", []);
    bb.terminalReads = [exited("garbage")];
    await run("h", "x", []);
    bb.terminalReadError = new Error("read failed");
    await run("h", "x", []);
    expect(bb.terminalClosed).toEqual(["term-1", "term-2", "term-3"]);
  });

  it("[U872] reports a terminal that disconnected as an error", async () => {
    const { bb, run } = setup();
    bb.terminalReads = [{ status: "disconnected", exitCode: null, output: "", truncated: false }];
    expect(await run("h", "x", [])).toMatchObject({ code: null, error: expect.stringMatching(/disconnected/) });
  });
});

describe("routeExec", () => {
  it("[U832] runs locally with no host and remotely with a host", async () => {
    const local: Exec = async () => ({ code: 0, stdout: "local", stderr: "" });
    const remote = async (host: string) => ({ code: 0, stdout: `remote:${host}`, stderr: "" });
    const exec = routeExec(local, remote);
    expect((await exec("git", ["x"])).stdout).toBe("local");
    expect((await exec("git", ["x"], { cwd: "/w" })).stdout).toBe("local");
    expect((await exec("git", ["x"], { host: null })).stdout).toBe("local");
    expect((await exec("git", ["x"], { host: "host_gpu", cwd: "/w" })).stdout).toBe("remote:host_gpu");
  });
});

describe("the FMX1 wrapper, run by a real shell", () => {
  /** Run `WRAPPER` the way the terminal does: `sh -c <wrapper> sh <command> <args>`. */
  function runWrapped(command: string, args: string[], cwd?: string): ExecResult | null {
    const run = spawnSync("sh", ["-c", WRAPPER, "sh", command, ...args], { encoding: "utf8", cwd });
    return decodeFrame(run.stdout.replace(/\n/g, "\r\n"));
  }

  it("[U878] reports exit code 0 with empty streams", () => {
    expect(runWrapped("true", [])).toEqual({ code: 0, stdout: "", stderr: "" });
  });

  it("[U878] reports a non-zero exit code with output on both streams, kept apart", () => {
    expect(runWrapped("sh", ["-c", "echo out-line; echo err-line >&2; exit 3"])).toEqual({ code: 3, stdout: "out-line\n", stderr: "err-line\n" });
  });

  it("[U878] reports the exit code of a failing git command in a directory that is not a repository", () => {
    const dir = mkdtempSync(join(tmpdir(), "factoryman-wrapper-"));
    try {
      const result = runWrapped("git", ["status", "--porcelain"], dir);
      expect(result?.code).not.toBe(0);
      expect(result?.stderr).toMatch(/not a git repository/i);
      expect(result?.stdout).toBe("");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("[U878] reports exit code 127 and the error for a command that does not exist", () => {
    const result = runWrapped("factoryman-no-such-command", []);
    expect(result?.code).toBe(127);
    expect(result?.stdout).toBe("");
  });

  it("[U878] carries multi-line output and non-ASCII text through the frame", () => {
    expect(runWrapped("sh", ["-c", "printf 'a\\nb\\n'; printf 'h\\303\\251llo' >&2"])).toEqual({ code: 0, stdout: "a\nb\n", stderr: "héllo" });
  });
});

describe("createRemoteRunner terminal states", () => {
  it("[U881] keeps polling while the terminal is starting", async () => {
    const bb = new FakeBbPort();
    bb.terminalReads = [{ status: "starting", exitCode: null, output: "", truncated: false }, { status: "exited", exitCode: 0, output: frame(0, "ok"), truncated: false }];
    const run = createRemoteRunner(bb, async () => undefined, { pollMs: 10, timeoutMs: 100 });
    expect(await run("h", "x", [])).toMatchObject({ code: 0, stdout: "ok" });
  });
});
