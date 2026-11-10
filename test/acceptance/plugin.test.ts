import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { describe, expect, it } from "vitest";
import plugin from "../../src/server";

describe("plugin factory", () => {
  it("[A17] opens the store on the host database, recovers, registers exactly six tools and the command, and disposes cleanly", async () => {
    const host = createFakePluginHost({ pluginId: "factoryman" });

    await plugin(host.bb);

    const { logEntries, registrations } = host.harness.inspection;
    expect(logEntries[0]).toEqual({ level: "info", message: "bb-factoryman loaded" });
    expect(registrations.agentTools.map((tool) => tool.name).sort()).toEqual([
      "factoryman_decide",
      "factoryman_dispatch",
      "factoryman_merge",
      "factoryman_report",
      "factoryman_status",
      "factoryman_teardown",
    ]);
    expect(registrations.cli?.name).toBe("factoryman");
    expect([...registrations.rpcMethods].sort()).toEqual(["apiVersion", "getTask", "listEvents", "listTasks"]);
    expect(registrations.httpRoutes).toEqual([]);
    expect(registrations.schedules).toEqual([]);
    expect(Object.values(registrations.hooks).every((hook) => hook === null)).toBe(true);
    const tables = host.bb.storage.database().prepare("select name from sqlite_master where type = 'table'").all() as Array<{ name: string }>;
    expect(tables.map((row) => row.name)).toEqual(expect.arrayContaining(["task", "task_event", "approval", "project_config"]));
    expect(host.bb.storage.database().pragma("user_version", { simple: true })).toBe(1);

    await expect(host.harness.lifecycle.dispose()).resolves.toBeUndefined();
  });
});
