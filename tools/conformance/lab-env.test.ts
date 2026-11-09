import { describe, expect, it } from "vitest";
import { labEnv, labPaths, offlineProof, pluginBuildCommand, pluginCopyArgs, type LabSettings } from "./lab-env.ts";

const settings: LabSettings = {
  labDir: "/var/tmp/bblab-conformance",
  bbAppDir: "/var/tmp/bblab-conformance/pin/node_modules/bb-app",
  ports: { server: 48931, daemon: 48932, model: 48933 },
  offline: true,
  readOnlyBinds: ["/m/installs/claude/2.1.316", "/m/installs/pi/1.4.0"],
};
const HOST = { PATH: "/usr/bin:/bin", HOME: "/home/u", ANTHROPIC_API_KEY: "sk-real", OPENAI_API_KEY: "sk-real", CLAUDE_CODE_OAUTH_TOKEN: "tok", GH_TOKEN: "ghp", HTTPS_PROXY: "http://proxy" };

describe("the lab commands", () => {
  it("[U1371] builds the bblab command from the repository path, and an environment with the lab variables and no other host variable", () => {
    const paths = labPaths("/repo");
    expect(paths).toEqual({ bblab: "/repo/tools/bblab/bblab", evidence: "/repo/tools/bblab/bblab-evidence", stubAgent: "/repo/tools/stub-agent/stub-agent.ts" });
    const env = labEnv(settings, HOST);
    expect(env).toMatchObject({ BBLAB_DIR: settings.labDir, BBLAB_BB_APP_DIR: settings.bbAppDir, BBLAB_SERVER_PORT: "48931", BBLAB_DAEMON_PORT: "48932", BBLAB_OFFLINE: "1", BBLAB_RO: "/m/installs/claude/2.1.316 /m/installs/pi/1.4.0", PATH: "/usr/bin:/bin" });
    expect(Object.keys(env).filter((key) => /KEY|TOKEN|SECRET|PASS|PROXY/.test(key))).toEqual([]);
    expect(JSON.stringify(env)).not.toContain("sk-real");
    expect(env["BBLAB_PASS_ENV"]).toBeUndefined();
    expect(labEnv({ ...settings, offline: false, readOnlyBinds: [] }, HOST)["BBLAB_OFFLINE"]).toBeUndefined();
  });

  it("[U1372] builds the plugin copy command with the exclusions, and a build command that uses the lab's data directory and a home inside the lab", () => {
    const copy = pluginCopyArgs("/repo", "/lab/plugin-src");
    for (const excluded of [".git", "./specs", "./.claude", "./.specify", "./tools", "./conformance", "./dist"]) expect(copy.join(" ")).toContain(`--exclude=${excluded}`);
    expect(copy.join(" ")).toContain("/repo");
    expect(copy.join(" ")).toContain("/lab/plugin-src");
    const build = pluginBuildCommand(settings, HOST);
    expect(build.args).toEqual([`${settings.bbAppDir}/dist/bb.js`, "plugin", "build"]);
    expect(build.cwd).toBe("/var/tmp/bblab-conformance/plugin-src");
    expect(build.env["BB_DATA_DIR"]).toBe("/var/tmp/bblab-conformance/data");
    expect(build.env["HOME"]?.startsWith(settings.labDir)).toBe(true);
    expect(Object.keys(build.env).filter((key) => /KEY|TOKEN|SECRET|PASS|PROXY/.test(key))).toEqual([]);
  });

  it("[U1373] passes the offline proof only when the public connection fails and the loopback answers", () => {
    expect(offlineProof({ publicConnect: "ENETUNREACH", loopbackStatus: 200 }).ok).toBe(true);
    expect(offlineProof({ publicConnect: "ECONNREFUSED", loopbackStatus: 200 }).ok).toBe(true);
    const connected = offlineProof({ publicConnect: "CONNECTED", loopbackStatus: 200 });
    expect(connected.ok).toBe(false);
    expect(connected.message).toMatch(/reached/i);
    const dead = offlineProof({ publicConnect: "ENETUNREACH", loopbackStatus: null });
    expect(dead.ok).toBe(false);
    expect(dead.message).toMatch(/loopback/i);
    expect(offlineProof({ publicConnect: "ENETUNREACH", loopbackStatus: 502 }).ok).toBe(false);
  });
});
