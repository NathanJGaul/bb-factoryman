import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { HARNESS_IDS, resolveDriver } from "./index.ts";
import type { Driver } from "./types.ts";

const PORT = 48898;
const URL_BASE = `http://127.0.0.1:${PORT}`;
const driver = (id: string): Driver => {
  const resolved = resolveDriver(id);
  if (!resolved.ok) throw new Error(resolved.message);
  return resolved.driver;
};
const file = (d: Driver, path: string) => {
  const found = d.homeFiles(PORT).find((f) => f.path === path);
  if (found === undefined) throw new Error(`${d.id} writes no ${path}`);
  return found.content;
};

describe("resolveDriver", () => {
  it("[U1327] resolves the four harness ids and the stub, and refuses an unknown id with the known ids", () => {
    expect([...HARNESS_IDS].sort()).toEqual(["claude-code", "codex", "omp", "pi"]);
    for (const id of [...HARNESS_IDS, "stub"]) expect(driver(id).id).toBe(id);
    const refused = resolveDriver("gemini");
    expect(refused.ok).toBe(false);
    if (!refused.ok) for (const id of HARNESS_IDS) expect(refused.message).toContain(id);
  });
});

describe("the harness drivers", () => {
  it("[U1328] points Claude Code at the fake model through settings.json, and names the deferred route", () => {
    const d = driver("claude-code");
    const settings = JSON.parse(file(d, ".claude/settings.json")) as { env: Record<string, string> };
    expect(settings.env["ANTHROPIC_BASE_URL"]).toBe(URL_BASE);
    expect(settings.env["ANTHROPIC_API_KEY"]).toBe("mock-not-a-credential");
    expect(settings.env["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"]).toBe("1");
    expect(settings.env["DISABLE_AUTOUPDATER"]).toBe("1");
    expect([d.provider, d.wire, d.toolRoute]).toEqual(["claude-code", "messages", "mcp-deferred"]);
    expect(d.profile.provider).toBe("claude-code");
  });

  it("[U1329] points Codex at the fake model through config.toml with the responses wire API", () => {
    const d = driver("codex");
    const toml = file(d, ".codex/config.toml");
    expect(toml).toContain('model_provider = "mock"');
    expect(toml).toContain("[model_providers.mock]");
    expect(toml).toContain(`base_url = "${URL_BASE}/v1"`);
    expect(toml).toContain('wire_api = "responses"');
    expect(toml).toContain("requires_openai_auth = false");
    // Without a login, bb reports Codex as unauthenticated. A file with the literal dummy key makes `codex login status` exit 0 and writes no real credential.
    expect(JSON.parse(file(d, ".codex/auth.json"))).toEqual({ OPENAI_API_KEY: "mock-not-a-credential" });
    expect([d.provider, d.wire, d.toolRoute]).toEqual(["codex", "responses", "function"]);
  });

  it("[U1330] points Pi at the fake model through models.json, and runs Pi in full permission mode", () => {
    const d = driver("pi");
    const models = JSON.parse(file(d, ".pi/agent/models.json")) as { providers: { mock: { baseUrl: string; api: string; apiKey: string; models: Array<{ id: string }> } } };
    expect(models.providers.mock).toMatchObject({ baseUrl: `${URL_BASE}/v1`, api: "openai-completions", apiKey: "mock-not-a-credential" });
    expect(models.providers.mock.models.map((m) => m.id)).toEqual(["mock-1"]);
    expect([d.provider, d.wire, d.toolRoute]).toEqual(["pi", "chat", "function"]);
    expect(d.profile.permissionMode).toBe("full");
    expect(d.profile.model).toBe("mock/mock-1");
  });

  it("[U1331] points omp at the fake model through models.yml and a model role, and names the device route", () => {
    const d = driver("omp");
    const yml = file(d, ".omp/agent/models.yml");
    expect(yml).toContain(`baseUrl: ${URL_BASE}/v1`);
    expect(yml).toContain("apiKey: mock-not-a-credential");
    expect(yml).toContain("api: openai-completions");
    expect(yml).toContain("- id: mock-1");
    expect(d.setupCommands(PORT)).toContainEqual(["omp", "config", "set", "modelRoles", '{"default":"mock/mock-1"}']);
    expect([d.provider, d.wire, d.toolRoute]).toEqual(["acp-omp", "chat", "xd-device"]);
    // In accept-edits, omp asks for approval before a shell command, and a scripted worker waits for ever (lab finding, live run 5).
    expect(d.profile.permissionMode).toBe("full");
    expect(d.unsupportedProfile.permissionMode).toBe("auto");
  });

  it("[U1332] gives every driver a ship profile, an unsupported profile, a failure mode, and the step after a late stamp", () => {
    const step: Record<string, string> = { "claude-code": "next-turn", pi: "next-turn", codex: "clear", omp: "clear" };
    expect(HARNESS_IDS).toHaveLength(4);
    for (const id of HARNESS_IDS) {
      const d = driver(id);
      expect(d.shipProfile.provider, id).toBe(d.profile.provider);
      expect(d.unsupportedProfile.provider, id).toBe(d.profile.provider);
      expect(d.unsupportedProfile, id).not.toEqual(d.profile);
      expect(d.failure.code, id).toBeGreaterThanOrEqual(400);
      expect(d.failure.timeoutMs, id).toBeGreaterThan(0);
      // omp shows a model error as the assistant's text and ends the turn normally (live run 5). The other three fail the thread.
      expect(d.failure.mode, id).toBe(id === "omp" ? "ends-turn" : "fails");
      expect(d.roleChangeStep, id).toBe(step[id]);
    }
  });

  it("[U1333] writes only inside the lab home, and never reads an environment variable or the real home", () => {
    expect(HARNESS_IDS).toHaveLength(4);
    for (const id of HARNESS_IDS) {
      for (const f of driver(id).homeFiles(PORT)) {
        expect(f.path.startsWith("/"), `${id} ${f.path}`).toBe(false);
        expect(f.path.split("/")).not.toContain("..");
      }
    }
    const dir = new URL("./", import.meta.url);
    for (const name of readdirSync(dir).filter((n) => n.endsWith(".ts") && !n.endsWith(".test.ts"))) {
      const text = readFileSync(new URL(name, dir), "utf8");
      expect(text, name).not.toMatch(/process\.env|homedir|os\.userInfo|\$HOME|~\//);
    }
  });

  it("[U1334] binds the CLI's install directory read-only and links its name, and says when the CLI is missing", () => {
    const found = driver("claude-code").bindCli(() => "/home/u/.local/share/mise/installs/claude/2.1.316/claude");
    expect(found).toEqual({ ok: true, binds: ["/home/u/.local/share/mise/installs/claude/2.1.316"], links: [{ name: "claude", target: "/home/u/.local/share/mise/installs/claude/2.1.316/claude" }] });
    const elsewhere = driver("pi").bindCli(() => "/opt/pi/bin/pi");
    expect(elsewhere).toEqual({ ok: true, binds: ["/opt/pi/bin"], links: [{ name: "pi", target: "/opt/pi/bin/pi" }] });
    const missing = driver("codex").bindCli(() => null);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.message).toMatch(/codex.*not installed/i);
    expect(driver("stub").bindCli(() => null)).toEqual({ ok: true, binds: [], links: [] });
  });
});
