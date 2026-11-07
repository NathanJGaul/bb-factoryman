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
});
