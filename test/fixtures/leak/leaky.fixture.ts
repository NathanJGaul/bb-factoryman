import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { expect, it } from "vitest";
import { loadWorld } from "../plugin-host";

// A fixture for test/acceptance/tmpdir-leak.test.ts. It builds two fake plugin hosts and disposes neither, as many tests do.
it("builds a host through loadWorld and one through createFakePluginHost, and disposes neither", async () => {
  const world = await loadWorld();
  const direct = createFakePluginHost({ pluginId: "factoryman" });
  expect(world.host).toBeDefined();
  expect(direct).toBeDefined();
});
