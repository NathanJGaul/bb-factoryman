import { describe, expect, it } from "vitest";
import { events } from "./helpers.test-util.ts";
import { responses } from "./responses.ts";
import type { Conversation } from "../types.ts";

const request = {
  model: "mock-1",
  stream: true,
  instructions: "You are Codex. Skill: factoryman-worker",
  input: [
    { type: "message", role: "developer", content: [{ type: "input_text", text: "permissions" }] },
    { type: "message", role: "user", content: [{ type: "input_text", text: "hello" }] },
    { type: "function_call", name: "exec_command", arguments: '{"cmd":"ls"}', call_id: "call_1" },
    { type: "function_call_output", call_id: "call_1", output: "README.md" },
  ],
  tools: [{ type: "function", name: "exec_command", description: "Run it", parameters: { type: "object", properties: { cmd: { type: "string" } } } }, { type: "web_search" }],
};
const conversation: Conversation = responses.parse(request);

describe("Responses", () => {
  it("[U1362] reads a request into offered tools, instructions, turns, and function_call_output results", () => {
    expect(conversation).toMatchObject({ wire: "responses", model: "mock-1", stream: true });
    expect(conversation.system).toContain("factoryman-worker");
    expect(conversation.system).toContain("permissions");
    expect(conversation.tools.map((t) => t.name)).toEqual(["exec_command"]);
    expect(conversation.turns).toEqual([
      { role: "user", text: "hello" },
      { role: "assistant", text: "", toolCalls: [{ id: "call_1", name: "exec_command", args: { cmd: "ls" } }] },
      { role: "tool", callId: "call_1", text: "README.md" },
    ]);
    expect(responses.parse({ ...request, input: "plain string input" }).turns).toEqual([{ role: "user", text: "plain string input" }]);
  });

  it("[U1363] renders a tool call as the event stream that ends with response.completed and usage", () => {
    const call = responses.render({ kind: "tool_call", name: "exec_command", args: { cmd: "pwd" } }, conversation);
    expect(call.contentType).toBe("text/event-stream");
    const callEvents = events(call.body) as Array<{ type: string; item?: { type: string; name: string; arguments: string; call_id: string }; response?: { status: string; usage?: { total_tokens: number } } }>;
    expect(callEvents.map((e) => e.type)).toEqual(["response.created", "response.output_item.added", "response.function_call_arguments.delta", "response.function_call_arguments.done", "response.output_item.done", "response.completed"]);
    const done = callEvents.find((e) => e.type === "response.output_item.done")?.item;
    expect(done).toMatchObject({ type: "function_call", name: "exec_command" });
    expect(JSON.parse(done?.arguments ?? "")).toEqual({ cmd: "pwd" });
    expect(callEvents.at(-1)?.response).toMatchObject({ status: "completed", usage: { total_tokens: expect.any(Number) } });
  });

  it("[U1363] renders a text answer as the event stream", () => {

    const text = responses.render({ kind: "text", text: "All done." }, conversation);
    const textEvents = events(text.body) as Array<{ type: string; delta?: string; item?: { type: string } }>;
    expect(textEvents.find((e) => e.type === "response.output_text.delta")?.delta).toBe("All done.");
    expect(textEvents.find((e) => e.type === "response.output_item.done")?.item?.type).toBe("message");
    expect(textEvents.at(-1)?.type).toBe("response.completed");
  });
});
