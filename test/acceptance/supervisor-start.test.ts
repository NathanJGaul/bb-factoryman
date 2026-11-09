import { makePluginAgentConfigurationContext } from "@get-bb/plugin-sdk/testing";
import { afterEach, describe, expect, it } from "vitest";
import { makeCheckout, removeCheckouts } from "../fixtures/checkout";
import { loadWorld, stateFixture, type World } from "../fixtures/plugin-host";

afterEach(removeCheckouts);

const CLAUDE = { provider: "claude", model: "opus", reasoningLevel: "high", permissionMode: "auto" };
const PI = { provider: "pi", model: "openai/gpt-6-luna", reasoningLevel: "medium", permissionMode: "full" };
const dispatch = (extra: Record<string, unknown> = {}) => ({ version: 1, profiles: { deep: CLAUDE, pi: PI }, default: "deep", rules: [], ...extra });
const DEFAULT_PROMPT = "You are the factoryman supervisor. Wait for instructions.";

const bare = (config: unknown, extra: Parameters<typeof loadWorld>[0] = {}) => loadWorld({ bareConfig: true, checkout: makeCheckout({ dispatch: config }), ...extra });

async function cli(world: World, argv: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const result = await world.host.harness.behavior.runCli(argv);
  return { exitCode: result.exitCode, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}
const start = (world: World, ...flags: string[]) => cli(world, ["supervisor", "start", "--project", "proj-1", ...flags]);
const spawnArgs = (world: World) => world.sdkCalls("threads.spawn") as Array<[Record<string, unknown>]>;

describe("bb factoryman supervisor start through the plugin factory", () => {
  it("[A1601] spawns one thread with the profile's fields and the role in the spawn call, and prints the thread ID", async () => {
    const world = await bare(dispatch());
    const result = await start(world, "--profile", "deep");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.split("\n")[0]).toBe("Started factoryman supervisor thread thr-w1 with the profile deep (claude, opus).");
    expect(spawnArgs(world)).toHaveLength(1);
    const [args] = spawnArgs(world)[0] as [Record<string, unknown>];
    expect(args).toMatchObject({ projectId: "proj-1", providerId: "claude", model: "opus", reasoningLevel: "high", permissionMode: "auto", pluginMetadata: { role: "supervisor" } });
    expect(args).not.toHaveProperty("parentThreadId");
    expect(world.metadata.get("thr-w1")).toEqual({ role: "supervisor" });
  });

  it("[A1602] offers the thread the four supervisor tools and the supervisor skill on its first turn, and no worker tool or skill", async () => {
    const world = await bare(dispatch());
    await start(world, "--profile", "deep");
    const selected = await world.host.harness.behavior.resolveAgentConfiguration(
      makePluginAgentConfigurationContext({ pluginMetadata: world.metadata.get("thr-w1") as never, provider: { id: "claude" } }),
    );
    expect(selected.tools.map((tool) => tool.name).sort()).toEqual(["factoryman_dispatch", "factoryman_merge", "factoryman_status", "factoryman_teardown"]);
    expect(selected.skills).toEqual(["factoryman-supervisor"]);
  });

  it("[A1603] sends the --prompt text as the first prompt, and the fixed default when there is none", async () => {
    const world = await bare(dispatch());
    await start(world, "--profile", "deep", "--prompt", "Watch the repo and wait.");
    await start(world, "--profile", "deep");
    expect(spawnArgs(world).map(([args]) => args["prompt"])).toEqual(["Watch the repo and wait.", DEFAULT_PROMPT]);
  });

  it("[A1604] refuses a provider that is not ready, a mode the provider lacks, and a level the model does not list, with dispatch's reason and no event or row, and spawns Pi in a local-only project", async () => {
    const notReady = await bare(dispatch(), { providerStates: [stateFixture("claude", { status: "unauthenticated", localLoginCommand: "claude login" }), stateFixture("pi")] });
    const refusedState = await start(notReady, "--profile", "deep");
    expect(refusedState.exitCode).toBe(1);
    expect(refusedState.stderr).toContain("not signed in");
    expect(refusedState.stderr).toContain("Nothing was spawned.");

    const noMode = await bare(dispatch({ profiles: { deep: { ...CLAUDE, permissionMode: "full" } } }), { providers: [{ id: "claude", available: true, capabilities: { permissionModes: ["accept-edits"] }, reasoningLevels: [] }] });
    expect((await start(noMode, "--profile", "deep")).stderr).toContain("does not offer the permission mode `full`");

    const noLevel = await bare(dispatch({ profiles: { deep: { ...CLAUDE, reasoningLevel: "ultra" } } }));
    expect((await start(noLevel, "--profile", "deep")).stderr).toContain("does not list the reasoning level `ultra`");

    for (const world of [notReady, noMode, noLevel]) {
      expect(world.sdkCalls("threads.spawn")).toEqual([]);
      expect(world.store.listTasks()).toEqual([]);
    }

    const pi = await bare(dispatch(), { providers: [{ id: "pi", available: true, capabilities: { permissionModes: ["full"] }, reasoningLevels: [{ id: "medium", label: "medium" }] }] });
    pi.setProject({ deliveryMode: "local-only" });
    pi.setModels("pi", { models: [{ id: "openai/gpt-6-luna", model: "openai/gpt-6-luna", displayName: "x", description: "", isDefault: true, defaultReasoningEffort: "medium", reasoningDiscovery: "known", supportedReasoningEfforts: [{ reasoningEffort: "medium", description: "" }] }] });
    expect((await start(pi, "--profile", "pi")).exitCode).toBe(0);
    expect(pi.sdkCalls("threads.spawn")).toHaveLength(1);
  });

  it("[A1605] takes the profile from the flag, then from roles.supervisor.profile, and refuses every missing, undefined, or broken case", async () => {
    const world = await bare(dispatch({ roles: { supervisor: { profile: "pi" } } }), { providers: [{ id: "claude", available: true, capabilities: { permissionModes: ["accept-edits", "auto", "full"] }, reasoningLevels: [] }, { id: "pi", available: true, capabilities: { permissionModes: ["full"] }, reasoningLevels: [] }] });
    expect((await start(world, "--profile", "deep")).exitCode).toBe(0);
    expect(spawnArgs(world)[0]?.[0]).toMatchObject({ providerId: "claude" });

    const noRole = await bare(dispatch());
    const none = await start(noRole);
    expect(none.exitCode).toBe(1);
    expect(none.stderr).toContain("No supervisor profile is set for project proj-1.");
    expect(none.stderr).toContain("roles.supervisor.profile");
    const ghost = await start(noRole, "--profile", "ghost");
    expect(ghost.stderr).toContain('The supervisor profile "ghost" is not defined in dispatch.json. Defined profiles: deep, pi.');

    const invalid = await bare("{ nope");
    expect((await start(invalid, "--profile", "deep")).stderr).toContain("Cannot start a supervisor: dispatch.json is not valid JSON");
    const bareProject = await loadWorld({ bareConfig: true, checkout: makeCheckout() });
    expect((await start(bareProject, "--profile", "deep")).stderr).toContain("Defined profiles: none.");
    for (const refused of [noRole, invalid, bareProject]) expect(refused.sdkCalls("threads.spawn")).toEqual([]);
  });
});
