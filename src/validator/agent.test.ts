import { describe, expect, it } from "vitest";
import { FakeBbPort, providerState } from "../../test/fixtures/bb-port";
import type { Exec, ExecOptions, ExecResult } from "../exec";
import { AGENT_PROVIDERS, READ_SCRIPT, describeObservation, observeValidatorAgent, parseAgentSetting, providerForAgent, validatorProblem, type Observation, type ObservedAgent } from "./agent";

function names(text: string): string[] {
  const result = parseAgentSetting(text);
  if (!result.ok) throw new Error(`expected the setting to parse: ${result.reason}`);
  return result.names;
}
const reason = (text: string): string => {
  const result = parseAgentSetting(text);
  if (result.ok) throw new Error("expected the setting to be refused");
  return result.reason;
};

describe("parseAgentSetting", () => {
  it("[U1656] reads a scalar as the one name", () => {
    expect(names("agent: claude\n")).toEqual(["claude"]);
    expect(names("log_level: info\nagent: acp:omp\n")).toEqual(["acp:omp"]);
  });

  it("[U1657] reads a flow list as the names in order", () => {
    expect(names("agent: [codex, grok]\n")).toEqual(["codex", "grok"]);
    expect(names("agent: [pi]\n")).toEqual(["pi"]);
  });

  it("[U1658] reads a block list as the names in order", () => {
    expect(names("agent:\n  - codex\n  - grok\nci_timeout: 168h\n")).toEqual(["codex", "grok"]);
    expect(names("agent:\n- pi\n")).toEqual(["pi"]);
  });

  it("[U1659] removes the quotes around a name", () => {
    expect(names('agent: "claude"\n')).toEqual(["claude"]);
    expect(names("agent: ['codex', \"grok\"]\n")).toEqual(["codex", "grok"]);
    expect(names("agent:\n  - 'pi'\n")).toEqual(["pi"]);
  });

  it("[U1660] leaves a trailing comment out of the value", () => {
    expect(names("agent: claude # the default\n")).toEqual(["claude"]);
    expect(names("agent: [codex, grok] # fallback\n")).toEqual(["codex", "grok"]);
    expect(names("agent:\n  - codex # first\n")).toEqual(["codex"]);
  });

  it("[U1661] ignores a commented-out agent line", () => {
    expect(names("# agent: codex\n")).toEqual(["auto"]);
    expect(names("# agent: codex\nagent: pi\n")).toEqual(["pi"]);
  });

  it("[U1662] ignores an indented agent key, because only a top-level key counts", () => {
    expect(names("agent_config:\n  agent: codex\n")).toEqual(["auto"]);
    expect(names("  agent: codex\n")).toEqual(["auto"]);
  });

  it("[U1663] reads a file with no agent line as auto", () => {
    expect(names("")).toEqual(["auto"]);
    expect(names("log_level: info\nci_timeout: 168h\n")).toEqual(["auto"]);
  });

  it("[U1664] reads agent auto as auto, and keeps auto as an entry inside a list", () => {
    expect(names("agent: auto\n")).toEqual(["auto"]);
    expect(names("agent: [auto, codex]\n")).toEqual(["auto", "codex"]);
  });

  it.each([
    ["an unclosed flow list", "agent: [codex, grok\n", /not closed/],
    ["an empty flow list", "agent: []\n", /empty name/],
    ["a key with no value and no items", "agent:\nlog_level: info\n", /no value and no list items/],
    ["two top-level agent keys", "agent: codex\nagent: pi\n", /two top-level `agent` keys/],
    ["an empty name in a list", "agent: [codex, , pi]\n", /empty name/],
    ["an empty item in a block list", "agent:\n  - codex\n  - \n", /empty name/],
  ])("[U1665] refuses %s with a reason that names the shape, and guesses nothing", (_shape, text, pattern) => {
    expect(reason(text)).toMatch(pattern);
  });
});

describe("the agent to provider table", () => {
  it("[U1666] holds exactly the seven agents and their providers", () => {
    expect(AGENT_PROVIDERS).toEqual({
      claude: "claude-code",
      codex: "codex",
      pi: "pi",
      "acp:omp": "acp-omp",
      opencode: "acp-opencode",
      grok: "acp-grok",
      cursor: "acp-cursor",
    });
    expect(providerForAgent("claude")).toBe("claude-code");
    expect(providerForAgent("acp:omp")).toBe("acp-omp");
  });

  it.each(["acp:other", "acp:", "copilot", "rovodev", "devin", "antigravity", "never-heard-of-it", "constructor", "toString", "auto", ""])("[U1667] maps %j to no provider", (name) => {
    expect(providerForAgent(name)).toBeNull();
  });
});

interface Call {
  command: string;
  args: readonly string[];
  options: ExecOptions | undefined;
}

/** An `exec` that answers every call with `answer` and records the calls. */
function scripted(answer: ExecResult | (() => ExecResult | Promise<ExecResult>)): { exec: Exec; calls: Call[] } {
  const calls: Call[] = [];
  const exec: Exec = async (command, args, options) => {
    calls.push({ command, args, options });
    return typeof answer === "function" ? answer() : answer;
  };
  return { exec, calls };
}
const file = (text: string): ExecResult => ({ code: 0, stdout: text, stderr: "" });
const HERE = { hostId: null, hostName: "the default host" };
const GPU = { hostId: "host_gpu", hostName: "gpu-box" };

function bbWith(states: ReturnType<typeof providerState>[]): FakeBbPort {
  const bb = new FakeBbPort();
  bb.states = states;
  return bb;
}
const READY = (...ids: string[]) => ids.map((id) => providerState(id));

describe("observeValidatorAgent", () => {
  it("[U1668] reports a mapped agent whose provider bb reports ready as ready, with its provider", async () => {
    const { exec } = scripted(file("agent: claude\n"));
    const observation = await observeValidatorAgent({ bb: bbWith(READY("claude-code")), exec }, HERE);
    expect(observation).toEqual({ status: "observed", source: "file", ready: true, agents: [{ name: "claude", readiness: { kind: "ready", provider: "claude-code" } }] });
  });

  it.each([
    ["unauthenticated", /is not signed in on the default host \(bb status: unauthenticated\)\. Run `codex login` on that machine/],
    ["not_installed", /is not installed on the default host \(bb status: not_installed\)/],
    ["expired", /has an expired login on the default host \(bb status: expired\)/],
    ["unsupported_version", /is too old on the default host \(bb status: unsupported_version\)/],
  ] as const)("[U1669] reports a provider that is %s as not ready, with the text and the remedy that dispatch gives", async (status, pattern) => {
    const { exec } = scripted(file("agent: codex\n"));
    const observation = await observeValidatorAgent({ bb: bbWith([providerState("codex", { status, localLoginCommand: "codex login", installedVersion: "0.1.0", minimumSupportedVersion: "0.136.0" })]), exec }, HERE);
    expect(observation).toMatchObject({ status: "observed", ready: false, agents: [{ name: "codex", readiness: { kind: "not_ready", provider: "codex" } }] });
    const entry = observation.status === "observed" ? observation.agents[0]?.readiness : undefined;
    expect(entry?.kind === "not_ready" ? entry.problem : "").toMatch(pattern);
  });

  it("[U1670] reports a provider that the host's states do not list as not ready, and says that bb reports no state", async () => {
    const { exec } = scripted(file("agent: pi\n"));
    const observation = await observeValidatorAgent({ bb: bbWith(READY("claude-code")), exec }, HERE);
    const entry = observation.status === "observed" ? observation.agents[0]?.readiness : undefined;
    expect(observation).toMatchObject({ status: "observed", ready: false });
    expect(entry).toMatchObject({ kind: "not_ready", provider: "pi" });
    expect(entry?.kind === "not_ready" ? entry.problem : "").toContain("bb reports no state for the provider `pi`");
  });

  it("[U1671] reports an agent with no mapped provider as unchecked, and never as ready", async () => {
    const { exec } = scripted(file("agent: copilot\n"));
    const observation = await observeValidatorAgent({ bb: bbWith(READY("claude-code", "codex", "pi")), exec }, HERE);
    expect(observation).toMatchObject({ status: "observed", ready: false, agents: [{ name: "copilot", readiness: { kind: "unchecked" } }] });
    const entry = observation.status === "observed" ? observation.agents[0]?.readiness : undefined;
    expect(entry?.kind === "unchecked" ? entry.reason : "").toContain("readiness was not checked");
  });

  it("[U1672] is ready when one entry of an ordered list is ready, also when the first is not, and keeps the order", async () => {
    const { exec } = scripted(file("agent: [codex, grok, claude]\n"));
    const observation = await observeValidatorAgent({ bb: bbWith([providerState("codex", { status: "unauthenticated" }), providerState("acp-grok", { status: "not_installed" }), providerState("claude-code")]), exec }, HERE);
    expect(observation).toMatchObject({ status: "observed", ready: true });
    expect(observation.status === "observed" ? observation.agents.map((agent) => [agent.name, agent.readiness.kind]) : []).toEqual([
      ["codex", "not_ready"],
      ["grok", "not_ready"],
      ["claude", "ready"],
    ]);
  });

  it("[U1673] is not ready when no entry of an ordered list is ready", async () => {
    const { exec } = scripted(file("agent: [codex, copilot]\n"));
    const observation = await observeValidatorAgent({ bb: bbWith([providerState("codex", { status: "expired" })]), exec }, HERE);
    expect(observation).toMatchObject({ status: "observed", ready: false });
  });

  it("[U1674] lists the mapped providers that bb reports ready for auto, and is ready when the list is not empty", async () => {
    const { exec } = scripted(file("agent: auto\n"));
    const observation = await observeValidatorAgent({ bb: bbWith([providerState("claude-code"), providerState("codex", { status: "unauthenticated" }), providerState("pi"), providerState("acp-unmapped")]), exec }, HERE);
    expect(observation).toEqual({ status: "observed", source: "file", ready: true, agents: [{ name: "auto", readiness: { kind: "auto", readyProviders: ["claude-code", "pi"] } }] });
  });

  it("[U1675] is not ready for auto when no mapped provider is ready", async () => {
    const { exec } = scripted(file("log_level: info\n"));
    const observation = await observeValidatorAgent({ bb: bbWith([providerState("claude-code", { status: "unauthenticated" }), providerState("acp-unmapped")]), exec }, HERE);
    expect(observation).toMatchObject({ status: "observed", ready: false, agents: [{ name: "auto", readiness: { kind: "auto", readyProviders: [] } }] });
  });

  it("[U1676] reads a host with no configuration file (the read exits 3) as the default auto, with the source default", async () => {
    const { exec } = scripted({ code: 3, stdout: "", stderr: "" });
    const observation = await observeValidatorAgent({ bb: bbWith(READY("claude-code")), exec }, HERE);
    expect(observation).toEqual({ status: "observed", source: "default", ready: true, agents: [{ name: "auto", readiness: { kind: "auto", readyProviders: ["claude-code"] } }] });
  });

  it("[U1677] reports any other non-zero exit of the read as unobserved, with the exit code and the standard error", async () => {
    const { exec } = scripted({ code: 1, stdout: "", stderr: "cat: config.yaml: Permission denied" });
    const observation = await observeValidatorAgent({ bb: bbWith(READY("claude-code")), exec }, HERE);
    expect(observation).toMatchObject({ status: "unobserved", reason: expect.stringContaining("exited 1: cat: config.yaml: Permission denied") });
  });

  it("[U1678] reports a read that did not run as unobserved, with the reason", async () => {
    const observation = await observeValidatorAgent({ bb: bbWith(READY("claude-code")), exec: scripted({ code: null, stdout: "", stderr: "", error: "spawn sh ENOENT" }).exec }, HERE);
    expect(observation).toMatchObject({ status: "unobserved", reason: expect.stringContaining("spawn sh ENOENT") });
  });

  it("[U1678] reports a read that was killed or timed out as unobserved", async () => {
    const observation = await observeValidatorAgent({ bb: bbWith(READY("claude-code")), exec: scripted({ code: null, stdout: "", stderr: "" }).exec }, HERE);
    expect(observation).toMatchObject({ status: "unobserved", reason: expect.stringContaining("killed") });
  });

  it("[U1679] reports a setting that cannot be read as unobserved, with the parser's reason", async () => {
    const { exec } = scripted(file("agent: [codex\n"));
    const observation = await observeValidatorAgent({ bb: bbWith(READY("codex")), exec }, HERE);
    expect(observation).toMatchObject({ status: "unobserved", reason: expect.stringContaining("not closed") });
  });

  it("[U1680] reports a throwing states call as unobserved, and does not throw", async () => {
    const bb = bbWith(READY("claude-code"));
    bb.statesError = new Error("HTTP 503");
    const observation = await observeValidatorAgent({ bb, exec: scripted(file("agent: claude\n")).exec }, HERE);
    expect(observation).toMatchObject({ status: "unobserved", reason: expect.stringContaining("could not read bb's provider states (HTTP 503)") });
  });

  it("[U1680] reports a throwing exec as unobserved, and does not throw", async () => {
    const observation = await observeValidatorAgent({ bb: bbWith(READY("claude-code")), exec: async () => Promise.reject(new Error("terminal exploded")) }, HERE);
    expect(observation).toMatchObject({ status: "unobserved", reason: expect.stringContaining("terminal exploded") });
  });

  it("[U1681] runs one sh -c read with the contract's script, a 30 second bound, and the host of the call, and asks for the same host's states", async () => {
    const { exec, calls } = scripted(file("agent: claude\n"));
    const bb = bbWith(READY("claude-code"));
    await observeValidatorAgent({ bb, exec }, GPU);
    expect(calls).toEqual([{ command: "sh", args: ["-c", READ_SCRIPT], options: { host: "host_gpu", timeoutMs: 30_000 } }]);
    expect(bb.callsTo("getProviderStates")).toEqual([["host_gpu"]]);
  });

  it("[U1681] runs the read on the server, with no host, when the call names none", async () => {
    const { exec, calls } = scripted(file(""));
    const bb = bbWith(READY("claude-code"));
    await observeValidatorAgent({ bb, exec }, HERE);
    expect(calls[0]?.options).toEqual({ host: null, timeoutMs: 30_000 });
    expect(bb.callsTo("getProviderStates")).toEqual([[undefined]]);
  });

  it("[U1681] keeps the contract's script text: the NM_HOME default and the exit code for no file", () => {
    expect(READ_SCRIPT).toContain("${NM_HOME:-$HOME/.no-mistakes}/config.yaml");
    expect(READ_SCRIPT).toContain("exit 3");
  });
});

const host = "the default host";
const observed = (agents: Extract<Observation, { status: "observed" }>["agents"], ready: boolean, source: "file" | "default" = "file"): Observation => ({ status: "observed", source, agents, ready });
const claudeReady = { name: "claude", readiness: { kind: "ready", provider: "claude-code" } } as const;
const codexNot = { name: "codex", readiness: { kind: "not_ready", provider: "codex", problem: "The provider `codex` is not signed in on the default host (bb status: unauthenticated). Run `codex login` on that machine." } } as const;
const copilot = { name: "copilot", readiness: { kind: "unchecked", reason: "copilot has no known bb provider, so its readiness was not checked" } } as const;

describe("describeObservation", () => {
  it("[U1682] names a ready agent, its provider, and the host, and says it is ready", () => {
    expect(describeObservation(observed([claudeReady], true), host)).toBe("Validator agent: claude (bb provider claude-code) is ready on the default host.");
  });

  it("[U1683] says that a not-ready agent is not ready and carries bb's problem text", () => {
    expect(describeObservation(observed([codexNot], false), host)).toBe(
      "Validator agent: codex (bb provider codex) is not ready on the default host: The provider `codex` is not signed in on the default host (bb status: unauthenticated). Run `codex login` on that machine.",
    );
  });

  it("[U1684] names each agent of a list in order with its own readiness", () => {
    const text = describeObservation(observed([codexNot, claudeReady, copilot], true), "gpu-box");
    expect(text.startsWith("Validator agents, in order: codex (bb provider codex) is not ready on gpu-box: ")).toBe(true);
    expect(text.indexOf("codex")).toBeLessThan(text.indexOf("claude (bb provider claude-code) is ready on gpu-box"));
    expect(text.indexOf("claude (bb provider claude-code)")).toBeLessThan(text.indexOf("copilot has no known bb provider"));
  });

  it("[U1685] says that no-mistakes picks the first runnable agent for auto, and lists the ready providers or says there is none", () => {
    const some = describeObservation(observed([{ name: "auto", readiness: { kind: "auto", readyProviders: ["claude-code", "pi"] } }], true), host);
    expect(some).toBe("Validator agent: auto. no-mistakes picks the first runnable agent when the run starts. bb reports ready on the default host: claude-code, pi.");
    const none = describeObservation(observed([{ name: "auto", readiness: { kind: "auto", readyProviders: [] } }], false), host);
    expect(none).toBe("Validator agent: auto. no-mistakes picks the first runnable agent when the run starts. bb reports no ready provider that no-mistakes can use on the default host.");
  });

  it("[U1686] says that the default applies, after the Validator agent prefix, when the host has no file", () => {
    const text = describeObservation(observed([{ name: "auto", readiness: { kind: "auto", readyProviders: ["claude-code"] } }], true, "default"), host);
    expect(text.startsWith("Validator agent: auto (the host has no no-mistakes configuration file, so the default applies). no-mistakes picks the first runnable agent")).toBe(true);
  });

  it("[U1687] says that the readiness of an agent with no known provider was not checked", () => {
    expect(describeObservation(observed([copilot], false), host)).toBe("Validator agent: copilot has no known bb provider, so its readiness was not checked.");
  });

  it("[U1688] says that an unobserved agent could not be observed, gives the reason, and says readiness is not known", () => {
    expect(describeObservation({ status: "unobserved", reason: "the read exited 1: Permission denied" }, "gpu-box")).toBe(
      "Validator agent: could not be observed on gpu-box (the read exited 1: Permission denied), so its readiness is not known.",
    );
  });

  const CODEX_PROBLEM = "The provider `codex` is not signed in on the default host (bb status: unauthenticated). Run `codex login` on that machine.";
  const autoNone: ObservedAgent = { name: "auto", readiness: { kind: "auto", readyProviders: [] } };
  const autoPi: ObservedAgent = { name: "auto", readiness: { kind: "auto", readyProviders: ["pi"] } };

  it.each([
    ["a single agent that is not ready", observed([codexNot], false), `codex (bb provider codex) is not ready on the default host: ${CODEX_PROBLEM}`],
    ["a single agent with no known provider", observed([copilot], false), "copilot has no known bb provider, so its readiness was not checked."],
    ["a list in which no entry is ready", observed([copilot, codexNot], false), `copilot has no known bb provider, so its readiness was not checked; codex (bb provider codex) is not ready on the default host: ${CODEX_PROBLEM}`],
    ["auto with no ready provider", observed([autoNone], false), "auto. no-mistakes picks the first runnable agent when the run starts. bb reports no ready provider that no-mistakes can use on the default host."],
    ["an unobserved result", { status: "unobserved", reason: "the read timed out" } as Observation, "could not be observed on the default host (the read timed out), so its readiness is not known."],
  ])("[U1689] gives the problem text for %s, and its line never says the agent is ready", (_name, observation, problem) => {
    expect(validatorProblem(observation, host)).toBe(problem);
    expect(describeObservation(observation, host)).not.toMatch(/\bis ready\b/);
  });

  it.each([
    ["a single ready agent", observed([claudeReady], true)],
    ["a list in which one entry is ready and another has no known provider", observed([copilot, claudeReady], true)],
    ["auto with a ready provider", observed([autoPi], true)],
  ])("[U1689] gives no problem for %s", (_name, observation) => {
    expect(validatorProblem(observation, host)).toBeNull();
  });
});
