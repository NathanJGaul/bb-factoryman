// Stub ACP agent for the bb-factoryman conformance suite, tier 1.
//
// It speaks the Agent Client Protocol (newline-delimited JSON-RPC 2.0) on stdio.
// It needs no model and no credential. It calls the plugin's agent tools through
// the stdio MCP server that bb lists in `session/new` (`mcpServers`).
//
// The prompt scripts its behavior, so a test goes through the real dispatch and prompt path:
//   - A prompt with lines `CALL <tool> <json>`, `SHELL <command>`, `SLEEP <ms>`, or `LIST_TOOLS`
//     runs those directives in order and replies with every result (a supervisor driving).
//   - A prompt that starts the plugin's worker text ("You are the worker for <kind> task <id>")
//     runs the worker script. A `[brain:<flag>]` marker in the task description picks a variant.
//     The old marker `[stub:<flag>]` works the same way.
//   - Any other prompt (a wake message, a tool result delivered later) is logged and acknowledged.
// Every request, prompt, and tool result goes to $STUB_DIR/log.jsonl.
//
// Worker flags: silent, empty-evidence, double-report, dirty, nocommit, blocked, hold,
// fail=<code>, pr=<url>, prlong=<url>.
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";

const STUB_DIR = process.env["STUB_DIR"] ?? new URL(".", import.meta.url).pathname;
const LOG = join(STUB_DIR, "log.jsonl");

type Json = Record<string, unknown>;

function log(kind: string, data: Json = {}): void {
  appendFileSync(LOG, `${JSON.stringify({ t: new Date().toISOString(), pid: process.pid, kind, ...data })}\n`);
}

function send(message: Json): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", ...message })}\n`);
}

interface McpConfig {
  name?: string;
  command?: unknown;
  args?: string[];
  env?: Array<{ name: string; value: string }>;
}

interface McpTool {
  name: string;
}

interface ToolResult {
  text: string;
  isError: boolean;
}

class McpClient {
  readonly config: McpConfig;
  tools: McpTool[] = [];
  private nextId = 1;
  private readonly pending = new Map<number, { resolve: (value: Json) => void; reject: (error: Error) => void }>();
  private proc!: ChildProcessWithoutNullStreams;

  constructor(config: McpConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    const env = { ...process.env, ...Object.fromEntries((this.config.env ?? []).map((entry) => [entry.name, entry.value])) };
    this.proc = spawn(String(this.config.command), this.config.args ?? [], { env, stdio: ["pipe", "pipe", "pipe"] });
    this.proc.stderr.on("data", (chunk) => log("mcp-stderr", { text: String(chunk).slice(0, 2000) }));
    this.proc.on("exit", (code) => {
      for (const { reject } of this.pending.values()) reject(new Error(`MCP server exited with ${code}`));
      this.pending.clear();
    });
    createInterface({ input: this.proc.stdout, terminal: false }).on("line", (line) => {
      let message: { id?: number; result?: Json; error?: { code: number; message: string } };
      try {
        message = JSON.parse(line);
      } catch {
        return;
      }
      const waiter = message.id === undefined ? undefined : this.pending.get(message.id);
      if (waiter === undefined || message.id === undefined) return;
      this.pending.delete(message.id);
      if (message.error !== undefined) waiter.reject(new Error(`${message.error.code}: ${message.error.message}`));
      else waiter.resolve(message.result ?? {});
    });
    await this.request("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "factoryman-stub", version: "0.0.1" } }, 30_000);
    this.proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    const listed = await this.request("tools/list", {}, 30_000);
    this.tools = (listed["tools"] as McpTool[] | undefined) ?? [];
  }

  private request(method: string, params: Json, timeoutMs: number): Promise<Json> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP ${method} timed out after ${timeoutMs} ms`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => (clearTimeout(timer), resolve(value)),
        reject: (error) => (clearTimeout(timer), reject(error)),
      });
      this.proc.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  async call(name: string, args: Json): Promise<ToolResult> {
    const result = await this.request("tools/call", { name, arguments: args }, 12 * 60_000);
    const content = (result["content"] as Array<{ text?: string }> | undefined) ?? [];
    return { text: content.map((block) => block.text ?? JSON.stringify(block)).join("\n"), isError: result["isError"] === true };
  }
}

interface Session {
  id: string;
  cwd: string;
  mcpServers: McpConfig[];
  mcp?: Promise<McpClient[]>;
}

const sessions = new Map<string, Session>();
let sessionCounter = 0;

function update(sessionId: string, text: string): void {
  send({ method: "session/update", params: { sessionId, update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text } } } });
}

function mcpFor(session: Session): Promise<McpClient[]> {
  session.mcp ??= (async () => {
    const clients: McpClient[] = [];
    for (const config of session.mcpServers) {
      if (typeof config.command !== "string") continue;
      const client = new McpClient(config);
      await client.start();
      clients.push(client);
    }
    log("mcp-ready", { session: session.id, servers: clients.map((c) => ({ command: c.config.command, tools: c.tools.map((t) => t.name) })) });
    return clients;
  })();
  return session.mcp;
}

async function callTool(session: Session, name: string, args: Json): Promise<ToolResult> {
  const clients = await mcpFor(session);
  const client = clients.find((c) => c.tools.some((t) => t.name === name));
  if (client === undefined) {
    const known = clients.flatMap((c) => c.tools.map((t) => t.name));
    log("tool-missing", { session: session.id, name, known });
    return { text: `STUB: tool ${name} is not offered to this session. Offered: ${known.join(", ") || "(none)"}`, isError: true };
  }
  log("tool-call", { session: session.id, name, args });
  let result: ToolResult;
  try {
    result = await client.call(name, args);
  } catch (error) {
    result = { text: `STUB: call failed: ${error instanceof Error ? error.message : String(error)}`, isError: true };
  }
  log("tool-result", { session: session.id, name, ...result });
  return result;
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A supervisor script: the directive lines of the prompt, run in order. */
async function directiveScript(session: Session, text: string): Promise<string> {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "LIST_TOOLS") {
      const clients = await mcpFor(session);
      out.push(`[tools] ${clients.flatMap((c) => c.tools.map((t) => t.name)).join(", ") || "(none)"}`);
      continue;
    }
    const pause = /^SLEEP (\d+)\s*$/.exec(line);
    if (pause !== null) {
      log("sleep", { session: session.id, ms: Number(pause[1]) });
      await sleep(Number(pause[1]));
      out.push(`[slept ${pause[1]} ms]`);
      continue;
    }
    const shell = /^SHELL (.*)$/.exec(line);
    if (shell !== null) {
      // An agent with a shell: run the command exactly as a real agent session could.
      log("shell", { session: session.id, command: shell[1] });
      try {
        const stdout = execFileSync("bash", ["-c", shell[1] as string], { cwd: session.cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 60_000 });
        out.push(`[shell ok] ${stdout.trim()}`);
      } catch (error) {
        const failure = error as { stdout?: unknown; stderr?: unknown; message: string };
        out.push(`[shell ERROR] ${String(failure.stdout ?? "").trim()} ${String(failure.stderr ?? failure.message).trim()}`);
      }
      continue;
    }
    const call = /^CALL (\S+)(?: (.*))?$/.exec(line);
    if (call === null) continue;
    let args: Json;
    try {
      args = call[2] === undefined || call[2].trim() === "" ? {} : (JSON.parse(call[2]) as Json);
    } catch (error) {
      out.push(`STUB: bad JSON for ${call[1]}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    const result = await callTool(session, call[1] as string, args);
    out.push(`[${call[1]}${result.isError ? " ERROR" : ""}] ${result.text}`);
  }
  return out.join("\n\n");
}

/** The text of an ACP error for `fail=<code>`. The conformance suite looks for this cause in the task's evidence. */
const causeText = (code: string) => `CONFORMANCE-CAUSE-${code}`;

class PromptFailure extends Error {}

async function workerScript(session: Session, text: string): Promise<string> {
  const head = /You are the worker for (scout|ship) task (\S+)\. The delivery mode is ([\w-]+)\./.exec(text);
  if (head === null) throw new Error("unreadable worker prompt");
  const branch = /switch to the branch (\S+?)\.(?:\n|$)/.exec(text)?.[1] ?? "";
  const flag = /\[(?:brain|stub):([^\]]+)\]/.exec(text)?.[1] ?? "normal";
  const [, kind, taskId, mode] = head;
  const cwd = session.cwd;
  const out = [`STUB worker: ${kind} task ${taskId}, mode ${mode}, branch ${branch}, flag ${flag}, cwd ${cwd}`];
  const report = async (args: Json) => {
    const result = await callTool(session, "factoryman_report", args);
    out.push(`[factoryman_report ${JSON.stringify(args).slice(0, 160)}${result.isError ? " ERROR" : ""}] ${result.text}`);
    return result;
  };
  if (flag.startsWith("fail=")) throw new PromptFailure(`STUB upstream failure: ${causeText(flag.slice(5))}`);
  try {
    out.push(`git checkout -b ${branch}: ${git(cwd, "checkout", "-b", branch) || "ok"}`);
  } catch (error) {
    out.push(`git checkout failed: ${(error as { stderr?: string }).stderr ?? String(error)}`);
  }
  if (flag === "silent") {
    out.push("STUB worker: silent turn, no report.");
    return out.join("\n");
  }
  if (flag === "hold") {
    log("hold", { session: session.id, ms: 120_000 });
    await sleep(120_000);
  }
  if (flag === "empty-evidence") {
    await report({ outcome: "done", evidence: "" });
    await report({ outcome: "done", evidence: "   " });
  }
  if (kind === "scout") {
    const files = git(cwd, "ls-files");
    const evidence = `Scout report for ${taskId}. Files in this repository:\n${files}`;
    if (flag === "dirty") {
      writeFileSync(join(cwd, "UNTRACKED.txt"), "left behind\n");
      out.push("left dirty: UNTRACKED.txt");
    }
    await report({ outcome: "done", evidence });
    if (flag === "double-report") await report({ outcome: "done", evidence });
    return out.join("\n");
  }
  if (flag === "blocked") {
    await report({ outcome: "blocked", evidence: "stub: pretending to need information" });
    return out.join("\n");
  }
  if (flag !== "nocommit") {
    appendFileSync(join(cwd, "README.md"), `stub line from ${taskId}\n`);
    git(cwd, "add", "-A");
    git(cwd, "commit", "-q", "-m", `stub: add a line (${taskId})`);
    out.push(`committed: ${git(cwd, "log", "--oneline", "-1")}`);
  }
  if (flag === "dirty") {
    appendFileSync(join(cwd, "README.md"), "uncommitted edit\n");
    writeFileSync(join(cwd, "UNTRACKED.txt"), "left behind\n");
    out.push(`left dirty: ${git(cwd, "status", "--short").replace(/\n/g, "; ")}`);
  }
  const landed = flag === "nocommit" ? 0 : 1;
  const longPr = flag.startsWith("prlong=") ? flag.slice(7) : undefined;
  const prUrl = longPr ?? (flag.startsWith("pr=") ? flag.slice(3) : undefined);
  const evidence =
    longPr === undefined
      ? `stub: committed ${landed} commit(s) on ${branch}`
      : [
          `Pull request ${longPr} is open and ready for review.`,
          "Checks run in the no-mistakes pipeline:",
          ...Array.from({ length: 24 }, (_, i) => `  - step ${i + 1}: passed (${100 + i * 7} ms), nothing to fix, no findings left open`),
          "A long unbroken token follows, to see how the form wraps it:",
          "x".repeat(260),
          "Last line of the evidence.",
        ].join("\n");
  await report({ outcome: "done", evidence, ...(prUrl === undefined ? { landedCommits: landed } : { prUrl }) });
  if (flag === "double-report") await report({ outcome: "done", evidence, landedCommits: landed });
  return out.join("\n");
}

async function handlePrompt(session: Session, text: string): Promise<string> {
  log("prompt", { session: session.id, cwd: session.cwd, text: text.slice(0, 40000) });
  if (/^(CALL |LIST_TOOLS|SHELL |SLEEP )/m.test(text)) return directiveScript(session, text);
  if (/You are the worker for (scout|ship) task /.test(text)) return workerScript(session, text);
  return `STUB ack: ${text.slice(0, 300).replace(/\n/g, " ")}`;
}

async function onRequest(message: { id: number; method: string; params?: Json }): Promise<void> {
  const { id, method } = message;
  const params = message.params ?? {};
  log("rx", { method, params: method === "session/prompt" ? undefined : params });
  switch (method) {
    case "initialize":
      return send({
        id,
        result: {
          protocolVersion: 1,
          agentCapabilities: { loadSession: false, promptCapabilities: { image: false, audio: false, embeddedContext: false }, mcpCapabilities: { http: false, sse: false } },
          authMethods: [],
          agentInfo: { name: "factoryman-stub", title: "Factoryman stub", version: "0.0.1" },
        },
      });
    case "session/new": {
      sessionCounter += 1;
      const mcpServers = (params["mcpServers"] as McpConfig[] | undefined) ?? [];
      const session: Session = { id: `stub-${process.pid}-${sessionCounter}`, cwd: (params["cwd"] as string | undefined) ?? process.cwd(), mcpServers };
      sessions.set(session.id, session);
      log("session-new", {
        session: session.id,
        cwd: session.cwd,
        mcpServers: mcpServers.map((s) => ({ name: s.name, command: s.command, args: s.args, envNames: (s.env ?? []).map((e) => e.name) })),
      });
      send({ id, result: { sessionId: session.id } });
      // Start the servers now, as a real harness does, so the offered tools are known before the first tool call.
      mcpFor(session).catch((error: unknown) => log("error", { message: `MCP start failed: ${error instanceof Error ? error.message : String(error)}` }));
      return;
    }
    case "session/prompt": {
      const session = sessions.get(String(params["sessionId"]));
      if (session === undefined) return send({ id, error: { code: -32602, message: "unknown session" } });
      const blocks = (params["prompt"] as Array<{ type: string; text?: string }> | undefined) ?? [];
      const text = blocks.map((block) => (block.type === "text" ? (block.text ?? "") : `[${block.type}]`)).join("\n");
      let reply: string;
      try {
        reply = await handlePrompt(session, text);
      } catch (error) {
        if (error instanceof PromptFailure) {
          log("failure", { session: session.id, message: error.message });
          return send({ id, error: { code: -32603, message: error.message } });
        }
        reply = `STUB error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`;
        log("error", { message: reply });
      }
      update(session.id, reply);
      log("reply", { session: session.id, text: reply.slice(0, 4000) });
      return send({ id, result: { stopReason: "end_turn" } });
    }
    case "authenticate":
      return send({ id, result: {} });
    default:
      return send({ id, error: { code: -32601, message: `Method not found: ${method}` } });
  }
}

createInterface({ input: process.stdin, terminal: false }).on("line", (line) => {
  if (line.trim() === "") return;
  let message: { id?: number; method?: string; params?: Json };
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }
  if (message.method === undefined) {
    log("rx-response", { message });
    return;
  }
  if (message.id === undefined) {
    log("rx-notification", { method: message.method });
    return;
  }
  const request = { id: message.id, method: message.method, ...(message.params === undefined ? {} : { params: message.params }) };
  onRequest(request).catch((error: unknown) => {
    log("error", { message: error instanceof Error ? (error.stack ?? error.message) : String(error) });
    send({ id: request.id, error: { code: -32603, message: error instanceof Error ? error.message : String(error) } });
  });
});
log("start", { argv: process.argv, home: process.env["HOME"], cwd: process.cwd() });
