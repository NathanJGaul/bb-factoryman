import type { Driver } from "./types.ts";

const profile = { provider: "acp-stub", model: "acp-default", reasoningLevel: "medium", permissionMode: "accept-edits" } as const;

/** The tier 1 brain: the stub ACP agent. It has no CLI, no model, and no files to write. */
export const stub: Driver = {
  id: "stub",
  title: "Stub agent",
  provider: "acp-stub",
  wire: "none",
  toolRoute: "mcp-stdio",
  profile,
  shipProfile: profile,
  unsupportedProfile: { ...profile, permissionMode: "auto" },
  failure: { code: 500, timeoutMs: 60_000, mode: "fails" },
  roleChangeStep: "next-turn",
  cli: null,
  homeFiles: () => [],
  setupCommands: () => [],
  bindCli: () => ({ ok: true, binds: [], links: [] }),
};
