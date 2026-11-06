import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { describe, expect, it } from "vitest";
import plugin from "../../src/server";

describe("plugin factory", () => {
  it("loads in the fake host, registers nothing beyond its identity, and disposes cleanly", async () => {
    const host = createFakePluginHost({ pluginId: "factoryman" });

    await plugin(host.bb);

    const { logEntries, registrations } = host.harness.inspection;
    expect(logEntries).toEqual([{ level: "info", message: "bb-factoryman loaded" }]);
    expect(registrations.agentTools).toEqual([]);
    expect(registrations.rpcMethods).toEqual([]);
    expect(registrations.httpRoutes).toEqual([]);
    expect(registrations.services).toEqual([]);
    expect(registrations.schedules).toEqual([]);
    expect(registrations.cli).toBeNull();
    expect(registrations.settingsDescriptors).toEqual({});
    expect(Object.values(registrations.hooks).every((hook) => hook === null)).toBe(true);
    expect(Object.values(registrations.threadEventHandlers).every((count) => count === 0)).toBe(true);

    await expect(host.harness.lifecycle.dispose()).resolves.toBeUndefined();
  });
});
