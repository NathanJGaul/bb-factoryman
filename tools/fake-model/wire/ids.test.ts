import { describe, expect, it } from "vitest";
import type { Conversation, Wire } from "../types.ts";
import { chat } from "./chat.ts";
import { messages } from "./messages.ts";
import { responses } from "./responses.ts";

const withCalls = (wire: Conversation["wire"], calls: number): Conversation => ({
  wire,
  model: "m",
  stream: false,
  system: "",
  tools: [],
  turns: [
    { role: "user", text: "go" },
    ...Array.from({ length: calls }, (_, i): Conversation["turns"][number] => ({ role: "assistant", text: "", toolCalls: [{ id: `c${i}`, name: "Bash", args: {} }] })),
  ],
});

const idOf = (wire: Conversation["wire"], body: string): string => {
  const parsed = JSON.parse(body) as { content?: Array<{ id?: string }>; choices?: Array<{ message: { tool_calls: Array<{ id: string }> } }>; output?: Array<{ call_id?: string }> };
  if (wire === "messages") return parsed.content?.[0]?.id ?? "";
  if (wire === "chat") return parsed.choices?.[0]?.message.tool_calls[0]?.id ?? "";
  return parsed.output?.[0]?.call_id ?? "";
};

describe("tool call ids", () => {
  it.each<[Conversation["wire"], Wire]>([
    ["chat", chat],
    ["responses", responses],
    ["messages", messages],
  ])("[U1418] gives every %s tool call in one conversation its own id", (kind, wire) => {
    const ids = [0, 1, 2, 3].map((calls) => {
      const c = withCalls(kind, calls);
      const body = kind === "responses" ? JSON.stringify((JSON.parse(wire.render({ kind: "tool_call", name: "Bash", args: {} }, c).body) as { output: unknown[] })) : wire.render({ kind: "tool_call", name: "Bash", args: {} }, c).body;
      return idOf(kind, body);
    });
    expect(ids.every((id) => id !== "")).toBe(true);
    expect(new Set(ids).size).toBe(4);
  });
});
