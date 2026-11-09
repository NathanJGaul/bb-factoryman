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

  describe("[A1607] the advice after a stamp, through the registered command", () => {
    async function worldWithThreads() {
      const world = await loadWorld();
      for (const [id, providerId] of [["thr-codex", "codex"], ["thr-omp", "acp-omp"], ["thr-cc", "claude-code"], ["thr-pi", "pi"], ["thr-x", "acp-foo"]] as const) world.addThread({ id, providerId });
      world.addThread({ id: "thr-np" });
      const run = async (id: string) => {
        const result = await world.host.harness.behavior.runCli(["supervisor", id]);
        return { exitCode: result.exitCode, text: `${result.stdout ?? ""}${result.stderr ?? ""}` };
      };
      return { world, run };
    }

    it.each(["thr-codex", "thr-omp"])("tells the owner to clear %s", async (id) => {
      const { run } = await worldWithThreads();
      const { exitCode, text } = await run(id);
      expect(exitCode).toBe(0);
      expect(text).toContain(`bb thread clear ${id}`);
    });

    it.each(["thr-cc", "thr-pi"])("says that %s gets its tools on the next turn, with no clear", async (id) => {
      const { run } = await worldWithThreads();
      const { exitCode, text } = await run(id);
      expect(exitCode).toBe(0);
      expect(text).toContain("on its next turn.");
      expect(text).not.toMatch(/clear/i);
    });

    it("gives the generic clear advice for a provider with no contract row, and names it", async () => {
      const { run } = await worldWithThreads();
      const { text } = await run("thr-x");
      expect(text).toContain("The harness acp-foo has no recorded role-change behavior.");
      expect(text).toContain("bb thread clear thr-x");
    });

    it.each(["thr-np", "thr-missing"])("gives the generic clear advice, and still stamps, when bb names no provider for %s", async (id) => {
      const { run } = await worldWithThreads();
      const { exitCode, text } = await run(id);
      expect(exitCode).toBe(0);
      expect(text).toContain("bb did not say which harness the thread uses");
      expect(text).toContain(`bb thread clear ${id}`);
    });

    it("prints no advice and exits 1 with bb's reason when bb rejects the stamp", async () => {
      const { world, run } = await worldWithThreads();
      world.failMetadata = new Error("HTTP 500: boom");
      const rejected = await run("thr-codex");
      expect(rejected.exitCode).toBe(1);
      expect(rejected.text).toContain("Could not stamp thread thr-codex: HTTP 500: boom");
      expect(rejected.text).not.toContain("bb thread clear");
    });

    it("refuses a recorded worker thread, with no advice", async () => {
      const { world, run } = await worldWithThreads();
      await world.call("factoryman_dispatch", DISPATCH);
      const worker = await run("thr-w1");
      expect(worker.exitCode).toBe(1);
      expect(worker.text).toContain("is a task worker");
      expect(worker.text).not.toContain("bb thread clear");
    });

    it.each(["thr-codex", "thr-omp", "thr-cc", "thr-pi", "thr-x", "thr-np", "thr-missing"])("never says from its next session, for %s", async (id) => {
      const { run } = await worldWithThreads();
      expect((await run(id)).text).not.toContain("from its next session");
    });
  });
});
