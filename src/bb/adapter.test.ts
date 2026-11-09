import { createFakePluginHost, type FakeSdkOverrides } from "@get-bb/plugin-sdk/testing";
import { describe, expect, it } from "vitest";
import { PROFILE } from "../../test/fixtures/machine";
import { createBbPort } from "./adapter";

function setup(sdk: FakeSdkOverrides = {}) {
  const host = createFakePluginHost({ pluginId: "factoryman", sdk });
  return { host, port: createBbPort(host.bb), sdk: host.harness.sdk };
}

class NotFound extends Error {
  status = 404;
}

describe("createBbPort", () => {
  const projects = { get: async () => ({ id: "proj-1", sources: [{ type: "local_path", isDefault: true, hostId: "host_1", path: "/work/repo" }] }) };

  it("[U10] spawns a worker with the project, parent, off notifications, role metadata, profile, and a managed worktree on the project's host", async () => {
    const { port, sdk } = setup({ threads: { spawn: async () => ({ id: "thr-9" }) }, projects });
    const result = await port.spawnWorker({
      projectId: "proj-1",
      parentThreadId: "thr-sup",
      prompt: "do the work",
      profile: { ...PROFILE, permissionMode: "accept-edits" },
      metadata: { role: "worker", taskId: "t1" },
      baseBranch: "main",
    });
    expect(result).toEqual({ threadId: "thr-9" });
    expect(sdk.callsTo("threads.spawn")).toEqual([
      [
        {
          projectId: "proj-1",
          prompt: "do the work",
          parentThreadId: "thr-sup",
          parentNotifications: "off",
          providerId: "claude",
          model: "opus",
          reasoningLevel: "high",
          permissionMode: "accept-edits",
          pluginMetadata: { role: "worker", taskId: "t1" },
          // The server adds the origin for a plugin spawn (SDK normalization).
          origin: "plugin",
          originPluginId: "factoryman",
          environment: { type: "host", hostId: "host_1", workspace: { type: "managed-worktree", baseBranch: { kind: "named", name: "main" } } },
        },
      ],
    ]);
  });

  it("[U10] uses the default base branch when none is set", async () => {
    const { port, sdk } = setup({ threads: { spawn: async () => ({ id: "thr-9" }) }, projects });
    await port.spawnWorker({
      projectId: "proj-1",
      parentThreadId: "thr-sup",
      prompt: "x",
      profile: { ...PROFILE, permissionMode: "auto" },
      metadata: {},
      baseBranch: null,
    });
    const [[args]] = sdk.callsTo("threads.spawn") as [[{ environment: unknown }]];
    expect(args.environment).toEqual({ type: "host", hostId: "host_1", workspace: { type: "managed-worktree", baseBranch: { kind: "default" } } });
  });

  it("[U10] refuses to spawn when bb reports no host for the project, and spawns nothing", async () => {
    const { port, sdk } = setup({ threads: { spawn: async () => ({ id: "thr-9" }) }, projects: { get: async () => ({ id: "proj-1", sources: [] }) } });
    await expect(
      port.spawnWorker({ projectId: "proj-1", parentThreadId: "thr-sup", prompt: "x", profile: { ...PROFILE, permissionMode: "auto" }, metadata: {}, baseBranch: null }),
    ).rejects.toThrow(/no host/i);
    expect(sdk.callsTo("threads.spawn")).toEqual([]);
  });

  it("[U11] reads a thread as id, project, status, parent, and environment", async () => {
    const { port } = setup({
      threads: {
        get: async () => ({ id: "thr-1", projectId: "proj-1", status: "error", parentThreadId: "thr-sup", environmentId: "env-1", deletedAt: null, extra: true }),
      },
    });
    expect(await port.getThread("thr-1")).toEqual({
      id: "thr-1",
      projectId: "proj-1",
      status: "error",
      parentThreadId: "thr-sup",
      environmentId: "env-1",
      deleted: false,
    });
  });

  it("[U11] flags a soft-deleted thread and keeps its parent", async () => {
    const { port } = setup({ threads: { get: async () => ({ id: "thr-1", projectId: "proj-1", status: "idle", parentThreadId: "thr-sup", environmentId: null, deletedAt: 1794000000000 }) } });
    expect(await port.getThread("thr-1")).toMatchObject({ deleted: true, parentThreadId: "thr-sup" });
  });

  it("[U12] reads an unknown thread as null, and rethrows other failures", async () => {
    const missing = setup({ threads: { get: async () => Promise.reject(new NotFound("HTTP 404: thread not found")) } });
    expect(await missing.port.getThread("thr-x")).toBeNull();
    const broken = setup({ threads: { get: async () => Promise.reject(new Error("HTTP 500: boom")) } });
    await expect(broken.port.getThread("thr-x")).rejects.toThrow("HTTP 500: boom");
  });

  it("[U13] sends one text input in auto mode", async () => {
    const { port, sdk } = setup({ threads: { send: async () => ({ ok: true, delivery: "sent" }) } });
    await port.sendMessage("thr-sup", "wake up");
    expect(sdk.callsTo("threads.send")).toEqual([
      [{ threadId: "thr-sup", mode: "auto", input: [{ type: "text", text: "wake up", mentions: [] }] }],
    ]);
  });

  it("[U14] retires a worker by archiving the thread and then deleting the environment", async () => {
    const { port, sdk } = setup({
      threads: { archive: async () => ({}) },
      environments: { delete: async () => ({ ok: true }) },
    });
    await port.retireWorker("thr-1", "env-1");
    expect(sdk.calls.map((call) => `${call.path} ${JSON.stringify(call.args[0])}`)).toEqual([
      'threads.archive {"threadId":"thr-1"}',
      'environments.delete {"environmentId":"env-1"}',
    ]);
  });

  it("[U15] forwards a form request and returns the owner's submitted value unchanged", async () => {
    const { host, port } = setup();
    const pending = port.requestInput({
      threadId: "thr-sup",
      rendererId: "factoryman-merge-approval",
      title: "Approve merge",
      payload: { taskId: "t1" },
      timeoutMs: 5000,
    });
    const [form] = host.harness.inspection.pendingInteractions;
    expect(form).toMatchObject({ threadId: "thr-sup", rendererId: "factoryman-merge-approval", title: "Approve merge", payload: { taskId: "t1" }, timeoutMs: 5000 });
    host.harness.behavior.submitInteraction(form!.id, { decision: "approved" });
    expect(await pending).toEqual({ outcome: "submitted", value: { decision: "approved" } });
  });

  it("[U15] returns a cancelled form as a cancelled result", async () => {
    const { host, port } = setup();
    const pending = port.requestInput({ threadId: "thr-sup", rendererId: "r", title: "t", payload: {}, timeoutMs: 5000 });
    host.harness.behavior.cancelInteraction(host.harness.inspection.pendingInteractions[0]!.id);
    expect(await pending).toMatchObject({ outcome: "cancelled" });
  });

  it("[U16] stamps plugin metadata on the thread under the plugin's own ID", async () => {
    const { port, sdk } = setup({ threads: { updatePluginMetadata: async () => ({}) } });
    await port.setThreadMetadata("thr-1", { role: "supervisor" });
    expect(sdk.callsTo("threads.updatePluginMetadata")).toEqual([[{ threadId: "thr-1", pluginId: "factoryman", set: { role: "supervisor" } }]]);
  });

  it("[U17] reads an environment path, or null when the environment has none", async () => {
    const withPath = setup({ environments: { get: async () => ({ id: "env-1", path: "/work/tree" }) } });
    expect(await withPath.port.getEnvironmentPath("env-1")).toBe("/work/tree");
    const without = setup({ environments: { get: async () => ({ id: "env-1", path: null }) } });
    expect(await without.port.getEnvironmentPath("env-1")).toBeNull();
  });

  it("[U18] reads the project's default local source path, or null", async () => {
    const some = setup({
      projects: {
        get: async () => ({
          id: "proj-1",
          sources: [
            { type: "git_remote", isDefault: false, path: null },
            { type: "local_path", isDefault: true, path: "/work/repo" },
          ],
        }),
      },
    });
    expect(await some.port.getProjectCheckout("proj-1")).toBe("/work/repo");
    const none = setup({ projects: { get: async () => ({ id: "proj-1", sources: [] }) } });
    expect(await none.port.getProjectCheckout("proj-1")).toBeNull();
  });

  it("[U218] reads the project's git remote URL, or null", async () => {
    const some = setup({ projects: { get: async () => ({ id: "proj-1", gitRemoteUrl: "git@github.com:acme/widgets.git", sources: [] }) } });
    expect(await some.port.getProjectRemote("proj-1")).toBe("git@github.com:acme/widgets.git");
    const none = setup({ projects: { get: async () => ({ id: "proj-1", gitRemoteUrl: null, sources: [] }) } });
    expect(await none.port.getProjectRemote("proj-1")).toBeNull();
  });
  it("[U742] lists providers as ID, availability, permission modes, and reasoning level IDs", async () => {
    const { port } = setup({
      providers: {
        list: async () => [
          { id: "claude-code", available: true, capabilities: { permissionModes: ["accept-edits", "auto", "full"] }, reasoningLevels: [{ id: "low", label: "Low" }, { id: "high", label: "High" }] },
          { id: "pi", available: false, capabilities: { permissionModes: ["full"] }, reasoningLevels: [] },
        ],
      },
    } as FakeSdkOverrides);
    expect(await port.listProviders()).toEqual([
      { id: "claude-code", available: true, permissionModes: ["accept-edits", "auto", "full"], reasoningLevels: ["low", "high"] },
      { id: "pi", available: false, permissionModes: ["full"], reasoningLevels: [] },
    ]);
  });

  describe("getProviderStates", () => {
    const entry = (overrides: Record<string, unknown> = {}) => ({
      providerId: "codex",
      displayName: "Codex",
      status: "unauthenticated",
      installedVersion: "0.166.0",
      minimumSupportedVersion: "0.136.0",
      localLoginCommand: "codex login",
      loginCommand: "codex login --remote",
      statusMessage: "Not signed in",
      accountEmail: null,
      canInstall: false,
      canUpdate: false,
      planLabel: null,
      ...overrides,
    });

    it("[U1318] calls providerStates with no argument for no host, and with the host ID for a host", async () => {
      const { port, sdk } = setup({ system: { providerStates: async () => ({ providers: [] }) } } as FakeSdkOverrides);
      await port.getProviderStates();
      await port.getProviderStates("h2");
      expect(sdk.callsTo("system.providerStates")).toEqual([[undefined], [{ hostId: "h2" }]]);
    });

    it("[U1319] keeps the provider ID, status, versions, local login command, and status message of each entry, in order", async () => {
      const { port } = setup({
        system: { providerStates: async () => ({ providers: [entry(), entry({ providerId: "pi", status: "ready", installedVersion: null, minimumSupportedVersion: null, localLoginCommand: null, statusMessage: null })] }) },
      } as FakeSdkOverrides);
      expect(await port.getProviderStates()).toEqual([
        { providerId: "codex", status: "unauthenticated", installedVersion: "0.166.0", minimumSupportedVersion: "0.136.0", localLoginCommand: "codex login", statusMessage: "Not signed in" },
        { providerId: "pi", status: "ready", installedVersion: null, minimumSupportedVersion: null, localLoginCommand: null, statusMessage: null },
      ]);
    });

    it("[U1320] reads a status outside the six known values as unknown", async () => {
      const { port } = setup({ system: { providerStates: async () => ({ providers: [entry({ status: "rate_limited" }), entry({ status: undefined })] }) } } as FakeSdkOverrides);
      expect((await port.getProviderStates()).map((state) => state.status)).toEqual(["unknown", "unknown"]);
    });

    it.each(["ready", "not_installed", "unauthenticated", "expired", "unsupported_version", "unknown"])("[U1320] keeps the known status %s", async (status) => {
      const { port } = setup({ system: { providerStates: async () => ({ providers: [entry({ status })] }) } } as FakeSdkOverrides);
      expect((await port.getProviderStates())[0]?.status).toBe(status);
    });

    it("[U1321] does not catch an SDK error", async () => {
      const { port } = setup({
        system: {
          providerStates: async () => {
            throw new Error("HTTP 500");
          },
        },
      } as FakeSdkOverrides);
      await expect(port.getProviderStates()).rejects.toThrow("HTTP 500");
    });
  });

  describe("listModels", () => {
    const model = (overrides: Record<string, unknown> = {}) => ({
      id: "openai/gpt-6-luna",
      model: "gpt-6-luna",
      displayName: "GPT 6 Luna",
      description: "",
      isDefault: true,
      defaultReasoningEffort: "medium",
      reasoningDiscovery: "known",
      supportedReasoningEfforts: [
        { reasoningEffort: "low", description: "" },
        { reasoningEffort: "medium", description: "" },
      ],
      ...overrides,
    });
    const answer = (models: unknown[], modelLoadError: unknown = null) => ({ models, modelLoadError, selectedOnlyModels: [], providers: [] });

    it("[U1369] passes the provider ID, and passes the host ID only when one is given", async () => {
      const { port, sdk } = setup({ providers: { models: async () => answer([]) } } as FakeSdkOverrides);
      await port.listModels("pi");
      await port.listModels("pi", "h2");
      expect(sdk.callsTo("providers.models")).toEqual([[{ providerId: "pi" }], [{ providerId: "pi", hostId: "h2" }]]);
    });

    it("[U1370] keeps the ID, the model name, the default flag, the default level, and the levels of each model", async () => {
      const { port } = setup({ providers: { models: async () => answer([model(), model({ id: "other", model: "other", isDefault: false, defaultReasoningEffort: "", supportedReasoningEfforts: [] })]) } } as FakeSdkOverrides);
      expect((await port.listModels("pi")).models).toEqual([
        { id: "openai/gpt-6-luna", model: "gpt-6-luna", isDefault: true, defaultReasoningLevel: "medium", reasoningLevels: ["low", "medium"], reasoningKnown: true },
        { id: "other", model: "other", isDefault: false, defaultReasoningLevel: "", reasoningLevels: [], reasoningKnown: true },
      ]);
    });

    it("[U1371] reads reasoningDiscovery known as true and unknown as false", async () => {
      const { port } = setup({ providers: { models: async () => answer([model({ reasoningDiscovery: "known" }), model({ id: "b", reasoningDiscovery: "unknown" })]) } } as FakeSdkOverrides);
      expect((await port.listModels("pi")).models.map((entry) => entry.reasoningKnown)).toEqual([true, false]);
    });

    it("[U1372] reads a model load error as code and detail, and an absent one as null", async () => {
      const failed = setup({ providers: { models: async () => answer([], { code: "auth_required", detail: "Run pi login", providerId: "pi" }) } } as FakeSdkOverrides);
      expect((await failed.port.listModels("pi")).loadError).toEqual({ code: "auth_required", detail: "Run pi login" });
      const noDetail = setup({ providers: { models: async () => answer([], { code: "timeout", detail: null, providerId: "pi" }) } } as FakeSdkOverrides);
      expect((await noDetail.port.listModels("pi")).loadError).toEqual({ code: "timeout", detail: null });
      const fine = setup({ providers: { models: async () => answer([model()]) } } as FakeSdkOverrides);
      expect((await fine.port.listModels("pi")).loadError).toBeNull();
    });

    it("[U1373] does not catch an SDK error", async () => {
      const { port } = setup({
        providers: {
          models: async () => {
            throw new Error("HTTP 500");
          },
        },
      } as FakeSdkOverrides);
      await expect(port.listModels("pi")).rejects.toThrow("HTTP 500");
    });
  });

  it("[U819] lists machines with ID, name, status, phase, and an online flag", async () => {
    const host = (id: string, status: string, phase: string) => ({ id, name: `name-${id}`, status, lifecycle: { phase } });
    const { port } = setup({
      hosts: { list: async () => [host("h1", "connected", "active"), host("h2", "disconnected", "active"), host("h3", "connected", "suspended")] },
    } as FakeSdkOverrides);
    expect(await port.listMachines()).toEqual([
      { id: "h1", name: "name-h1", status: "connected", phase: "active", online: true },
      { id: "h2", name: "name-h2", status: "disconnected", phase: "active", online: false },
      { id: "h3", name: "name-h3", status: "connected", phase: "suspended", online: false },
    ]);
  });

  it("[U820] lists the project's sources with host, path, and default flag", async () => {
    const { port } = setup({
      projects: {
        get: async () => ({
          id: "proj-1",
          sources: [
            { type: "local_path", isDefault: true, hostId: "h1", path: "/work/a" },
            { type: "local_path", isDefault: false, hostId: "h2", path: "/work/b" },
          ],
        }),
      },
    } as FakeSdkOverrides);
    expect(await port.getProjectSources("proj-1")).toEqual([
      { hostId: "h1", path: "/work/a", isDefault: true },
      { hostId: "h2", path: "/work/b", isDefault: false },
    ]);
  });

  it("[U821] passes the host ID to the provider list, and none when it is absent", async () => {
    const { port, sdk } = setup({ providers: { list: async () => [] } } as FakeSdkOverrides);
    await port.listProviders("h2");
    await port.listProviders();
    expect(sdk.callsTo("providers.list")).toEqual([[{ hostId: "h2" }], [undefined]]);
  });

  it("[U822] spawns on the given host, and on the project's default host when none is given", async () => {
    const twoHosts = {
      get: async () => ({
        id: "proj-1",
        sources: [
          { type: "local_path", isDefault: true, hostId: "host_1", path: "/work/repo" },
          { type: "local_path", isDefault: false, hostId: "host_2", path: "/work/other" },
        ],
      }),
    };
    const { port, sdk } = setup({ threads: { spawn: async () => ({ id: "thr-9" }) }, projects: twoHosts } as FakeSdkOverrides);
    const base = { projectId: "proj-1", parentThreadId: "thr-sup", prompt: "x", profile: { ...PROFILE, permissionMode: "auto" as const }, metadata: {}, baseBranch: null };
    await port.spawnWorker({ ...base, hostId: "host_2" });
    await port.spawnWorker({ ...base, hostId: null });
    await port.spawnWorker(base);
    const hosts = (sdk.callsTo("threads.spawn") as Array<[{ environment: { hostId: string } }]>).map(([args]) => args.environment.hostId);
    expect(hosts).toEqual(["host_2", "host_1", "host_1"]);
    await expect(port.spawnWorker({ ...base, hostId: "host_9" })).rejects.toThrow(/host_9/);
  });

  it("[U823] starts a host_path terminal in argv mode, reads decoded output, and closes it", async () => {
    const created: unknown[] = [];
    const { port, sdk } = setup({
      terminals: {
        create: async (args: unknown) => {
          created.push(args);
          return { id: "term_1" };
        },
        output: async () => ({
          status: "exited",
          exitCode: 3,
          truncated: false,
          chunks: [
            { seq: 1, dataBase64: Buffer.from("world\n").toString("base64") },
            { seq: 0, dataBase64: Buffer.from("hello ").toString("base64") },
          ],
        }),
        close: async () => ({}),
      },
    } as FakeSdkOverrides);
    expect(await port.startTerminal("host_gpu", "/work/gpu", ["sh", "-c", "true"])).toEqual({ terminalId: "term_1" });
    expect(created).toEqual([{ cols: 200, rows: 50, scope: { kind: "host_path", hostId: "host_gpu", cwd: "/work/gpu" }, start: { mode: "argv", argv: ["sh", "-c", "true"] } }]);
    expect(await port.readTerminal("term_1")).toEqual({ status: "exited", exitCode: 3, output: "hello world\n", truncated: false });
    await port.closeTerminal("term_1");
    expect(sdk.callsTo("terminals.close")).toEqual([[{ terminalId: "term_1", mode: "force" }]]);
  });
  it("[U1028] reads the cost of a thread, and gives null for no cost or for a failure", async () => {
    const context = (usage: unknown) => ({ threads: { context: async () => ({ usage }) } }) as FakeSdkOverrides;
    expect(await setup(context({ cost: { amount: 1.25, currency: "USD" }, estimated: true })).port.getThreadCost("thr-1")).toEqual({ amount: 1.25, currency: "USD" });
    expect(await setup(context({ cost: { amount: 3, currency: "EUR" }, estimated: false })).port.getThreadCost("thr-1")).toEqual({ amount: 3, currency: "EUR" });
    expect(await setup(context({ estimated: true })).port.getThreadCost("thr-1")).toBeNull();
    expect(await setup(context({ cost: null })).port.getThreadCost("thr-1")).toBeNull();
    expect(await setup(context(null)).port.getThreadCost("thr-1")).toBeNull();
    const broken = setup({ threads: { context: async () => { throw new Error("bb is down"); } } } as FakeSdkOverrides);
    await expect(broken.port.getThreadCost("thr-1")).rejects.toThrow("bb is down");
  });

  it("[U1029] lists projects as ID and name", async () => {
    const { port } = setup({ projects: { list: async () => [{ id: "proj-1", name: "widgets", extra: 1 }, { id: "proj-2", name: "Gadgets" }] } } as FakeSdkOverrides);
    expect(await port.listProjects()).toEqual([{ id: "proj-1", name: "widgets" }, { id: "proj-2", name: "Gadgets" }]);
  });
});
