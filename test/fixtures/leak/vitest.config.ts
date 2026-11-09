import { defineConfig } from "vitest/config";

// The config of the child run in test/acceptance/tmpdir-leak.test.ts. The environment variable LEAK_WITHOUT_SETUP leaves the setup file out, as a control.
export default defineConfig({
  test: {
    name: "leak-fixtures",
    include: ["test/fixtures/leak/*.fixture.ts"],
    setupFiles: process.env["LEAK_WITHOUT_SETUP"] === undefined ? ["test/setup/private-tmpdir.setup.ts"] : [],
    environment: "node",
  },
});
