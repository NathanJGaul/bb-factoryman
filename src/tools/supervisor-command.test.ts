import { describe, expect, it } from "vitest";
import { withDispatchedTask } from "../../test/fixtures/runtime";
import { testRuntime } from "../../test/fixtures/runtime";
import { runFactorymanCommand } from "./supervisor-command";

describe("bb factoryman supervisor", () => {
  it("[U117] stamps the supervisor role on a thread and prints a confirmation", async () => {
    const t = await withDispatchedTask();
    const result = await runFactorymanCommand(t.runtime, ["supervisor", "thr-new"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("thr-new");
    expect(t.bb.callsTo("setThreadMetadata")).toEqual([["thr-new", { role: "supervisor" }]]);
  });

  it("[U118] refuses a recorded worker thread and stamps nothing", async () => {
    const t = await withDispatchedTask();
    const result = await runFactorymanCommand(t.runtime, ["supervisor", "thr-w1"]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/worker/i);
    expect(t.bb.callsTo("setThreadMetadata")).toEqual([]);
  });

  it("[U119] prints usage and exits non-zero without a thread ID or with an unknown command", async () => {
    const t = await withDispatchedTask();
    for (const argv of [["supervisor"], [], ["nope"]]) {
      const result = await runFactorymanCommand(t.runtime, argv);
      expect(result.exitCode, argv.join(" ")).not.toBe(0);
      expect(result.stderr).toContain("Usage: bb factoryman supervisor <thread-id>");
    }
    expect(t.bb.callsTo("setThreadMetadata")).toEqual([]);
  });

  describe("preflight", () => {
    function remoteRuntime(modeOverride: "no-mistakes" | "direct-PR" | "local-only" = "no-mistakes") {
      const t = testRuntime();
      t.bb.machines.push({ id: "host_gpu", name: "gpu-box", status: "connected", phase: "active", online: true });
      t.bb.sources.push({ hostId: "host_gpu", path: "/work/gpu", isDefault: false });
      t.runtime.deps.store.putProjectConfig({ projectId: "proj-1", deliveryMode: modeOverride, yolo: false, branchPrefix: null, baseBranch: null, defaultMachine: null });
      return t;
    }

    it("[U856] runs the preflight for a machine and project and prints the report, and prints usage for a bad call", async () => {
      const t = remoteRuntime();
      const ok = await runFactorymanCommand(t.runtime, ["preflight", "gpu-box", "--project", "proj-1"]);
      expect(ok.exitCode).toBe(0);
      expect(ok.stdout).toContain("gpu-box");
      expect(ok.stdout).toMatch(/ready/);
      expect(t.execCalls.every((call) => call.cwd === "/work/gpu")).toBe(true);

      t.execHandler = (command, args) => (command === "gh" && args[0] === "auth" ? { code: 1, stdout: "", stderr: "not logged in" } : { code: 0, stdout: "", stderr: "" });
      const failed = await runFactorymanCommand(t.runtime, ["preflight", "gpu-box", "--project", "proj-1"]);
      expect(failed.exitCode).toBe(1);
      expect(failed.stdout).toContain("gh_credentials");

      const viaContext = await runFactorymanCommand(t.runtime, ["preflight", "gpu-box"], { projectId: "proj-1" });
      expect(viaContext.exitCode).toBe(1);

      for (const argv of [["preflight"], ["preflight", "gpu-box"], ["preflight", "gpu-box", "--project"], ["preflight", "gpu-box", "--bogus", "x"]]) {
        const bad = await runFactorymanCommand(t.runtime, argv);
        expect(bad.exitCode, argv.join(" ")).toBe(2);
        expect(bad.stderr).toContain("Usage: bb factoryman preflight <machine> --project <project-id>");
      }
      const unknown = await runFactorymanCommand(t.runtime, ["preflight", "nowhere", "--project", "proj-1"]);
      expect(unknown.exitCode).toBe(1);
      expect(unknown.stderr).toContain("machine_unknown");
    });

    it("skips the checks that the delivery mode does not need, and reports a machine that is offline", async () => {
      const t = remoteRuntime("local-only");
      const ok = await runFactorymanCommand(t.runtime, ["preflight", "gpu-box", "--project", "proj-1"]);
      expect(ok.exitCode).toBe(0);
      expect(t.execCalls.map((call) => call.command)).not.toContain("gh");
      t.bb.machines[1] = { id: "host_gpu", name: "gpu-box", status: "disconnected", phase: "active", online: false };
      const offline = await runFactorymanCommand(t.runtime, ["preflight", "gpu-box", "--project", "proj-1"]);
      expect(offline.exitCode).toBe(1);
      expect(offline.stderr).toContain("machine_offline");
    });
  });
});
