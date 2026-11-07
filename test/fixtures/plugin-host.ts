import { createFakePluginHost, type FakePluginHost } from "@get-bb/plugin-sdk/testing";
import { createPlugin } from "../../src/server";
import type { ExecResult } from "../../src/exec";
import { defaultProjectConfig } from "../../src/store/store";
import { openSqliteStore } from "../../src/store/sqlite";
import type { ProjectConfig } from "../../src/store/types";

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
}

export interface WorldOptions {
  settings?: Record<string, string | number | boolean>;
  spawnError?: Error;
}

/** Load the real plugin factory into the fake host, with a small in-memory bb behind `bb.sdk`. */
export async function loadWorld(options: WorldOptions = {}): Promise<World> {
  const threads = new Map<string, FakeThread>();
  const paths = new Map<string, string>();
  const metadata = new Map<string, Record<string, unknown>>();
  const sent = new Map<string, string[]>();
  let spawned = 0;

  const host = createFakePluginHost({
    pluginId: "factoryman",
    settings: options.settings,
    sdk: {
      threads: {
        spawn: async (args: { projectId: string; parentThreadId?: string; pluginMetadata?: Record<string, unknown> }) => {
          if (options.spawnError) throw options.spawnError;
          const id = `thr-w${++spawned}`;
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
          sent.set(threadId, [...(sent.get(threadId) ?? []), (input ?? []).map((part) => part.text ?? "").join("")]);
          return { ok: true, delivery: "sent" };
        },
        archive: async () => ({}),
        updatePluginMetadata: async ({ threadId, set }: { threadId: string; set?: Record<string, unknown> }) => {
          metadata.set(threadId, { ...(metadata.get(threadId) ?? {}), ...set });
          return {};
        },
      },
      environments: {
        get: async ({ environmentId }: { environmentId: string }) => ({ id: environmentId, path: paths.get(environmentId) ?? null }),
        delete: async () => ({ ok: true }),
      },
      projects: {
        get: async ({ projectId }: { projectId: string }) => ({ id: projectId, sources: [{ type: "local_path", isDefault: true, path: "/work/repo" }] }),
      },
    },
  });

  const world: World = {
    host,
    threads,
    paths,
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
      const result = await host.harness.behavior.callAgentTool(tool, args, { threadId: caller.threadId, projectId: caller.projectId ?? "proj-1" });
      if (typeof result === "string") return { text: result, isError: false };
      return { text: result.content.map((part) => (part.type === "text" ? part.text : "")).join(""), isError: result.isError === true };
    },
    sdkCalls: (path) => host.harness.sdk.callsTo(path),
  };

  let next = 0;
  await createPlugin({
    exec: async (command, args, execOptions) => {
      world.execCalls.push({ command, args, cwd: execOptions?.cwd });
      return world.execHandler(command, args);
    },
    now: ((tick = 0) => () => new Date(Date.parse("2026-11-06T12:00:00.000Z") + tick++ * 1000).toISOString())(),
    newId: () => `t${++next}`,
  })(host.bb);
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
