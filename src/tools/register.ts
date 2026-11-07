import type { BbPluginApi, PluginAgentToolResult } from "@get-bb/plugin-sdk";
import { z } from "zod";
import type { MergeExecutor } from "../git/merge";
import type { Runtime } from "../runtime";
import { dispatch, dispatchSchema, type Caller } from "./dispatch";
import { merge, mergeSchema } from "./merge";
import { report, reportSchema } from "./report";
import type { ToolOutcome } from "./results";
import { status, statusSchema } from "./status";
import { teardown, teardownSchema } from "./teardown";

const SUPERVISOR_TOOLS = ["factoryman_dispatch", "factoryman_status", "factoryman_merge", "factoryman_teardown"] as const;
const WORKER_TOOLS = ["factoryman_report"] as const;
export const TOOL_NAMES: readonly string[] = [...SUPERVISOR_TOOLS, ...WORKER_TOOLS];
const SUPERVISOR_SKILL = "factoryman-supervisor";
const WORKER_SKILL = "factoryman-worker";

/**
 * Which tools bb offers a thread, from its plugin metadata. This is a hint and
 * not a gate: the metadata is writable by the thread's own agent, so each tool
 * decides the caller again from the store.
 */
export function toolsForMetadata(metadata: Record<string, unknown>): string[] {
  const role = metadata["role"];
  if (role === "supervisor") return [...SUPERVISOR_TOOLS];
  if (role === "worker") return [...WORKER_TOOLS];
  return [];
}

/** Which skills bb loads for a thread, by role. Like the tools, this is a hint and not a gate. */
export function skillsForMetadata(metadata: Record<string, unknown>): string[] {
  const role = metadata["role"];
  if (role === "supervisor") return [SUPERVISOR_SKILL];
  if (role === "worker") return [WORKER_SKILL];
  return [];
}

export function toToolResult(outcome: ToolOutcome): PluginAgentToolResult {
  return outcome.ok ? outcome.text : { content: [{ type: "text", text: outcome.text }], isError: true };
}

/** The JSON schema that bb advertises. The tool re-checks its arguments, so a bad call gets the tool's own refusal text. */
function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  void _ignored;
  return rest;
}

export function registerTools(bb: BbPluginApi, rt: Runtime, executor: MergeExecutor): void {
  const caller = (ctx: { threadId: string; projectId: string; signal: AbortSignal }): Caller => ({ threadId: ctx.threadId, projectId: ctx.projectId, signal: ctx.signal });
  const define = (name: string, description: string, instructions: string, schema: z.ZodType, run: (caller: Caller, params: unknown) => Promise<ToolOutcome>) =>
    bb.agents.registerTool({
      name,
      description,
      instructions,
      parameters: jsonSchema(schema),
      execute: async (params, ctx) => toToolResult(await run(caller(ctx), params)),
    });

  define(
    "factoryman_dispatch",
    "Create a ship or scout task and start its worker thread.",
    "Call factoryman_dispatch with the task kind, a description, and a complete profile. The worker reports back through the plugin, and the plugin wakes you when a task needs you.",
    dispatchSchema,
    (c, params) => dispatch(rt, c, params),
  );
  define(
    "factoryman_status",
    "Read the state of one task or of the tasks in this project. This tool changes nothing.",
    "Call factoryman_status to read task state instead of asking a worker.",
    statusSchema,
    (c, params) => status(rt, c, params),
  );
  define(
    "factoryman_merge",
    "Ask the owner to approve a review-ready ship task, then merge it. The owner answers in a form.",
    "Call factoryman_merge only for a task in review_ready. A merge needs the owner's recorded approval unless the project has yolo on.",
    mergeSchema,
    (c, params) => merge(rt, executor, c, params),
  );
  define(
    "factoryman_teardown",
    "Remove a finished worker's environment after the landed-work check.",
    "Call factoryman_teardown for a merged or failed task. It refuses while the worktree has uncommitted changes or unpushed commits.",
    teardownSchema,
    (c, params) => teardown(rt, c, params),
  );
  define(
    "factoryman_report",
    "Hand back your outcome with evidence: done, blocked, or failed.",
    "Call factoryman_report when you finish, when you are blocked, or when you cannot finish. Evidence is required.",
    reportSchema,
    (c, params) => report(rt, c, params),
  );

  bb.agents.configure((context) => ({ tools: toolsForMetadata(context.pluginMetadata), skills: skillsForMetadata(context.pluginMetadata) }));
}
