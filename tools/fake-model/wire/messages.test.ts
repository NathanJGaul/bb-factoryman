import { describe, expect, it } from "vitest";
import { events } from "./helpers.test-util.ts";
import { messages } from "./messages.ts";
import type { Conversation } from "../types.ts";

const request = {
  model: "claude-haiku-5-5",
  stream: true,
  system: [{ type: "text", text: "You are Claude Code. Skill: bb-global-skills:factoryman-worker" }],
  messages: [
    { role: "user", content: [{ type: "text", text: "<system-reminder>deferred: mcp__bb-bridge__factoryman_report</system-reminder>" }, { type: "text", text: "hello" }] },
    { role: "assistant", content: [{ type: "text", text: "Running." }, { type: "tool_use", id: "toolu_1", name: "Bash", input: { command: "ls" } }] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", content: [{ type: "text", text: "README.md" }] }] },
    { role: "assistant", content: [{ type: "tool_use", id: "toolu_2", name: "Bash", input: { command: "pwd" } }] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_2", content: "/work" }] },
  ],
  tools: [{ name: "Bash", description: "Run it", input_schema: { type: "object", properties: { command: { type: "string" } } } }],
};
const conversation: Conversation = messages.parse(request);

describe("Messages", () => {
  it("[U1364] reads a request, keeps the system reminders in the user text, and reads tool_result blocks as tool results", () => {
    expect(conversation).toMatchObject({ wire: "messages", model: "claude-haiku-5-5", stream: true });
    expect(conversation.system).toContain("factoryman-worker");
    expect(conversation.tools).toEqual([{ name: "Bash", description: "Run it", schema: { type: "object", properties: { command: { type: "string" } } } }]);
    expect(conversation.turns[0]).toEqual({ role: "user", text: expect.stringContaining("mcp__bb-bridge__factoryman_report") });
    expect(conversation.turns[0]).toEqual({ role: "user", text: expect.stringContaining("hello") });
    expect(conversation.turns.slice(1)).toEqual([
      { role: "assistant", text: "Running.", toolCalls: [{ id: "toolu_1", name: "Bash", args: { command: "ls" } }] },
      { role: "tool", callId: "toolu_1", text: "README.md" },
      { role: "assistant", text: "", toolCalls: [{ id: "toolu_2", name: "Bash", args: { command: "pwd" } }] },
      { role: "tool", callId: "toolu_2", text: "/work" },
    ]);
    expect(messages.parse({ ...request, system: "plain system" }).system).toBe("plain system");
  });

  it("[U1421] reads a system-role message in the messages array as system text and not as a turn", () => {
    const body = {
      ...request,
      messages: [
        ...request.messages.slice(0, 1),
        { role: "system", content: [{ type: "text", text: "Deferred tools: mcp__bb-bridge__factoryman_dispatch. Skills: bb-global-skills:factoryman-supervisor" }] },
        ...request.messages.slice(1),
      ],
    };
    const parsed = messages.parse(body);
    expect(parsed.system).toContain("mcp__bb-bridge__factoryman_dispatch");
    expect(parsed.system).toContain("You are Claude Code");
    expect(parsed.turns).toEqual(messages.parse(request).turns);
  });

  it("[U1365] renders a tool call and a text answer as the event stream with a stop reason, and as one message when not streamed", () => {
    const call = messages.render({ kind: "tool_call", name: "Bash", args: { command: "git status" } }, conversation);
    expect(call.contentType).toBe("text/event-stream");
    const callEvents = events(call.body) as Array<{ type: string; content_block?: { type: string; name?: string }; delta?: { type?: string; partial_json?: string; stop_reason?: string } }>;
    expect(callEvents.map((e) => e.type)).toEqual(["message_start", "content_block_start", "content_block_delta", "content_block_stop", "message_delta", "message_stop"]);
    expect(callEvents[1]?.content_block).toMatchObject({ type: "tool_use", name: "Bash" });
    expect(JSON.parse(callEvents[2]?.delta?.partial_json ?? "")).toEqual({ command: "git status" });
    expect(callEvents[4]?.delta?.stop_reason).toBe("tool_use");

    const text = messages.render({ kind: "text", text: "All done." }, conversation);
    const textEvents = events(text.body) as Array<{ type: string; delta?: { text?: string; stop_reason?: string } }>;
    expect(textEvents.find((e) => e.type === "content_block_delta")?.delta?.text).toBe("All done.");
    expect(textEvents.find((e) => e.type === "message_delta")?.delta?.stop_reason).toBe("end_turn");

    const plain = messages.render({ kind: "text", text: "All done." }, { ...conversation, stream: false });
    expect(plain.contentType).toBe("application/json");
    expect(JSON.parse(plain.body)).toMatchObject({ type: "message", role: "assistant", stop_reason: "end_turn", content: [{ type: "text", text: "All done." }] });
  });
});
