import { bindCli } from "./bind.ts";
import type { Driver } from "./types.ts";

const profile = { provider: "codex", model: "mock-1", reasoningLevel: "low", permissionMode: "accept-edits" } as const;

/** Codex reads a custom model provider from config.toml. The fake model speaks the Responses format. */
export const codex: Driver = {
  id: "codex",
  title: "Codex",
  provider: "codex",
  wire: "responses",
  toolRoute: "function",
  profile,
  shipProfile: { ...profile, permissionMode: "full" },
  unsupportedProfile: { ...profile, reasoningLevel: "no-such-level" },
  failure: { code: 401, timeoutMs: 180_000 },
  roleChangeStep: "clear",
  cli: { command: "codex", versionArgs: ["--version"] },
  homeFiles: (port) => [
    // bb reports Codex as unauthenticated until `codex login status` succeeds. The literal dummy key makes it succeed. It is not a credential.
    { path: ".codex/auth.json", content: `${JSON.stringify({ OPENAI_API_KEY: "mock-not-a-credential" })}\n` },
    {
      path: ".codex/config.toml",
      content: [
        'model = "mock-1"',
        'model_provider = "mock"',
        "",
        "[model_providers.mock]",
        'name = "Mock"',
        `base_url = "http://127.0.0.1:${port}/v1"`,
        'wire_api = "responses"',
        "requires_openai_auth = false",
        "",
      ].join("\n"),
    },
  ],
  setupCommands: () => [],
  bindCli: (which) => bindCli("codex", which),
};
