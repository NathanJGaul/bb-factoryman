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
  it("[U10] spawns a worker with the project, parent, off notifications, role metadata, profile, and a managed worktree", async () => {
    const { port, sdk } = setup({ threads: { spawn: async () => ({ id: "thr-9" }) } });
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
          environment: { type: "host", workspace: { type: "managed-worktree", baseBranch: { kind: "named", name: "main" } } },
        },
      ],
    ]);
  });

  it("[U10] uses the default base branch when none is set", async () => {
    const { port, sdk } = setup({ threads: { spawn: async () => ({ id: "thr-9" }) } });
    await port.spawnWorker({
      projectId: "proj-1",
      parentThreadId: "thr-sup",
      prompt: "x",
      profile: { ...PROFILE, permissionMode: "auto" },
      metadata: {},
      baseBranch: null,
    });
    const [[args]] = sdk.callsTo("threads.spawn") as [[{ environment: unknown }]];
    expect(args.environment).toEqual({ type: "host", workspace: { type: "managed-worktree", baseBranch: { kind: "default" } } });
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
});
