import { afterEach, describe, expect, it } from "vitest";
import { TaskLog } from "../../src/store/task-log";
import { makeCheckout, removeCheckouts } from "../fixtures/checkout";
import { loadWorld, modelFixture, providerFixture, type World } from "../fixtures/plugin-host";

afterEach(removeCheckouts);

type Mode = "no-mistakes" | "direct-PR" | "local-only";
const MODES: Mode[] = ["no-mistakes", "direct-PR", "local-only"];
const PI_PROFILE = { provider: "pi", model: "openai/gpt-6-luna", reasoningLevel: "medium", permissionMode: "full" } as const;
const PROVIDERS = [providerFixture("pi", { capabilities: { permissionModes: ["full"] }, reasoningLevels: [{ id: "medium", label: "medium" }] }), providerFixture("claude"), providerFixture("claude-code")];
const TASK = { description: "Add a --json flag to the status command." } as const;
const CONFIG = { version: 1, profiles: { pi: PI_PROFILE }, default: "pi", rules: [{ id: "any-work", when: { kind: "ship" }, profile: "pi" }, { id: "any-scout", when: { kind: "scout" }, profile: "pi" }] };
// With no rule at all, only `default` can supply the Pi profile, so a refusal proves that the default leg is judged.
const CONFIG_DEFAULT_ONLY = { version: 1, profiles: { pi: PI_PROFILE }, default: "pi", rules: [] };

async function worldIn(mode: Mode, options: Parameters<typeof loadWorld>[0] = {}): Promise<World> {
  // Pi refuses a model that bb does not list (feature 009, H2), so bb lists the one the profile names.
  const models = { pi: { models: [modelFixture(PI_PROFILE.model, { supportedReasoningEfforts: [{ reasoningEffort: "medium", description: "" }] })] } };
  const world = await loadWorld({ providers: PROVIDERS, models, ...options });
  world.setProject({ deliveryMode: mode });
  return world;
}

const refusedText = "is not admitted for local-only projects";

describe("the Pi admission rule through the plugin factory", () => {
  it.each(["ship", "scout"] as const)("[A1316] blocks a Pi %s task in a local-only project and creates no task and no worker", async (kind) => {
    const world = await worldIn("local-only");
    const result = await world.call("factoryman_dispatch", { ...TASK, kind, profile: PI_PROFILE });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("Dispatch blocked (provider_not_admitted)");
    expect(result.text).toContain(refusedText);
    expect(result.text).toContain("It is allowed in: no-mistakes, direct-PR.");
    expect(result.text).toContain("No task was created.");
    expect(world.store.listTasks()).toEqual([]);
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
  });

  it.each(["no-mistakes", "direct-PR"] as const)("[A1317] dispatches a ready Pi profile in full mode in a %s project", async (mode) => {
    const world = await worldIn(mode);
    const result = await world.call("factoryman_dispatch", { ...TASK, kind: "ship", profile: PI_PROFILE });
    expect(result.isError).toBe(false);
    const [[spawn]] = world.sdkCalls("threads.spawn") as [[Record<string, unknown>]];
    expect(spawn).toMatchObject({ providerId: "pi", permissionMode: "full" });
    expect(world.store.getTask("t1")).toMatchObject({ mode, state: "working" });
  });

  it.each([
    ["an explicit override", { profile: PI_PROFILE }, CONFIG],
    ["a matching rule", { rule: "any-work" }, CONFIG],
    ["the configured default", {}, CONFIG_DEFAULT_ONLY],
  ])("[A1318] refuses Pi in a local-only project when the profile comes from %s", async (_label, choice, dispatch) => {
    const world = await worldIn("local-only", { checkout: makeCheckout({ dispatch }) });
    const result = await world.call("factoryman_dispatch", { ...TASK, kind: "ship", ...choice });
    expect(result.isError).toBe(true);
    expect(result.text).toContain(refusedText);
    expect(world.store.listTasks()).toEqual([]);
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
  });

  // The model "m" is in the fixtures' default model list (test/fixtures/models.ts, pinned by test/fixtures/defaults.test.ts). These providers refuse a model that bb does not list, so the test relies on that list.
  it.each(MODES)("[A1319] never refuses claude-code, codex, acp-omp, or an unknown provider in a %s project", async (mode) => {
    const others = ["claude-code", "codex", "acp-omp", "acp-mystery"];
    const world = await worldIn(mode, {
      providers: others.map((id) => providerFixture(id, { reasoningLevels: [{ id: "medium", label: "medium" }] })),
    });
    for (const provider of others) {
      const result = await world.call("factoryman_dispatch", { ...TASK, kind: "ship", profile: { provider, model: "m", reasoningLevel: "medium", permissionMode: "accept-edits" } });
      expect(result.isError, `${provider}: ${result.text}`).toBe(false);
    }
    expect(world.sdkCalls("threads.spawn")).toHaveLength(others.length);
  });

  it("[A1320] fails a queued Pi task in a local-only project with evidence when its slot frees, and starts no worker for it", async () => {
    const world = await loadWorld({ providers: PROVIDERS, checkout: makeCheckout({ workflow: { version: 1, limits: { maxWorkers: 1 } } }) });
    world.setProject({ deliveryMode: "local-only" });
    expect((await world.call("factoryman_dispatch", { ...TASK, kind: "ship", profile: { provider: "claude", model: "opus", reasoningLevel: "high", permissionMode: "accept-edits" } })).isError).toBe(false);
    // A task queued by an earlier plugin version, when Pi was still allowed in this mode.
    const request = { v: 1, description: "Old Pi work.", tags: [], profile: PI_PROFILE, machine: null, cloneHost: "host_local", parentThreadId: "thr-sup", branchPrefix: null, baseBranch: null };
    new TaskLog(world.store).create({ type: "create", actor: "supervisor", taskId: "old-pi", projectId: "proj-1", kind: "ship", mode: "local-only", request });
    await world.restart();
    await world.call("factoryman_report", { outcome: "failed", evidence: "Gave up." }, { threadId: "thr-w1" });
    await world.runStartup();
    expect(world.store.getTask("old-pi")?.state).toBe("failed");
    const failed = world.store.listEvents({ taskId: "old-pi" }).findLast((row) => row.event === "fail");
    expect(failed?.evidence).toContain("The queued task can no longer start:");
    expect(failed?.evidence).toContain(refusedText);
    // The reload gave the fake host a new call log, so this counts the spawns since the restart: none.
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
  });

  it("[A1321] spawns no worker on any other provider when it refuses Pi", async () => {
    const world = await worldIn("local-only", { checkout: makeCheckout({ dispatch: CONFIG_DEFAULT_ONLY }) });
    const result = await world.call("factoryman_dispatch", { ...TASK, kind: "ship" });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("No other provider was tried.");
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
    expect(world.store.listTasks()).toEqual([]);
  });
});
