import { bindCli } from "./bind.ts";
import type { Driver } from "./types.ts";

const profile = { provider: "pi", model: "mock/mock-1", reasoningLevel: "none", permissionMode: "full" } as const;

/** Pi reads custom providers from models.json and offers only the `full` permission mode. */
export const pi: Driver = {
  id: "pi",
  title: "Pi",
  provider: "pi",
  wire: "chat",
  toolRoute: "function",
  profile,
  shipProfile: profile,
  unsupportedProfile: { ...profile, permissionMode: "accept-edits" },
  failure: { code: 401, timeoutMs: 120_000, mode: "fails" },
  roleChangeStep: "next-turn",
  cli: { command: "pi", versionArgs: ["--version"] },
  homeFiles: (port) => [
    {
      path: ".pi/agent/models.json",
      content: `${JSON.stringify(
        {
          providers: {
            mock: {
              baseUrl: `http://127.0.0.1:${port}/v1`,
              api: "openai-completions",
              apiKey: "mock-not-a-credential",
              models: [{ id: "mock-1", name: "Mock 1", reasoning: false }],
            },
          },
        },
        null,
        2,
      )}\n`,
    },
  ],
  setupCommands: () => [],
  bindCli: (which) => bindCli("pi", which),
};
