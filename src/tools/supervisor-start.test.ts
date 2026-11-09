import { describe, expect, it } from "vitest";
import { modelEntry, providerState } from "../../test/fixtures/bb-port";
import { testRuntime, type TestRuntime } from "../../test/fixtures/runtime";
import { defaultProjectConfig } from "../store/store";
import { runSupervisorStart, START_USAGE } from "./supervisor-start";

const CHECKOUT = "/work/repo";
const FILE = `${CHECKOUT}/.bb/factoryman/dispatch.json`;
const CLAUDE = { provider: "claude", model: "opus", reasoningLevel: "high", permissionMode: "auto" };
const CODEX = { provider: "claude-code", model: "sonnet", reasoningLevel: "medium", permissionMode: "accept-edits" };
const DEFAULT_PROMPT = "You are the factoryman supervisor. Wait for instructions.";

type Config = Record<string, unknown>;
const file = (extra: Config = {}): Config => ({ version: 1, profiles: { claude: CLAUDE, codex: CODEX }, default: "claude", rules: [], ...extra });

/** A runtime whose project `proj-1` has a checkout with the given `dispatch.json` text (or none). */
function runtimeWith(config: Config | string | null = file()): TestRuntime {
  const t = testRuntime();
  t.bb.checkouts.set("proj-1", CHECKOUT);
  if (config !== null) t.files.files.set(FILE, typeof config === "string" ? config : JSON.stringify(config));
  return t;
}
const start = (t: TestRuntime, ...args: string[]) => runSupervisorStart(t.runtime, args);
const spawns = (t: TestRuntime) => t.bb.callsTo("spawnSupervisor");

describe("bb factoryman supervisor start", () => {
  it("[U1623] spawns once with the profile's four fields and the metadata role supervisor, and prints the thread, the profile, the provider, and the model", async () => {
    const t = runtimeWith();
    const result = await start(t, "--project", "proj-1", "--profile", "claude");
    expect(result.exitCode).toBe(0);
    expect(spawns(t)).toHaveLength(1);
    expect(spawns(t)[0]?.[0]).toMatchObject({ projectId: "proj-1", profile: CLAUDE, metadata: { role: "supervisor" }, baseBranch: null });
    expect(result.stdout?.split("\n")[0]).toBe("Started factoryman supervisor thread thr-s1 with the profile claude (claude, opus).");
    expect(result.stdout).toContain("from its first turn");
  });

  it("[U1624] sends the --prompt text as the first prompt", async () => {
    const t = runtimeWith();
    await start(t, "--project", "proj-1", "--profile", "claude", "--prompt", "Watch the repo and wait.");
    expect(spawns(t)[0]?.[0]).toMatchObject({ prompt: "Watch the repo and wait." });
  });

  it("[U1625] sends the fixed text that tells the supervisor to wait when there is no --prompt", async () => {
    const t = runtimeWith();
    await start(t, "--project", "proj-1", "--profile", "claude");
    expect(spawns(t)[0]?.[0]).toMatchObject({ prompt: DEFAULT_PROMPT });
  });

  it("[U1626] uses roles.supervisor.profile when --profile is absent", async () => {
    const t = runtimeWith(file({ roles: { supervisor: { profile: "codex" } } }));
    const result = await start(t, "--project", "proj-1");
    expect(result.exitCode).toBe(0);
    expect(spawns(t)[0]?.[0]).toMatchObject({ profile: CODEX });
    expect(result.stdout).toContain("with the profile codex (claude-code, sonnet)");
  });

  it("[U1627] lets --profile win over roles.supervisor.profile", async () => {
    const t = runtimeWith(file({ roles: { supervisor: { profile: "codex" } } }));
    await start(t, "--project", "proj-1", "--profile", "claude");
    expect(spawns(t)[0]?.[0]).toMatchObject({ profile: CLAUDE });
  });

  it("[U1628] refuses with both remedies and without using the default profile when neither names a profile, and spawns nothing", async () => {
    const t = runtimeWith(file({ default: "claude" }));
    const result = await start(t, "--project", "proj-1");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("No supervisor profile is set for project proj-1.");
    expect(result.stderr).toContain("--profile <name>");
    expect(result.stderr).toContain("roles.supervisor.profile");
    expect(result.stderr).toContain('The profile "default" is the worker\'s and is not used.');
    expect(result.stderr).toContain("Defined profiles: claude, codex.");
    expect(result.stderr).toContain("Nothing was spawned.");
    expect(spawns(t)).toEqual([]);
  });

  it("[U1629] refuses an undefined profile name, lists the defined profiles, and spawns nothing", async () => {
    const t = runtimeWith();
    const result = await start(t, "--project", "proj-1", "--profile", "ghost");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('The supervisor profile "ghost" is not defined in dispatch.json. Defined profiles: claude, codex.');
    expect(result.stderr).toContain("Nothing was spawned.");
    expect(spawns(t)).toEqual([]);
    const inherited = await start(t, "--project", "proj-1", "--profile", "constructor");
    expect(inherited.stderr).toContain('"constructor" is not defined');
    expect(spawns(t)).toEqual([]);
  });

  it("[U1630] takes the project from --project, falls back to the command context, and lets --project win", async () => {
    const t = runtimeWith();
    t.bb.checkouts.set("proj-ctx", CHECKOUT);
    await runSupervisorStart(t.runtime, ["--profile", "claude"], { projectId: "proj-ctx" });
    expect(t.bb.callsTo("getProjectCheckout")).toEqual([["proj-ctx"]]);
    expect(spawns(t)[0]?.[0]).toMatchObject({ projectId: "proj-ctx" });
    await runSupervisorStart(t.runtime, ["--project", "proj-1", "--profile", "claude"], { projectId: "proj-ctx" });
    expect(t.bb.callsTo("getProjectCheckout").at(-1)).toEqual(["proj-1"]);
    expect(spawns(t)[1]?.[0]).toMatchObject({ projectId: "proj-1" });
  });

  it("[U1631] refuses an invalid dispatch.json with the loader's message and spawns nothing", async () => {
    const t = runtimeWith("{ nope");
    const result = await start(t, "--project", "proj-1", "--profile", "claude");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Cannot start a supervisor: dispatch.json is not valid JSON");
    expect(result.stderr).toContain("Nothing was spawned.");
    expect(spawns(t)).toEqual([]);
  });

  it("[U1632] refuses an unreadable dispatch.json with the reason and spawns nothing", async () => {
    const t = runtimeWith();
    t.files.errors.set(FILE, new Error("EACCES: permission denied"));
    const result = await start(t, "--project", "proj-1", "--profile", "claude");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Cannot start a supervisor: could not read dispatch.json: EACCES");
    expect(spawns(t)).toEqual([]);
  });

  it("[U1633] refuses a missing dispatch.json and a project with no checkout as having no defined profile, and spawns nothing", async () => {
    const missing = runtimeWith(null);
    const noFile = await start(missing, "--project", "proj-1", "--profile", "claude");
    expect(noFile.exitCode).toBe(1);
    expect(noFile.stderr).toContain('The supervisor profile "claude" is not defined in dispatch.json. Defined profiles: none.');
    const noCheckout = testRuntime();
    const result = await start(noCheckout, "--project", "proj-1");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("No supervisor profile is set for project proj-1.");
    expect(result.stderr).toContain("Defined profiles: none.");
    expect([...spawns(missing), ...spawns(noCheckout)]).toEqual([]);
  });

  it("[U1634] refuses with the reason when the checkout read throws, and spawns nothing", async () => {
    const t = runtimeWith();
    t.bb.checkoutError = new Error("HTTP 500");
    const result = await start(t, "--project", "proj-1", "--profile", "claude");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Cannot start a supervisor: could not read the project (HTTP 500).");
    expect(result.stderr).toContain("Nothing was spawned.");
    expect(spawns(t)).toEqual([]);
  });

  it("[U1635] refuses a provider that is not ready with the gate's message, and says nothing was spawned", async () => {
    const t = runtimeWith();
    t.bb.states = [providerState("claude", { status: "unauthenticated", localLoginCommand: "claude login" })];
    const result = await start(t, "--project", "proj-1", "--profile", "claude");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Cannot start a supervisor: The provider `claude` is not signed in on the default host");
    expect(result.stderr).toContain("Run `claude login`");
    expect(result.stderr).toContain("Nothing was spawned.");
    expect(spawns(t)).toEqual([]);
  });

  it("[U1636] refuses a permission mode the provider lacks, and a model or level the provider does not list, with the gate's message", async () => {
    const mode = runtimeWith();
    mode.bb.providers = [{ id: "claude", available: true, permissionModes: ["accept-edits"], reasoningLevels: ["low", "high"] }];
    expect((await start(mode, "--project", "proj-1", "--profile", "claude")).stderr).toContain("does not offer the permission mode `auto`");
    const level = runtimeWith();
    level.bb.models.set("claude", { models: [modelEntry("opus", { reasoningLevels: ["low"] })], loadError: null });
    expect((await start(level, "--project", "proj-1", "--profile", "claude")).stderr).toContain("does not list the reasoning level `high`");
    expect([...spawns(mode), ...spawns(level)]).toEqual([]);
  });

  it("[U1637] refuses and spawns nothing when a gate read throws", async () => {
    const t = runtimeWith();
    t.bb.statesError = new Error("HTTP 404");
    const result = await start(t, "--project", "proj-1", "--profile", "claude");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("could not read bb's provider states (HTTP 404)");
    expect(spawns(t)).toEqual([]);
  });

  it("[U1638] spawns a Pi profile in a local-only project, because the admission rule is not applied", async () => {
    const pi = { provider: "pi", model: "openai/gpt-6-luna", reasoningLevel: "medium", permissionMode: "full" };
    const t = runtimeWith(file({ profiles: { pi }, default: "pi" }));
    t.runtime.deps.store.putProjectConfig({ ...defaultProjectConfig("proj-1"), deliveryMode: "local-only" });
    t.bb.providers = [{ id: "pi", available: true, permissionModes: ["full"], reasoningLevels: ["low", "medium", "high"] }];
    t.bb.models.set("pi", { models: [modelEntry("openai/gpt-6-luna", { reasoningLevels: ["low", "medium", "high"] })], loadError: null });
    const result = await start(t, "--project", "proj-1", "--profile", "pi");
    expect(result.exitCode).toBe(0);
    expect(spawns(t)[0]?.[0]).toMatchObject({ profile: pi });
  });

  it("[U1639] reads the default host in the gate, and runs the gate before the spawn", async () => {
    const t = runtimeWith();
    await start(t, "--project", "proj-1", "--profile", "claude");
    expect(t.bb.callsTo("listProviders")).toEqual([[undefined]]);
    expect(t.bb.callsTo("getProviderStates")).toEqual([[undefined]]);
    const order = t.bb.calls.map((call) => call.method);
    expect(order.indexOf("getProviderStates")).toBeLessThan(order.indexOf("spawnSupervisor"));
  });

  it("[U1640] exits 1 with bb's reason when the spawn throws, and records nothing", async () => {
    const t = runtimeWith();
    t.bb.spawnError = new Error("HTTP 409: No project source configured for this host");
    const result = await start(t, "--project", "proj-1", "--profile", "claude");
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Could not start the supervisor: HTTP 409: No project source configured for this host");
    expect(result.stderr).not.toContain("Nothing was spawned.");
    expect(t.runtime.deps.store.listTasks()).toEqual([]);
    expect(t.bb.callsTo("setThreadMetadata")).toEqual([]);
  });

  it.each([
    ["no project", ["--profile", "claude"]],
    ["a repeated flag", ["--project", "proj-1", "--profile", "claude", "--profile", "codex"]],
    ["a flag without a value", ["--project", "proj-1", "--profile"]],
    ["a blank value", ["--project", "proj-1", "--profile", "  "]],
    ["an unknown flag", ["--project", "proj-1", "--profile", "claude", "--bogus", "x"]],
    ["an extra positional", ["--project", "proj-1", "--profile", "claude", "extra"]],
  ])("[U1641] exits 2 with the usage text and spawns nothing for %s", async (_name, args) => {
    const t = runtimeWith();
    const result = await start(t, ...args);
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toBe(START_USAGE);
    expect(spawns(t)).toEqual([]);
    expect(t.bb.callsTo("getProjectCheckout")).toEqual([]);
  });
});
