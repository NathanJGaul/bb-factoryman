import { bindCli } from "./bind.ts";
import type { Driver } from "./types.ts";

const profile = { provider: "claude-code", model: "claude-haiku-5-5", reasoningLevel: "low", permissionMode: "accept-edits" } as const;

/** Claude Code reads its endpoint from `env` in settings.json and shows the report tool as a deferred MCP tool. */
export const claudeCode: Driver = {
  id: "claude-code",
  title: "Claude Code",
  provider: "claude-code",
  wire: "messages",
  toolRoute: "mcp-deferred",
  profile,
  shipProfile: { ...profile, permissionMode: "full" },
  unsupportedProfile: { ...profile, reasoningLevel: "no-such-level" },
  failure: { code: 401, timeoutMs: 120_000, mode: "fails" },
  roleChangeStep: "next-turn",
  cli: { command: "claude", versionArgs: ["--version"] },
  homeFiles: (port) => [
    {
      path: ".claude/settings.json",
      content: `${JSON.stringify(
        {
          env: {
            ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`,
            ANTHROPIC_API_KEY: "mock-not-a-credential",
            CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
            DISABLE_TELEMETRY: "1",
            DISABLE_AUTOUPDATER: "1",
          },
        },
        null,
        2,
      )}\n`,
    },
  ],
  setupCommands: () => [],
  bindCli: (which) => bindCli("claude", which),
};
