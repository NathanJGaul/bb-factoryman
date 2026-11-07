import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { describe, expect, it } from "vitest";
import { createEvent } from "../test/fixtures/store";
import { validEvent } from "../test/fixtures/machine";
import { DISPATCH, loadWorld } from "../test/fixtures/plugin-host";
import { createPlugin } from "./server";
import { recover } from "./store/replay";
import { openSqliteStore } from "./store/sqlite";
import { TaskLog } from "./store/task-log";

describe("createPlugin", () => {
  it("[U120] opens the store on the host's database and repairs a stale cache through recovery", async () => {
    const host = createFakePluginHost({ pluginId: "factoryman" });
    const store = openSqliteStore(host.bb.storage.database());
    const log = new TaskLog(store);
    log.create(createEvent({ taskId: "k1" }));
    log.apply("k1", validEvent("start"));
    store.clearTasks();
    expect(store.getTask("k1")).toBeNull();

    await createPlugin()(host.bb);

    expect(openSqliteStore(host.bb.storage.database()).getTask("k1")?.state).toBe("working");
  });

  it("[U121] logs a corrupt task from recovery as an error and still loads", async () => {
    const host = createFakePluginHost({ pluginId: "factoryman" });
    const store = openSqliteStore(host.bb.storage.database());
    new TaskLog(store).create(createEvent({ taskId: "k2" }));
    store.appendEvent({
      taskId: "k2",
      at: "2026-11-06T12:00:00.000Z",
      fromState: "queued",
      toState: "merged",
      event: "merge",
      actor: "supervisor",
      evidence: null,
      payload: { yolo: true },
      outcome: "applied",
      reasonCode: null,
      reasonMessage: null,
    });

    await createPlugin()(host.bb);

    const errors = host.harness.inspection.logEntries.filter((entry) => entry.level === "error");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain("Task k2 has a corrupt log");
    expect(host.harness.inspection.registrations.agentTools).toHaveLength(5);
  });

  it("[U122] defines the merge method and approval timeout settings with their defaults", async () => {
    const host = createFakePluginHost({ pluginId: "factoryman" });
    await createPlugin()(host.bb);
    expect(host.harness.inspection.registrations.settingsDescriptors).toMatchObject({
      mergeMethod: { type: "select", options: ["squash", "merge", "rebase"], default: "squash" },
      approvalTimeoutMinutes: { type: "number", default: 10 },
    });
  });

  it("[U40] makes no bb.sdk.plugins call in a full dispatch, report, merge, and teardown flow", async () => {
    const world = await loadWorld();
    world.setProject({ deliveryMode: "direct-PR", yolo: true });
    world.paths.set("env-thr-w1", "/work/tree");
    world.execHandler = (command, args) => ({ code: 0, stdout: command === "git" && args[0] === "rev-list" ? "0\n" : "", stderr: "" });
    const pr = "https://github.com/acme/widgets/pull/7";
    await world.call("factoryman_dispatch", DISPATCH);
    await world.call("factoryman_report", { outcome: "done", evidence: "PR open.", prUrl: pr }, { threadId: "thr-w1" });
    await world.call("factoryman_merge", { taskId: "t1" });
    await world.call("factoryman_teardown", { taskId: "t1" });
    expect(world.store.getTask("t1")?.state).toBe("torn_down");
    const paths = world.host.harness.sdk.calls.map((call) => call.path);
    expect(paths.length).toBeGreaterThan(3);
    expect(paths.filter((path) => path.startsWith("plugins."))).toEqual([]);
  });

  it("[U123] registers the command, the five tools, the six event handlers, and one service", async () => {
    const host = createFakePluginHost({ pluginId: "factoryman" });
    await createPlugin()(host.bb);
    const { registrations } = host.harness.inspection;
    expect(registrations.cli?.name).toBe("factoryman");
    expect(registrations.agentTools).toHaveLength(5);
    expect(registrations.services.map((service) => service.name)).toEqual(["factoryman-startup"]);
    const handled = Object.entries(registrations.threadEventHandlers).filter(([, n]) => n > 0).map(([name]) => name).sort();
    expect(handled).toEqual(["interaction.pending", "thread.archived", "thread.deleted", "thread.failed", "thread.idle", "turn.failed"]);
  });

  it("[U124] leaves the replayed task rows equal to the cached rows after a seeded random walk of tool calls and thread events", async () => {
    const world = await loadWorld();
    world.setProject({ deliveryMode: "direct-PR", yolo: true });
    world.execHandler = (command, args) => ({ code: 0, stdout: command === "git" && args[0] === "rev-list" ? "0\n" : "", stderr: "" });
    let seed = 20261106;
    const random = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let n = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n;
      return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
    };
    const pick = <T,>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
    const pr = "https://github.com/acme/widgets/pull/7";
    for (let step = 0; step < 300; step += 1) {
      const task = `t${1 + Math.floor(random() * 6)}`;
      const worker = { threadId: `thr-w${task.slice(1)}` };
      world.paths.set(`env-${worker.threadId}`, "/work/tree");
      switch (pick(["dispatch", "report", "report", "status", "merge", "teardown", "event", "event"] as const)) {
        case "dispatch":
          await world.call("factoryman_dispatch", { ...DISPATCH, kind: pick(["ship", "scout"] as const) });
          break;
        case "report":
          await world.call("factoryman_report", { outcome: pick(["done", "done", "blocked", "failed"] as const), evidence: pick(["Evidence.", "", "  "]), prUrl: pick([pr, undefined]), landedCommits: 1 }, worker);
          break;
        case "status":
          await world.call("factoryman_status", pick([{}, { taskId: task }] as const));
          break;
        case "merge":
          await world.call("factoryman_merge", { taskId: task });
          break;
        case "teardown":
          await world.call("factoryman_teardown", { taskId: task });
          break;
        case "event":
          await world.emit(pick(["thread.failed", "thread.idle", "thread.deleted", "thread.archived"] as const), worker.threadId, { error: pick(["boom", null]) });
          break;
      }
    }
    expect(world.store.listTasks().length).toBeGreaterThan(2);
    const events = world.store.listEvents();
    expect(events.filter((row) => row.outcome === "applied").length).toBeGreaterThan(40);
    expect(events.filter((row) => row.outcome === "refused").length).toBeGreaterThan(10);
    const report = recover(world.store);
    expect(report.corrupt).toEqual([]);
    expect(report.repaired).toEqual([]);
  });
});

