// A tiny stdio MCP server for the stub agent's tests. It offers one tool, factoryman_report, and
// appends every call to the file in $MCP_LOG. It stands in for the bb-bridge server that bb lists in `session/new`.
import { appendFileSync } from "node:fs";
import { createInterface } from "node:readline";

const LOG = process.env["MCP_LOG"] ?? "/dev/null";
const send = (message: Record<string, unknown>) => process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);

createInterface({ input: process.stdin, terminal: false }).on("line", (line) => {
  let message: { id?: number; method?: string; params?: { name?: string; arguments?: unknown } };
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  if (message.id === undefined) return;
  if (message.method === "initialize") {
    send({ id: message.id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "fake-mcp", version: "0" } } });
  } else if (message.method === "tools/list") {
    send({ id: message.id, result: { tools: [{ name: "factoryman_report", description: "Report.", inputSchema: { type: "object" } }] } });
  } else if (message.method === "tools/call") {
    appendFileSync(LOG, `${JSON.stringify({ name: message.params?.name, arguments: message.params?.arguments })}\n`);
    send({ id: message.id, result: { content: [{ type: "text", text: "recorded" }] } });
  } else {
    send({ id: message.id, error: { code: -32601, message: "not found" } });
  }
});
