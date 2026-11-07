import { describe, expect, it } from "vitest";
import { DISPATCH, loadWorld } from "../fixtures/plugin-host";

describe("factoryman_status through the plugin factory", () => {
  it("[A7] reads one task or a filtered project list and writes nothing to the log", async () => {
    const world = await loadWorld();
    await world.call("factoryman_dispatch", DISPATCH);
    await world.call("factoryman_dispatch", { ...DISPATCH, kind: "scout" });
    await world.call("factoryman_report", { outcome: "blocked", evidence: "Waiting." }, { threadId: "thr-w2" });
    const before = world.store.listEvents().length;

    const one = await world.call("factoryman_status", { taskId: "t1" });
    expect(one.text).toContain("Task t1: ship, no-mistakes, state working");
    const filtered = await world.call("factoryman_status", { states: ["blocked"] });
    expect(filtered.text).toContain("Task t2: scout");
    expect(filtered.text).not.toContain("Task t1");
    const all = await world.call("factoryman_status", {});
    expect(all.text.split("\n").filter((line) => line.startsWith("Task "))).toHaveLength(2);

    expect(world.store.listEvents().length).toBe(before);
  });
});
