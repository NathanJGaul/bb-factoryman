import { afterEach, describe, expect, it } from "vitest";
import { makeCheckout, removeCheckouts } from "../fixtures/checkout";
import { loadWorld, modelFixture, providerFixture, type World } from "../fixtures/plugin-host";

afterEach(removeCheckouts);

const TASK = { kind: "ship", description: "Add a --json flag to the status command." } as const;
const levels = (...ids: string[]) => ids.map((reasoningEffort) => ({ reasoningEffort, description: "" }));
const coarse = (...ids: string[]) => ids.map((id) => ({ id, label: id }));
const dispatch = (world: World, profile: Record<string, string>) => world.call("factoryman_dispatch", { ...TASK, profile });

const OMP = { provider: "acp-omp", model: "openai/gpt-6-luna", reasoningLevel: "off", permissionMode: "accept-edits" };
const ompProviders = [providerFixture("acp-omp", { capabilities: { permissionModes: ["accept-edits", "full"] }, reasoningLevels: coarse("low", "medium", "high", "xhigh", "max") })];
const ompModels = (supported: string[], extra: Record<string, unknown> = {}) => ({ "acp-omp": { models: [modelFixture(OMP.model, { supportedReasoningEfforts: levels(...supported), ...extra })] } });

describe("model-aware checks through the plugin factory", () => {
  it("[A1330] dispatches a profile on omp with level off when the model lists off and the provider-wide list does not", async () => {
    const world = await loadWorld({ providers: ompProviders, models: ompModels(["off", "low", "medium"]) });
    const result = await dispatch(world, OMP);
    expect(result.isError, result.text).toBe(false);
    const [[spawn]] = world.sdkCalls("threads.spawn") as [[Record<string, unknown>]];
    expect(spawn).toMatchObject({ providerId: "acp-omp", reasoningLevel: "off" });
  });

  it("[A1331] refuses a level that the named model does not list, and names the model and its levels", async () => {
    const world = await loadWorld({ providers: ompProviders, models: ompModels(["off", "low", "medium"]) });
    const result = await dispatch(world, { ...OMP, reasoningLevel: "high" });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("The model `openai/gpt-6-luna` of the provider `acp-omp` does not list the reasoning level `high`. It lists: off, low, medium.");
    expect(world.store.listTasks()).toEqual([]);
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
  });

  it("[A1332] refuses an unlisted model on Pi with the models bb offers, or with no models and the load error", async () => {
    const pi = { provider: "pi", model: "openai/gpt-6-luna", reasoningLevel: "medium", permissionMode: "full" };
    const providers = [providerFixture("pi", { capabilities: { permissionModes: ["full"] }, reasoningLevels: coarse("low", "medium", "high") })];
    const listed = await loadWorld({ providers, models: { pi: { models: [modelFixture("openai/gpt-6-sol"), modelFixture("openai/gpt-6-terra")] } } });
    const choices = await dispatch(listed, pi);
    expect(choices.isError).toBe(true);
    expect(choices.text).toContain("The model `openai/gpt-6-luna` is not listed for the provider `pi` on the default host. It lists: openai/gpt-6-sol, openai/gpt-6-terra.");
    expect(listed.sdkCalls("threads.spawn")).toEqual([]);

    const none = await loadWorld({ providers, models: { pi: { models: [], modelLoadError: { code: "auth_required", detail: "Run pi login", providerId: "pi" } } } });
    const text = (await dispatch(none, pi)).text;
    expect(text).toContain("It lists: no models.");
    expect(text).toContain("bb could not load the models (auth_required: Run pi login).");
    expect(none.store.listTasks()).toEqual([]);
  });

  it("[A1333] judges an unlisted model on claude-code and on codex by the provider-wide level list", async () => {
    const providers = [
      providerFixture("claude-code", { reasoningLevels: coarse("low", "medium", "high", "max") }),
      providerFixture("codex", { reasoningLevels: coarse("low", "medium", "high", "ultra") }),
    ];
    const models = { "claude-code": { models: [modelFixture("opus")] }, codex: { models: [modelFixture("gpt-6-luna")] } };
    const world = await loadWorld({ providers, models });
    for (const [provider, level] of [["claude-code", "max"], ["codex", "ultra"]] as const) {
      const result = await dispatch(world, { provider, model: "an-unlisted-alias", reasoningLevel: level, permissionMode: "accept-edits" });
      expect(result.isError, `${provider}: ${result.text}`).toBe(false);
    }
    const off = await dispatch(world, { provider: "claude-code", model: "an-unlisted-alias", reasoningLevel: "ultra", permissionMode: "accept-edits" });
    expect(off.isError).toBe(true);
    expect(off.text).toContain("The provider `claude-code` does not list the reasoning level `ultra`. It lists: low, medium, high, max.");
  });

  it("[A1334] judges a model whose levels are unknown by the provider-wide level list", async () => {
    const world = await loadWorld({ providers: ompProviders, models: ompModels(["off"], { reasoningDiscovery: "unknown" }) });
    const refused = await dispatch(world, OMP);
    expect(refused.isError).toBe(true);
    expect(refused.text).toContain("The provider `acp-omp` does not list the reasoning level `off`. It lists: low, medium, high, xhigh, max.");
    expect((await dispatch(world, { ...OMP, reasoningLevel: "high" })).isError).toBe(false);
  });

  const CODEX = { provider: "codex", model: "gpt-6-luna", reasoningLevel: "high", permissionMode: "auto" };
  const codexWorld = (reasoningLevels: unknown) =>
    loadWorld({
      checkout: makeCheckout({ dispatch: { version: 1, profiles: { base: CODEX }, default: "base", rules: [], reasoningLevels } }),
      providers: [providerFixture("codex", { reasoningLevels: coarse("none", "low", "medium", "high", "xhigh", "max", "ultra") })],
      models: { codex: { models: [modelFixture("gpt-6-luna", { supportedReasoningEfforts: levels("none", "low", "medium", "high", "xhigh", "max", "ultra") })] } },
    });
  const CODEX_LADDER = ["none", "low", "medium", "high", "xhigh", "max", "ultra"];

  it("[A1335] keeps the array form of reasoningLevels as before: a lowered level blocks, an equal or higher one passes", async () => {
    const world = await codexWorld(["none", "low", "medium", "high", "xhigh", "max"]);
    const lowered = await dispatch(world, { ...CODEX, reasoningLevel: "low" });
    expect(lowered.isError).toBe(true);
    expect(lowered.text).toContain("reasoning_lowered");
    expect((await dispatch(world, { ...CODEX, reasoningLevel: "max" })).isError).toBe(false);
  });

  it("[A1336] ranks Codex ultra in a Codex ladder: ultra clears against a baseline at high, and a lowered level blocks with reasoning_lowered", async () => {
    const world = await codexWorld({ codex: CODEX_LADDER });
    expect((await dispatch(world, { ...CODEX, reasoningLevel: "ultra" })).isError).toBe(false);
    const lowered = await dispatch(world, { ...CODEX, reasoningLevel: "low" });
    expect(lowered.isError).toBe(true);
    expect(lowered.text).toContain("reasoning_lowered");
    expect(lowered.text).toContain("is below");
    expect(lowered.text).not.toContain("cannot be ranked");
  });

  it("[A1337] ranks a provider that the record omits in the default ladder", async () => {
    const world = await codexWorld({ "claude-code": ["low", "ultracode"] });
    const lowered = await dispatch(world, { ...CODEX, reasoningLevel: "low" });
    expect(lowered.isError).toBe(true);
    expect(lowered.text).toContain("is below");
    // ultra is off the default ladder, so a record that omits Codex cannot rank it.
    const offLadder = await dispatch(world, { ...CODEX, reasoningLevel: "ultra" });
    expect(offLadder.text).toContain("cannot be ranked");
  });

  it("[A1338] blocks the dispatch and creates no task when bb cannot answer the model list", async () => {
    const world = await loadWorld({ modelsError: new Error("HTTP 503") });
    const result = await dispatch(world, { provider: "claude", model: "opus", reasoningLevel: "high", permissionMode: "accept-edits" });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("Dispatch failed: could not read bb's models (HTTP 503). No task was created.");
    expect(world.store.listTasks()).toEqual([]);
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
  });

  it("[A1350] keeps a queued task queued while bb does not list its model, and starts it once bb lists it", async () => {
    const world = await loadWorld({ checkout: makeCheckout({ workflow: { version: 1, limits: { maxWorkers: 1 } } }) });
    const profile = { provider: "claude", model: "opus", reasoningLevel: "high", permissionMode: "accept-edits" };
    expect((await dispatch(world, profile)).isError).toBe(false);
    expect((await dispatch(world, profile)).text).toMatch(/Task t2 is queued/);
    world.setModels("claude", { models: [modelFixture("something-else")] });
    await world.call("factoryman_report", { outcome: "failed", evidence: "Gave up." }, { threadId: "thr-w1" });
    expect(world.store.getTask("t2")?.state).toBe("queued");
    expect(world.sdkCalls("threads.spawn")).toHaveLength(1);
    world.setModels("claude");
    await world.runStartup();
    expect(world.store.getTask("t2")?.state).toBe("working");
  });
});
