import { describe, expect, it } from "vitest";
import { DISPATCH, loadWorld } from "../fixtures/plugin-host";
import { recordedBb } from "../fixtures/recorded";

describe("recorded bb payloads through the plugin factory", () => {
  it("[A28] turns the real thread.failed, turn.failed, thread.idle, and interaction.pending payloads into the expected transitions and messages", async () => {
    const recorded = recordedBb();
    const failedThread = recorded.events["thread.failed"].thread.id;
    const idleThread = recorded.events["thread.idle"].thread.id;
    const world = await loadWorld({ threadIds: [failedThread, idleThread] });
    await world.call("factoryman_dispatch", DISPATCH);
    await world.call("factoryman_dispatch", DISPATCH);
    world.sent("thr-sup").length = 0;

    // The real server sends turn.failed about twenty milliseconds after thread.failed, inside the plugin's wait.
    world.sleepHook = async () => {
      await world.host.harness.behavior.emitThreadEvent("turn.failed", recorded.events["turn.failed"] as never);
    };
    await world.host.harness.behavior.emitThreadEvent("thread.failed", recorded.events["thread.failed"] as never);
    expect(world.store.getTask("t1")?.state).toBe("failed");
    expect(world.store.listEvents({ taskId: "t1" }).find((row) => row.event === "fail")?.evidence).toBe("worker thread failed: provider error (category bad-request, HTTP 404)");

    await world.host.harness.behavior.emitThreadEvent("thread.idle", recorded.events["thread.idle"] as never);
    await world.host.harness.behavior.emitThreadEvent("interaction.pending", recorded.events["interaction.pending"] as never);
    expect(world.store.getTask("t2")?.state).toBe("working");
    expect(world.sent("thr-sup").map((text) => text.split("\n")[0])).toEqual([
      "[factoryman] Task t1 (ship, no-mistakes) is now failed.",
      "[factoryman] Task t2 (ship, no-mistakes) reports: the worker finished a turn without reporting.",
      "[factoryman] Task t2 (ship, no-mistakes) reports: the worker raised a question: Approve merge (probe).",
    ]);
  });
});
