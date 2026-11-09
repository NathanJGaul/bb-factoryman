import { describe, expect, it } from "vitest";
import { FakeBbPort, providerState } from "../../test/fixtures/bb-port";
import type { Exec, ExecResult } from "../exec";
import type { DeliveryMode } from "../machine/types";
import { READ_SCRIPT } from "../validator/agent";
import { preflightOnce, preflightReport, reportText, runPreflight, type PreflightInput } from "./preflight";

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
const READ = `sh -c ${READ_SCRIPT}`;

describe("runPreflight", () => {
  it("[U838] gives an empty problem list for a machine that passes every check, and runs each check on the host", async () => {
    const { bb, exec, calls, input } = setup();
    expect(await runPreflight({ bb, exec }, input("no-mistakes"))).toEqual([]);
    // The validator read (feature 011) sits between the gate checks and the gh check, and it needs no working directory.
    expect(calls.map((call) => call.line)).toEqual(["git --version", NM_INSTALLED, NM_INIT, READ, GH]);
    expect(calls.every((call) => call.host === "host_gpu")).toBe(true);
    expect(calls.filter((call) => call.line !== READ).every((call) => call.cwd === "/work/gpu")).toBe(true);
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

  describe("the agent CLI check reads the provider states of the host", () => {
    it("[U1346] gives no agent_cli problem for a named provider that is ready on the host", async () => {
      const { bb, exec, input } = setup();
      bb.statesByHost.set("host_gpu", [providerState("claude")]);
      expect(await runPreflight({ bb, exec }, input("local-only", "claude"))).toEqual([]);
    });

    it("[U1347] reports a named provider that is not signed in on the host, with the readiness text and bb's login command", async () => {
      const { bb, exec, input } = setup();
      bb.statesByHost.set("host_gpu", [providerState("claude", { status: "unauthenticated", localLoginCommand: "claude login" })]);
      expect(await runPreflight({ bb, exec }, input("local-only", "claude"))).toEqual([
        {
          check: "agent_cli",
          message: "The provider `claude` is not signed in on gpu-box (bb status: unauthenticated). Run `claude login` on that machine.",
        },
      ]);
    });

    it("[U1348] gives no problem with no named provider when one listed provider is ready", async () => {
      const { bb, exec, input } = setup();
      bb.providersByHost.set("host_gpu", [
        { id: "claude", available: true, permissionModes: ["auto"], reasoningLevels: [] },
        { id: "codex", available: true, permissionModes: ["auto"], reasoningLevels: [] },
      ]);
      bb.statesByHost.set("host_gpu", [providerState("claude", { status: "unauthenticated" }), providerState("codex")]);
      expect(await runPreflight({ bb, exec }, input("local-only", null))).toEqual([]);
    });

    it("[U1349] reports no agent CLI with no named provider when every listed provider is installed but not ready", async () => {
      const { bb, exec, input } = setup();
      bb.statesByHost.set("host_gpu", [providerState("claude", { status: "unauthenticated" }), providerState("claude-code", { status: "expired" })]);
      const problems = await runPreflight({ bb, exec }, input("local-only", null));
      expect(problems).toEqual([{ check: "agent_cli", message: "No agent CLI is available on gpu-box. Install one and sign in on that machine." }]);
    });

    it("[U1350] reads the states with the host's own ID", async () => {
      const { bb, exec, input } = setup();
      await runPreflight({ bb, exec }, input("local-only", "claude"));
      expect(bb.callsTo("getProviderStates")).toEqual([["host_gpu"]]);
    });
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

describe("preflightReport: the validator agent", () => {
  const states = (...extra: ReturnType<typeof providerState>[]) => [providerState("claude"), providerState("claude-code"), ...extra];

  it("[U1690] adds a validator_agent problem with the agent's line when the agent is not ready", async () => {
    const { bb, exec, input } = setup({ [READ]: { stdout: "agent: codex\n" } });
    bb.states = states(providerState("codex", { status: "unauthenticated", localLoginCommand: "codex login" }));
    const report = await preflightReport({ bb, exec }, input("no-mistakes"));
    expect(report.problems).toEqual([{ check: "validator_agent", message: expect.stringContaining("codex (bb provider codex) is not ready on gpu-box") }]);
    expect(report.problems[0]?.message).toContain("Run `codex login` on that machine");
    expect(report.notes).toEqual([]);
  });

  it("[U1691] adds a validator_agent problem when the agent cannot be observed", async () => {
    const { bb, exec, input } = setup({ [READ]: { code: 1, stderr: "Permission denied" } });
    const report = await preflightReport({ bb, exec }, input("no-mistakes"));
    expect(report.problems).toEqual([{ check: "validator_agent", message: expect.stringContaining("could not be observed on gpu-box") }]);
    expect(report.problems[0]?.message).toContain("Permission denied");
  });

  it("[U1692] adds no problem and returns the agent's line as a note when the agent is ready, and runPreflight returns the problems only", async () => {
    const { bb, exec, input } = setup({ [READ]: { stdout: "agent: claude\n" } });
    const report = await preflightReport({ bb, exec }, input("no-mistakes"));
    expect(report).toEqual({ problems: [], notes: ["Validator agent: claude (bb provider claude-code) is ready on gpu-box."] });
    expect(await runPreflight({ bb, exec }, input("no-mistakes"))).toEqual([]);
  });

  it("[U1693] runs no observation for direct-PR and local-only projects", async () => {
    for (const mode of ["direct-PR", "local-only"] as const) {
      const { bb, exec, calls, input } = setup();
      const report = await preflightReport({ bb, exec }, input(mode));
      expect(calls.map((call) => call.line), mode).not.toContain(READ);
      expect(report.notes, mode).toEqual([]);
    }
  });

  it("[U1722] reads the host's own provider states", async () => {
    const { bb, exec, input } = setup({ [READ]: { stdout: "agent: codex\n" } });
    bb.statesByHost.set("host_gpu", states(providerState("codex")));
    bb.states = states(providerState("codex", { status: "not_installed" }));
    const report = await preflightReport({ bb, exec }, input("no-mistakes"));
    expect(report.problems).toEqual([]);
    expect(report.notes[0]).toContain("codex (bb provider codex) is ready on gpu-box");
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

  it("[U1695] prints the notes after the headline, for a ready machine and for a machine with another problem", () => {
    const note = "Validator agent: claude (bb provider claude-code) is ready on gpu-box.";
    const ready = reportText(HOST, "no-mistakes", [], [note]);
    expect(ready.split("\n")).toEqual(["Machine gpu-box (host_gpu) is ready for no-mistakes mode work.", note]);
    const problem = reportText(HOST, "no-mistakes", [{ check: "gh_credentials", message: "gh has no credentials." }], [note]);
    expect(problem).toContain("- gh_credentials: gh has no credentials.");
    expect(problem.indexOf(note)).toBeGreaterThan(problem.indexOf("gh_credentials"));
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
