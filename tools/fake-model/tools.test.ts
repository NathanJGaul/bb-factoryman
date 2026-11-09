import { describe, expect, it } from "vitest";
import { buildArgs, findRoute, findShell } from "./tools.ts";
import type { Conversation, OfferedTool } from "./types.ts";

const tool = (name: string, schema: Record<string, unknown> = { type: "object", properties: {} }): OfferedTool => ({ name, description: "", schema });
const conversation = (tools: OfferedTool[], system = ""): Conversation => ({ wire: "chat", model: "m", stream: true, system, tools, turns: [{ role: "user", text: "hi" }] });

describe("findRoute", () => {
  it("[U1350] finds the report tool as a plain function, as an offered MCP function, as a deferred tool, and as a device", () => {
    expect(findRoute(conversation([tool("read"), tool("factoryman_report")]), "factoryman_report")).toEqual({ kind: "function", name: "factoryman_report" });
    expect(findRoute(conversation([tool("mcp__bb-bridge__factoryman_report")]), "factoryman_report")).toEqual({ kind: "function", name: "mcp__bb-bridge__factoryman_report" });
    const deferred = conversation([tool("Bash"), tool("ToolSearch")], "<system-reminder>deferred: mcp__bb-bridge__factoryman_report, mcp__bb-bridge__update_environment_directory</system-reminder>");
    expect(findRoute(deferred, "factoryman_report")).toEqual({ kind: "search", name: "ToolSearch", query: "select:mcp__bb-bridge__factoryman_report" });
    const device = conversation([tool("read"), tool("write")], 'MCP Tool Routes: "factoryman_report" -> xd://mcp__bb_bridge_factoryman_report');
    expect(findRoute(device, "factoryman_report")).toEqual({ kind: "device", name: "write", path: "xd://mcp__bb_bridge_factoryman_report" });
    expect(findRoute(conversation([tool("read"), tool("write")]), "factoryman_report")).toBeNull();
    expect(findRoute(conversation([tool("ToolSearch")], "no such name here"), "factoryman_report")).toBeNull();
  });

  it("[U1350] does not take a tool whose name only ends in the plugin tool's name", () => {
    expect(findRoute(conversation([tool("not_factoryman_report")]), "factoryman_report")).toBeNull();
    expect(findRoute(conversation([tool("factoryman_dispatch")]), "factoryman_report")).toBeNull();
  });
});

describe("findShell", () => {
  it("[U1351] finds the shell tool among Bash, bash, and exec_command", () => {
    expect(findShell([tool("Read"), tool("Bash")])?.name).toBe("Bash");
    expect(findShell([tool("read"), tool("bash")])?.name).toBe("bash");
    expect(findShell([tool("write_stdin"), tool("exec_command")])?.name).toBe("exec_command");
    expect(findShell([tool("read"), tool("write")])).toBeNull();
  });
});

describe("buildArgs", () => {
  it("[U1352] puts the command in the string property command or cmd, and fills other required properties by type", () => {
    const bash = { type: "object", properties: { command: { type: "string" }, description: { type: "string" }, timeout: { type: "number" } }, required: ["command", "description"] };
    expect(buildArgs(bash, { command: "git status" })).toEqual({ command: "git status", description: "conformance" });
    const codex = { type: "object", properties: { cmd: { type: "string" }, workdir: { type: "string" }, yield_time_ms: { type: "number" } }, required: ["cmd"] };
    expect(buildArgs(codex, { command: "ls" })).toEqual({ cmd: "ls" });
    const omp = { type: "object", properties: { i: { type: "string" }, command: { type: "string" }, wait: { type: "boolean" }, n: { type: "integer" }, kind: { type: "string", enum: ["a", "b"] }, list: { type: "array" } }, required: ["i", "command", "wait", "n", "kind", "list"] };
    expect(buildArgs(omp, { command: "pwd" })).toEqual({ i: "conformance", command: "pwd", wait: false, n: 0, kind: "a", list: [] });
    expect(buildArgs({ type: "object", properties: {} }, {})).toEqual({});
  });
});
