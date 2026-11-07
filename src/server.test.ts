import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { describe, expect, it } from "vitest";
import { createEvent } from "../test/fixtures/store";
import { validEvent } from "../test/fixtures/machine";
import { DISPATCH, loadWorld } from "../test/fixtures/plugin-host";
import { createPlugin } from "./server";
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
});
