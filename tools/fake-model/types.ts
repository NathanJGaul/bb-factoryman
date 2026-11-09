/** A tool that the harness offers its model, in the shape every wire format shares. */
export interface OfferedTool {
  name: string;
  description: string;
  /** The JSON schema of the arguments. */
  schema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/** One turn of the conversation. A tool result is its own turn. */
export type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; toolCalls: ToolCall[] }
  | { role: "tool"; callId: string; text: string };

export type WireFormat = "chat" | "responses" | "messages";

/** A request from a harness, read into one shape. The brain works on this and knows no wire format. */
export interface Conversation {
  wire: WireFormat;
  model: string;
  stream: boolean;
  /** System, developer, and instruction text. */
  system: string;
  tools: OfferedTool[];
  turns: Turn[];
}

/** What the brain decides to do next. */
export type Action =
  | { kind: "tool_call"; name: string; args: Record<string, unknown> }
  | { kind: "text"; text: string }
  | { kind: "error"; status: number; message: string }
  /** Wait, then do the action. The wait keeps a turn open, so a supervisor stays busy. */
  | { kind: "delay"; ms: number; then: Action };

/** A reply, ready to write to the socket. A streamed reply is the whole event stream as one body. */
export interface WireResponse {
  status: number;
  contentType: string;
  body: string;
}

/** What each wire format module exports. */
export interface Wire {
  parse(body: unknown): Conversation;
  render(action: Exclude<Action, { kind: "delay" }>, conversation: Conversation): WireResponse;
}
