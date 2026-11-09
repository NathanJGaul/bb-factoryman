import { makePluginAgentConfigurationContext } from "@get-bb/plugin-sdk/testing";
import { afterEach, describe, expect, it } from "vitest";
import { startedThreadId } from "../../tools/conformance/readers.ts";
import { makeCheckout, removeCheckouts } from "../fixtures/checkout";
import { loadWorld, modelFixture, providerFixture, stateFixture, type World } from "../fixtures/plugin-host";

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

  /** A world whose file has a Claude profile `deep` and a Pi profile `pi`, and whose bb lists the Pi model that the Pi profile names. */
  const piWorld = (extra: Record<string, unknown> = {}) =>
    bare(dispatch(extra), {
      providers: [providerFixture("claude"), providerFixture("pi", { capabilities: { permissionModes: ["full"] }, reasoningLevels: [{ id: "medium", label: "medium" }] })],
      models: { pi: { models: [modelFixture("openai/gpt-6-luna", { isDefault: true, defaultReasoningEffort: "medium", supportedReasoningEfforts: [{ reasoningEffort: "medium", description: "" }] })] } },
    });

  /** The command refused: exit 1, the reason, and nothing spawned, no task, and no event recorded. */
  async function expectRefused(world: World, flags: string[], reason: string, label: string) {
    const result = await start(world, ...flags);
    expect(result.exitCode, label).toBe(1);
    expect(result.stderr, label).toContain(reason);
    expect(world.sdkCalls("threads.spawn"), label).toEqual([]);
    expect(world.store.listTasks(), label).toEqual([]);
    expect(world.store.listEvents(), label).toEqual([]);
    return result;
  }

  it("[A1604] refuses a provider that is not ready with dispatch's reason, and says that nothing was spawned", async () => {
    const world = await bare(dispatch(), { providerStates: [stateFixture("claude", { status: "unauthenticated", localLoginCommand: "claude login" }), stateFixture("pi")] });
    const result = await expectRefused(world, ["--profile", "deep"], "not signed in", "not ready");
    expect(result.stderr).toContain("Nothing was spawned.");
  });

  it("[A1604] refuses a permission mode that the provider lacks", async () => {
    const world = await bare(dispatch({ profiles: { deep: { ...CLAUDE, permissionMode: "full" } } }), { providers: [providerFixture("claude", { capabilities: { permissionModes: ["accept-edits"] } })] });
    await expectRefused(world, ["--profile", "deep"], "does not offer the permission mode `full`", "mode");
  });

  it("[A1604] refuses a reasoning level that the model does not list", async () => {
    const world = await bare(dispatch({ profiles: { deep: { ...CLAUDE, reasoningLevel: "ultra" } } }));
    await expectRefused(world, ["--profile", "deep"], "does not list the reasoning level `ultra`", "level");
  });

  it("[A1604] spawns a Pi profile in a local-only project, because the worker admission rule is not applied", async () => {
    const world = await piWorld();
    world.setProject({ deliveryMode: "local-only" });
    const result = await start(world, "--profile", "pi");
    expect(result.exitCode).toBe(0);
    expect(world.sdkCalls("threads.spawn")).toHaveLength(1);
  });

  it("[A1621] spawns the profile that roles.supervisor.profile names when there is no --profile", async () => {
    const world = await piWorld({ roles: { supervisor: { profile: "pi" } } });
    const result = await start(world);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.split("\n")[0]).toBe("Started factoryman supervisor thread thr-w1 with the profile pi (pi, openai/gpt-6-luna).");
    expect(spawnArgs(world)).toHaveLength(1);
    expect(spawnArgs(world)[0]?.[0]).toMatchObject({ providerId: "pi", model: "openai/gpt-6-luna", reasoningLevel: "medium", permissionMode: "full" });
  });

  it("[A1622] gives the real command's output to the lab's reader, which finds the thread that the command spawned", async () => {
    const world = await bare(dispatch());
    const started = await start(world, "--profile", "deep");
    const supervisors = [...world.metadata].filter(([, metadata]) => (metadata as { role?: string }).role === "supervisor").map(([id]) => id);
    expect(supervisors).toHaveLength(1);
    expect(startedThreadId(started.stdout)).toBe(supervisors[0]);
    const refused = await start(world, "--profile", "ghost");
    expect(refused.exitCode).toBe(1);
    expect(startedThreadId(`${refused.stdout}${refused.stderr}`)).toBeNull();
  });

  it("[A1605] lets --profile win over roles.supervisor.profile", async () => {
    const world = await piWorld({ roles: { supervisor: { profile: "pi" } } });
    expect((await start(world, "--profile", "deep")).exitCode).toBe(0);
    expect(spawnArgs(world)).toHaveLength(1);
    expect(spawnArgs(world)[0]?.[0]).toMatchObject({ providerId: "claude" });
  });

  it("[A1605] refuses when neither the flag nor the file names a profile, and names both remedies", async () => {
    const world = await bare(dispatch());
    const result = await expectRefused(world, [], "No supervisor profile is set for project proj-1.", "no profile");
    expect(result.stderr).toContain("roles.supervisor.profile");
    expect(result.stderr).toContain("--profile <name>");
  });

  it("[A1605] refuses an undefined profile and lists the defined ones", async () => {
    const world = await bare(dispatch());
    await expectRefused(world, ["--profile", "ghost"], 'The supervisor profile "ghost" is not defined in dispatch.json. Defined profiles: deep, pi.', "undefined");
  });

  it("[A1605] refuses an invalid dispatch.json, and a project with no file", async () => {
    await expectRefused(await bare("{ nope"), ["--profile", "deep"], "Cannot start a supervisor: dispatch.json is not valid JSON", "invalid");
    await expectRefused(await loadWorld({ bareConfig: true, checkout: makeCheckout() }), ["--profile", "deep"], "Defined profiles: none.", "no file");
  });
});
