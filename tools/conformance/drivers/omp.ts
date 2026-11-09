import { bindCli } from "./bind.ts";
import type { Driver } from "./types.ts";

/** omp asks for approval before a shell command in `accept-edits`, so a scripted worker would wait for ever. Tier 1.5 tests the plumbing, so the profile uses `full`. */
const profile = { provider: "acp-omp", model: "mock/mock-1", reasoningLevel: "low", permissionMode: "full" } as const;

/** omp runs behind bb's ACP provider. It reads models.yml, and it shows the report tool as an `xd://` device. */
export const omp: Driver = {
  id: "omp",
  title: "omp",
  provider: "acp-omp",
  wire: "chat",
  toolRoute: "xd-device",
  profile,
  shipProfile: profile,
  unsupportedProfile: { ...profile, permissionMode: "auto" },
  failure: { code: 401, timeoutMs: 120_000 },
  roleChangeStep: "clear",
  cli: { command: "omp", versionArgs: ["--version"] },
  homeFiles: (port) => [
    {
      path: ".omp/agent/models.yml",
      content: [
        "providers:",
        "  mock:",
        `    baseUrl: http://127.0.0.1:${port}/v1`,
        "    apiKey: mock-not-a-credential",
        "    api: openai-completions",
        "    models:",
        "      - id: mock-1",
        "        name: Mock 1",
        "",
      ].join("\n"),
    },
  ],
  setupCommands: () => [["omp", "config", "set", "modelRoles", '{"default":"mock/mock-1"}']],
  bindCli: (which) => bindCli("omp", which),
};
