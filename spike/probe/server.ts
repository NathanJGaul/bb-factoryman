// Throwaway spike probe for bb-factoryman milestones 4 to 6.
// It never ships. It records what the real bb server does so the results can
// be written into spike/RESULTS.md.
import { appendFileSync } from "node:fs";
import type { BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";

// Set PROBE_LOG to a writable path before you start the server.
const LOG = process.env["PROBE_LOG"] ?? "/tmp/spike-probe.jsonl";

function record(kind: string, data: unknown): void {
  appendFileSync(
    LOG,
    `${JSON.stringify({ at: new Date().toISOString(), kind, data })}\n`,
  );
}

export default async function plugin(bb: BbPluginApi) {
  bb.log.info("probe loaded");
  record("loaded", { pluginId: bb.pluginId });

  // Per-thread tool visibility: the thread's plugin metadata picks the tools.
  bb.agents.registerTool({
    name: "probe_merge",
    description:
      "Probe: ask the owner for a merge approval. Takes a short note.",
    parameters: z.object({ note: z.string() }),
    async execute(params, ctx) {
      record("tool:probe_merge:start", { params, threadId: ctx.threadId });
      const started = Date.now();
      const result = await bb.ui.requestInput(
        {
          threadId: ctx.threadId,
          rendererId: "approval",
          title: "Approve merge (probe)",
          payload: { note: params.note },
          timeoutMs: 30000,
        },
        { signal: ctx.signal },
      );
      record("tool:probe_merge:result", {
        result,
        elapsedMs: Date.now() - started,
      });
      return `merge decision: ${JSON.stringify(result)}`;
    },
  });
  bb.agents.registerTool({
    name: "probe_report",
    description: "Probe: hand back a short outcome report.",
    parameters: z.object({ text: z.string() }),
    execute(params, ctx) {
      record("tool:probe_report", { params, threadId: ctx.threadId });
      return "report recorded";
    },
  });

  bb.agents.configure((context) => {
    const role = context.pluginMetadata["role"];
    record("configure", {
      threadId: context.thread.id,
      parentThreadId: context.thread.parentThreadId,
      pluginMetadata: context.pluginMetadata,
      origin: context.origin,
      host: context.host,
    });
    if (role === "supervisor") {
      return { tools: ["probe_merge", "probe_report"], skills: [] };
    }
    if (role === "worker") {
      return { tools: ["probe_report"], skills: [] };
    }
    return { tools: [], skills: [] };
  });

  // Event shapes: record every payload the plugin can observe.
  const names = [
    "thread.created",
    "thread.active",
    "thread.idle",
    "thread.failed",
    "thread.archived",
    "thread.deleted",
    "interaction.pending",
    "message.queued",
    "message.dispatched",
    "message.cancelled",
    "turn.failed",
  ] as const;
  for (const name of names) {
    bb.events.on(name, (payload) => {
      record(`event:${name}`, payload);
    });
  }

  bb.cli.register({
    name: "probe",
    summary: "Spike probe commands",
    commands: [
      { name: "form", summary: "open a form", usage: "bb probe form <threadId> <timeoutMs>" },
      { name: "send", summary: "send a message", usage: "bb probe send <threadId> <mode> <text>" },
      { name: "spawn", summary: "spawn a thread", usage: "bb probe spawn <projectId> <role> <prompt>" },
      { name: "meta", summary: "read thread metadata", usage: "bb probe meta <threadId>" },
    ],
    async run(argv) {
      const [cmd, ...rest] = argv;
      try {
        if (cmd === "form") {
          const [threadId, timeout] = rest;
          if (!threadId) return { exitCode: 2, stderr: "threadId required\n" };
          const started = Date.now();
          void bb.ui
            .requestInput({
              threadId,
              rendererId: "approval",
              title: "Approve merge (probe cli)",
              payload: { note: "cli form" },
              timeoutMs: Number(timeout ?? 30000),
            })
            .then((result) =>
              record("form:result", { result, elapsedMs: Date.now() - started }),
            )
            .catch((error: unknown) =>
              record("form:error", { message: String(error) }),
            );
          return { exitCode: 0, stdout: "form requested\n" };
        }
        if (cmd === "send") {
          const [threadId, mode, ...text] = rest;
          if (!threadId || !mode) return { exitCode: 2, stderr: "usage\n" };
          const res = await bb.sdk.threads.send({
            threadId,
            mode: mode as "auto",
            input: [{ type: "text", text: text.join(" "), mentions: [] }],
          });
          record("send:result", res);
          return { exitCode: 0, stdout: `${JSON.stringify(res)}\n` };
        }
        if (cmd === "spawn") {
          const [projectId, role, ...prompt] = rest;
          if (!projectId || !role) return { exitCode: 2, stderr: "usage\n" };
          const res = await bb.sdk.threads.spawn({
            projectId,
            prompt: prompt.join(" "),
            providerId: "claude-code",
            model: "claude-haiku-5-5",
            pluginMetadata: { role },
            environment: { type: "project-default" },
          });
          record("spawn:result", {
            id: res.id,
            status: res.status,
            keys: Object.keys(res),
          });
          return { exitCode: 0, stdout: `${res.id}\n` };
        }
        if (cmd === "meta") {
          const [threadId] = rest;
          if (!threadId) return { exitCode: 2, stderr: "usage\n" };
          const res = await bb.sdk.threads.getPluginMetadata({ threadId });
          return { exitCode: 0, stdout: `${JSON.stringify(res)}\n` };
        }
        return { exitCode: 2, stderr: "unknown command\n" };
      } catch (error) {
        record("cli:error", { cmd, message: String(error) });
        return { exitCode: 1, stderr: `${String(error)}\n` };
      }
    },
  });
}
