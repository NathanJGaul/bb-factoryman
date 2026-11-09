import { describe, expect, it } from "vitest";
import { nextAction } from "./brain.ts";
import type { Action, Conversation, OfferedTool, Turn } from "./types.ts";

const bashSchema = { type: "object", properties: { command: { type: "string" }, description: { type: "string" } }, required: ["command", "description"] };
const reportSchema = { type: "object", properties: { outcome: { type: "string" }, evidence: { type: "string" } }, required: ["outcome", "evidence"] };
const tool = (name: string, schema: Record<string, unknown> = { type: "object", properties: {} }): OfferedTool => ({ name, description: "", schema });
const PLAIN = [tool("Bash", bashSchema), tool("factoryman_report", reportSchema), tool("factoryman_dispatch")];

const convo = (turns: Turn[], tools: OfferedTool[] = PLAIN, system = ""): Conversation => ({ wire: "chat", model: "m", stream: true, system, tools, turns });
const user = (text: string): Turn => ({ role: "user", text });
const called = (name: string, args: Record<string, unknown> = {}): Turn[] => [
  { role: "assistant", text: "", toolCalls: [{ id: `c-${name}`, name, args }] },
  { role: "tool", callId: `c-${name}`, text: "ok" },
];

const worker = (kind: "scout" | "ship", flag: string | null, id = "t-1") =>
  [
    `You are the worker for ${kind} task ${id}. The delivery mode is local-only.`,
    "",
    "Task:",
    `do the work${flag === null ? "" : ` ${flag}`}`,
    "",
    `First, create and switch to the branch fm/${id}.`,
  ].join("\n");

const call = (action: Action): { name: string; args: Record<string, unknown> } => {
  if (action.kind !== "tool_call") throw new Error(`expected a tool call, got ${JSON.stringify(action)}`);
  return { name: action.name, args: action.args };
};

/** Walk a worker script: feed back the previous action as a tool call until the model answers with text. */
function walk(prompt: string, tools: OfferedTool[] = PLAIN, system = ""): Action[] {
  const turns: Turn[] = [user(prompt)];
  const actions: Action[] = [];
  for (let i = 0; i < 12; i += 1) {
    const action = nextAction(convo(turns, tools, system));
    actions.push(action);
    const inner = action.kind === "delay" ? action.then : action;
    if (inner.kind !== "tool_call") break;
    turns.push(...called(inner.name, inner.args));
  }
  return actions;
}
const shellCommands = (actions: Action[]) =>
  actions.flatMap((a) => {
    const inner = a.kind === "delay" ? a.then : a;
    return inner.kind === "tool_call" && inner.name === "Bash" ? [String(inner.args["command"])] : [];
  });
const reports = (actions: Action[]) =>
  actions.flatMap((a) => {
    const inner = a.kind === "delay" ? a.then : a;
    return inner.kind === "tool_call" && inner.name === "factoryman_report" ? [inner.args] : [];
  });

describe("directives from the latest user turn", () => {
  it("[U1353] runs CALL, SHELL, and SLEEP in order, one per step, and ends with text after the last result", () => {
    const prompt = ['CALL factoryman_dispatch {"kind":"scout","description":"x"}', "SHELL ls", "SLEEP 40"].join("\n");
    const first = nextAction(convo([user(prompt)]));
    expect(call(first)).toEqual({ name: "factoryman_dispatch", args: { kind: "scout", description: "x" } });
    const second = nextAction(convo([user(prompt), ...called("factoryman_dispatch")]));
    expect(call(second)).toEqual({ name: "Bash", args: { command: "ls", description: "conformance" } });
    const third = nextAction(convo([user(prompt), ...called("factoryman_dispatch"), ...called("Bash")]));
    expect(third).toEqual({ kind: "delay", ms: 40, then: { kind: "text", text: expect.any(String) } });
    const between = ["CALL factoryman_status {}", "SLEEP 30", "SHELL ls"].join("\n");
    expect(nextAction(convo([user(between), ...called("factoryman_status")]))).toMatchObject({ kind: "delay", ms: 30, then: { kind: "tool_call", name: "Bash" } });
    const missing = nextAction(convo([user("CALL factoryman_merge {}")]));
    expect(missing).toMatchObject({ kind: "text", text: expect.stringMatching(/factoryman_merge.*not offered/) });
  });
});

describe("the worker script", () => {
  it("[U1354] creates the branch and reports a scout done, and for a ship task commits once before it reports the commit count", () => {
    const scout = walk(worker("scout", null));
    expect(shellCommands(scout)).toEqual(["git checkout -b fm/t-1"]);
    expect(reports(scout)).toEqual([{ outcome: "done", evidence: expect.stringContaining("t-1") }]);
    expect(scout.at(-1)).toMatchObject({ kind: "text" });
    const ship = walk(worker("ship", null));
    expect(shellCommands(ship)).toHaveLength(2);
    expect(shellCommands(ship)[1]).toContain("git add -A");
    expect(shellCommands(ship)[1]).toMatch(/git .*commit/);
    expect(reports(ship)).toEqual([{ outcome: "done", evidence: expect.stringContaining("t-1"), landedCommits: 1 }]);
  });

  it("[U1355] plays silent, empty-evidence, double-report, dirty, nocommit, blocked, and hold", () => {
    const silent = walk(worker("scout", "[brain:silent]"));
    expect(reports(silent)).toEqual([]);
    expect(silent.at(-1)).toMatchObject({ kind: "text" });

    const empty = reports(walk(worker("scout", "[brain:empty-evidence]")));
    expect(empty.map((r) => String(r["evidence"]).trim() === "")).toEqual([true, true, false]);

    const twice = reports(walk(worker("scout", "[brain:double-report]")));
    expect(twice).toHaveLength(2);

    const dirty = walk(worker("ship", "[brain:dirty]"));
    expect(shellCommands(dirty).some((c) => c.includes("UNTRACKED.txt"))).toBe(true);

    const none = walk(worker("ship", "[brain:nocommit]"));
    expect(shellCommands(none).some((c) => /git .*commit/.test(c))).toBe(false);
    expect(reports(none)).toEqual([{ outcome: "done", evidence: expect.any(String), landedCommits: 0 }]);

    expect(reports(walk(worker("ship", "[brain:blocked]")))[0]).toMatchObject({ outcome: "blocked" });

    const hold = walk(worker("scout", "[brain:hold]"));
    expect(hold.some((a) => a.kind === "delay" && a.ms === 120_000)).toBe(true);
  });

  it("[U1356] returns an error action with the HTTP status and the cause text for fail=<code>", () => {
    expect(nextAction(convo([user(worker("scout", "[brain:fail=401]"))]))).toEqual({ kind: "error", status: 401, message: expect.stringContaining("CONFORMANCE-CAUSE-401") });
    expect(nextAction(convo([user(worker("ship", "[brain:fail=429]"))]))).toMatchObject({ kind: "error", status: 429 });
  });

  it("[U1357] calls ToolSearch before a deferred report tool, and the report tool once the search has loaded it", () => {
    const deferredTools = [tool("Bash", bashSchema), tool("ToolSearch", { type: "object", properties: { query: { type: "string" }, max_results: { type: "number" } }, required: ["query"] })];
    const system = "<system-reminder>deferred: mcp__bb-bridge__factoryman_report</system-reminder>";
    const afterBranch = [user(worker("scout", null)), ...called("Bash")];
    expect(call(nextAction(convo(afterBranch, deferredTools, system)))).toEqual({ name: "ToolSearch", args: { query: "select:mcp__bb-bridge__factoryman_report", max_results: 1 } });
    const loaded = [...deferredTools, tool("mcp__bb-bridge__factoryman_report", reportSchema)];
    const afterSearch = [...afterBranch, ...called("ToolSearch", { query: "select:mcp__bb-bridge__factoryman_report" })];
    expect(call(nextAction(convo(afterSearch, loaded, system))).name).toBe("mcp__bb-bridge__factoryman_report");
  });

  it("[U1358] writes the report JSON to the xd device with the write tool when the report tool is only a device", () => {
    const writeSchema = { type: "object", properties: { i: { type: "string" }, path: { type: "string" }, content: { type: "string" } }, required: ["i", "path", "content"] };
    const tools = [tool("bash", bashSchema), tool("write", writeSchema)];
    const system = 'MCP Tool Routes: "factoryman_report" -> xd://mcp__bb_bridge_factoryman_report';
    const action = call(nextAction(convo([user(worker("scout", null)), ...called("bash")], tools, system)));
    expect(action.name).toBe("write");
    expect(action.args["path"]).toBe("xd://mcp__bb_bridge_factoryman_report");
    expect(action.args["i"]).toBe("conformance");
    expect(JSON.parse(String(action.args["content"]))).toMatchObject({ outcome: "done" });
  });
});

describe("text that a harness adds after a tool result", () => {
  it("[U1423] keeps running a directive script after Tool loaded. and a total_tokens reminder", () => {
    const prompt = ['CALL factoryman_dispatch {"kind":"scout","description":"x"}', "SLEEP 40"].join("\n");
    const deferredTools = [tool("ToolSearch", { type: "object", properties: { query: { type: "string" }, max_results: { type: "number" } }, required: ["query"] }), tool("mcp__bb-bridge__factoryman_dispatch")];
    const system = "<system-reminder>deferred: mcp__bb-bridge__factoryman_dispatch</system-reminder>";
    const afterSearch: Turn[] = [user(prompt), ...called("ToolSearch", { query: "select:mcp__bb-bridge__factoryman_dispatch" }), user("Tool loaded."), user("<total_tokens>14999985 tokens left</total_tokens>")];
    const next = nextAction(convo(afterSearch, deferredTools, system));
    expect(call(next)).toEqual({ name: "mcp__bb-bridge__factoryman_dispatch", args: { kind: "scout", description: "x" } });
    const afterCall: Turn[] = [...afterSearch, ...called("mcp__bb-bridge__factoryman_dispatch"), user("<total_tokens>14999000 tokens left</total_tokens>")];
    expect(nextAction(convo(afterCall, deferredTools, system))).toMatchObject({ kind: "delay", ms: 40 });
  });
});

describe("a turn with no script", () => {
  it("[U1359] answers a plain prompt, a wake message after a finished script, and a system reminder with text", () => {
    expect(nextAction(convo([user("hello there")]))).toMatchObject({ kind: "text" });
    const done = [user("CALL factoryman_status {}"), ...called("factoryman_status"), { role: "assistant", text: "Done.", toolCalls: [] } as Turn, user("[factoryman] Task t-1 (scout, local-only) is now report_ready.")];
    expect(nextAction(convo(done))).toMatchObject({ kind: "text" });
    const reminded = [user("CALL factoryman_status {}"), ...called("factoryman_status"), user("<system-reminder>background note</system-reminder>")];
    expect(nextAction(convo(reminded))).toMatchObject({ kind: "text" });
  });
});
