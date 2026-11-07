import { describe, expect, it } from "vitest";
import type { Exec, ExecResult } from "../exec";
import { failureText, runChecks } from "./checks";
import type { Check } from "./types";

function setup(results: Record<string, Partial<ExecResult>> = {}) {
  const calls: Array<{ line: string; cwd?: string; host?: string | null; timeoutMs?: number }> = [];
  const exec: Exec = async (command, args, options) => {
    const line = [command, ...args].join(" ");
    calls.push({ line, cwd: options?.cwd, host: options?.host, timeoutMs: options?.timeoutMs });
    return { code: 0, stdout: "", stderr: "", ...results[line] };
  };
  return { exec, calls };
}

const lint: Check = { name: "lint", argv: ["pnpm", "run", "lint"] };
const test: Check = { name: "test", argv: ["pnpm", "test"], timeoutSeconds: 90 };
const where = { cwd: "/work/tree", host: null };

describe("runChecks", () => {
  it("[U919] runs each check with argv[0], the rest as arguments, the worktree, the host, and the timeout", async () => {
    const { exec, calls } = setup();
    await runChecks(exec, [lint, test], { cwd: "/work/gpu/tree", host: "host_gpu" });
    expect(calls).toEqual([
      { line: "pnpm run lint", cwd: "/work/gpu/tree", host: "host_gpu", timeoutMs: undefined },
      { line: "pnpm test", cwd: "/work/gpu/tree", host: "host_gpu", timeoutMs: 90_000 },
    ]);
  });

  it("[U920] passes a check only on exit code 0", async () => {
    for (const [code, passed] of [[0, true], [1, false], [2, false], [127, false]] as const) {
      const { exec } = setup({ "pnpm run lint": { code } });
      const run = await runChecks(exec, [lint], where);
      expect(run.facts, String(code)).toEqual([{ name: "lint", passed }]);
    }
  });

  it("[U921] fails a check that cannot run and puts the error in its failure text", async () => {
    const { exec } = setup({ "pnpm run lint": { code: null, error: "spawn pnpm ENOENT" } });
    const run = await runChecks(exec, [lint], where);
    expect(run.facts).toEqual([{ name: "lint", passed: false }]);
    expect(run.failures[0]).toContain("spawn pnpm ENOENT");
  });

  it("[U922] runs every check, in order, even after one fails", async () => {
    const { exec, calls } = setup({ "pnpm run lint": { code: 1 } });
    const run = await runChecks(exec, [lint, test], where);
    expect(calls.map((call) => call.line)).toEqual(["pnpm run lint", "pnpm test"]);
    expect(run.facts).toEqual([{ name: "lint", passed: false }, { name: "test", passed: true }]);
    expect(run.failures).toHaveLength(1);
  });

  it("[U923] names each failing check with the tail of its output, cut to a limit", async () => {
    const long = `${"x".repeat(2000)}END`;
    const { exec } = setup({ "pnpm run lint": { code: 1, stdout: "ignored", stderr: long }, "pnpm test": { code: 3, stdout: "3 tests failed", stderr: "" } });
    const run = await runChecks(exec, [lint, test], where);
    const text = failureText(run);
    expect(text).toContain("lint");
    expect(text).toContain("END");
    expect(text).toContain("test");
    expect(text).toContain("3 tests failed");
    expect(run.failures[0]?.length).toBeLessThan(900);
    expect(failureText({ facts: [], failures: [] })).toBe("");
  });

  it("[U924] gives no facts and runs nothing when no check is configured", async () => {
    const { exec, calls } = setup();
    expect(await runChecks(exec, [], where)).toEqual({ facts: [], failures: [] });
    expect(calls).toEqual([]);
  });
});
