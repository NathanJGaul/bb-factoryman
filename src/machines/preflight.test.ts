import { describe, expect, it } from "vitest";
import { FakeBbPort } from "../../test/fixtures/bb-port";
import type { Exec, ExecResult } from "../exec";
import type { DeliveryMode } from "../machine/types";
import { preflightOnce, reportText, runPreflight, type PreflightInput } from "./preflight";

const HOST = { id: "host_gpu", name: "gpu-box", status: "connected", phase: "active", online: true };

function setup(failures: Record<string, Partial<ExecResult>> = {}) {
  const bb = new FakeBbPort();
  const calls: Array<{ line: string; cwd?: string; host?: string | null }> = [];
  const exec: Exec = async (command, args, options) => {
    const line = [command, ...args].join(" ");
    calls.push({ line, cwd: options?.cwd, host: options?.host });
    return { code: 0, stdout: "", stderr: "", ...failures[line] };
  };
  const input = (mode: DeliveryMode, provider: string | null = "claude"): PreflightInput => ({ host: HOST, sourcePath: "/work/gpu", mode, provider });
  return { bb, exec, calls, input };
}

const NM_INSTALLED = "sh -c command -v no-mistakes";
const NM_INIT = "git remote get-url no-mistakes";
const GH = "gh auth status";

describe("runPreflight", () => {
  it("[U838] gives an empty problem list for a machine that passes every check, and runs each check on the host", async () => {
    const { bb, exec, calls, input } = setup();
    expect(await runPreflight({ bb, exec }, input("no-mistakes"))).toEqual([]);
    expect(calls.map((call) => call.line)).toEqual(["git --version", NM_INSTALLED, NM_INIT, GH]);
    expect(calls.every((call) => call.host === "host_gpu" && call.cwd === "/work/gpu")).toBe(true);
    expect(bb.callsTo("listProviders")).toEqual([["host_gpu"]]);
  });

  it("[U839] reports an agent CLI that is not available on the host, for a named provider and for any provider", async () => {
    const { bb, exec, input } = setup();
    bb.providersByHost.set("host_gpu", [{ id: "claude", available: false, permissionModes: ["auto"], reasoningLevels: [] }]);
    const named = await runPreflight({ bb, exec }, input("local-only", "claude"));
    expect(named).toEqual([expect.objectContaining({ check: "agent_cli", message: expect.stringContaining("claude") })]);
    const any = await runPreflight({ bb, exec }, input("local-only", null));
    expect(any).toEqual([expect.objectContaining({ check: "agent_cli" })]);
    bb.providersByHost.set("host_gpu", [{ id: "claude", available: true, permissionModes: ["auto"], reasoningLevels: [] }]);
    expect(await runPreflight({ bb, exec }, input("local-only", null))).toEqual([]);
    // Another provider is available, but the task needs `claude`.
    bb.providersByHost.set("host_gpu", [
      { id: "claude", available: false, permissionModes: ["auto"], reasoningLevels: [] },
      { id: "codex", available: true, permissionModes: ["auto"], reasoningLevels: [] },
    ]);
    expect(await runPreflight({ bb, exec }, input("local-only", "claude"))).toEqual([expect.objectContaining({ check: "agent_cli" })]);
    expect(await runPreflight({ bb, exec }, input("local-only", null))).toEqual([]);
  });

  it("[U840] reports a missing no-mistakes for no-mistakes mode only", async () => {
    const { bb, exec, input } = setup({ [NM_INSTALLED]: { code: 1 } });
    expect(await runPreflight({ bb, exec }, input("no-mistakes"))).toEqual([expect.objectContaining({ check: "no_mistakes_installed", message: expect.stringContaining("not installed") })]);
    expect(await runPreflight({ bb, exec }, input("direct-PR"))).toEqual([]);
    expect(await runPreflight({ bb, exec }, input("local-only"))).toEqual([]);
  });

  it("[U841] reports a missing no-mistakes remote in the source for no-mistakes mode", async () => {
    const { bb, exec, input } = setup({ [NM_INIT]: { code: 2, stderr: "error: No such remote" } });
    const problems = await runPreflight({ bb, exec }, input("no-mistakes"));
    expect(problems).toEqual([expect.objectContaining({ check: "no_mistakes_initialized", message: expect.stringContaining("/work/gpu") })]);
    expect(await runPreflight({ bb, exec }, input("direct-PR"))).toEqual([]);
  });

  it("[U842] reports failing gh credentials for no-mistakes and direct-PR, and not for local-only", async () => {
    const { bb, exec, input } = setup({ [GH]: { code: 1, stderr: "You are not logged in" } });
    for (const mode of ["no-mistakes", "direct-PR"] as const) {
      expect(await runPreflight({ bb, exec }, input(mode)), mode).toEqual([expect.objectContaining({ check: "gh_credentials" })]);
    }
    expect(await runPreflight({ bb, exec }, input("local-only"))).toEqual([]);
  });

  it("[U843] counts a command that could not run as a failed check", async () => {
    const { bb, exec, input } = setup({ "git --version": { code: null, error: "terminal timed out after 1000 ms" } });
    const problems = await runPreflight({ bb, exec }, input("local-only"));
    expect(problems).toEqual([expect.objectContaining({ check: "git", message: expect.stringContaining("timed out") })]);
  });

  it("[U870] reports every failed check together", async () => {
    const { bb, exec, input } = setup({ [NM_INSTALLED]: { code: 1 }, [GH]: { code: 1 } });
    const problems = await runPreflight({ bb, exec }, input("no-mistakes"));
    expect(problems.map((problem) => problem.check)).toEqual(["no_mistakes_installed", "gh_credentials"]);
  });
});

describe("preflightOnce", () => {
  it("[U844] caches a pass for the same project and mode, and runs again for another mode or project", async () => {
    const { bb, exec, calls, input } = setup();
    const cache = new Set<string>();
    await preflightOnce({ bb, exec }, cache, "proj-1", input("local-only"));
    const afterFirst = calls.length;
    await preflightOnce({ bb, exec }, cache, "proj-1", input("local-only"));
    expect(calls.length).toBe(afterFirst);
    await preflightOnce({ bb, exec }, cache, "proj-1", input("direct-PR"));
    expect(calls.length).toBeGreaterThan(afterFirst);
    const afterMode = calls.length;
    await preflightOnce({ bb, exec }, cache, "proj-2", input("local-only"));
    expect(calls.length).toBeGreaterThan(afterMode);
  });

  it("[U844] does not cache a failure", async () => {
    const failing = setup({ [GH]: { code: 1 } });
    const failCache = new Set<string>();
    await preflightOnce({ bb: failing.bb, exec: failing.exec }, failCache, "proj-1", failing.input("direct-PR"));
    const before = failing.calls.length;
    await preflightOnce({ bb: failing.bb, exec: failing.exec }, failCache, "proj-1", failing.input("direct-PR"));
    expect(failing.calls.length).toBeGreaterThan(before);
  });
});

describe("reportText", () => {
  it("[U845] names the machine, each problem, and the fix", () => {
    const text = reportText(HOST, "no-mistakes", [
      { check: "no_mistakes_installed", message: "no-mistakes is not installed. Install it, then run `no-mistakes init` in /work/gpu." },
      { check: "gh_credentials", message: "gh has no credentials. Run `gh auth login`." },
    ]);
    expect(text).toContain("gpu-box");
    expect(text).toContain("host_gpu");
    expect(text).toContain("no-mistakes mode");
    expect(text).toContain("no_mistakes_installed");
    expect(text).toContain("no-mistakes init");
    expect(text).toContain("gh auth login");
  });

  it("[U871] says so when nothing is missing", () => {
    expect(reportText(HOST, "local-only", [])).toMatch(/ready/);
  });
});

describe("preflightOnce cache keys", () => {
  it("[U882] runs its own checks for a second host", async () => {
    const { bb, exec, calls, input } = setup();
    const cache = new Set<string>();
    await preflightOnce({ bb, exec }, cache, "proj-1", input("local-only"));
    const first = calls.length;
    await preflightOnce({ bb, exec }, cache, "proj-1", { ...input("local-only"), host: { ...HOST, id: "host_other", name: "other-box" } });
    expect(calls.length).toBeGreaterThan(first);
  });

  it("[U883] runs its own checks for a second provider", async () => {
    const { bb, exec, calls, input } = setup();
    const cache = new Set<string>();
    await preflightOnce({ bb, exec }, cache, "proj-1", input("local-only", "claude"));
    const first = calls.length;
    await preflightOnce({ bb, exec }, cache, "proj-1", input("local-only", "codex"));
    expect(calls.length).toBeGreaterThan(first);
  });

  it("[U884] caches a pass for the same host, project, mode, and provider", async () => {
    const { bb, exec, calls, input } = setup();
    const cache = new Set<string>();
    await preflightOnce({ bb, exec }, cache, "proj-1", input("local-only", "claude"));
    const first = calls.length;
    await preflightOnce({ bb, exec }, cache, "proj-1", input("local-only", "claude"));
    expect(calls.length).toBe(first);
  });
});
