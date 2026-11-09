import { describe, expect, it } from "vitest";
import { DISPATCH, loadWorld } from "../fixtures/plugin-host";

describe("bb factoryman supervisor through the plugin factory", () => {
  it("[A18] stamps the role on a non-worker thread and refuses a recorded worker", async () => {
    const world = await loadWorld();
    world.addThread({ id: "thr-owner-chat" });
    const stamped = await world.host.harness.behavior.runCli(["supervisor", "thr-owner-chat"]);
    expect(stamped.exitCode).toBe(0);
    expect(world.metadata.get("thr-owner-chat")).toEqual({ role: "supervisor" });

    await world.call("factoryman_dispatch", DISPATCH);
    const refused = await world.host.harness.behavior.runCli(["supervisor", "thr-w1"]);
    expect(refused.exitCode).not.toBe(0);
    expect(world.metadata.get("thr-w1")).toEqual({ role: "worker", taskId: "t1", kind: "ship", mode: "no-mistakes", state: "working", machine: null });
  });

  it("[A1607] prints the advice that matches the thread's harness, and never the old text", async () => {
    const world = await loadWorld();
    for (const [id, providerId] of [["thr-codex", "codex"], ["thr-omp", "acp-omp"], ["thr-cc", "claude-code"], ["thr-pi", "pi"], ["thr-x", "acp-foo"]] as const) world.addThread({ id, providerId });
    world.addThread({ id: "thr-np" });
    const run = async (id: string) => {
      const result = await world.host.harness.behavior.runCli(["supervisor", id]);
      return { exitCode: result.exitCode, text: `${result.stdout ?? ""}${result.stderr ?? ""}` };
    };

    for (const id of ["thr-codex", "thr-omp"]) {
      const { exitCode, text } = await run(id);
      expect(exitCode, id).toBe(0);
      expect(text, id).toContain(`bb thread clear ${id}`);
    }
    for (const id of ["thr-cc", "thr-pi"]) {
      const { exitCode, text } = await run(id);
      expect(exitCode, id).toBe(0);
      expect(text, id).toContain("on its next turn.");
      expect(text, id).not.toMatch(/clear/i);
    }
    const unknown = await run("thr-x");
    expect(unknown.text).toContain("The harness acp-foo has no recorded role-change behavior.");
    expect(unknown.text).toContain("bb thread clear thr-x");
    const noProvider = await run("thr-np");
    expect(noProvider.exitCode).toBe(0);
    expect(noProvider.text).toContain("bb did not say which harness the thread uses");
    expect(noProvider.text).toContain("bb thread clear thr-np");
    const missing = await run("thr-missing");
    expect(missing.exitCode).toBe(0);
    expect(missing.text).toContain("bb thread clear thr-missing");

    world.failMetadata = new Error("HTTP 500: boom");
    const rejected = await run("thr-codex");
    expect(rejected.exitCode).toBe(1);
    expect(rejected.text).toContain("Could not stamp thread thr-codex: HTTP 500: boom");
    expect(rejected.text).not.toContain("bb thread clear");
    world.failMetadata = null;

    await world.call("factoryman_dispatch", DISPATCH);
    const worker = await run("thr-w1");
    expect(worker.exitCode).toBe(1);
    expect(worker.text).toContain("is a task worker");
    expect(worker.text).not.toContain("bb thread clear");

    for (const id of ["thr-codex", "thr-omp", "thr-cc", "thr-pi", "thr-x", "thr-np", "thr-missing"]) expect((await run(id)).text, id).not.toContain("from its next session");
  });
});
