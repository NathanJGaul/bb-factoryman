import type { Action, Conversation, OfferedTool, Turn, Wire } from "../types.ts";
import { callId, type Json, json, parseArgs, sse, stream, textOf, toolsOf, usage } from "./shared.ts";

/** OpenAI chat completions, the format of Pi and omp. */
function parse(body: unknown): Conversation {
  const request = (body ?? {}) as Json;
  const messages = Array.isArray(request["messages"]) ? (request["messages"] as Json[]) : [];
  const system: string[] = [];
  const turns: Turn[] = [];
  for (const message of messages) {
    const role = message["role"];
    if (role === "system" || role === "developer") system.push(textOf(message["content"]));
    else if (role === "user") turns.push({ role: "user", text: textOf(message["content"]) });
    else if (role === "assistant") {
      const calls = Array.isArray(message["tool_calls"]) ? (message["tool_calls"] as Json[]) : [];
      turns.push({
        role: "assistant",
        text: textOf(message["content"]),
        toolCalls: calls.map((call) => {
          const fn = (call["function"] ?? {}) as Json;
          return { id: String(call["id"] ?? ""), name: String(fn["name"] ?? ""), args: parseArgs(fn["arguments"]) };
        }),
      });
    } else if (role === "tool") turns.push({ role: "tool", callId: String(message["tool_call_id"] ?? ""), text: textOf(message["content"]) });
  }
  const tools = toolsOf(request["tools"], (tool): OfferedTool | null => {
    const fn = (tool["function"] ?? tool) as Json;
    return typeof fn["name"] === "string" ? { name: fn["name"], description: String(fn["description"] ?? ""), schema: (fn["parameters"] ?? { type: "object", properties: {} }) as Json } : null;
  });
  return { wire: "chat", model: String(request["model"] ?? "mock-1"), stream: request["stream"] === true, system: system.join("\n"), tools, turns };
}

const ID = "chatcmpl-conformance";

function render(action: Exclude<Action, { kind: "delay" }>, conversation: Conversation) {
  if (action.kind === "error") return json(action.status, { error: { message: action.message, type: "conformance_error", code: String(action.status) } });
  const created = Math.floor(Date.now() / 1000);
  const model = conversation.model;
  const finish = action.kind === "tool_call" ? "tool_calls" : "stop";
  const id = callId(conversation, "call");
  const delta = action.kind === "tool_call" ? { tool_calls: [{ index: 0, id, type: "function", function: { name: action.name, arguments: JSON.stringify(action.args) } }] } : { content: action.text };
  if (!conversation.stream) {
    const message = action.kind === "tool_call" ? { role: "assistant", content: null, tool_calls: [{ id, type: "function", function: { name: action.name, arguments: JSON.stringify(action.args) } }] } : { role: "assistant", content: action.text };
    return json(200, { id: ID, object: "chat.completion", created, model, choices: [{ index: 0, message, finish_reason: finish }], usage: usage() });
  }
  const chunk = (d: Json, reason: string | null) => ({ data: { id: ID, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta: d, finish_reason: reason }] } });
  return stream(
    sse([
      chunk({ role: "assistant", content: "" }, null),
      chunk(delta, null),
      chunk({}, finish),
      { data: { id: ID, object: "chat.completion.chunk", created, model, choices: [], usage: usage() } },
      "done",
    ]),
  );
}

export const chat = { parse, render } satisfies Wire;
