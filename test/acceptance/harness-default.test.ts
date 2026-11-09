import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseDispatchConfig } from "../../src/dispatch/config";
import { makeCheckout, removeCheckouts } from "../fixtures/checkout";
import { loadWorld, modelFixture, providerFixture, type World } from "../fixtures/plugin-host";

afterEach(removeCheckouts);

const TASK = { kind: "ship", description: "Add a --json flag to the status command." } as const;
const MODELS = { "claude-code": { models: [modelFixture("claude-sonnet-5-5", { isDefault: true, defaultReasoningEffort: "high" }), modelFixture("claude-opus-5-5")] } };
const dispatchFile = (checkout: string) => join(checkout, ".bb", "factoryman", "dispatch.json");

/** A world whose project has the given checkout and no default profile of the test's own: the plugin reads the real file. */
const bare = (checkout: string, extra: Parameters<typeof loadWorld>[0] = {}) => loadWorld({ bareConfig: true, checkout, models: MODELS, ...extra });

async function cli(world: World, argv: string[]): Promise<{ exitCode: number; text: string }> {
  const result = await world.host.harness.behavior.runCli(argv);
  return { exitCode: result.exitCode, text: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}
const init = (world: World, ...flags: string[]) => cli(world, ["dispatch", "init", "--provider", "claude-code", "--project", "proj-1", ...flags]);

describe("a project with no default profile", () => {
  it("[A1322] blocks a dispatch with the init hint and creates no task", async () => {
    const world = await bare(makeCheckout());
    const result = await world.call("factoryman_dispatch", TASK);
    expect(result.isError).toBe(true);
    expect(result.text).toContain("Dispatch blocked (no_default_profile)");
    expect(result.text).toContain("bb factoryman dispatch init --provider <id>");
    expect(result.text).toContain("No task was created.");
    expect(world.store.listTasks()).toEqual([]);
    expect(world.sdkCalls("threads.spawn")).toEqual([]);
  });

  it("[A1322] blocks the same way when dispatch.json has no default and no rule matches", async () => {
    const dispatch = { version: 1, profiles: { deep: { provider: "claude", model: "opus", reasoningLevel: "high", permissionMode: "auto" } }, rules: [{ id: "scouts", when: { kind: "scout" }, profile: "deep" }] };
    const world = await bare(makeCheckout({ dispatch }));
    const result = await world.call("factoryman_dispatch", TASK);
    expect(result.isError).toBe(true);
    expect(result.text).toContain("no_default_profile");
    expect(world.store.listTasks()).toEqual([]);
  });

  // The models "opus", "sonnet", and "haiku" come from the fixtures' default model list (test/fixtures/models.ts, pinned by test/fixtures/defaults.test.ts), and the providers are ready by default.
  it("[A1323] resolves an explicit profile, a matching rule, and a configured default as before, in that order", async () => {
    const profiles = {
      explicit: { provider: "claude", model: "opus", reasoningLevel: "high", permissionMode: "auto" },
      ruled: { provider: "claude", model: "sonnet", reasoningLevel: "high", permissionMode: "auto" },
      fallback: { provider: "claude", model: "haiku", reasoningLevel: "high", permissionMode: "auto" },
    };
    const dispatch = { version: 1, profiles, default: "fallback", rules: [{ id: "scouts", when: { kind: "scout" }, profile: "ruled" }] };
    const spawnedModel = (world: World) => ((world.sdkCalls("threads.spawn") as Array<[{ model: string }]>)[0] ?? [{ model: "none" }])[0].model;
    const override = await bare(makeCheckout({ dispatch }));
    await override.call("factoryman_dispatch", { ...TASK, kind: "scout", profile: profiles.explicit });
    expect(spawnedModel(override)).toBe("opus");
    const ruled = await bare(makeCheckout({ dispatch }));
    await ruled.call("factoryman_dispatch", { ...TASK, kind: "scout" });
    expect(spawnedModel(ruled)).toBe("sonnet");
    const fallback = await bare(makeCheckout({ dispatch }));
    const result = await fallback.call("factoryman_dispatch", TASK);
    expect(spawnedModel(fallback)).toBe("haiku");
    expect(result.text).toContain("from the configured default");
  });
});

describe("bb factoryman dispatch init through the plugin factory", () => {
  it("[A1324] writes a starter file with one profile built from what bb lists, sets it as the default, and prints the path and the profile", async () => {
    const checkout = makeCheckout();
    const world = await bare(checkout);
    const result = await init(world);
    expect(result.exitCode).toBe(0);
    expect(result.text).toContain(`Wrote ${dispatchFile(checkout)}.`);
    expect(result.text).toContain('Profile "claude-code": claude-code claude-sonnet-5-5 high auto. It is the default for this project.');
    expect(JSON.parse(readFileSync(dispatchFile(checkout), "utf8"))).toEqual({
      version: 1,
      profiles: { "claude-code": { provider: "claude-code", model: "claude-sonnet-5-5", reasoningLevel: "high", permissionMode: "auto" } },
      default: "claude-code",
      rules: [],
    });
  });

  it("[A1325] writes a file that the plugin's parser accepts, and the next dispatch resolves to its profile", async () => {
    const checkout = makeCheckout();
    const world = await bare(checkout);
    await init(world);
    const parsed = parseDispatchConfig(JSON.parse(readFileSync(dispatchFile(checkout), "utf8")));
    expect(parsed.ok).toBe(true);
    const result = await world.call("factoryman_dispatch", TASK);
    expect(result.isError, result.text).toBe(false);
    expect(result.text).toContain("Profile: claude-code claude-sonnet-5-5 high auto, from the configured default.");
    const [[spawn]] = world.sdkCalls("threads.spawn") as [[Record<string, unknown>]];
    expect(spawn).toMatchObject({ providerId: "claude-code", model: "claude-sonnet-5-5", reasoningLevel: "high", permissionMode: "auto" });
  });

  it.each([
    ["a valid file", JSON.stringify({ version: 1, profiles: {}, rules: [] })],
    ["an invalid file", "{ not json"],
  ])("[A1326] writes nothing and leaves the file as it was when %s exists", async (_label, existing) => {
    const checkout = makeCheckout({ dispatch: existing });
    const world = await bare(checkout);
    const result = await init(world);
    expect(result.exitCode).toBe(1);
    expect(result.text).toContain("already exists, so nothing was written");
    expect(readFileSync(dispatchFile(checkout), "utf8")).toBe(existing);
  });

  it.each([
    ["an unknown provider", ["dispatch", "init", "--provider", "mystery", "--project", "proj-1"], {}, 1, "bb does not list the provider `mystery`"],
    ["a provider with no model and no --model", ["dispatch", "init", "--provider", "pi", "--project", "proj-1"], { providers: [providerFixture("pi")], models: { pi: { models: [] } } }, 1, "Pass --model <id>."],
    ["a missing flag", ["dispatch", "init", "--project", "proj-1"], {}, 2, "Usage: bb factoryman dispatch init"],
  ])("[A1327] exits with a clear message and writes nothing for %s", async (_label, argv, extra, exitCode, text) => {
    const checkout = makeCheckout();
    const world = await bare(checkout, extra as Parameters<typeof loadWorld>[0]);
    const result = await cli(world, argv);
    expect(result.exitCode).toBe(exitCode);
    expect(result.text).toContain(text);
    expect(existsSync(dispatchFile(checkout))).toBe(false);
  });

  it("[A1327] exits with a clear message for a project whose checkout is not on the server", async () => {
    const checkout = makeCheckout();
    const world = await bare(checkout, { sources: [{ hostId: "host_local", path: checkout, isDefault: false }] });
    const result = await init(world);
    expect(result.exitCode).toBe(1);
    expect(result.text).toContain("has no local checkout on the server");
    expect(existsSync(dispatchFile(checkout))).toBe(false);
  });

  it("[A1328] replaces the values from bb with --model, --level, and --mode", async () => {
    const checkout = makeCheckout();
    const world = await bare(checkout);
    const result = await init(world, "--model", "claude-opus-5-5", "--level", "low", "--mode", "accept-edits");
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(readFileSync(dispatchFile(checkout), "utf8")).profiles["claude-code"]).toEqual({
      provider: "claude-code",
      model: "claude-opus-5-5",
      reasoningLevel: "low",
      permissionMode: "accept-edits",
    });
  });

  it.each([
    ["a level that the model does not list", ["--level", "ultra"], "does not list the reasoning level `ultra`"],
    ["a mode that the provider does not offer", ["--mode", "yolo"], "does not offer the permission mode `yolo`"],
  ])("[A1328] stops the write for %s", async (_label, flags, text) => {
    const checkout = makeCheckout();
    const world = await bare(checkout);
    const result = await init(world, ...flags);
    expect(result.exitCode).toBe(1);
    expect(result.text).toContain(text);
    expect(existsSync(dispatchFile(checkout))).toBe(false);
  });

  it("[A1329] calls no bb method that changes state, and the file holds no credential", async () => {
    const checkout = makeCheckout();
    const world = await bare(checkout);
    await init(world);
    const paths = world.host.harness.sdk.calls.map((call) => call.path);
    expect(paths.filter((path) => /^(threads\.(spawn|send|archive|updatePluginMetadata)|environments\.|terminals\.|hosts\.)/.test(path))).toEqual([]);
    expect(paths).toEqual(expect.arrayContaining(["projects.get", "providers.list", "providers.models"]));
    expect(readFileSync(dispatchFile(checkout), "utf8")).not.toMatch(/token|secret|password|api[_-]?key|credential/i);
  });

  it("[A1324] creates the config directory when the checkout has none", async () => {
    const checkout = makeCheckout();
    writeFileSync(join(checkout, "README.md"), "x");
    expect(existsSync(join(checkout, ".bb"))).toBe(false);
    const world = await bare(checkout);
    expect((await init(world)).exitCode).toBe(0);
    expect(existsSync(dispatchFile(checkout))).toBe(true);
  });
});
