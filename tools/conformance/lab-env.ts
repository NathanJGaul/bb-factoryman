import { join } from "node:path";

export interface LabPaths {
  bblab: string;
  evidence: string;
  stubAgent: string;
}

/** The lab tools sit in this repository. The runner never looks them up on the `PATH`. */
export function labPaths(repoRoot: string): LabPaths {
  return {
    bblab: join(repoRoot, "tools/bblab/bblab"),
    evidence: join(repoRoot, "tools/bblab/bblab-evidence"),
    stubAgent: join(repoRoot, "tools/stub-agent/stub-agent.ts"),
  };
}

export interface LabSettings {
  labDir: string;
  bbAppDir: string;
  ports: { server: number; daemon: number; model: number };
  offline: boolean;
  /** The harness CLI directories to bind read-only into the sandbox. */
  readOnlyBinds: string[];
}

/**
 * The environment of every `bblab` call. It holds the lab variables, the `PATH`, and the `HOME` that the host tools need.
 * It copies no other host variable, so no credential, token, or proxy setting can reach the lab by this route.
 */
export function labEnv(settings: LabSettings, host: Record<string, string | undefined>): Record<string, string> {
  return {
    PATH: host["PATH"] ?? "/usr/bin:/bin",
    HOME: host["HOME"] ?? "/",
    BBLAB_DIR: settings.labDir,
    BBLAB_BB_APP_DIR: settings.bbAppDir,
    BBLAB_SERVER_PORT: String(settings.ports.server),
    BBLAB_DAEMON_PORT: String(settings.ports.daemon),
    ...(settings.offline ? { BBLAB_OFFLINE: "1" } : {}),
    ...(settings.readOnlyBinds.length > 0 ? { BBLAB_RO: settings.readOnlyBinds.join(" ") } : {}),
    EVIDENCE_DIR: join(settings.labDir, "evidence"),
  };
}

/** The `tar` arguments that copy the plugin source, with its dependencies, into the lab. The tools, specs, and results stay out. */
export function pluginCopyArgs(repoRoot: string, dest: string): string[] {
  const excludes = [".git", "./specs", "./.claude", "./.specify", "./tools", "./conformance", "./dist"];
  return [...excludes.map((path) => `--exclude=${path}`), "-cf", "-", "-C", repoRoot, ".", "|", "tar", "-xf", "-", "-C", dest];
}

export interface BuildCommand {
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
}

/**
 * `bb plugin build` installs bb's build toolchain with `npm` the first time, so it needs the network.
 * The runner builds once, outside the sandbox, into the lab's data directory. After that the lab installs and runs offline.
 * The home is inside the lab, so the build touches nothing of the real home.
 */
export function pluginBuildCommand(settings: LabSettings, host: Record<string, string | undefined>): BuildCommand {
  return {
    command: process.execPath,
    args: [join(settings.bbAppDir, "dist/bb.js"), "plugin", "build"],
    cwd: join(settings.labDir, "plugin-src"),
    env: { PATH: host["PATH"] ?? "/usr/bin:/bin", HOME: join(settings.labDir, "buildhome"), BB_DATA_DIR: join(settings.labDir, "data"), BB_TELEMETRY: "false", BB_CLI_ERROR_LOG: "0" },
  };
}

/** The lab is offline when a public address cannot be reached and the lab's own bb answers on the loopback. */
export function offlineProof(probe: { publicConnect: string; loopbackStatus: number | null }): { ok: boolean; message: string } {
  if (probe.publicConnect === "CONNECTED") return { ok: false, message: "The lab reached a public address, so it is not offline." };
  if (probe.loopbackStatus === null) return { ok: false, message: "The lab's bb did not answer on the loopback." };
  if (probe.loopbackStatus < 200 || probe.loopbackStatus >= 400) return { ok: false, message: `The lab's bb answered on the loopback with HTTP ${probe.loopbackStatus}.` };
  return { ok: true, message: `A public connection failed (${probe.publicConnect}) and the loopback answered with HTTP ${probe.loopbackStatus}.` };
}
