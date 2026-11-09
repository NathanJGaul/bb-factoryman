// The fake model server for the conformance suite, tier 1.5.
//
// It stands in for the model behind a real harness CLI. It answers OpenAI chat completions
// (Pi, omp), OpenAI Responses (Codex), and Anthropic Messages (Claude Code). It follows the script
// that the prompt carries (see brain.ts), logs every request, and needs no credential.
// It listens on the loopback only and makes no outbound connection.
//
// usage: node server.ts --port <n> --log <file>     (port 0 picks a free port; the first output line says which)
import { appendFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { nextAction } from "./brain.ts";
import { instructionText, pluginToolsIn, skillsIn } from "./instructions.ts";
import type { Action, Conversation, Wire, WireFormat, WireResponse } from "./types.ts";
import { chat } from "./wire/chat.ts";
import { messages } from "./wire/messages.ts";
import { responses } from "./wire/responses.ts";

export interface Server {
  port: number;
  address: string;
  close(): Promise<void>;
}

const WIRES: Record<WireFormat, Wire> = { chat, responses, messages };
const HOST = "127.0.0.1";
/** After this many requests from one actor, the script ends, so a harness that repeats a request cannot hold the lab for ever. */
const REQUEST_LIMIT = 150;

function wireFor(path: string): WireFormat | null {
  if (path.includes("/chat/completions")) return "chat";
  if (path.endsWith("/responses")) return "responses";
  if (path.endsWith("/v1/messages")) return "messages";
  return null;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wait out every delay and return the action that follows them. */
async function settle(action: Action): Promise<Exclude<Action, { kind: "delay" }>> {
  let current = action;
  while (current.kind === "delay") {
    await sleep(current.ms);
    current = current.then;
  }
  return current;
}

function describeActor(c: Conversation): string {
  const users = c.turns.filter((t) => t.role === "user").map((t) => t.text);
  const worker = users.map((text) => /You are the worker for (?:scout|ship) task (\S+?)\./.exec(text)?.[1]).find((id) => id !== undefined);
  if (worker !== undefined) return `worker:${worker}`;
  for (const text of [...users].reverse()) {
    const label = /\[conformance:sup=([^\]\s]+)\]/.exec(text)?.[1];
    if (label !== undefined) return `sup:${label}`;
  }
  return "other";
}

function instructions(c: Conversation): string {
  return instructionText(c.system, c.turns.flatMap((t) => (t.role === "user" ? [t.text] : [])));
}

/** The plugin tools a harness offers by any route: the tool list, a deferred tool, or a device. */
function pluginToolsOf(c: Conversation): string[] {
  const listed = c.tools.flatMap((tool) => /^(?:mcp__[A-Za-z0-9_-]+__)?(factoryman_[a-z]+)$/.exec(tool.name)?.[1] ?? []);
  return [...new Set([...listed, ...pluginToolsIn(instructions(c))])].sort();
}

function summarize(c: Conversation) {
  return c.turns.map((t) => (t.role === "assistant" ? { role: t.role, text: t.text.slice(0, 300), calls: t.toolCalls.map((call) => call.name) } : { role: t.role, text: t.text.slice(0, 600) }));
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function send(res: ServerResponse, reply: WireResponse): void {
  res.writeHead(reply.status, { "content-type": reply.contentType, "cache-control": "no-cache" });
  res.end(reply.body);
}

const plain = (res: ServerResponse, status: number, body: unknown) => send(res, { status, contentType: "application/json", body: JSON.stringify(body) });

/** Start the server. The log file gets one JSON line per request. A bearer value is never read, only noted as present. */
export function startServer(options: { port: number; logFile: string }): Promise<Server> {
  const log = (entry: Record<string, unknown>) => appendFileSync(options.logFile, `${JSON.stringify({ t: new Date().toISOString(), ...entry })}\n`);
  const counts = new Map<string, number>();
  const server = createServer((req, res) => {
    void (async () => {
      const path = (req.url ?? "/").split("?")[0] ?? "/";
      const auth = req.headers["authorization"] !== undefined || req.headers["x-api-key"] !== undefined ? "present" : "absent";
      if (req.method === "GET" && path.endsWith("/models")) return plain(res, 200, { object: "list", data: [{ id: "mock-1", object: "model" }], models: [{ slug: "mock-1" }] });
      const body = await readBody(req);
      if (path.endsWith("/messages/count_tokens")) return plain(res, 200, { input_tokens: 10 });
      const format = wireFor(path);
      if (req.method !== "POST" || format === null) {
        log({ method: req.method, url: req.url, auth, note: "no route" });
        return plain(res, 404, {});
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(body);
      } catch {
        log({ method: req.method, url: req.url, auth, note: "unreadable body" });
        return plain(res, 400, { error: { message: "unreadable body" } });
      }
      const wire = WIRES[format];
      const conversation = wire.parse(parsed);
      const actor = describeActor(conversation);
      const seen = (counts.get(actor) ?? 0) + 1;
      counts.set(actor, seen);
      const decided: Action = actor !== "other" && seen > REQUEST_LIMIT ? { kind: "text", text: "BRAIN: request limit reached, so the script ends here." } : nextAction(conversation);
      log({
        method: req.method,
        url: req.url,
        auth,
        wire: format,
        model: conversation.model,
        stream: conversation.stream,
        tools: conversation.tools.map((tool) => tool.name),
        skills: skillsIn(instructions(conversation)),
        pluginTools: pluginToolsOf(conversation),
        actor,
        action: decided.kind === "delay" ? { kind: decided.kind, ms: decided.ms, then: decided.then.kind } : decided.kind === "tool_call" ? { kind: decided.kind, name: decided.name } : { kind: decided.kind },
        turns: summarize(conversation),
      });
      send(res, wire.render(await settle(decided), conversation));
    })().catch((error: unknown) => {
      log({ url: req.url, error: error instanceof Error ? error.message : String(error) });
      if (!res.headersSent) plain(res, 500, { error: { message: "fake model failure" } });
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, HOST, () => {
      const address = server.address() as AddressInfo;
      resolve({
        port: address.port,
        address: address.address,
        close: () => new Promise((done) => (server.closeAllConnections(), server.close(() => done()))),
      });
    });
  });
}

function main(argv: string[]): void {
  const value = (flag: string) => argv[argv.indexOf(flag) + 1];
  const port = Number(value("--port") ?? "0");
  const logFile = value("--log");
  if (!Number.isInteger(port) || logFile === undefined) {
    process.stderr.write("usage: node server.ts --port <n> --log <file>\n");
    process.exit(2);
  }
  startServer({ port, logFile }).then(
    (server) => process.stdout.write(`${JSON.stringify({ listening: `${server.address}:${server.port}` })}\n`),
    (error: unknown) => {
      process.stderr.write(`fake model failed to start: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    },
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
