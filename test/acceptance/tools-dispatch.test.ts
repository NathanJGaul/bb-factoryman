import { describe, expect, it } from "vitest";
import { DISPATCH, loadWorld } from "../fixtures/plugin-host";

describe("factoryman_dispatch through the plugin factory", () => {
  it("[A3] creates a task in the project's mode, spawns one child worker with notifications off and role metadata, and records start", async () => {
    const world = await loadWorld();
    world.setProject({ deliveryMode: "direct-PR", branchPrefix: "wip/" });
    const result = await world.call("factoryman_dispatch", DISPATCH);
    expect(result).toEqual({ isError: false, text: "Dispatched ship task t1 in direct-PR mode. Worker thread thr-w1, branch wip/t1." });
    const [[spawn]] = world.sdkCalls("threads.spawn") as [[Record<string, unknown>]];
    expect(spawn).toMatchObject({
      projectId: "proj-1",
      parentThreadId: "thr-sup",
      parentNotifications: "off",
      pluginMetadata: { role: "worker", taskId: "t1", kind: "ship" },
      providerId: "claude",
      permissionMode: "accept-edits",
    });
    expect(world.store.getTask("t1")).toMatchObject({ mode: "direct-PR", state: "working", workerThreadId: "thr-w1", branch: "wip/t1" });
    const start = world.store.listEvents({ taskId: "t1" }).find((row) => row.event === "start");
    expect(start).toMatchObject({ actor: "supervisor", evidence: DISPATCH.description });
  });

  it("[A4] refuses an incomplete profile, an empty description, or an unknown kind before any task or thread exists", async () => {
    const world = await loadWorld();
    for (const args of [
      { ...DISPATCH, profile: { provider: "claude", model: "opus" } },
      { ...DISPATCH, description: "  " },
      { ...DISPATCH, kind: "epic" },
    ]) {
      const result = await world.call("factoryman_dispatch", args);
      expect(result.isError).toBe(true);
    }
    expect(world.store.listTasks()).toEqual([]);
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
  });

  it("[A5] records the task as failed with the spawn error as evidence when the spawn fails", async () => {
    const world = await loadWorld({ spawnError: new Error("host offline") });
    const result = await world.call("factoryman_dispatch", DISPATCH);
    expect(result.isError).toBe(true);
    expect(result.text).toContain("host offline");
    expect(world.store.getTask("t1")?.state).toBe("failed");
    expect(world.store.listEvents({ taskId: "t1" }).find((row) => row.event === "fail")?.evidence).toContain("host offline");
  });
});
