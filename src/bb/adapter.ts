import type { BbPluginApi } from "@get-bb/plugin-sdk";
import type { BbPort, InputResult, Json } from "./port";

const PERMISSION_MODES = ["accept-edits", "auto", "full"] as const;
type PermissionMode = (typeof PERMISSION_MODES)[number];

function permissionMode(value: string): PermissionMode {
  if ((PERMISSION_MODES as readonly string[]).includes(value)) return value as PermissionMode;
  throw new Error(`Unknown permission mode \`${value}\`.`);
}

interface ThreadFields {
  id: string;
  projectId: string;
  status: string;
  parentThreadId: string | null;
  environmentId: string | null;
  deletedAt?: number | null;
}

/** True for the error that bb's SDK raises for an HTTP 404. */
function isNotFound(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { status, message } = error as { status?: unknown; message?: unknown };
  return status === 404 || (typeof message === "string" && /\bHTTP 404\b/.test(message));
}

/**
 * The only place that calls `bb.sdk` and `bb.ui`. A change in the SDK lands here
 * and nowhere else.
 */
export function createBbPort(bb: BbPluginApi): BbPort {
  return {
    async spawnWorker(request) {
      // bb 0.48.1 rejects a host workspace without a host ID (found in the live smoke test), so use the project's default host.
      const project = await bb.sdk.projects.get({ projectId: request.projectId });
      const hostId = project.sources.find((candidate) => candidate.isDefault)?.hostId;
      if (hostId === undefined || hostId === null) throw new Error(`bb reports no host for project ${request.projectId}.`);
      const thread = await bb.sdk.threads.spawn({
        projectId: request.projectId,
        prompt: request.prompt,
        parentThreadId: request.parentThreadId,
        parentNotifications: "off",
        providerId: request.profile.provider,
        model: request.profile.model,
        reasoningLevel: request.profile.reasoningLevel,
        permissionMode: permissionMode(request.profile.permissionMode),
        pluginMetadata: request.metadata,
        environment: {
          type: "host",
          hostId,
          workspace: {
            type: "managed-worktree",
            baseBranch: request.baseBranch === null ? { kind: "default" } : { kind: "named", name: request.baseBranch },
          },
        },
      });
      return { threadId: thread.id };
    },

    async getThread(threadId) {
      try {
        const found = (await bb.sdk.threads.get({ threadId })) as ThreadFields | { thread: ThreadFields };
        const { id, projectId, status, parentThreadId, environmentId, deletedAt } = "thread" in found ? found.thread : found;
        return { id, projectId, status, parentThreadId, environmentId, deleted: deletedAt !== null && deletedAt !== undefined };
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },

    async sendMessage(threadId, text) {
      await bb.sdk.threads.send({ threadId, mode: "auto", input: [{ type: "text", text, mentions: [] }] });
    },

    async getEnvironmentPath(environmentId) {
      const environment = await bb.sdk.environments.get({ environmentId });
      return environment.path ?? null;
    },

    async retireWorker(threadId, environmentId) {
      await bb.sdk.threads.archive({ threadId });
      await bb.sdk.environments.delete({ environmentId });
    },

    async getProjectCheckout(projectId) {
      const project = await bb.sdk.projects.get({ projectId });
      const source = project.sources.find((candidate) => candidate.isDefault && candidate.type === "local_path");
      return source?.path ?? null;
    },

    async getProjectRemote(projectId) {
      const project = await bb.sdk.projects.get({ projectId });
      return project.gitRemoteUrl ?? null;
    },

    async requestInput(request) {
      const result = await bb.ui.requestInput(
        { threadId: request.threadId, rendererId: request.rendererId, title: request.title, payload: request.payload, timeoutMs: request.timeoutMs },
        request.signal ? { signal: request.signal } : undefined,
      );
      return result as InputResult;
    },

    async setThreadMetadata(threadId, metadata: Record<string, Json>) {
      await bb.sdk.threads.updatePluginMetadata({ threadId, pluginId: bb.pluginId, set: metadata });
    },
  };
}
