import { createFakePluginHost, makeThreadResponse, type FakePluginHost } from "@get-bb/plugin-sdk/testing";
import { createPlugin } from "../../src/server";
import type { Validator } from "../../src/validator/types";
import type { ExecResult } from "../../src/exec";
import { defaultProjectConfig } from "../../src/store/store";
import { openSqliteStore } from "../../src/store/sqlite";
import type { ProjectConfig } from "../../src/store/types";
import { frame } from "./frame";
import { skillNamesOnDisk } from "./skills";
import type { DispatchResolver } from "../../src/dispatch/types";

/** A provider as `bb.sdk.providers.list` returns it, cut to the fields the plugin reads. */
export function providerFixture(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    available: true,
    capabilities: { permissionModes: ["accept-edits", "auto", "full"] },
    reasoningLevels: ["low", "medium", "high", "xhigh", "max"].map((level) => ({ id: level, label: level })),
    ...overrides,
  };
}

/** A host as `bb.sdk.hosts.list` returns it, cut to the fields the plugin reads. */
export function hostFixture(id: string, name: string, overrides: { status?: string; phase?: string } = {}) {
  return { id, name, status: overrides.status ?? "connected", lifecycle: { phase: overrides.phase ?? "active" } };
}

export type HostFixture = ReturnType<typeof hostFixture>;

export interface SourceFixture {
  hostId: string;
  path: string;
  isDefault?: boolean;
}

/** One command that the plugin ran on a remote host through a terminal. */
export interface RemoteRun {
  hostId: string;
  cwd: string | null;
  command: string;
  args: string[];
}

export interface RemoteFake {
  runs: RemoteRun[];
  /** Decide the result of a remote command. `hang` never exits. */
  handler: (run: RemoteRun) => ExecResult | "hang";
  /** Mark every result's output as truncated, whatever the handler returned. */
  truncate: boolean;
  /** Make `terminals.create` fail. */
  createError: Error | null;
}

/** What the plugin posted to the webhook, and what the fake receiver answers. */
export interface WebhookFake {
  calls: Array<{ url: string; init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal } }>;
  result: { ok: boolean; status: number } | Error;
}

export interface FakeThread {
  id: string;
  projectId: string;
  status: string;
  parentThreadId: string | null;
  environmentId: string | null;
}

class NotFound extends Error {
  status = 404;
}

export interface World {
  host: FakePluginHost;
  threads: Map<string, FakeThread>;
  paths: Map<string, string>;
  /** The machines `hosts.list` returns. Tests change it to take a machine offline. */
  machines: HostFixture[];
  /** The fake terminals behind `bb.sdk.terminals`, which stand in for remote machines. */
  remote: RemoteFake;
  /** Hold the next `providers.list` call until this promise settles. The call clears it. */
  holdProviders: Promise<void> | null;
  /** Make `threads.updatePluginMetadata` fail. */
  failMetadata: Error | null;
  /** The cost that `threads.context` reports per thread. A thread that is missing reports no cost. */
  costs: Map<string, { amount: number; currency: string }>;
  /** The webhook receiver. */
  webhook: WebhookFake;
  /** Move the plugin's clock forward by `ms`. */
  skewClock(ms: number): void;
  metadata: Map<string, Record<string, unknown>>;
  execCalls: Array<{ command: string; args: readonly string[]; cwd?: string }>;
  /** Override to script git and gh. The default is a successful empty run. */
  execHandler: (command: string, args: readonly string[]) => ExecResult;
  /** A second view of the plugin's own database, for setup and for reading the log. */
  store: ReturnType<typeof openSqliteStore>;
  setProject(config: Partial<ProjectConfig>): void;
  /** Make the thread bb knows about, as if the owner created it. */
  addThread(thread: Partial<FakeThread> & { id: string }): FakeThread;
  /** Texts the plugin sent through `threads.send`, per thread. */
  sent(threadId: string): string[];
  call(tool: string, args: unknown, caller?: { threadId: string; projectId?: string }): Promise<{ text: string; isError: boolean }>;
  sdkCalls(path: string): unknown[][];
  /** Runs when the plugin waits through its injected `sleep`. */
  sleepHook: ((ms: number) => Promise<void>) | null;
  /** Reload the plugin on the same database, as a server restart does. */
  restart(): Promise<void>;
  /** Run the start-up service until its work is done, then stop it. */
  runStartup(): Promise<void>;
  /** Start the machine monitor service. Call `stop` when the test is done. */
  startMonitor(): { stop(): Promise<void> };
  /** Emit a thread event with a complete thread DTO built from `thread`. */
  emit(name: "thread.failed" | "thread.idle" | "thread.deleted" | "thread.archived", threadId: string, extra?: Record<string, unknown>): Promise<void>;
}

export interface WorldOptions {
  settings?: Record<string, string | number | boolean>;
  spawnError?: Error;
  /** Thread IDs for the workers that `threads.spawn` creates, in order. */
  threadIds?: string[];
  /** Make `threads.send` fail. */
  sendError?: Error;
  /** Replace the no-mistakes validator. */
  validator?: Validator;
  /** The project's checkout path. The default is a path that does not exist. */
  checkout?: string;
  /** What `providers.list` returns. The default lists `claude` and `claude-code`. */
  providers?: unknown[];
  /** The machines bb knows. The default is one connected host, `host_local`, named `local-box`. */
  machines?: HostFixture[];
  /** The project's sources. The default is one default source on `host_local`. */
  sources?: SourceFixture[];
  /** What `providers.list` returns per host ID, instead of `providers`. */
  providersByHost?: Record<string, unknown[]>;
  /** Make `providers.list` fail. */
  providersError?: Error;
  /** Make `projects.get` fail. */
  projectError?: Error;
  /** Make `hosts.list` fail. */
  hostsError?: Error;
  /** What `projects.list` returns. */
  projectList?: Array<{ id: string; name: string }>;
  /** Replace the rules-table resolver. */
  resolver?: DispatchResolver;
  /** Run some commands for real. Return undefined to fall back to the scripted handler. */
  exec?: (command: string, args: readonly string[], cwd: string | undefined) => Promise<ExecResult> | undefined;
}

/** Load the real plugin factory into the fake host, with a small in-memory bb behind `bb.sdk`. */
export async function loadWorld(options: WorldOptions = {}): Promise<World> {
  const threads = new Map<string, FakeThread>();
  const paths = new Map<string, string>();
  const metadata = new Map<string, Record<string, unknown>>();
  const machines: HostFixture[] = options.machines ?? [hostFixture("host_local", "local-box")];
  const sources = () => (options.sources ?? [{ hostId: "host_local", path: options.checkout ?? "/work/repo", isDefault: true }]).map((source, index) => ({ type: "local_path", isDefault: source.isDefault ?? index === 0, ...source }));
  const remote: RemoteFake = { runs: [], handler: () => ({ code: 0, stdout: "", stderr: "" }), truncate: false, createError: null };
  const terminals = new Map<string, { status: string; exitCode: number | null; output: string; truncated: boolean }>();
  const costs = new Map<string, { amount: number; currency: string }>();
  const webhook: WebhookFake = { calls: [], result: { ok: true, status: 200 } };
  let skew = 0;
  const sent = new Map<string, string[]>();
  let spawned = 0;

  const host = createFakePluginHost({
    pluginId: "factoryman",
    agentSkillIds: skillNamesOnDisk(),
    settings: options.settings,
    sdk: {
      threads: {
        spawn: async (args: { projectId: string; parentThreadId?: string; pluginMetadata?: Record<string, unknown>; environment?: unknown }) => {
          if (options.spawnError) throw options.spawnError;
          // Real bb answers HTTP 409 for a host that holds no source of the project (spike item 6).
          const hostId = (args.environment as { hostId?: string } | undefined)?.hostId;
          if (hostId !== undefined && !sources().some((source) => source.hostId === hostId)) throw new Error("HTTP 409: No project source configured for this host");
          const id = options.threadIds?.[spawned] ?? `thr-w${spawned + 1}`;
          spawned += 1;
          threads.set(id, { id, projectId: args.projectId, status: "active", parentThreadId: args.parentThreadId ?? null, environmentId: `env-${id}` });
          metadata.set(id, args.pluginMetadata ?? {});
          return { id };
        },
        get: async ({ threadId }: { threadId: string }) => {
          const thread = threads.get(threadId);
          if (!thread) throw new NotFound("HTTP 404: thread not found");
          return thread;
        },
        send: async ({ threadId, input }: { threadId: string; input?: ReadonlyArray<{ type: string; text?: string }> }) => {
          if (options.sendError) throw options.sendError;
          sent.set(threadId, [...(sent.get(threadId) ?? []), (input ?? []).map((part) => part.text ?? "").join("")]);
          return { ok: true, delivery: "sent" };
        },
        archive: async () => ({}),
        context: async ({ threadId }: { threadId: string }) => {
          const cost = costs.get(threadId);
          return { usage: cost === undefined ? null : { cost, estimated: true, modelContextWindow: 200000 } };
        },
        updatePluginMetadata: async ({ threadId, set }: { threadId: string; set?: Record<string, unknown> }) => {
          if (world.failMetadata) throw world.failMetadata;
          metadata.set(threadId, { ...(metadata.get(threadId) ?? {}), ...set });
          return {};
        },
      },
      environments: {
        get: async ({ environmentId }: { environmentId: string }) => ({ id: environmentId, path: paths.get(environmentId) ?? null }),
        delete: async () => ({ ok: true }),
      },
      projects: {
        list: async () => options.projectList ?? [],
        get: async ({ projectId }: { projectId: string }) => {
          if (options.projectError) throw options.projectError;
          return { id: projectId, gitRemoteUrl: "git@github.com:acme/widgets.git", sources: sources() };
        },
      },
      providers: {
        list: async (args?: { hostId?: string }) => {
          if (options.providersError) throw options.providersError;
          const held = world.holdProviders;
          world.holdProviders = null;
          if (held !== null) await held;
          const byHost = args?.hostId === undefined ? undefined : options.providersByHost?.[args.hostId];
          return byHost ?? options.providers ?? [providerFixture("claude"), providerFixture("claude-code")];
        },
      },
      hosts: {
        list: async () => {
          if (options.hostsError) throw options.hostsError;
          return machines;
        },
      },
      terminals: {
        create: async (rawArgs: unknown) => {
          const args = rawArgs as { scope: { hostId: string; cwd: string | null }; start: { argv: string[] } };
          if (remote.createError) throw remote.createError;
          // The runner starts `sh -c <wrapper> sh <command> <args>`, so the real command starts at index 4.
          const [, , , , command = "", ...rest] = args.start.argv;
          const run: RemoteRun = { hostId: args.scope.hostId, cwd: args.scope.cwd, command, args: rest };
          remote.runs.push(run);
          const id = `term_${remote.runs.length}`;
          const result = remote.handler(run);
          terminals.set(
            id,
            result === "hang"
              ? { status: "running", exitCode: null, output: "", truncated: false }
              : { status: "exited", exitCode: 0, output: frame(result.code ?? 1, result.stdout, result.stderr), truncated: remote.truncate },
          );
          return { id };
        },
        output: async ({ terminalId }: { terminalId: string }) => {
          const session = terminals.get(terminalId);
          if (!session) throw new NotFound("HTTP 404: terminal not found");
          return { status: session.status, exitCode: session.exitCode, truncated: session.truncated, closeReason: null, nextSeq: 1, chunks: [{ seq: 0, dataBase64: Buffer.from(session.output, "utf8").toString("base64") }] };
        },
        close: async () => ({}),
      },
    },
  });

  const world: World = {
    host,
    threads,
    paths,
    machines,
    remote,
    failMetadata: null,
    holdProviders: null,
    costs,
    webhook,
    skewClock(ms) {
      skew += ms;
    },
    metadata,
    execCalls: [],
    execHandler: () => ({ code: 0, stdout: "", stderr: "" }),
    store: undefined as never,
    setProject(config) {
      world.store.putProjectConfig({ ...defaultProjectConfig("proj-1"), ...config });
    },
    addThread(thread) {
      const full: FakeThread = { projectId: "proj-1", status: "idle", parentThreadId: null, environmentId: null, ...thread };
      threads.set(full.id, full);
      return full;
    },
    sent: (threadId) => sent.get(threadId) ?? [],
    async call(tool, args, caller = { threadId: "thr-sup" }) {
      const result = await world.host.harness.behavior.callAgentTool(tool, args, { threadId: caller.threadId, projectId: caller.projectId ?? "proj-1" });
      if (typeof result === "string") return { text: result, isError: false };
      return { text: result.content.map((part) => (part.type === "text" ? part.text : "")).join(""), isError: result.isError === true };
    },
    sdkCalls: (path) => world.host.harness.sdk.callsTo(path),
    sleepHook: null,
    async restart() {
      world.host = await world.host.harness.lifecycle.reload(factory);
      world.store = openSqliteStore(world.host.bb.storage.database());
    },
    async runStartup() {
      const run = world.host.harness.behavior.runService("factoryman-startup");
      await new Promise((resolve) => setTimeout(resolve, 0));
      run.controller.abort();
      await run.done;
    },
    startMonitor() {
      const run = world.host.harness.behavior.runService("factoryman-machines");
      return {
        stop: async () => {
          run.controller.abort();
          await run.done;
        },
      };
    },
    async emit(name, threadId, extra = {}) {
      const thread = world.threads.get(threadId);
      const dto = makeThreadResponse({ id: threadId, ...(thread ? { projectId: thread.projectId, parentThreadId: thread.parentThreadId, status: thread.status as never } : {}) });
      await world.host.harness.behavior.emitThreadEvent(name, { thread: dto, ...extra } as never);
    },
  };

  let next = 0;
  const factory = createPlugin({
    exec: async (command, args, execOptions) => {
      world.execCalls.push({ command, args, cwd: execOptions?.cwd });
      return (await options.exec?.(command, args, execOptions?.cwd)) ?? world.execHandler(command, args);
    },
    now: ((tick = 0) => () => new Date(Date.parse("2026-11-06T12:00:00.000Z") + skew + tick++ * 1000).toISOString())(),
    newId: () => `t${++next}`,
    sleep: async (ms) => (world.sleepHook ? world.sleepHook(ms) : new Promise<void>((resolve) => setTimeout(resolve, 1))),
    validator: options.validator,
    resolver: options.resolver,
    fetch: async (url, init) => {
      webhook.calls.push({ url, init });
      if (webhook.result instanceof Error) throw webhook.result;
      return webhook.result;
    },
    pollMs: 1,
    remote: { pollMs: 1, timeoutMs: 30 },
    machinePollMs: 1,
  });
  await factory(host.bb);
  world.store = openSqliteStore(host.bb.storage.database());
  world.addThread({ id: "thr-sup" });
  return world;
}

export const PROFILE_ARGS = { provider: "claude", model: "opus", reasoningLevel: "high", permissionMode: "accept-edits" } as const;
export const DISPATCH = { kind: "ship", description: "Add a --json flag to the status command.", profile: PROFILE_ARGS } as const;

/** Wait until the host holds an open form, then return its ID. */
export async function nextForm(world: World): Promise<string> {
  for (let i = 0; i < 200; i += 1) {
    const [form] = world.host.harness.inspection.pendingInteractions;
    if (form) return form.id;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("no approval form opened");
}

/** Poll until `until` holds, so a background loop has time to run. */
export async function settle(until: () => boolean, limit = 500): Promise<void> {
  for (let i = 0; i < limit && !until(); i += 1) await new Promise((resolve) => setTimeout(resolve, 2));
}
