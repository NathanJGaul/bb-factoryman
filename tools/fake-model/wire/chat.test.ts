import { describe, expect, it } from "vitest";
import { chat } from "./chat.ts";
import { events } from "./helpers.test-util.ts";
import type { Conversation } from "../types.ts";

const request = {
  model: "mock-1",
  stream: true,
  messages: [
    { role: "system", content: "You are Pi. <available_skills>factoryman-worker</available_skills>" },
    { role: "developer", content: [{ type: "text", text: "extra rules" }] },
    { role: "user", content: "hello" },
    { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "bash", arguments: '{"command":"ls"}' } }] },
    { role: "tool", tool_call_id: "call_1", content: "README.md" },
  ],
  tools: [{ type: "function", function: { name: "bash", description: "Run it", parameters: { type: "object", properties: { command: { type: "string" } } } } }],
};

const conversation = (stream: boolean): Conversation => ({ ...chat.parse({ ...request, stream }) });

describe("chat completions", () => {
  it("[U1360] reads a request into offered tools, system text, turns, and tool results", () => {
    const c = chat.parse(request);
    expect(c).toMatchObject({ wire: "chat", model: "mock-1", stream: true });
    expect(c.system).toContain("factoryman-worker");
    expect(c.system).toContain("extra rules");
    expect(c.tools).toEqual([{ name: "bash", description: "Run it", schema: { type: "object", properties: { command: { type: "string" } } } }]);
    expect(c.turns).toEqual([
      { role: "user", text: "hello" },
      { role: "assistant", text: "", toolCalls: [{ id: "call_1", name: "bash", args: { command: "ls" } }] },
      { role: "tool", callId: "call_1", text: "README.md" },
    ]);
  });

  it("[U1361] renders a tool call and a text answer as streamed chunks, and as one body when not streamed", () => {
    const streamed = chat.render({ kind: "tool_call", name: "bash", args: { command: "pwd" } }, conversation(true));
    expect(streamed.status).toBe(200);
    expect(streamed.contentType).toBe("text/event-stream");
    expect(streamed.body.trimEnd().endsWith("data: [DONE]")).toBe(true);
    const chunks = events(streamed.body) as Array<{ choices: Array<{ delta?: { tool_calls?: Array<{ function: { name: string; arguments: string } }> }; finish_reason: string | null }> }>;
    const call = chunks.flatMap((c) => c.choices.flatMap((choice) => choice.delta?.tool_calls ?? []))[0];
    expect(call?.function.name).toBe("bash");
    expect(JSON.parse(call?.function.arguments ?? "")).toEqual({ command: "pwd" });
    expect(chunks.flatMap((c) => c.choices.map((choice) => choice.finish_reason)).filter(Boolean)).toEqual(["tool_calls"]);

    const text = chat.render({ kind: "text", text: "All done." }, conversation(true));
    const textChunks = events(text.body) as Array<{ choices: Array<{ delta?: { content?: string }; finish_reason: string | null }> }>;
    expect(textChunks.flatMap((c) => c.choices.map((choice) => choice.delta?.content ?? "")).join("")).toBe("All done.");
    expect(textChunks.flatMap((c) => c.choices.map((choice) => choice.finish_reason)).filter(Boolean)).toEqual(["stop"]);

    const plain = chat.render({ kind: "tool_call", name: "bash", args: { command: "pwd" } }, conversation(false));
    expect(plain.contentType).toBe("application/json");
    const parsed = JSON.parse(plain.body) as { object: string; choices: Array<{ finish_reason: string; message: { tool_calls: Array<{ function: { name: string } }> } }>; usage: { total_tokens: number } };
    expect(parsed.object).toBe("chat.completion");
    expect(parsed.choices[0]?.finish_reason).toBe("tool_calls");
    expect(parsed.choices[0]?.message.tool_calls[0]?.function.name).toBe("bash");
    expect(parsed.usage.total_tokens).toBeGreaterThan(0);
  });
});
