import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { expect, it } from "vitest";

// A fixture for test/acceptance/tmpdir-leak.test.ts. A host exists when the test fails, so cleanup must not depend on a green run.
it("builds a host and then fails on purpose", () => {
  createFakePluginHost({ pluginId: "factoryman" });
  expect("this test fails on purpose").toBe("so that the run reports a failure");
});
