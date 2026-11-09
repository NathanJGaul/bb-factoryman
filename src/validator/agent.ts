import type { BbPort, ProviderState } from "../bb/port";
import { readinessProblem } from "../dispatch/availability";
import type { Exec } from "../exec";

/**
 * Observe which agent no-mistakes will use, and whether bb reports its provider ready (report task H12, decision D4
 * option B, D-126). The module reads and never writes. It reads one file with one command, and it never throws:
 * anything it cannot read becomes an `unobserved` result, and an unobserved or unchecked agent is never ready.
 */

export type ParseResult = { ok: true; names: string[] } | { ok: false; reason: string };

export type AgentReadiness =
  | { kind: "ready"; provider: string }
  | { kind: "not_ready"; provider: string; problem: string }
  | { kind: "unchecked"; reason: string }
  | { kind: "auto"; readyProviders: string[] };

export interface ObservedAgent {
  name: string;
  readiness: AgentReadiness;
}

export type Observation = { status: "observed"; source: "file" | "default"; agents: ObservedAgent[]; ready: boolean } | { status: "unobserved"; reason: string };

export interface ObserveWhere {
  /** The host that runs the pipeline, or null for the server. */
  hostId: string | null;
  /** The machine's name, or "the default host". Messages name it. */
  hostName: string;
}

/** The bb provider that starts the same program as each no-mistakes agent (D-126). Every other agent has none. */
export const AGENT_PROVIDERS: Readonly<Record<string, string>> = {
  claude: "claude-code",
  codex: "codex",
  pi: "pi",
  "acp:omp": "acp-omp",
  opencode: "acp-opencode",
  grok: "acp-grok",
  cursor: "acp-cursor",
};

/** The one command of the observation. It reads the file and writes nothing. Exit 3 means the host has no file. */
export const READ_SCRIPT = 'f="${NM_HOME:-$HOME/.no-mistakes}/config.yaml"; if [ -f "$f" ]; then cat "$f"; else exit 3; fi';
export const READ_TIMEOUT_MS = 30_000;
const NO_FILE = 3;

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Cut a trailing comment: a `#` at the start or after whitespace, outside quotes. */
function stripComment(value: string): string {
  let quote: string | null = null;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i] as string;
    if (quote !== null) {
      if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "#" && (i === 0 || /\s/.test(value[i - 1] as string))) return value.slice(0, i);
  }
  return value;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  const first = trimmed[0];
  return trimmed.length >= 2 && (first === '"' || first === "'") && trimmed.endsWith(first) ? trimmed.slice(1, -1) : trimmed;
}

const fail = (reason: string): ParseResult => ({ ok: false, reason });

/**
 * Read the top-level `agent` key of no-mistakes' configuration: a name, a flow list, or a block list. No key reads as
 * `auto`. A shape this reader does not understand is refused with a reason, and never guessed.
 */
export function parseAgentSetting(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const keys = lines.flatMap((line, index) => (/^agent:(\s|$)/.test(line) ? [index] : []));
  if (keys.length === 0) return { ok: true, names: ["auto"] };
  if (keys.length > 1) return fail("the file has two top-level `agent` keys");
  const index = keys[0] as number;
  const value = stripComment((lines[index] as string).slice("agent:".length)).trim();

  if (value.startsWith("[")) {
    if (!value.endsWith("]")) return fail("the `agent` list is not closed (a flow list ends with `]`)");
    const names = value.slice(1, -1).split(",").map(unquote);
    return names.some((name) => name === "") ? fail("the `agent` list has an empty name") : { ok: true, names };
  }
  if (value !== "") return { ok: true, names: [unquote(value)] };

  const names: string[] = [];
  for (let j = index + 1; j < lines.length; j += 1) {
    const line = lines[j] as string;
    if (/^\s*(#.*)?$/.test(line)) continue;
    const item = /^\s*-(?:\s+(.*))?$/.exec(line);
    if (item === null) break;
    const name = unquote(stripComment(item[1] ?? ""));
    if (name === "") return fail("the `agent` list has an empty name");
    names.push(name);
  }
  return names.length === 0 ? fail("`agent:` has no value and no list items") : { ok: true, names };
}

/** The bb provider that matches a no-mistakes agent, or null. */
export function providerForAgent(name: string): string | null {
  return Object.hasOwn(AGENT_PROVIDERS, name) ? (AGENT_PROVIDERS[name] as string) : null;
}

const unobserved = (reason: string): Observation => ({ status: "unobserved", reason });

function readiness(name: string, states: readonly ProviderState[], host: string): AgentReadiness {
  if (name === "auto") {
    const providers = [...new Set(Object.values(AGENT_PROVIDERS))];
    return { kind: "auto", readyProviders: providers.filter((provider) => readinessProblem(provider, states, host) === null) };
  }
  const provider = providerForAgent(name);
  if (provider === null) return { kind: "unchecked", reason: `${name} has no known bb provider, so its readiness was not checked` };
  const problem = readinessProblem(provider, states, host);
  return problem === null ? { kind: "ready", provider } : { kind: "not_ready", provider, problem };
}

const isReady = (agent: ObservedAgent): boolean => agent.readiness.kind === "ready" || (agent.readiness.kind === "auto" && agent.readiness.readyProviders.length > 0);

/**
 * Read the agent setting on the host that runs the pipeline, and bb's provider states for the same host. A host
 * with no file reads as the default `auto`.
 */
export async function observeValidatorAgent(deps: { bb: Pick<BbPort, "getProviderStates">; exec: Exec }, where: ObserveWhere): Promise<Observation> {
  let read;
  try {
    read = await deps.exec("sh", ["-c", READ_SCRIPT], { host: where.hostId, timeoutMs: READ_TIMEOUT_MS });
  } catch (error) {
    return unobserved(`the read failed (${message(error)})`);
  }
  if (read.error !== undefined || read.code === null) return unobserved(`the read did not finish (${read.error ?? "it was killed or timed out"})`);
  let names = ["auto"];
  let source: "file" | "default" = "default";
  if (read.code !== NO_FILE) {
    if (read.code !== 0) return unobserved(`the read exited ${read.code}: ${read.stderr.trim() || "no error text"}`);
    const parsed = parseAgentSetting(read.stdout);
    if (!parsed.ok) return unobserved(parsed.reason);
    names = parsed.names;
    source = "file";
  }

  let states: ProviderState[];
  try {
    states = await deps.bb.getProviderStates(where.hostId ?? undefined);
  } catch (error) {
    return unobserved(`could not read bb's provider states (${message(error)})`);
  }
  const agents = names.map((name) => ({ name, readiness: readiness(name, states, where.hostName) }));
  return { status: "observed", source, agents, ready: agents.some(isReady) };
}

const trimPeriod = (text: string): string => text.replace(/\.$/, "");

function autoText(readyProviders: readonly string[], host: string): string {
  return readyProviders.length > 0 ? `bb reports ready on ${host}: ${readyProviders.join(", ")}` : `bb reports no ready provider that no-mistakes can use on ${host}`;
}

function part(agent: ObservedAgent, host: string): string {
  const { name, readiness: state } = agent;
  switch (state.kind) {
    case "ready":
      return `${name} (bb provider ${state.provider}) is ready on ${host}`;
    case "not_ready":
      return `${name} (bb provider ${state.provider}) is not ready on ${host}: ${trimPeriod(state.problem)}`;
    case "unchecked":
      return state.reason;
    case "auto":
      return `auto (no-mistakes picks the first runnable agent; ${autoText(state.readyProviders, host)})`;
  }
}

/** The one line of evidence: the agent or agents, their providers, and their readiness. It never calls an unchecked or unobserved result ready. */
export function describeObservation(observation: Observation, hostName: string): string {
  if (observation.status === "unobserved") return `Validator agent: could not be observed on ${hostName} (${observation.reason}), so its readiness is not known.`;
  const { agents } = observation;
  if (agents.length > 1) return `Validator agents, in order: ${agents.map((agent) => part(agent, hostName)).join("; ")}.`;
  const agent = agents[0] as ObservedAgent;
  if (agent.readiness.kind === "auto") {
    const origin = observation.source === "default" ? " (the host has no no-mistakes configuration file, so the default applies)" : "";
    return `Validator agent: auto${origin}. no-mistakes picks the first runnable agent when the run starts. ${autoText(agent.readiness.readyProviders, hostName)}.`;
  }
  if (agent.readiness.kind === "not_ready") return `Validator agent: ${agent.name} (bb provider ${agent.readiness.provider}) is not ready on ${hostName}: ${agent.readiness.problem}`;
  return `Validator agent: ${part(agent, hostName)}.`;
}

/** Why the preflight should report a problem, or null when the agent is ready. It is the evidence line without its prefix. */
export function validatorProblem(observation: Observation, hostName: string): string | null {
  if (observation.status === "observed" && observation.ready) return null;
  return describeObservation(observation, hostName).replace(/^Validator agents?(, in order)?: /, "");
}
