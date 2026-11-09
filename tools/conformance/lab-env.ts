import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { DeliveryMode } from "./drivers/types.ts";

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

/** The command that runs the repository's `bblab` with these arguments. It names the script by its path and never looks it up on the `PATH`. */
export function bblabCommand(paths: LabPaths, args: string[]): { command: string; args: string[] } {
  return { command: "bash", args: [paths.bblab, ...args] };
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

/** Entries that survive a reset: the pinned bb, its npm home, and the evidence snapshots. */
const KEEP = new Set(["pin", "pinhome", "evidence"]);

/**
 * Start from a clean lab directory. The previous run's data, repositories, and logs go.
 * The pinned bb stays, and so does bb's build toolchain inside `data/plugins`, because it needs the network to install.
 */
export function resetLab(labDir: string): void {
  if (!existsSync(labDir)) return;
  for (const entry of readdirSync(labDir)) {
    if (KEEP.has(entry)) continue;
    if (entry !== "data") {
      rmSync(join(labDir, entry), { recursive: true, force: true });
      continue;
    }
    // bb's data directory: keep only the finished toolchain directories.
    for (const item of readdirSync(join(labDir, "data"))) {
      if (item !== "plugins") rmSync(join(labDir, "data", item), { recursive: true, force: true });
    }
    for (const plugin of readdirSync(join(labDir, "data/plugins"))) {
      if (!/^toolchain-[\d.-]+$/.test(plugin)) rmSync(join(labDir, "data/plugins", plugin), { recursive: true, force: true });
    }
  }
}

/** The `node -e` source that writes the `project_config` row of the lab project. */
export function projectRowScript(projectId: string, mode: DeliveryMode): string {
  return `const D=require('better-sqlite3');const db=new D(process.env.BB_DATA_DIR+'/plugins/bb-factoryman/data.db');db.prepare('INSERT OR REPLACE INTO project_config (project_id, delivery_mode, yolo, branch_prefix, base_branch, default_machine) VALUES (?, ?, 0, NULL, ?, NULL)').run('${projectId}','${mode}','main');`;
}

/** The first prompt of a supervisor thread of the lab. The label marker lets the fake model and the log readers tell the threads apart. */
export function supervisorPrompt(label: string): string {
  return `[conformance:sup=${label}]\nhello`;
}

/** The arguments of `bb factoryman supervisor start` for a supervisor of the lab. The profile comes from `roles.supervisor.profile` of the project's file. */
export function supervisorStartArgs(projectId: string, label: string): string[] {
  return ["factoryman", "supervisor", "start", "--project", projectId, "--prompt", supervisorPrompt(label)];
}

/**
 * The `dispatch.json` of the lab project: the driver's profile is the worker's default and the supervisor's profile,
 * so `supervisor start` needs no flag. The text holds no single quote, because the runner writes it inside a quoted shell string.
 */
export function labDispatchJson(profile: unknown): string {
  return JSON.stringify({ version: 1, profiles: { harness: profile }, default: "harness", roles: { supervisor: { profile: "harness" } }, rules: [] });
}
