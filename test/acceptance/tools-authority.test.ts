import { describe, expect, it } from "vitest";
import { DISPATCH, loadWorld } from "../fixtures/plugin-host";

describe("caller authority through the plugin factory", () => {
  it("[A2] refuses a recorded worker on supervisor tools and a non-worker on the report tool", async () => {
    const world = await loadWorld();
    expect((await world.call("factoryman_dispatch", DISPATCH)).isError).toBe(false);
    const worker = { threadId: "thr-w1" };
    for (const [tool, args] of [
      ["factoryman_dispatch", DISPATCH],
      ["factoryman_status", {}],
      ["factoryman_merge", { taskId: "t1" }],
      ["factoryman_teardown", { taskId: "t1" }],
    ] as const) {
      const result = await world.call(tool, args, worker);
      expect(result.isError, tool).toBe(true);
      expect(result.text, tool).toContain("actor_forbidden");
    }
    const notWorker = await world.call("factoryman_report", { outcome: "done", evidence: "x" }, { threadId: "thr-sup" });
    expect(notWorker.isError).toBe(true);
    expect(notWorker.text).toContain("actor_forbidden");
    expect(world.store.listTasks()).toHaveLength(1);
    expect(world.store.getTask("t1")?.state).toBe("working");
    expect(world.sdkCalls("threads.spawn")).toHaveLength(1);
  });
});
