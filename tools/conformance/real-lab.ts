import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import type { RunArgs } from "./args.ts";
import type { Driver } from "./drivers/types.ts";
import { judgeIsolation } from "./isolation.ts";
import { labEnv, labPaths, offlineProof, pluginBuildCommand, pluginCopyArgs, resetLab, type LabSettings } from "./lab-env.ts";
import type { DispatchOptions, EventRow, Lab, Offers, ProviderState, TaskRow, ThreadFacts, ToolResult, Wake, Who } from "./port.ts";
import { fakeOffers, readWakes, stubOffers, type LogLine, type ThreadEvent } from "./readers.ts";
import type { Isolation, LabSession } from "./run.ts";
import { ansi, exec } from "./shell.ts";

/** The bb build that tier 1 and tier 1.5 run on. The report found that the bb on the PATH is older than the owner's server. */
export const BB_VERSION = "0.49.0";
const PROJECT = "lab-repo";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function freePort(taken: Set<number>): Promise<number> {
  for (;;) {
    const port = await new Promise<number>((resolve, reject) => {
      const server = createServer();
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const { port: p } = server.address() as { port: number };
        server.close(() => resolve(p));
      });
    });
    if (port >= 20_000 && !taken.has(port) && ![38886, 38887, 38888, 4387, 9808].includes(port)) {
      taken.add(port);
      return port;
    }
  }
}

function jsonl(path: string): LogLine[] {
  return existsSync(path) ? readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line) as LogLine) : [];
}

export interface RealLabInit {
  repoRoot: string;
  args: RunArgs;
  driver: Driver;
  binds: string[];
  hostEnv: Record<string, string | undefined>;
  which: (command: string) => string | null;
  progress: (line: string) => void;
}

class RealLab implements Lab {
  readonly tier: "1" | "1.5";
  readonly driver: Driver;
  readonly clone: string;
  readonly patienceMs: number;
  readonly failurePatienceMs: number;
  readonly settleMs: number;
  projectId = "";
  driverThread = "";

  private readonly env: Record<string, string>;
  private readonly paths: { bblab: string };
  private readonly settings: LabSettings;

  constructor(env: Record<string, string>, paths: { bblab: string }, settings: LabSettings, driver: Driver, tier: "1" | "1.5") {
    this.env = env;
    this.paths = paths;
    this.settings = settings;
    this.tier = tier;
    this.driver = driver;
    this.clone = join(settings.labDir, "repos/work");
    this.patienceMs = tier === "1" ? 90_000 : 300_000;
    this.failurePatienceMs = this.patienceMs + driver.failure.timeoutMs;
    this.settleMs = tier === "1" ? 3_000 : 6_000;
  }

  /** Run a command inside the lab sandbox. */
  async inLab(command: string[], options: { input?: string; timeoutMs?: number } = {}) {
    const result = await exec("bash", [this.paths.bblab, "x", ...command], { env: this.env, timeoutMs: 300_000, ...options });
    return { ...result, stdout: ansi(result.stdout), stderr: ansi(result.stderr) };
  }

  async bb(args: string[], options: { timeoutMs?: number } = {}) {
    return this.inLab(["bb", ...args], options);
  }

  private async bbJson<T>(args: string[]): Promise<T> {
    const out = await this.bb([...args, "--json"]);
    if (out.code !== 0) throw new Error(`bb ${args.join(" ")} failed (exit ${out.code}): ${out.stderr.trim() || out.stdout.trim()}`);
    return JSON.parse(out.stdout) as T;
  }

  private async rpc<T>(method: string, input: Record<string, unknown>): Promise<T> {
    const file = join(this.settings.labDir, "rpc", `${method}.json`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(input));
    const out = await this.bb(["plugin", "rpc", "call", "bb-factoryman", method, "--input-file", file, "--json"]);
    if (out.code !== 0) throw new Error(`plugin rpc ${method} failed: ${out.stderr.trim() || out.stdout.trim()}`);
    return JSON.parse(out.stdout) as T;
  }

  async tasks(): Promise<TaskRow[]> {
    return (await this.rpc<{ tasks: TaskRow[] }>("listTasks", {})).tasks;
  }
  async events(taskId?: string): Promise<EventRow[]> {
    return (await this.rpc<{ events: EventRow[] }>("listEvents", { ...(taskId === undefined ? {} : { taskId }), limit: 1000 })).events;
  }
  async waitForState(taskId: string, states: string[], timeoutMs: number): Promise<TaskRow | null> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const row = (await this.tasks()).find((t) => t.taskId === taskId);
      if (row !== undefined && states.includes(row.state)) return row;
      if (Date.now() >= deadline) return null;
      await sleep(1000);
    }
  }

  private stubLog = () => jsonl(join(this.settings.labDir, "stub/log.jsonl"));

  async callTool(tool: string, args: Record<string, unknown>): Promise<ToolResult> {
    const seen = (log: LogLine[]) => log.filter((l) => l["kind"] === "tool-result" && l["name"] === tool);
    const before = seen(this.stubLog()).length;
    const told = await this.bb(["thread", "tell", this.driverThread, `CALL ${tool} ${JSON.stringify(args)}`]);
    if (told.code !== 0) throw new Error(`bb thread tell failed: ${told.stderr.trim()}`);
    const deadline = Date.now() + 180_000;
    for (;;) {
      const found = seen(this.stubLog());
      if (found.length > before) {
        const last = found[before] as LogLine;
        return { text: String(last["text"] ?? ""), isError: last["isError"] === true };
      }
      if (Date.now() >= deadline) throw new Error(`The driver supervisor returned no result for ${tool} within 180 s.`);
      await sleep(500);
    }
  }

  async dispatch(kind: "scout" | "ship", description: string, options: DispatchOptions = {}): Promise<{ result: ToolResult; taskId: string | null }> {
    const known = new Set((await this.tasks()).map((t) => t.taskId));
    const profile = options.profile ?? (kind === "ship" ? this.driver.shipProfile : this.driver.profile);
    const marked = options.flag === undefined ? description : `${description} [brain:${options.flag}]`;
    const result = await this.callTool("factoryman_dispatch", { kind, description: marked, profile });
    const created = (await this.tasks()).filter((t) => !known.has(t.taskId));
    return { result, taskId: created.length === 1 ? (created[0] as TaskRow).taskId : null };
  }

  async providerStates(): Promise<ProviderState[]> {
    const out = await this.inLab(["node", join(this.settings.labDir, "tools/conformance/lab-scripts/provider-states.ts"), this.settings.bbAppDir, String(this.settings.ports.server)]);
    if (out.code !== 0) throw new Error(`provider states failed: ${out.stderr.trim()}`);
    return JSON.parse(out.stdout) as ProviderState[];
  }

  private async threadLog(id: string): Promise<ThreadEvent[]> {
    const raw = await this.bbJson<Array<{ seq: number; type: string; data: Record<string, unknown> }>>(["thread", "log", id, "--all"]);
    return raw.map((e) => ({ seq: e.seq, type: e.type, data: e.data }));
  }

  async thread(id: string): Promise<ThreadFacts> {
    const shown = await this.bbJson<{ thread?: Record<string, unknown> } & Record<string, unknown>>(["thread", "show", id]);
    const t = (shown.thread ?? shown) as Record<string, unknown>;
    const first = (await this.threadLog(id)).find((e) => e.type === "client/turn/requested");
    const execution = (first?.data["execution"] ?? {}) as Record<string, string | null>;
    return {
      id,
      providerId: String(t["providerId"] ?? ""),
      status: String(t["status"] ?? ""),
      parentThreadId: (t["parentThreadId"] as string | null | undefined) ?? null,
      model: execution["model"] ?? null,
      reasoningLevel: execution["reasoningLevel"] ?? null,
      permissionMode: execution["permissionMode"] ?? null,
    };
  }

  async wakes(threadId: string): Promise<Wake[]> {
    return readWakes(await this.threadLog(threadId));
  }

  async parentOf(taskId: string): Promise<string | null> {
    const row = (await this.tasks()).find((t) => t.taskId === taskId);
    return row?.workerThreadId == null ? null : (await this.thread(row.workerThreadId)).parentThreadId;
  }

  async offers(who: Who): Promise<Offers> {
    return this.tier === "1" ? stubOffers(this.stubLog(), who) : fakeOffers(jsonl(join(this.settings.labDir, "model/requests.jsonl")), who);
  }

  async spawnSupervisor(label: string): Promise<string> {
    const p = this.tier === "1" ? { provider: "acp-stub", model: "acp-default", reasoningLevel: null, permissionMode: null } : { provider: this.driver.profile.provider, model: this.driver.profile.model, reasoningLevel: this.driver.profile.reasoningLevel, permissionMode: this.driver.profile.permissionMode };
    const flags = ["--provider", p.provider, "--model", p.model, ...(p.reasoningLevel === null ? [] : ["--reasoning-level", p.reasoningLevel]), ...(p.permissionMode === null ? [] : ["--permission-mode", p.permissionMode])];
    const spawned = await this.bbJson<{ id: string }>(["thread", "spawn", "--project", this.projectId, ...flags, "--new-environment", "worktree", "--base-branch", "main", "--prompt", `[conformance:sup=${label}]\nhello`]);
    return spawned.id;
  }

  async tell(threadId: string, label: string, directives: string[], options: { wait?: boolean } = {}): Promise<void> {
    const text = [`[conformance:sup=${label}]`, ...(directives.length === 0 ? ["hello"] : directives)].join("\n");
    const told = await this.bb(["thread", "tell", threadId, text]);
    if (told.code !== 0) throw new Error(`bb thread tell failed: ${told.stderr.trim()}`);
    if (options.wait !== false) await this.waitIdle(threadId, this.patienceMs);
  }

  async waitIdle(threadId: string, timeoutMs: number): Promise<boolean> {
    await sleep(1000);
    const out = await this.bb(["thread", "wait", threadId, "--status", "idle", "--timeout", String(Math.ceil(timeoutMs / 1000))], { timeoutMs: timeoutMs + 30_000 });
    return out.code === 0;
  }

  async stamp(threadId: string): Promise<{ code: number; text: string }> {
    const out = await this.bb(["factoryman", "supervisor", threadId]);
    return { code: out.code, text: `${out.stdout}${out.stderr}`.trim() };
  }

  async startSupervisor(label: string): Promise<{ code: number; text: string }> {
    const out = await this.bb(["factoryman", "supervisor", "start", "--project", this.projectId, "--label", label]);
    return { code: out.code, text: `${out.stdout}${out.stderr}`.trim() };
  }

  async clear(threadId: string): Promise<void> {
    await this.bb(["thread", "clear", threadId]);
    await this.waitIdle(threadId, 60_000);
  }

  async reloadPlugin(): Promise<void> {
    const out = await this.bb(["plugin", "reload", "bb-factoryman"]);
    if (out.code !== 0) throw new Error(`plugin reload failed: ${out.stderr.trim()}`);
  }

  async worktree(taskId: string): Promise<string | null> {
    const out = await this.inLab(["git", "-C", this.clone, "worktree", "list", "--porcelain"]);
    let path: string | null = null;
    for (const line of out.stdout.split("\n")) {
      if (line.startsWith("worktree ")) path = line.slice(9);
      if (line === `branch refs/heads/fm/${taskId}` && path !== null && existsSync(path)) return path;
    }
    return null;
  }

  async sh(command: string): Promise<{ code: number; stdout: string }> {
    const out = await this.inLab(["bash", "-c", command]);
    return { code: out.code, stdout: out.stdout };
  }

  async processes(pattern: string): Promise<string[]> {
    const script = 'me=$$; for d in /proc/[0-9]*; do p=${d#/proc/}; [ "$p" = "$me" ] && continue; c=$(readlink "$d/cwd" 2>/dev/null); a=$(tr "\\0" " " < "$d/cmdline" 2>/dev/null); case "$a" in *"for d in /proc"*) continue;; esac; case "$c $a" in *"$1"*) echo "$p $c $a";; esac; done';
    const out = await this.inLab(["bash", "-c", script, "scan", pattern]);
    return out.stdout.split("\n").filter(Boolean);
  }
}

/** Build the lab: pin bb, build and install the plugin, register the stub, set up the harness and the fake model, create the project. */
export async function openRealLab(init: RealLabInit): Promise<LabSession> {
  const { repoRoot, args, driver, binds, hostEnv, progress } = init;
  const paths = labPaths(repoRoot);
  const labDir = args.labDir;
  const taken = new Set<number>();
  const ports = { server: args.ports.server ?? (await freePort(taken)), daemon: args.ports.daemon ?? (await freePort(taken)), model: args.ports.model ?? (await freePort(taken)) };
  const bbAppDir = args.bbAppDir ?? join(labDir, "pin/node_modules/bb-app");
  const settings: LabSettings = { labDir, bbAppDir, ports, offline: args.offline, readOnlyBinds: binds };
  const env = labEnv(settings, hostEnv);
  const hostBase = { PATH: env["PATH"] as string, HOME: env["HOME"] as string };
  resetLab(labDir);
  mkdirSync(labDir, { recursive: true });

  if (!existsSync(join(bbAppDir, "dist/bb.js"))) {
    progress(`Installing bb-app@${BB_VERSION} into ${join(labDir, "pin")}`);
    mkdirSync(join(labDir, "pin"), { recursive: true });
    const installed = await exec("npm", ["install", `bb-app@${BB_VERSION}`, "--no-audit", "--no-fund", "--prefix", join(labDir, "pin")], { env: { ...hostBase, HOME: join(labDir, "pinhome") }, cwd: join(labDir, "pin") });
    if (installed.code !== 0) throw new Error(`Could not install bb-app@${BB_VERSION}: ${installed.stderr.trim().slice(-400)}`);
  }
  const bbVersion = (JSON.parse(readFileSync(join(bbAppDir, "package.json"), "utf8")) as { version: string }).version;

  const lab = new RealLab(env, paths, settings, driver, args.tier);
  const evidence = async (...parts: string[]) => exec("bash", [paths.evidence, ...parts], { env: { ...env, FIRSTMATE_HOME: hostEnv["FIRSTMATE_HOME"] ?? join(env["HOME"] as string, "Projects/firstmate") } });
  const down = () => exec("bash", [paths.bblab, "down"], { env });
  await evidence("snap", "before");

  let up = false;
  const abort = async (error: unknown): Promise<never> => {
    if (up) await down();
    await evidence("snap", "after");
    throw error;
  };

  try {
    progress("Copying and building the plugin (network on, outside the sandbox)");
    const src = join(labDir, "plugin-src");
    rmSync(src, { recursive: true, force: true });
    mkdirSync(src, { recursive: true });
    const copy = pluginCopyArgs(repoRoot, src);
    const pipe = copy.indexOf("|");
    const copied = await exec("bash", ["-c", `tar ${copy.slice(0, pipe).map((a) => JSON.stringify(a)).join(" ")} | tar ${copy.slice(pipe + 2).map((a) => JSON.stringify(a)).join(" ")}`], { env: hostBase });
    if (copied.code !== 0) throw new Error(`Could not copy the plugin: ${copied.stderr.trim()}`);
    if (!existsSync(join(src, "node_modules"))) throw new Error("The plugin copy has no node_modules. Run `pnpm install --frozen-lockfile` in the repository first.");
    const build = pluginBuildCommand(settings, hostEnv);
    mkdirSync(build.env["HOME"] as string, { recursive: true });
    const built = await exec(build.command, build.args, { env: build.env, cwd: build.cwd, timeoutMs: 600_000 });
    if (built.code !== 0 || !existsSync(join(src, "dist/server.js"))) throw new Error(`bb plugin build failed: ${ansi(built.stderr || built.stdout).trim().slice(-600)}`);

    progress(`Starting the lab (${args.offline ? "offline" : "network shared"})`);
    cpSync(join(repoRoot, "tools"), join(labDir, "tools"), { recursive: true, filter: (source) => !source.endsWith(".test.ts") });
    const started = await exec("bash", [paths.bblab, "up", ...(args.offline ? ["--offline"] : [])], { env, timeoutMs: 240_000 });
    if (started.code !== 0) throw new Error(`bblab up failed: ${ansi(started.stderr || started.stdout).trim().slice(-600)}`);
    up = true;
    for (const link of (driver.bindCli(init.which) as { links?: Array<{ name: string; target: string }> }).links ?? []) {
      const dest = join(labDir, "bin", link.name);
      rmSync(dest, { force: true });
      symlinkSync(link.target, dest);
    }

    if (args.offline) {
      const probe = await lab.inLab(["node", "-e", `const net=require("net");const s=net.connect({host:"1.1.1.1",port:443,timeout:3000});const done=(m)=>{console.log(m);process.exit(0)};s.on("connect",()=>done("CONNECTED"));s.on("error",(e)=>done(e.code));s.on("timeout",()=>done("TIMEOUT"));`]);
      const status = await lab.inLab(["node", "-e", `fetch("http://127.0.0.1:${ports.server}/").then((r)=>console.log(r.status),()=>console.log("none"))`]);
      const proof = offlineProof({ publicConnect: probe.stdout.trim(), loopbackStatus: Number.isNaN(Number(status.stdout.trim())) ? null : Number(status.stdout.trim()) });
      if (!proof.ok) throw new Error(`The lab is not offline as asked: ${proof.message}`);
      progress(proof.message);
    }

    const installed = await lab.bb(["plugin", "install", src, "--yes"], { timeoutMs: 180_000 });
    if (installed.code !== 0 || !/running/.test(installed.stdout)) throw new Error(`bb plugin install failed (exit ${installed.code}): ${(installed.stderr || installed.stdout).trim().slice(-600)}`);

    mkdirSync(join(labDir, "stub"), { recursive: true });
    mkdirSync(join(labDir, "model"), { recursive: true });
    const agent = [{ id: "stub", displayName: "Factoryman stub", command: "node", args: [join(labDir, "tools/stub-agent/stub-agent.ts")], env: { STUB_DIR: join(labDir, "stub") } }];
    const configured = await lab.bb(["plugin", "config", "provider-acp", "set", "customAgents", JSON.stringify(agent)]);
    if (configured.code !== 0) throw new Error(`Could not register the stub agent: ${configured.stderr.trim()}`);

    if (args.tier === "1.5") {
      for (const file of driver.homeFiles(ports.model)) {
        const dest = join(labDir, "home", file.path);
        mkdirSync(dirname(dest), { recursive: true });
        writeFileSync(dest, file.content);
      }
      for (const command of driver.setupCommands(ports.model)) {
        const done = await lab.inLab(command, { input: "" });
        if (done.code !== 0) throw new Error(`Setup command failed (${command.join(" ")}): ${done.stderr.trim()}`);
      }
      await lab.inLab(["bash", "-c", `setsid nohup node ${join(labDir, "tools/fake-model/server.ts")} --port ${ports.model} --log ${join(labDir, "model/requests.jsonl")} > ${join(labDir, "logs/model.log")} 2>&1 < /dev/null &`]);
      let answered = false;
      for (let i = 0; i < 30 && !answered; i += 1) {
        const ping = await lab.inLab(["node", "-e", `fetch("http://127.0.0.1:${ports.model}/v1/models").then((r)=>console.log(r.status),()=>console.log("none"))`]);
        answered = ping.stdout.trim() === "200";
        if (!answered) await sleep(500);
      }
      if (!answered) throw new Error("The fake model did not answer on its loopback port.");
    }

    progress("Creating the project");
    const profile = driver.profile;
    const dispatchJson = JSON.stringify({ version: 1, profiles: { harness: profile }, default: "harness", rules: [] });
    const made = await lab.inLab([
      "bash",
      "-c",
      `set -e; mkdir -p ${labDir}/repos && cd ${labDir}/repos && git init -q --bare -b main origin.git && git clone -q origin.git work 2>/dev/null && cd work && printf '# throwaway\\n' > README.md && mkdir -p .bb/factoryman && printf '%s\\n' '${dispatchJson}' > .bb/factoryman/dispatch.json && git add -A && git commit -qm init && git branch -M main && git push -q -u origin main`,
    ]);
    if (made.code !== 0) throw new Error(`Could not create the project repository: ${made.stderr.trim()}`);
    const project = JSON.parse((await lab.bb(["project", "create", "--name", PROJECT, "--root", join(labDir, "repos/work"), "--json"])).stdout) as { id: string };
    lab.projectId = project.id;
    const row = await lab.inLab(["bash", "-c", `cd ${src} && node -e "const D=require('better-sqlite3');const db=new D(process.env.BB_DATA_DIR+'/plugins/bb-factoryman/data.db');db.prepare('INSERT OR REPLACE INTO project_config (project_id, delivery_mode, yolo, branch_prefix, base_branch, default_machine) VALUES (?, ?, 0, NULL, ?, NULL)').run('${project.id}','local-only','main');"`]);
    if (row.code !== 0) throw new Error(`Could not write the project row: ${row.stderr.trim()}`);

    progress("Starting the driver supervisor (the stub)");
    const driverThread = JSON.parse((await lab.bb(["thread", "spawn", "--project", project.id, "--provider", "acp-stub", "--model", "acp-default", "--new-environment", "worktree", "--base-branch", "main", "--prompt", "[conformance:sup=driver]\nhello", "--json"])).stdout) as { id: string };
    lab.driverThread = driverThread.id;
    const stamped = await lab.stamp(driverThread.id);
    if (stamped.code !== 0) throw new Error(`Could not stamp the driver supervisor: ${stamped.text}`);
    await lab.waitIdle(driverThread.id, 60_000);
  } catch (error) {
    return abort(error);
  }

  const cliVersion = await readCliVersion(driver, init.which, hostBase);
  return {
    lab,
    cli: cliVersion,
    bbVersion,
    offline: args.offline,
    async close(): Promise<Isolation> {
      const stopped = await down();
      await evidence("snap", "after");
      const verdict = judgeIsolation(ansi((await evidence("diff", "before", "after")).stdout));
      const tripwire = ansi(stopped.stdout).split("\n").find((line) => line.startsWith("tripwire:")) ?? "tripwire: no report";
      const note = verdict.ignored > 0 ? ` (${verdict.ignored} unrelated file name change(s) from other tools were ignored)` : "";
      return { clean: verdict.clean, report: [verdict.clean ? `no change to the real home, the credentials, or the lab process list${note}` : `changed: ${verdict.changes.join("; ")}`, tripwire].join(". ") };
    },
  };
}

async function readCliVersion(driver: Driver, which: (command: string) => string | null, env: Record<string, string>): Promise<{ name: string; version: string }> {
  if (driver.cli === null) return { name: "stub-agent", version: "0.0.1" };
  const real = which(driver.cli.command);
  if (real === null) return { name: driver.cli.command, version: "unknown" };
  const out = await exec(real, driver.cli.versionArgs, { env: { ...env, HOME: env["HOME"] as string }, timeoutMs: 30_000 });
  const version = /\d+\.\d+\.\d+/.exec(out.stdout + out.stderr)?.[0] ?? "unknown";
  return { name: driver.cli.command, version };
}
