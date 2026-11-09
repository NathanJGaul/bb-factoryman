import type { Conversation, OfferedTool } from "../types.ts";

export type Json = Record<string, unknown>;

/** Join the text of a message body that is a string or a list of parts. */
export function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      const p = part as Json;
      return typeof p["text"] === "string" ? p["text"] : "";
    })
    .filter((text) => text !== "")
    .join("\n");
}

export function parseArgs(text: unknown): Json {
  if (typeof text !== "string" || text.trim() === "") return {};
  try {
    const value = JSON.parse(text) as unknown;
    return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Json) : {};
  } catch {
    return {};
  }
}

export function usage(): { prompt_tokens: number; completion_tokens: number; total_tokens: number } {
  return { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 };
}

export function sse(events: Array<{ event?: string; data: unknown } | "done">): string {
  return events
    .map((e) => (e === "done" ? "data: [DONE]\n\n" : `${e.event === undefined ? "" : `event: ${e.event}\n`}data: ${JSON.stringify(e.data)}\n\n`))
    .join("");
}

export const json = (status: number, body: unknown) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
export const stream = (body: string) => ({ status: 200, contentType: "text/event-stream", body });

export function toolsOf(list: unknown, pick: (tool: Json) => OfferedTool | null): OfferedTool[] {
  return Array.isArray(list) ? list.flatMap((tool) => pick(tool as Json) ?? []) : [];
}


/**
 * A tool call id that no earlier call in the conversation has. Claude Code runs a call once per id,
 * so a fixed id would make it skip every call after the first.
 */
export function callId(conversation: Conversation, prefix: string): string {
  const earlier = conversation.turns.reduce((n, turn) => (turn.role === "assistant" ? n + turn.toolCalls.length : n), 0);
  return `${prefix}_conformance_${earlier + 1}`;
}
