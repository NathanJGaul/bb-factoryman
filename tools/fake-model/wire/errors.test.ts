import { describe, expect, it } from "vitest";
import { chat } from "./chat.ts";
import { messages } from "./messages.ts";
import { responses } from "./responses.ts";
import type { Conversation, Wire } from "../types.ts";

const convo = (wire: Conversation["wire"]): Conversation => ({ wire, model: "m", stream: true, system: "", tools: [], turns: [{ role: "user", text: "hi" }] });

describe("error actions", () => {
  it.each<[string, Wire, Conversation["wire"]]>([
    ["chat completions", chat, "chat"],
    ["Responses", responses, "responses"],
    ["Messages", messages, "messages"],
  ])("[U1366] turns an error action into the %s error body with the status and the cause text", (_name, wire, kind) => {
    const reply = wire.render({ kind: "error", status: 401, message: "CONFORMANCE-CAUSE-401" }, convo(kind));
    expect(reply.status).toBe(401);
    expect(reply.contentType).toBe("application/json");
    const body = JSON.parse(reply.body) as { error: { message: string }; type?: string };
    expect(body.error.message).toBe("CONFORMANCE-CAUSE-401");
    if (kind === "messages") expect(body.type).toBe("error");
  });
});
