import { describe, expect, it } from "vitest";
import { DISPATCH, loadWorld } from "../fixtures/plugin-host";

describe("start-up reconcile through the plugin factory", () => {
  it("[A27] appends one reconcile row and one message per mismatch, changes no state, and repeats nothing on a second restart", async () => {
    const world = await loadWorld();
    await world.call("factoryman_dispatch", DISPATCH);
    await world.call("factoryman_dispatch", DISPATCH);
    world.threads.get("thr-w1")!.status = "error";
    world.sent("thr-sup").length = 0;

    await world.restart();
    await world.runStartup();
    const reconciles = () => world.store.listEvents().filter((row) => row.event === "reconcile");
    expect(reconciles().map((row) => row.taskId)).toEqual(["t1"]);
    expect(world.store.getTask("t1")?.state).toBe("working");
    expect(world.store.getTask("t2")?.state).toBe("working");
    expect(world.sent("thr-sup")).toEqual([expect.stringContaining("The log says the task is working, but bb reports failed.")]);

    await world.restart();
    await world.runStartup();
    expect(reconciles()).toHaveLength(1);
    expect(world.sent("thr-sup")).toHaveLength(1);
  });
});
