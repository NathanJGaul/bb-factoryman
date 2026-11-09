import { afterEach, describe, expect, it } from "vitest";
import type { DispatchResolver } from "../../src/dispatch/types";
import { makeCheckout, removeCheckouts } from "../fixtures/checkout";
import { loadWorld, modelFixture, providerFixture, stateFixture } from "../fixtures/plugin-host";

afterEach(removeCheckouts);

const PROFILES = {
  deep: { provider: "claude", model: "opus", reasoningLevel: "xhigh", permissionMode: "auto" },
  steady: { provider: "claude", model: "sonnet", reasoningLevel: "high", permissionMode: "auto" },
  fast: { provider: "claude", model: "haiku", reasoningLevel: "low", permissionMode: "accept-edits" },
};

const config = (extra: Record<string, unknown> = {}) => ({
  version: 1,
  profiles: PROFILES,
  rules: [
    { id: "scouting", when: { kind: "scout" }, profile: "fast" },
    { id: "refactor", when: { kind: "ship", keywords: ["refactor"] }, profile: "deep" },
  ],
  ...extra,
});

const TASK = { kind: "ship", description: "Add a --json flag to the status command." } as const;
const EXPLICIT = { provider: "claude", model: "opus", reasoningLevel: "max", permissionMode: "auto" } as const;

async function dispatchWith(dispatch: unknown, args: Record<string, unknown>, options: Parameters<typeof loadWorld>[0] = {}) {
  const world = await loadWorld({ checkout: makeCheckout({ dispatch }), ...options });
  const result = await world.call("factoryman_dispatch", args);
  return { world, result };
}

function spawned(world: Awaited<ReturnType<typeof loadWorld>>): Record<string, unknown> {
  const [[spawn]] = world.sdkCalls("threads.spawn") as [[Record<string, unknown>]];
  return spawn;
}

describe("dispatch profile resolution through the plugin factory", () => {
  it("[A701] spawns the worker with exactly the explicit profile, whatever the rules and default say", async () => {
    const { world, result } = await dispatchWith(config({ default: "steady" }), { ...TASK, description: "Refactor the store.", profile: EXPLICIT });
    expect(result.isError).toBe(false);
    expect(spawned(world)).toMatchObject({ providerId: "claude", model: "opus", reasoningLevel: "max", permissionMode: "auto" });
  });

  it("[A702] takes the profile of the one matching rule when no profile is given", async () => {
    const { world, result } = await dispatchWith(config(), { ...TASK, description: "Refactor the store." });
    expect(result.isError).toBe(false);
    expect(result.text).toContain('rule "refactor"');
    expect(spawned(world)).toMatchObject({ providerId: "claude", model: "opus", reasoningLevel: "xhigh", permissionMode: "auto" });
  });

  it("[A703] returns ambiguous with both candidates and creates no task and no thread when two rules with different profiles match", async () => {
    const { world, result } = await dispatchWith(
      config({ rules: [{ id: "any-ship", when: { kind: "ship" }, profile: "steady" }, { id: "refactor", when: { keywords: ["refactor"] }, profile: "deep" }] }),
      { ...TASK, description: "Refactor the store." },
    );
    expect(result.isError).toBe(true);
    expect(result.text).toContain("ambiguous");
    expect(result.text).toContain("any-ship");
    expect(result.text).toContain("refactor");
    expect(world.store.listTasks()).toEqual([]);
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
  });

  it("[A704] spawns with the profile of the rule that the supervisor picks, and refuses a rule that does not match", async () => {
    const rules = [{ id: "any-ship", when: { kind: "ship" }, profile: "steady" }, { id: "refactor", when: { keywords: ["refactor"] }, profile: "deep" }];
    const picked = await dispatchWith(config({ rules }), { ...TASK, description: "Refactor the store.", rule: "refactor" });
    expect(picked.result.isError).toBe(false);
    expect(spawned(picked.world)).toMatchObject({ model: "opus" });
    const wrong = await dispatchWith(config({ rules }), { ...TASK, description: "Add a flag.", rule: "refactor" });
    expect(wrong.result.isError).toBe(true);
    expect(wrong.result.text).toContain("rule_not_applicable");
    expect(wrong.world.sdkCalls("threads.spawn")).toEqual([]);
  });

  it("[A705] resolves clear when the matching rules name the same profile", async () => {
    const { world, result } = await dispatchWith(
      config({ rules: [{ id: "a", when: { kind: "ship" }, profile: "deep" }, { id: "b", when: { keywords: ["store"] }, profile: "deep" }] }),
      { ...TASK, description: "Tidy the store." },
    );
    expect(result.isError).toBe(false);
    expect(spawned(world)).toMatchObject({ model: "opus" });
  });

  it("[A706] uses the configured default when no rule matches, and blocks when there is none", async () => {
    const withDefault = await dispatchWith(config({ default: "steady" }), TASK);
    expect(spawned(withDefault.world)).toMatchObject({ model: "sonnet", reasoningLevel: "high" });
    const none = await dispatchWith(config(), TASK);
    expect(none.result.isError).toBe(true);
    expect(none.result.text).toContain("no_default_profile");
    expect(none.world.sdkCalls("threads.spawn")).toEqual([]);
  });

  it("[A707] refuses a call with both a profile and a rule before anything is read or spawned", async () => {
    const { world, result } = await dispatchWith(config(), { ...TASK, profile: EXPLICIT, rule: "refactor" });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("not both");
    expect(world.sdkCalls("projects.get")).toEqual([]);
    expect(world.sdkCalls("providers.list")).toEqual([]);
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
    expect(world.store.listTasks()).toEqual([]);
  });

  it("[A708] blocks an explicit profile below the matched rule's reasoning level, and standing permission lifts the block", async () => {
    const lowered = { ...EXPLICIT, reasoningLevel: "medium" };
    const blocked = await dispatchWith(config(), { ...TASK, description: "Refactor the store.", profile: lowered });
    expect(blocked.result.isError).toBe(true);
    expect(blocked.result.text).toContain("reasoning_lowered");
    expect(blocked.world.sdkCalls("threads.spawn")).toEqual([]);
    const allowed = await dispatchWith(config({ standingPermission: { lowerReasoning: true } }), { ...TASK, description: "Refactor the store.", profile: lowered });
    expect(allowed.result.isError).toBe(false);
    expect(spawned(allowed.world)).toMatchObject({ reasoningLevel: "medium" });
  });

  it.each([
    ["bad JSON", "{ not json"],
    ["an unknown key", config({ surprise: true })],
    ["an undefined profile", config({ rules: [{ id: "x", when: { kind: "ship" }, profile: "missing" }] })],
  ])("[A709] blocks dispatch for %s, and uses no default in its place", async (_label, bad) => {
    const { world, result } = await dispatchWith(bad, TASK);
    expect(result.isError).toBe(true);
    expect(result.text).toContain("dispatch.json");
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
    expect(world.store.listTasks()).toEqual([]);
  });

  // The model's own levels decide when bb knows them (feature 009, H2). This model's levels are unknown, so the provider's list applies.
  const UNKNOWN_LEVELS = { claude: { models: [modelFixture("opus", { reasoningDiscovery: "unknown" })] } };
  it.each<[string, unknown[], string, Parameters<typeof loadWorld>[0]]>([
    // Readiness comes first (feature 009): bb's state for the provider explains these two now.
    ["unavailable", [providerFixture("claude", { available: false })], "is not installed", {}],
    ["not listed", [providerFixture("codex")], "bb reports no state for the provider `claude`", {}],
    ["a permission mode it does not list", [providerFixture("claude", { capabilities: { permissionModes: ["accept-edits"] } })], "permission mode", {}],
    ["a reasoning level it does not list", [providerFixture("claude", { reasoningLevels: [{ id: "low", label: "low" }] })], "reasoning level", { models: UNKNOWN_LEVELS }],
  ])("[A710] blocks a provider that bb reports as %s", async (_label, providers, text, extra) => {
    const { world, result } = await dispatchWith(config(), { ...TASK, profile: EXPLICIT }, { providers, ...extra });
    expect(result.isError).toBe(true);
    expect(result.text).toContain(text);
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
  });

  // bb says the provider is ready, and its own listing says otherwise: the listing still blocks (the check after readiness).
  it.each<[string, unknown[], string]>([
    ["is listed but not available", [providerFixture("claude", { available: false })], "The provider `claude` is not available in bb. Available providers: none."],
    ["is not listed", [providerFixture("codex")], "The provider `claude` is not available in bb. Available providers: codex."],
  ])("[A710] blocks a provider that bb reports as ready when the provider %s", async (_label, providers, text) => {
    const { world, result } = await dispatchWith(config(), { ...TASK, profile: EXPLICIT }, { providers, providerStates: [stateFixture("claude")] });
    expect(result.isError).toBe(true);
    expect(result.text).toContain(text);
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
  });

  const TWO_RULES = config({ rules: [{ id: "a", when: { kind: "ship" }, profile: "steady" }, { id: "b", when: { kind: "ship" }, profile: "deep" }] });
  it.each<[string, unknown, Record<string, unknown>, Parameters<typeof loadWorld>[0]]>([
    ["ambiguous", TWO_RULES, TASK, {}],
    ["rule_not_applicable", TWO_RULES, { ...TASK, rule: "nope" }, {}],
    ["reasoning_lowered", config(), { ...TASK, description: "Refactor the store.", profile: { ...EXPLICIT, reasoningLevel: "medium" } }, {}],
    ["config_invalid", "{ not json", TASK, {}],
    ["provider_unavailable", config(), { ...TASK, profile: EXPLICIT }, { providers: [providerFixture("claude", { available: false })] }],
  ])("[A711] leaves the event log, the task list, and the spawn calls unchanged for a %s result", async (_code, dispatch, args, options) => {
    const world = await loadWorld({ checkout: makeCheckout({ dispatch }), ...options });
    const before = world.store.listEvents().length;
    const result = await world.call("factoryman_dispatch", args);
    expect(result.isError).toBe(true);
    expect(world.store.listEvents().length).toBe(before);
    expect(world.store.listTasks()).toEqual([]);
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
  });

  it("[A712] lets a resolver injected into the factory replace the rules table", async () => {
    const stub: DispatchResolver = {
      resolve: () => ({ status: "clear", profile: { provider: "claude", model: "stub-model", reasoningLevel: "high", permissionMode: "auto" }, source: "default", ruleId: null }),
    };
    const { world, result } = await dispatchWith(config(), TASK, { resolver: stub });
    expect(result.isError).toBe(false);
    expect(spawned(world)).toMatchObject({ model: "stub-model" });
  });

  it("[A713] blocks with the init hint when dispatch.json is absent, because the plugin has no built-in default", async () => {
    const world = await loadWorld({ checkout: makeCheckout(), bareConfig: true });
    const result = await world.call("factoryman_dispatch", TASK);
    expect(result.isError).toBe(true);
    expect(result.text).toContain("bb factoryman dispatch init --provider <id>");
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
  });
  it("[A715] fails closed when bb's provider list cannot be read", async () => {
    const world = await loadWorld({ checkout: makeCheckout({ dispatch: config() }), providersError: new Error("bb is down") });
    const result = await world.call("factoryman_dispatch", { ...TASK, profile: EXPLICIT });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("could not read bb's providers");
    expect(result.text).toContain("No task was created");
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
    expect(world.store.listTasks()).toEqual([]);
  });

  it.each<[string, Parameters<typeof loadWorld>[0]]>([
    ["the project cannot be read", { projectError: new Error("bb is down") }],
    ["the injected resolver throws", { resolver: { resolve: () => { throw new Error("classifier crashed"); } } }],
  ])("[A716] fails closed when %s", async (_label, options) => {
    const world = await loadWorld({ checkout: makeCheckout({ dispatch: config() }), ...options });
    const result = await world.call("factoryman_dispatch", TASK);
    expect(result.isError).toBe(true);
    expect(result.text).toContain("could not read the dispatch rules");
    expect(result.text).toContain("No task was created");
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
    expect(world.store.listTasks()).toEqual([]);
  });

  it("[A717] passes the task kind, the project's mode, and the tags to the rules", async () => {
    const rules = [
      { id: "scouts", when: { kind: "scout" }, profile: "fast" },
      { id: "pr-work", when: { kind: "ship", mode: "direct-PR" }, profile: "deep" },
      { id: "docs", when: { kind: "ship", mode: "no-mistakes", tags: ["docs"] }, profile: "steady" },
    ];
    const scout = await dispatchWith(config({ rules }), { kind: "scout", description: "Look around." });
    expect(spawned(scout.world)).toMatchObject({ model: "haiku" });

    const prWorld = await loadWorld({ checkout: makeCheckout({ dispatch: config({ rules }) }) });
    prWorld.setProject({ deliveryMode: "direct-PR" });
    await prWorld.call("factoryman_dispatch", TASK);
    expect(spawned(prWorld)).toMatchObject({ model: "opus" });

    const tagged = await dispatchWith(config({ rules }), { ...TASK, tags: ["docs"] });
    expect(spawned(tagged.world)).toMatchObject({ model: "sonnet" });
    // No rule matches an untagged task, so the configured default applies.
    const fallback = { provider: "claude-code", model: "claude-sonnet-5-5", reasoningLevel: "high", permissionMode: "auto" };
    const untagged = await dispatchWith(config({ rules, profiles: { ...PROFILES, fallback }, default: "fallback" }), TASK);
    expect(spawned(untagged.world)).toMatchObject({ providerId: "claude-code" });
  });
});
