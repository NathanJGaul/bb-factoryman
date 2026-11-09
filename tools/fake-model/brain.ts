import { buildArgs, findRoute, findShell } from "./tools.ts";
import type { Action, Conversation, ToolCall, Turn } from "./types.ts";

/** The cause text that a `fail=<code>` flag puts in the error body. The suite looks for it in the task's evidence. */
export const causeText = (code: string): string => `CONFORMANCE-CAUSE-${code}`;

const REMINDER = /<system-reminder>[\s\S]*?<\/system-reminder>/g;
const WORKER = /You are the worker for (scout|ship) task (\S+)\. The delivery mode is ([\w-]+)\./;
const DIRECTIVE = /^(?:CALL |SHELL |SLEEP |LIST_TOOLS)/m;
const HOLD_MS = 120_000;
const IDENTITY = "-c user.name=conformance -c user.email=conformance@invalid.example";

type UserTurn = Extract<Turn, { role: "user" }>;
type Step = { kind: "shell"; command: string } | { kind: "plugin"; tool: string; args: Record<string, unknown> } | { kind: "text"; text: string } | { kind: "delay"; ms: number };

const meaningful = (turn: UserTurn): string => turn.text.replace(REMINDER, "").trim();

function textAction(text: string): Action {
  return { kind: "text", text };
}

/** Plugin tool calls made so far in the part of the conversation after `from`. The search hop is not a step. */
function stepsDone(turns: Turn[], from: number): number {
  return turns.slice(from).reduce((n, turn) => (turn.role === "assistant" ? n + turn.toolCalls.filter((c: ToolCall) => c.name !== "ToolSearch").length : n), 0);
}

function searched(turns: Turn[], from: number, query: string): boolean {
  return turns.slice(from).some((turn) => turn.role === "assistant" && turn.toolCalls.some((c) => c.name === "ToolSearch" && c.args["query"] === query));
}

/** Turn a plugin tool call into the call that this harness's model can make. */
function pluginCall(c: Conversation, from: number, tool: string, args: Record<string, unknown>): Action {
  const route = findRoute(c, tool);
  if (route === null) {
    const offered = c.tools.map((t) => t.name).join(", ") || "(none)";
    return textAction(`BRAIN: the tool ${tool} is not offered to this session. Offered: ${offered}`);
  }
  if (route.kind === "function") return { kind: "tool_call", name: route.name, args };
  if (route.kind === "search") {
    if (searched(c.turns, from, route.query)) return textAction(`BRAIN: ToolSearch did not load ${tool}.`);
    return { kind: "tool_call", name: route.name, args: { query: route.query, max_results: 1 } };
  }
  const write = c.tools.find((t) => t.name === route.name);
  return { kind: "tool_call", name: route.name, args: { ...buildArgs(write?.schema ?? {}, {}), path: route.path, content: JSON.stringify(args) } };
}

function stepAction(c: Conversation, from: number, step: Step): Action {
  switch (step.kind) {
    case "text":
      return textAction(step.text);
    case "delay":
      return textAction("Done.");
    case "plugin":
      return pluginCall(c, from, step.tool, step.args);
    case "shell": {
      const shell = findShell(c.tools);
      if (shell === null) return textAction(`BRAIN: no shell tool is offered. Offered: ${c.tools.map((t) => t.name).join(", ") || "(none)"}`);
      return { kind: "tool_call", name: shell.name, args: buildArgs(shell.schema, { command: step.command }) };
    }
  }
}

/** Run the real step at `index`, after the delays that sit right before it. A delay keeps the turn open. */
function runStep(c: Conversation, from: number, steps: Step[], index: number): Action {
  let delay = 0;
  for (let at = index - 1; at >= 0 && steps[at]?.kind === "delay"; at -= 1) delay += (steps[at] as { ms: number }).ms;
  const step = steps[index];
  const action = step === undefined ? textAction("Done.") : stepAction(c, from, step);
  return delay > 0 ? { kind: "delay", ms: delay, then: action } : action;
}

/** Count steps that are not delays, because a delay makes no tool call. */
function realStepIndex(steps: Step[], done: number): number {
  let seen = 0;
  for (let i = 0; i < steps.length; i += 1) {
    if (steps[i]?.kind === "delay") continue;
    if (seen === done) return i;
    seen += 1;
  }
  return steps.length;
}

function directiveSteps(text: string): Step[] {
  const steps: Step[] = [];
  for (const line of text.split(/\r?\n/)) {
    const sleep = /^SLEEP (\d+)\s*$/.exec(line);
    if (sleep !== null) {
      steps.push({ kind: "delay", ms: Number(sleep[1]) });
      continue;
    }
    const shell = /^SHELL (.*)$/.exec(line);
    if (shell !== null) {
      steps.push({ kind: "shell", command: shell[1] as string });
      continue;
    }
    const plugin = /^CALL (\S+)(?: (.*))?$/.exec(line);
    if (plugin === null) continue;
    try {
      const args = plugin[2] === undefined || plugin[2].trim() === "" ? {} : (JSON.parse(plugin[2]) as Record<string, unknown>);
      steps.push({ kind: "plugin", tool: plugin[1] as string, args });
    } catch (error) {
      steps.push({ kind: "text", text: `BRAIN: bad JSON for ${plugin[1]}: ${error instanceof Error ? error.message : String(error)}` });
    }
  }
  return steps;
}

function workerSteps(kind: string, taskId: string, flag: string, branch: string): Step[] {
  const report = (args: Record<string, unknown>): Step => ({ kind: "plugin", tool: "factoryman_report", args });
  const steps: Step[] = [{ kind: "shell", command: `git checkout -b ${branch}` }];
  if (flag === "silent") return [...steps, { kind: "text", text: "Silent turn, no report." }];
  if (flag === "hold") steps.push({ kind: "delay", ms: HOLD_MS });
  if (flag === "empty-evidence") steps.push(report({ outcome: "done", evidence: "" }), report({ outcome: "done", evidence: "   " }));
  if (kind === "scout") {
    if (flag === "dirty") steps.push({ kind: "shell", command: "echo left > UNTRACKED.txt" });
    const done = report({ outcome: "done", evidence: `CONFORMANCE scout report for ${taskId}.` });
    steps.push(done);
    if (flag === "double-report") steps.push(done);
    return steps;
  }
  if (flag === "blocked") return [...steps, report({ outcome: "blocked", evidence: "CONFORMANCE: pretending to need information." })];
  if (flag !== "nocommit") steps.push({ kind: "shell", command: `echo "conformance ${taskId}" >> README.md && git add -A && git ${IDENTITY} commit -q -m "conformance: ${taskId}"` });
  if (flag === "dirty") steps.push({ kind: "shell", command: "echo more >> README.md && echo left > UNTRACKED.txt" });
  const landed = flag === "nocommit" ? 0 : 1;
  const pr = flag.startsWith("pr=") ? flag.slice(3) : undefined;
  const done = report({ outcome: "done", evidence: `CONFORMANCE ship: ${landed} commit(s) on ${branch}.`, ...(pr === undefined ? { landedCommits: landed } : { prUrl: pr }) });
  steps.push(done);
  if (flag === "double-report") steps.push(done);
  return steps;
}

/**
 * Decide the next action from the whole conversation. The brain keeps no state:
 * how far a script has run is the number of tool calls the model already made.
 * Two scripts exist, the worker script and the directive script, as in the stub agent.
 */
export function nextAction(c: Conversation): Action {
  const users = c.turns.flatMap((turn, index) => (turn.role === "user" ? [{ turn, index }] : []));
  const worker = users.map((u) => ({ ...u, match: WORKER.exec(u.turn.text) })).find((u) => u.match !== null);
  if (worker?.match != null) {
    const [, kind, taskId] = worker.match as unknown as [string, string, string];
    const flag = /\[(?:brain|stub):([^\]]+)\]/.exec(worker.turn.text)?.[1] ?? "normal";
    const branch = /switch to the branch (\S+?)\.(?:\n|$)/.exec(worker.turn.text)?.[1] ?? `fm/${taskId}`;
    if (flag.startsWith("fail=")) {
      const code = flag.slice(5);
      return { kind: "error", status: Number(code), message: causeText(code) };
    }
    const steps = workerSteps(kind, taskId, flag, branch);
    return runStep(c, worker.index, steps, realStepIndex(steps, stepsDone(c.turns, worker.index)));
  }
  const latest = [...users].reverse().find((u) => meaningful(u.turn) !== "");
  if (latest === undefined || !DIRECTIVE.test(meaningful(latest.turn))) return textAction("OK (conformance)");
  const steps = directiveSteps(meaningful(latest.turn));
  return runStep(c, latest.index, steps, realStepIndex(steps, stepsDone(c.turns, latest.index)));
}
