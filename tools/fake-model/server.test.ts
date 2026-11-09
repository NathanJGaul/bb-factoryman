import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { tmpDir } from "../../test/fixtures/git-repo.ts";
import { type Server, startServer } from "./server.ts";

const running: Server[] = [];
afterEach(async () => {
  for (const server of running.splice(0)) await server.close();
});

async function boot(): Promise<{ server: Server; url: string; log: () => Array<Record<string, unknown>> }> {
  const dir = tmpDir("fake-model-");
  const logFile = join(dir, "requests.jsonl");
  const server = await startServer({ port: 0, logFile });
  running.push(server);
  return {
    server,
    url: `http://127.0.0.1:${server.port}`,
    log: () => (existsSync(logFile) ? readFileSync(logFile, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []),
  };
}
const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

const chatBody = (userText: string, extra: Record<string, unknown> = {}) => ({
  model: "mock-1",
  stream: false,
  messages: [
    { role: "system", content: "You are Pi. <available_skills>factoryman-worker</available_skills>" },
    { role: "user", content: userText },
  ],
  tools: [{ type: "function", function: { name: "bash", description: "", parameters: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } } }],
  ...extra,
});

describe("the fake model server", () => {
  it("[U1367] routes by path to the three formats, serves the model list and the token count, and answers 404 elsewhere", async () => {
    const { url } = await boot();
    const chat = await post(`${url}/v1/chat/completions`, chatBody("hello"));
    expect(chat.status).toBe(200);
    expect(((await chat.json()) as { object: string }).object).toBe("chat.completion");
    const responses = await post(`${url}/v1/responses`, { model: "mock-1", stream: false, input: "hello", tools: [] });
    expect(((await responses.json()) as { object: string }).object).toBe("response");
    const messages = await post(`${url}/v1/messages`, { model: "claude-haiku-5-5", stream: false, messages: [{ role: "user", content: "hello" }] });
    expect(((await messages.json()) as { type: string }).type).toBe("message");
    const models = await fetch(`${url}/v1/models`);
    expect(((await models.json()) as { data: Array<{ id: string }> }).data.length).toBeGreaterThan(0);
    const count = await post(`${url}/v1/messages/count_tokens`, { model: "m", messages: [] });
    expect(((await count.json()) as { input_tokens: number }).input_tokens).toBeGreaterThan(0);
    expect((await fetch(`${url}/nothing/here`)).status).toBe(404);
    expect((await fetch(`${url}/v1/chat/completions`, { method: "POST", body: "{not json" })).status).toBe(400);
  });

  it("[U1368] logs each request with the wire format, the tools and skills offered, and who the request is for", async () => {
    const { url, log } = await boot();
    await post(`${url}/v1/chat/completions`, chatBody("You are the worker for scout task t-7. The delivery mode is local-only.\n\nTask:\nx\n\nFirst, create and switch to the branch fm/t-7.\n"));
    await post(`${url}/v1/chat/completions`, chatBody("[conformance:sup=late]\nCALL factoryman_status {}"));
    await post(`${url}/v1/chat/completions`, chatBody("something else"));
    const [worker, supervisor, other] = log();
    expect(worker).toMatchObject({ wire: "chat", tools: ["bash"], skills: ["factoryman-worker"], actor: "worker:t-7" });
    expect(supervisor?.["actor"]).toBe("sup:late");
    expect(other?.["actor"]).toBe("other");
    expect(worker?.["action"]).toMatchObject({ kind: "tool_call", name: "bash" });
  });

  it("[U1369] listens on the loopback only and never writes a bearer value to its log", async () => {
    const { server, url, log } = await boot();
    expect(server.address).toBe("127.0.0.1");
    await post(`${url}/v1/chat/completions`, chatBody("hi"), { authorization: "Bearer secret-value-123" });
    await post(`${url}/v1/chat/completions`, chatBody("hi"));
    const lines = log();
    expect(lines.map((l) => l["auth"])).toEqual(["present", "absent"]);
    expect(JSON.stringify(lines)).not.toContain("secret-value-123");
    expect(readFileSync(new URL("./server.ts", import.meta.url), "utf8")).not.toMatch(/\bfetch\(|http\.request|https\.request|net\.connect|from "node:https"/);
  });

  it("[U1370] holds a reply for the SLEEP directive's time", async () => {
    const { url } = await boot();
    const started = Date.now();
    const reply = await post(`${url}/v1/chat/completions`, chatBody("SLEEP 400"));
    expect(reply.status).toBe(200);
    expect(Date.now() - started).toBeGreaterThanOrEqual(380);
  });
});
