import { makePluginAgentConfigurationContext } from "@get-bb/plugin-sdk/testing";
import { describe, expect, it } from "vitest";
import { loadWorld } from "../fixtures/plugin-host";

describe("tool visibility through the plugin factory", () => {
  it("[A1816] offers the five supervisor tools to a supervisor thread with factoryman_decide last, only the report tool to a worker thread, and none to any other thread", async () => {
    const world = await loadWorld();
    const offered = async (pluginMetadata: Record<string, unknown>) =>
      (await world.host.harness.behavior.resolveAgentConfiguration(makePluginAgentConfigurationContext({ pluginMetadata: pluginMetadata as never }))).tools.map((tool) => tool.name).sort();
    expect(await offered({ role: "supervisor" })).toEqual(["factoryman_decide", "factoryman_dispatch", "factoryman_merge", "factoryman_status", "factoryman_teardown"]);
    const inOrder = (await world.host.harness.behavior.resolveAgentConfiguration(makePluginAgentConfigurationContext({ pluginMetadata: { role: "supervisor" } as never }))).tools.map((tool) => tool.name);
    expect(inOrder.at(-1)).toBe("factoryman_decide");
    expect(await offered({ role: "worker", taskId: "t1" })).toEqual(["factoryman_report"]);
    expect(await offered({})).toEqual([]);
  });
});
