import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { afterEach, describe, expect, it } from "vitest";
import { git, initRepo, tmpDir } from "../../test/fixtures/git-repo.ts";

const STUB = new URL("./stub-agent.ts", import.meta.url).pathname;
const FAKE_MCP = new URL("./fake-mcp.ts", import.meta.url).pathname;

interface Reply {
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

class Session {
  readonly dir = tmpDir("stub-agent-");
  readonly mcpLog = join(this.dir, "mcp.jsonl");
  readonly cwd: string;
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly waiting = new Map<number, (reply: Reply) => void>();
  readonly updates: string[] = [];
  private nextId = 1;
  sessionId = "";

  constructor(cwd = initRepo()) {
    this.cwd = cwd;
    this.child = spawn(process.execPath, [STUB], {
      env: { ...process.env, STUB_DIR: this.dir, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.com", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.com" },
    });
    createInterface({ input: this.child.stdout }).on("line", (line) => {
      const message = JSON.parse(line) as { id?: number; method?: string; params?: { update?: { content?: { text?: string } } } } & Reply;
      if (message.method === "session/update") this.updates.push(message.params?.update?.content?.text ?? "");
      else if (message.id !== undefined) this.waiting.get(message.id)?.(message);
    });
  }

  request(method: string, params: Record<string, unknown>): Promise<Reply> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no reply to ${method} within 20 s; updates so far: ${this.updates.join(" | ")}`)), 20_000);
      this.waiting.set(id, (reply) => (clearTimeout(timer), resolve(reply)));
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  async open(): Promise<void> {
    await this.request("initialize", { protocolVersion: 1 });
    const created = await this.request("session/new", {
      cwd: this.cwd,
      mcpServers: [{ name: "bb-bridge", command: process.execPath, args: [FAKE_MCP], env: [{ name: "MCP_LOG", value: this.mcpLog }] }],
    });
    this.sessionId = String(created.result?.["sessionId"] ?? "");
  }

  async prompt(text: string): Promise<{ reply: Reply; text: string }> {
    const before = this.updates.length;
    const reply = await this.request("session/prompt", { sessionId: this.sessionId, prompt: [{ type: "text", text }] });
    return { reply, text: this.updates.slice(before).join("\n") };
  }

  reports(): Array<{ name: string; arguments: Record<string, unknown> }> {
    return existsSync(this.mcpLog) ? readFileSync(this.mcpLog, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  }

  log(): Array<Record<string, unknown>> {
    const file = join(this.dir, "log.jsonl");
    return existsSync(file) ? readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l)) : [];
  }

  close(): void {
    this.child.kill();
  }
}

const open: Session[] = [];
afterEach(() => {
  for (const session of open.splice(0)) session.close();
});
async function session(cwd?: string): Promise<Session> {
  const s = new Session(cwd);
  open.push(s);
  await s.open();
  return s;
}

const workerPrompt = (kind: "scout" | "ship", flag: string | null, id = "t-1") =>
  [
    `You are the worker for ${kind} task ${id}. The delivery mode is local-only.`,
    "",
    "Task:",
    `do the work${flag === null ? "" : ` ${flag}`}`,
    "",
    `First, create and switch to the branch fm/${id}.`,
    "The factoryman-worker skill lists the rules for your work. Read it before you start.",
  ].join("\n");

describe("the stub agent over ACP", () => {
  it("[U1335] answers initialize and session/new, starts the MCP servers that bb lists, and logs each request", async () => {
    const s = await session();
    expect(s.sessionId).not.toBe("");
    const kinds = s.log().map((entry) => entry["kind"]);
    expect(kinds).toContain("rx");
    expect(kinds).toContain("session-new");
    const { text } = await s.prompt("LIST_TOOLS");
    expect(text).toContain("factoryman_report");
    expect(s.log().some((entry) => entry["kind"] === "mcp-ready")).toBe(true);
  });

  it("[U1336] LIST_TOOLS reports the MCP tools, and CALL returns the tool's result or an error text", async () => {
    const s = await session();
    const listed = await s.prompt("LIST_TOOLS");
    expect(listed.text).toContain("[tools] factoryman_report");
    const called = await s.prompt('CALL factoryman_report {"outcome":"done","evidence":"seen"}');
    expect(called.text).toContain("[factoryman_report] recorded");
    expect(s.reports()).toEqual([{ name: "factoryman_report", arguments: { outcome: "done", evidence: "seen" } }]);
    const missing = await s.prompt("CALL factoryman_dispatch {}");
    expect(missing.text).toMatch(/factoryman_dispatch ERROR\].*not offered/);
    const bad = await s.prompt("CALL factoryman_report {not json");
    expect(bad.text).toMatch(/bad JSON/);
  });

  it("[U1337] SHELL runs in the session directory, and SLEEP waits that long", async () => {
    const s = await session();
    writeFileSync(join(s.cwd, "marker.txt"), "x");
    const shell = await s.prompt("SHELL ls marker.txt && pwd");
    expect(shell.text).toContain("[shell ok] marker.txt");
    expect(shell.text).toContain(s.cwd);
    const failing = await s.prompt("SHELL exit 3");
    expect(failing.text).toContain("[shell ERROR]");
    const started = Date.now();
    await s.prompt("SLEEP 400");
    expect(Date.now() - started).toBeGreaterThanOrEqual(380);
  });
});

describe("the stub agent as a worker", () => {
  it("[U1338] reports a scout task done with the file list as evidence", async () => {
    const s = await session();
    await s.prompt(workerPrompt("scout", null));
    const [report] = s.reports();
    expect(report?.arguments["outcome"]).toBe("done");
    expect(String(report?.arguments["evidence"])).toContain("README.md");
    expect(git(s.cwd, "branch", "--show-current").trim()).toBe("fm/t-1");
  });

  it("[U1339] creates the branch, commits one line, and reports the commit count of a ship task", async () => {
    const s = await session();
    await s.prompt(workerPrompt("ship", null));
    expect(git(s.cwd, "rev-list", "--count", "main..fm/t-1").trim()).toBe("1");
    const [report] = s.reports();
    expect(report?.arguments).toMatchObject({ outcome: "done", landedCommits: 1 });
  });

  it("[U1340] ends a silent turn with no report", async () => {
    const s = await session();
    const { text } = await s.prompt(workerPrompt("scout", "[brain:silent]"));
    expect(s.reports()).toEqual([]);
    expect(text).toMatch(/silent/i);
    expect(git(s.cwd, "branch", "--show-current").trim()).toBe("fm/t-1");
  });

  it("[U1341] reports empty evidence for empty-evidence, and reports twice for double-report", async () => {
    const empty = await session();
    await empty.prompt(workerPrompt("scout", "[brain:empty-evidence]"));
    expect(empty.reports().map((r) => String(r.arguments["evidence"]).trim() === "")).toEqual([true, true, false]);
    const twice = await session();
    await twice.prompt(workerPrompt("scout", "[brain:double-report]"));
    expect(twice.reports().map((r) => r.arguments["outcome"])).toEqual(["done", "done"]);
  });

  it("[U1342] leaves uncommitted work for dirty and no commit for nocommit", async () => {
    const dirty = await session();
    await dirty.prompt(workerPrompt("ship", "[brain:dirty]"));
    expect(git(dirty.cwd, "status", "--short").trim()).not.toBe("");
    const none = await session();
    await none.prompt(workerPrompt("ship", "[brain:nocommit]"));
    expect(git(none.cwd, "rev-list", "--count", "main..fm/t-1").trim()).toBe("0");
    expect(none.reports()[0]?.arguments).toMatchObject({ landedCommits: 0 });
  });

  it("[U1343] answers the prompt with an ACP error whose text carries the code for fail=<code>", async () => {
    const s = await session();
    const { reply } = await s.prompt(workerPrompt("scout", "[brain:fail=401]"));
    expect(reply.error?.message).toContain("CONFORMANCE-CAUSE-401");
    expect(s.reports()).toEqual([]);
  });

  it("[U1344] reads the marker [brain:<flag>] and the old marker [stub:<flag>] the same way", async () => {
    const dir = tmpDir("stub-markers-");
    mkdirSync(dir, { recursive: true });
    const a = await session();
    await a.prompt(workerPrompt("scout", "[brain:silent]"));
    const b = await session();
    await b.prompt(workerPrompt("scout", "[stub:silent]"));
    expect(a.reports()).toEqual([]);
    expect(b.reports()).toEqual([]);
    const c = await session();
    await c.prompt(workerPrompt("ship", "[stub:blocked]"));
    expect(c.reports()[0]?.arguments["outcome"]).toBe("blocked");
  });
});

describe("the stub agent at session start", () => {
  it("[U1412] starts the MCP servers that bb lists as soon as a session opens, so the offered tools are in the log before any tool call", async () => {
    const s = await session();
    const deadline = Date.now() + 5000;
    while (!s.log().some((entry) => entry["kind"] === "mcp-ready") && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
    const ready = s.log().find((entry) => entry["kind"] === "mcp-ready") as { servers: Array<{ tools: string[] }> } | undefined;
    expect(ready?.servers[0]?.tools).toEqual(["factoryman_report"]);
  });
});
