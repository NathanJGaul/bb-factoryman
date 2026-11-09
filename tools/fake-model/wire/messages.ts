import type { Action, Conversation, OfferedTool, Turn, Wire } from "../types.ts";
import { callId, type Json, json, sse, stream, textOf, toolsOf } from "./shared.ts";

/** Anthropic Messages, the format of Claude Code. */
function parse(body: unknown): Conversation {
  const request = (body ?? {}) as Json;
  const system = textOf(request["system"]);
  const turns: Turn[] = [];
  const messages = Array.isArray(request["messages"]) ? (request["messages"] as Json[]) : [];
  for (const message of messages) {
    const blocks: Json[] = typeof message["content"] === "string" ? [{ type: "text", text: message["content"] }] : Array.isArray(message["content"]) ? (message["content"] as Json[]) : [];
    if (message["role"] === "assistant") {
      turns.push({
        role: "assistant",
        text: textOf(blocks.filter((b) => b["type"] === "text")),
        toolCalls: blocks.filter((b) => b["type"] === "tool_use").map((b) => ({ id: String(b["id"] ?? ""), name: String(b["name"] ?? ""), args: ((b["input"] ?? {}) as Json) })),
      });
      continue;
    }
    // A user message holds text and tool results. The results come first, as separate turns, and the text follows.
    for (const block of blocks.filter((b) => b["type"] === "tool_result")) turns.push({ role: "tool", callId: String(block["tool_use_id"] ?? ""), text: textOf(block["content"]) });
    const text = textOf(blocks.filter((b) => b["type"] === "text"));
    if (text !== "") turns.push({ role: "user", text });
  }
  const tools = toolsOf(request["tools"], (tool): OfferedTool | null =>
    typeof tool["name"] === "string" ? { name: tool["name"], description: String(tool["description"] ?? ""), schema: (tool["input_schema"] ?? { type: "object", properties: {} }) as Json } : null,
  );
  return { wire: "messages", model: String(request["model"] ?? "mock-1"), stream: request["stream"] === true, system, tools, turns };
}

function render(action: Exclude<Action, { kind: "delay" }>, conversation: Conversation) {
  if (action.kind === "error") {
    const type = action.status === 401 || action.status === 403 ? "authentication_error" : action.status === 429 ? "rate_limit_error" : "api_error";
    return json(action.status, { type: "error", error: { type, message: action.message } });
  }
  const model = conversation.model;
  const id = callId(conversation, "toolu");
  const stop = action.kind === "tool_call" ? "tool_use" : "end_turn";
  const block = action.kind === "tool_call" ? { type: "tool_use", id, name: action.name, input: action.args } : { type: "text", text: action.text };
  if (!conversation.stream) return json(200, { id: "msg_conformance", type: "message", role: "assistant", model, content: [block], stop_reason: stop, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 5 } });
  const start = { id: "msg_conformance", type: "message", role: "assistant", model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } };
  const opening = action.kind === "tool_call" ? { type: "tool_use", id, name: action.name, input: {} } : { type: "text", text: "" };
  const delta = action.kind === "tool_call" ? { type: "input_json_delta", partial_json: JSON.stringify(action.args) } : { type: "text_delta", text: action.text };
  return stream(
    sse([
      { event: "message_start", data: { type: "message_start", message: start } },
      { event: "content_block_start", data: { type: "content_block_start", index: 0, content_block: opening } },
      { event: "content_block_delta", data: { type: "content_block_delta", index: 0, delta } },
      { event: "content_block_stop", data: { type: "content_block_stop", index: 0 } },
      { event: "message_delta", data: { type: "message_delta", delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 5 } } },
      { event: "message_stop", data: { type: "message_stop" } },
    ]),
  );
}

export const messages = { parse, render } satisfies Wire;
