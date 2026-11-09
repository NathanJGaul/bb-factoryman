import type { Action, Conversation, OfferedTool, Turn, Wire } from "../types.ts";
import { callId, type Json, json, parseArgs, sse, stream, textOf, toolsOf } from "./shared.ts";

/** OpenAI Responses, the format of Codex. */
function parse(body: unknown): Conversation {
  const request = (body ?? {}) as Json;
  const system: string[] = typeof request["instructions"] === "string" ? [request["instructions"]] : [];
  const turns: Turn[] = [];
  const input = request["input"];
  if (typeof input === "string") turns.push({ role: "user", text: input });
  else if (Array.isArray(input)) {
    for (const item of input as Json[]) {
      const type = item["type"] ?? "message";
      if (type === "message") {
        const role = item["role"];
        if (role === "system" || role === "developer") system.push(textOf(item["content"]));
        else if (role === "user") turns.push({ role: "user", text: textOf(item["content"]) });
        else if (role === "assistant") turns.push({ role: "assistant", text: textOf(item["content"]), toolCalls: [] });
      } else if (type === "function_call") {
        turns.push({ role: "assistant", text: "", toolCalls: [{ id: String(item["call_id"] ?? ""), name: String(item["name"] ?? ""), args: parseArgs(item["arguments"]) }] });
      } else if (type === "function_call_output") {
        turns.push({ role: "tool", callId: String(item["call_id"] ?? ""), text: typeof item["output"] === "string" ? item["output"] : textOf(item["output"]) });
      }
    }
  }
  const tools = toolsOf(request["tools"], (tool): OfferedTool | null =>
    tool["type"] === "function" && typeof tool["name"] === "string" ? { name: tool["name"], description: String(tool["description"] ?? ""), schema: (tool["parameters"] ?? { type: "object", properties: {} }) as Json } : null,
  );
  return { wire: "responses", model: String(request["model"] ?? "mock-1"), stream: request["stream"] !== false, system: system.join("\n"), tools, turns };
}

function render(action: Exclude<Action, { kind: "delay" }>, conversation: Conversation) {
  if (action.kind === "error") return json(action.status, { error: { message: action.message, type: "conformance_error", code: String(action.status) } });
  const usage = { input_tokens: 10, output_tokens: 5, total_tokens: 15, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } };
  const base = { id: "resp_conformance", object: "response", created_at: Math.floor(Date.now() / 1000), model: conversation.model, status: "in_progress", output: [] as unknown[] };
  const args = action.kind === "tool_call" ? JSON.stringify(action.args) : "";
  const id = callId(conversation, "call");
  const item =
    action.kind === "tool_call"
      ? { type: "function_call", id: `fc_${id}`, call_id: id, name: action.name, arguments: args, status: "completed" }
      : { type: "message", id: "msg_conformance", role: "assistant", status: "completed", content: [{ type: "output_text", text: action.text, annotations: [] }] };
  const completed = { ...base, status: "completed", output: [item], usage };
  if (!conversation.stream) return json(200, completed);
  const events: Array<{ event: string; data: unknown }> = [{ event: "response.created", data: { type: "response.created", response: base } }];
  if (action.kind === "tool_call") {
    events.push(
      { event: "response.output_item.added", data: { type: "response.output_item.added", output_index: 0, item: { ...item, arguments: "", status: "in_progress" } } },
      { event: "response.function_call_arguments.delta", data: { type: "response.function_call_arguments.delta", output_index: 0, item_id: `fc_${id}`, delta: args } },
      { event: "response.function_call_arguments.done", data: { type: "response.function_call_arguments.done", output_index: 0, item_id: `fc_${id}`, arguments: args } },
    );
  } else {
    events.push(
      { event: "response.output_item.added", data: { type: "response.output_item.added", output_index: 0, item: { ...item, content: [], status: "in_progress" } } },
      { event: "response.output_text.delta", data: { type: "response.output_text.delta", output_index: 0, item_id: "msg_conformance", content_index: 0, delta: action.text } },
    );
  }
  events.push({ event: "response.output_item.done", data: { type: "response.output_item.done", output_index: 0, item } }, { event: "response.completed", data: { type: "response.completed", response: completed } });
  return stream(sse(events));
}

export const responses = { parse, render } satisfies Wire;
