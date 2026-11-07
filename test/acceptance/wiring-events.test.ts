import { describe, expect, it } from "vitest";
import { DISPATCH, loadWorld, type World } from "../fixtures/plugin-host";

const PR = "https://github.com/acme/widgets/pull/7";
const w1 = { threadId: "thr-w1" };

async function oneTask(options: { mode?: "no-mistakes" | "direct-PR"; kind?: "ship" | "scout" } = {}): Promise<World> {
  const world = await loadWorld();
  if (options.mode) world.setProject({ deliveryMode: options.mode });
  await world.call("factoryman_dispatch", { ...DISPATCH, kind: options.kind ?? "ship" });
  world.sent("thr-sup").length = 0;
  return world;
}
const state = (world: World, id = "t1") => world.store.getTask(id)?.state;
const interaction = (pluginId: string | null, title: string) => ({
  interaction: { id: "pint_1", threadId: "thr-w1", status: "pending", origin: pluginId ? { kind: "plugin", pluginId, rendererId: "r" } : { kind: "provider", providerId: "claude-code" }, payload: { kind: pluginId ? "plugin" : "provider", title } },
});

describe("event wiring through the plugin factory", () => {
  it("[A19] fails a working task when its worker thread fails, with evidence, and wakes the supervisor once", async () => {
    const world = await oneTask();
    await world.emit("thread.failed", "thr-w1", { error: "Provider crashed" });
    expect(state(world)).toBe("failed");
    expect(world.store.listEvents({ taskId: "t1" }).find((row) => row.event === "fail")).toMatchObject({ actor: "system", evidence: "worker thread failed: Provider crashed" });
    expect(world.sent("thr-sup")).toEqual([expect.stringContaining("Task t1 (ship, no-mistakes) is now failed.")]);
  });

  it("[A20] wakes the supervisor for an idle worker on a working task and leaves the state unchanged", async () => {
    const world = await oneTask();
    await world.emit("thread.idle", "thr-w1", { lastAssistantText: "I am done." });
    expect(state(world)).toBe("working");
    expect(world.sent("thr-sup")).toEqual([expect.stringContaining("reports: the worker finished a turn without reporting")]);
  });

  it("[A21] fails the task when its thread is deleted and only warns when it is archived", async () => {
    const deleted = await oneTask();
    await deleted.emit("thread.deleted", "thr-w1");
    expect(state(deleted)).toBe("failed");
    const archived = await oneTask();
    await archived.emit("thread.archived", "thr-w1");
    expect(state(archived)).toBe("working");
    expect(archived.sent("thr-sup")).toEqual([expect.stringContaining("worker thread was archived")]);
  });

  it("[A22] wakes the supervisor with the title of a question from another source, and not for this plugin's own form", async () => {
    const world = await oneTask();
    await world.host.harness.behavior.emitThreadEvent("interaction.pending", { thread: (await import("@get-bb/plugin-sdk/testing")).makeThreadResponse({ id: "thr-w1" }), ...interaction(null, "Run npm install?") } as never);
    await world.host.harness.behavior.emitThreadEvent("interaction.pending", { thread: (await import("@get-bb/plugin-sdk/testing")).makeThreadResponse({ id: "thr-w1" }), ...interaction("factoryman", "Approve merge") } as never);
    expect(world.sent("thr-sup")).toEqual([expect.stringContaining("the worker raised a question: Run npm install?")]);
  });

  it("[A23] sends a wake message only for a transition into an attention state", async () => {
    const world = await oneTask({ mode: "direct-PR" });
    await world.call("factoryman_report", { outcome: "done", evidence: "PR open.", prUrl: PR }, w1);
    expect(world.sent("thr-sup")).toEqual([expect.stringContaining("is now review_ready")]);
    world.setProject({ deliveryMode: "direct-PR", yolo: true });
    await world.call("factoryman_merge", { taskId: "t1" });
    expect(state(world)).toBe("merged");
    expect(world.sent("thr-sup")).toHaveLength(1);

    const handoff = await oneTask();
    await handoff.call("factoryman_report", { outcome: "done", evidence: "Committed." }, w1);
    expect(state(handoff)).toBe("validating");
    expect(handoff.sent("thr-sup")).toEqual([]);
    const scout = await oneTask({ kind: "scout" });
    await scout.call("factoryman_report", { outcome: "done", evidence: "Report." }, w1);
    expect(scout.sent("thr-sup")).toEqual([expect.stringContaining("is now report_ready")]);
  });

  it("[A24] changes nothing and sends nothing for non-worker threads, terminal tasks, and post-handoff states", async () => {
    const world = await oneTask();
    const before = world.store.listEvents().length;
    world.addThread({ id: "thr-stranger" });
    for (const name of ["thread.failed", "thread.idle", "thread.deleted", "thread.archived"] as const) await world.emit(name, "thr-stranger", name === "thread.failed" ? { error: "x" } : {});
    expect(world.store.listEvents()).toHaveLength(before);
    expect(world.sent("thr-sup")).toEqual([]);

    await world.call("factoryman_report", { outcome: "done", evidence: "Committed." }, w1);
    expect(state(world)).toBe("validating");
    await world.emit("thread.failed", "thr-w1", { error: "late failure" });
    await world.emit("thread.idle", "thr-w1");
    expect(state(world)).toBe("validating");
    expect(world.sent("thr-sup")).toEqual([]);
  });

  it("[A25] sends exactly the expected wake messages for a replayed sequence of thread events", async () => {
    const world = await loadWorld({ threadIds: ["thr-w1", "thr-w2"] });
    await world.call("factoryman_dispatch", DISPATCH);
    await world.call("factoryman_dispatch", { ...DISPATCH, kind: "scout" });
    world.addThread({ id: "thr-w3-unknown" });
    const { makeThreadResponse } = await import("@get-bb/plugin-sdk/testing");
    const interactionOn = async (threadId: string, value: ReturnType<typeof interaction>) =>
      world.host.harness.behavior.emitThreadEvent("interaction.pending", { thread: makeThreadResponse({ id: threadId }), ...value } as never);

    await world.host.harness.behavior.emitThreadEvent("thread.created", { thread: makeThreadResponse({ id: "thr-w1" }) } as never);
    await world.host.harness.behavior.emitThreadEvent("thread.active", { thread: makeThreadResponse({ id: "thr-w1" }) } as never);
    await world.emit("thread.idle", "thr-w1");
    await world.emit("thread.idle", "thr-w1");
    await interactionOn("thr-w1", interaction(null, "Run npm install?"));
    await interactionOn("thr-w1", interaction("factoryman", "Approve merge"));
    await world.emit("thread.failed", "thr-w2", { error: "out of memory" });
    await world.emit("thread.failed", "thr-w2", { error: "out of memory" });
    await world.emit("thread.deleted", "thr-w2");
    await world.emit("thread.archived", "thr-w1");
    await world.emit("thread.failed", "thr-w1", { error: null });
    await world.emit("thread.deleted", "thr-w1");
    await world.emit("thread.idle", "thr-w3-unknown");

    const heads = world.sent("thr-sup").map((text) => text.split("\n")[0]);
    expect(heads).toEqual([
      "[factoryman] Task t1 (ship, no-mistakes) reports: the worker finished a turn without reporting.",
      "[factoryman] Task t1 (ship, no-mistakes) reports: the worker finished a turn without reporting.",
      "[factoryman] Task t1 (ship, no-mistakes) reports: the worker raised a question: Run npm install?.",
      "[factoryman] Task t2 (scout, no-mistakes) is now failed.",
      "[factoryman] Task t1 (ship, no-mistakes) reports: the worker thread was archived, so bb may remove its worktree.",
      "[factoryman] Task t1 (ship, no-mistakes) is now failed.",
    ]);
    expect(state(world, "t1")).toBe("failed");
    expect(state(world, "t2")).toBe("failed");
    expect(world.store.listEvents().filter((row) => row.event === "fail" && row.outcome === "applied")).toHaveLength(2);
  });

  it("[A26] wakes the worker's parent in auto mode, warns when there is no parent, and keeps a transition when the send fails", async () => {
    const world = await oneTask();
    world.threads.get("thr-w1")!.parentThreadId = "thr-chief";
    world.addThread({ id: "thr-chief" });
    await world.emit("thread.idle", "thr-w1");
    expect(world.sent("thr-chief")).toHaveLength(1);
    expect(world.sdkCalls("threads.send")[0]?.[0]).toMatchObject({ threadId: "thr-chief", mode: "auto" });

    const orphan = await oneTask();
    orphan.threads.get("thr-w1")!.parentThreadId = null;
    await orphan.emit("thread.idle", "thr-w1");
    expect(orphan.sdkCalls("threads.send")).toEqual([]);
    expect(orphan.host.harness.inspection.logEntries.some((entry) => entry.level === "warn" && entry.message.includes("No parent thread"))).toBe(true);

    const broken = await loadWorld({ sendError: new Error("bb is down") });
    await broken.call("factoryman_dispatch", DISPATCH);
    await broken.emit("thread.failed", "thr-w1", { error: "boom" });
    expect(state(broken)).toBe("failed");
    expect(broken.host.harness.inspection.logEntries.some((entry) => entry.level === "warn" && entry.message.includes("bb is down"))).toBe(true);
  });
});
