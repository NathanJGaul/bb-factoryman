import { afterEach, describe, expect, it } from "vitest";
import type { DispatchResolver } from "../../src/dispatch/types";
import { makeCheckout, removeCheckouts } from "../fixtures/checkout";
import { loadWorld, providerFixture } from "../fixtures/plugin-host";

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

  it("[A706] uses the configured default when no rule matches, and the built-in default when there is none", async () => {
    const withDefault = await dispatchWith(config({ default: "steady" }), TASK);
    expect(spawned(withDefault.world)).toMatchObject({ model: "sonnet", reasoningLevel: "high" });
    const builtin = await dispatchWith(config(), TASK);
    expect(builtin.result.isError).toBe(false);
    expect(spawned(builtin.world)).toMatchObject({ providerId: "claude-code", model: "claude-sonnet-5-5", reasoningLevel: "high", permissionMode: "auto" });
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

  it("[A709] blocks dispatch for bad JSON, an unknown key, or an undefined profile, and uses no default in its place", async () => {
    for (const bad of ["{ not json", config({ surprise: true }), config({ rules: [{ id: "x", when: { kind: "ship" }, profile: "missing" }] })]) {
      const { world, result } = await dispatchWith(bad, TASK);
      expect(result.isError).toBe(true);
      expect(result.text).toContain("dispatch.json");
      expect(world.sdkCalls("threads.spawn")).toEqual([]);
      expect(world.store.listTasks()).toEqual([]);
    }
  });

  it("[A710] blocks a provider that bb reports unavailable or does not list, and a mode or level it does not list", async () => {
    const cases: Array<[unknown[], string]> = [
      [[providerFixture("claude", { available: false })], "not available"],
      [[providerFixture("codex")], "not available"],
      [[providerFixture("claude", { capabilities: { permissionModes: ["accept-edits"] } })], "permission mode"],
      [[providerFixture("claude", { reasoningLevels: [{ id: "low", label: "low" }] })], "reasoning level"],
    ];
    for (const [providers, text] of cases) {
      const { world, result } = await dispatchWith(config(), { ...TASK, profile: EXPLICIT }, { providers });
      expect(result.isError).toBe(true);
      expect(result.text).toContain(text);
      expect(world.sdkCalls("threads.spawn")).toEqual([]);
    }
  });

  it("[A711] leaves the event log and the spawn calls unchanged for every blocked or ambiguous result", async () => {
    const world = await loadWorld({ checkout: makeCheckout({ dispatch: config({ rules: [{ id: "a", when: { kind: "ship" }, profile: "steady" }, { id: "b", when: { kind: "ship" }, profile: "deep" }] }) }) });
    const before = world.store.listEvents().length;
    await world.call("factoryman_dispatch", TASK);
    await world.call("factoryman_dispatch", { ...TASK, rule: "nope" });
    expect(world.store.listEvents().length).toBe(before);
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

  it("[A713] gives the built-in default when dispatch.json is absent", async () => {
    const world = await loadWorld({ checkout: makeCheckout() });
    const result = await world.call("factoryman_dispatch", TASK);
    expect(result.isError).toBe(false);
    expect(spawned(world)).toMatchObject({ providerId: "claude-code", model: "claude-sonnet-5-5" });
  });
});
