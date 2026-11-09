import type { Conversation, OfferedTool } from "./types.ts";

/** How the harness lets its model reach a plugin tool. */
export type Route =
  | { kind: "function"; name: string }
  /** Claude Code defers MCP tools: one `ToolSearch` call loads them. */
  | { kind: "search"; name: string; query: string }
  /** omp shows an MCP tool as a device that a `write` call reaches. */
  | { kind: "device"; name: string; path: string };

const MCP_NAME = /mcp__[A-Za-z0-9_-]*__/;

/** A tool's name is the plugin tool's name, or bb's MCP bridge name for it (`mcp__bb-bridge__<name>`). */
function isPluginTool(offered: string, pluginTool: string): boolean {
  return offered === pluginTool || (offered.endsWith(`__${pluginTool}`) && MCP_NAME.test(offered));
}

/**
 * Find how to call a plugin tool. A tool the harness offers is a function.
 * Otherwise the system text names a deferred tool (Claude Code) or a device (omp).
 */
export function findRoute(conversation: Conversation, pluginTool: string): Route | null {
  const offered = conversation.tools.find((t) => isPluginTool(t.name, pluginTool));
  if (offered !== undefined) return { kind: "function", name: offered.name };
  const text = conversation.system + conversation.turns.map((turn) => ("text" in turn ? turn.text : "")).join("\n");
  const search = conversation.tools.find((t) => t.name === "ToolSearch");
  if (search !== undefined) {
    const deferred = new RegExp(`mcp__[A-Za-z0-9_-]*__${pluginTool}`).exec(text)?.[0];
    if (deferred !== undefined) return { kind: "search", name: search.name, query: `select:${deferred}` };
  }
  const write = conversation.tools.find((t) => t.name === "write");
  if (write !== undefined) {
    const device = new RegExp(`xd://mcp__[A-Za-z0-9_]*${pluginTool}`).exec(text)?.[0];
    if (device !== undefined) return { kind: "device", name: write.name, path: device };
  }
  return null;
}

const SHELL_NAMES = ["Bash", "bash", "exec_command"];

/** The tool that runs a shell command. */
export function findShell(tools: OfferedTool[]): OfferedTool | null {
  for (const name of SHELL_NAMES) {
    const found = tools.find((t) => t.name === name);
    if (found !== undefined) return found;
  }
  return null;
}

interface Property {
  type?: string;
  enum?: unknown[];
}

/**
 * Build the arguments of a tool call from its JSON schema, so no harness's argument names are hard-coded.
 * The string property `command` or `cmd` takes the command. Every other required property gets a fixed value of its type.
 */
export function buildArgs(schema: Record<string, unknown>, values: { command?: string }): Record<string, unknown> {
  const properties = (schema["properties"] as Record<string, Property> | undefined) ?? {};
  const required = new Set((schema["required"] as string[] | undefined) ?? []);
  const args: Record<string, unknown> = {};
  for (const [name, property] of Object.entries(properties)) {
    const isCommand = (name === "command" || name === "cmd") && property.type === "string" && values.command !== undefined;
    if (isCommand) {
      args[name] = values.command;
    } else if (required.has(name)) {
      if (property.enum !== undefined && property.enum.length > 0) args[name] = property.enum[0];
      else if (property.type === "number" || property.type === "integer") args[name] = 0;
      else if (property.type === "boolean") args[name] = false;
      else if (property.type === "array") args[name] = [];
      else if (property.type === "object") args[name] = {};
      else args[name] = "conformance";
    }
  }
  return args;
}
