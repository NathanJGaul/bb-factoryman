import { describe, expect, it } from "vitest";
import { modelEntry, providerState } from "../../test/fixtures/bb-port";
import { testRuntime, type TestRuntime } from "../../test/fixtures/runtime";
import type { ModelList, ProviderAvailability } from "../bb/port";
import { parseDispatchConfig } from "./config";
import { INIT_USAGE, runDispatchInit } from "./init";

const CHECKOUT = "/work/repo";
const FILE = `${CHECKOUT}/.bb/factoryman/dispatch.json`;

interface Setup {
  providers?: ProviderAvailability[];
  models?: ModelList;
  provider?: string;
}

function setup({ providers, models, provider = "codex" }: Setup = {}): TestRuntime {
  const t = testRuntime();
  t.bb.checkouts.set("proj-1", CHECKOUT);
  t.bb.providers = providers ?? [
    { id: "codex", available: true, permissionModes: ["accept-edits", "auto", "full"], reasoningLevels: ["low", "medium", "high"] },
    { id: "acp-omp", available: true, permissionModes: ["accept-edits", "full"], reasoningLevels: ["low", "medium", "high"] },
    { id: "pi", available: true, permissionModes: ["full"], reasoningLevels: ["low", "medium", "high"] },
  ];
  t.bb.models.set(provider, models ?? { models: [modelEntry("gpt-6-luna", { isDefault: true, defaultReasoningLevel: "medium", reasoningLevels: ["low", "medium", "high"] })], loadError: null });
  return t;
}

const run = (t: TestRuntime, args: string[], ctx: { projectId?: string } = {}) => runDispatchInit(t.runtime, args, ctx);
const written = (t: TestRuntime) => t.files.files.get(FILE);
const profileOf = (t: TestRuntime, provider = "codex") => {
  const parsed = parseDispatchConfig(JSON.parse(written(t) ?? "null"));
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.config.profiles[provider];
};
const ARGS = ["--provider", "codex", "--project", "proj-1"];

describe("dispatch init: the arguments", () => {
  // Each call that the command must refuse as a usage error, with the id of the behavior it shows.
  const usageCase = (id: string, label: string, args: string[]) =>
    it(`${id} prints the usage and exits 2 for ${label}, and reads and writes nothing`, async () => {
      const t = setup();
      const result = await run(t, args);
      expect(result).toEqual({ exitCode: 2, stderr: INIT_USAGE });
      expect(t.bb.calls).toEqual([]);
      expect(t.files.writes).toEqual([]);
    });

  usageCase("[U1412]", "no --provider", ["--project", "proj-1"]);
  usageCase("[U1413]", "no --project and no project in the context", ["--provider", "codex"]);
  usageCase("[U1414]", "a flag with no value", ["--provider", "codex", "--project"]);
  usageCase("[U1414]", "a flag whose value is another flag", ["--provider", "--model", "--project", "proj-1"]);
  usageCase("[U1415]", "a flag with a blank value", ["--provider", "codex", "--project", "  "]);
  usageCase("[U1416]", "a repeated flag", ["--provider", "codex", "--provider", "pi", "--project", "proj-1"]);
  usageCase("[U1417]", "an unknown flag", ["--provider", "codex", "--project", "proj-1", "--force", "yes"]);
  usageCase("[U1417]", "a stray word", ["codex", "--project", "proj-1"]);

  it("[U1418] takes the project from the context when --project is absent", async () => {
    const t = setup();
    expect((await run(t, ["--provider", "codex"], { projectId: "proj-1" })).exitCode).toBe(0);
    expect(t.files.writes).toEqual([FILE]);
  });

  it("[U1418] lets --project win over the project in the context", async () => {
    const other = setup();
    other.bb.checkouts.set("proj-9", "/work/other");
    expect((await run(other, ["--provider", "codex", "--project", "proj-9"], { projectId: "proj-1" })).exitCode).toBe(0);
    expect(other.files.writes).toEqual(["/work/other/.bb/factoryman/dispatch.json"]);
  });
});

describe("dispatch init: the profile", () => {
  it("[U1419] takes the model that bb marks as the default", async () => {
    const t = setup({ models: { models: [modelEntry("first"), modelEntry("second", { isDefault: true, defaultReasoningLevel: "high" })], loadError: null } });
    await run(t, ARGS);
    expect(profileOf(t)).toMatchObject({ model: "second" });
  });

  it("[U1420] takes the first listed model when none is marked as the default", async () => {
    const t = setup({ models: { models: [modelEntry("first", { defaultReasoningLevel: "low" }), modelEntry("second")], loadError: null } });
    await run(t, ARGS);
    expect(profileOf(t)).toMatchObject({ model: "first" });
  });

  it("[U1421] exits 1 when bb lists no model and --model is absent, and writes nothing", async () => {
    const t = setup({ models: { models: [], loadError: null } });
    const result = await run(t, ARGS);
    expect(result).toEqual({ exitCode: 1, stderr: "bb lists no models for `codex`. Pass --model <id>.\n" });
    expect(t.files.writes).toEqual([]);
  });

  it("[U1422] takes the model's default level when it is not empty", async () => {
    const t = setup({ models: { models: [modelEntry("m", { isDefault: true, defaultReasoningLevel: "high", reasoningLevels: ["low", "medium", "high"] })], loadError: null } });
    await run(t, ARGS);
    expect(profileOf(t)).toMatchObject({ reasoningLevel: "high" });
  });

  it("[U1423] takes medium when the model has no default level and lists medium", async () => {
    const t = setup({ models: { models: [modelEntry("m", { isDefault: true, defaultReasoningLevel: "", reasoningLevels: ["low", "medium", "high"] })], loadError: null } });
    await run(t, ARGS);
    expect(profileOf(t)).toMatchObject({ reasoningLevel: "medium" });
  });

  it("[U1424] takes the first level the model lists when it has no default level and no medium", async () => {
    const t = setup({ models: { models: [modelEntry("m", { isDefault: true, defaultReasoningLevel: "", reasoningLevels: ["low", "high"] })], loadError: null } });
    await run(t, ARGS);
    expect(profileOf(t)).toMatchObject({ reasoningLevel: "low" });
  });

  it("[U1425] exits 1 and asks for --level when the model lists no level and the provider lists none", async () => {
    const t = setup({
      providers: [{ id: "codex", available: true, permissionModes: ["auto"], reasoningLevels: [] }],
      models: { models: [modelEntry("m", { isDefault: true, defaultReasoningLevel: "", reasoningLevels: [] })], loadError: null },
    });
    const result = await run(t, ARGS);
    expect(result).toEqual({ exitCode: 1, stderr: "Pass --level <id>.\n" });
    expect(t.files.writes).toEqual([]);
  });

  it("[U1426] takes auto when the provider offers it", async () => {
    const t = setup();
    await run(t, ARGS);
    expect(profileOf(t)).toMatchObject({ permissionMode: "auto" });
  });

  it("[U1427] takes accept-edits when the provider offers no auto (omp)", async () => {
    const t = setup({ provider: "acp-omp" });
    await run(t, ["--provider", "acp-omp", "--project", "proj-1"]);
    expect(profileOf(t, "acp-omp")).toMatchObject({ permissionMode: "accept-edits" });
  });

  it("[U1428] takes full when the provider offers only that (Pi)", async () => {
    const t = setup({ provider: "pi" });
    await run(t, ["--provider", "pi", "--project", "proj-1"]);
    expect(profileOf(t, "pi")).toMatchObject({ permissionMode: "full" });
  });

  it("[U1429] exits 1 when the provider offers no permission mode", async () => {
    const t = setup({ providers: [{ id: "codex", available: true, permissionModes: [], reasoningLevels: ["low", "medium", "high"] }] });
    const result = await run(t, ARGS);
    expect(result).toEqual({ exitCode: 1, stderr: "The provider offers no permission mode.\n" });
    expect(t.files.writes).toEqual([]);
  });

  it("[U1430] lets --model, --level, and --mode each replace the matching value", async () => {
    const t = setup({ models: { models: [modelEntry("gpt-6-luna", { isDefault: true, defaultReasoningLevel: "medium" }), modelEntry("gpt-6-sol")], loadError: null } });
    await run(t, [...ARGS, "--model", "gpt-6-sol", "--level", "high", "--mode", "accept-edits"]);
    expect(profileOf(t)).toEqual({ provider: "codex", model: "gpt-6-sol", reasoningLevel: "high", permissionMode: "accept-edits" });
  });

  it.each([
    ["a model that bb does not list, on a provider that refuses unlisted models", "pi", ["--model", "nope"], "The model `nope` is not listed for the provider `pi`"],
    ["a level that the model does not list", "codex", ["--level", "ultra"], "does not list the reasoning level `ultra`"],
    ["a mode that the provider does not offer", "pi", ["--mode", "accept-edits"], "does not offer the permission mode `accept-edits`"],
  ])("[U1431] exits 1 with dispatch's message for %s, and writes nothing", async (_label, provider, flags, text) => {
    const t = setup({ provider, models: { models: [modelEntry("m", { isDefault: true, defaultReasoningLevel: "medium", reasoningLevels: ["low", "medium", "high"] })], loadError: null } });
    const result = await run(t, ["--provider", provider, "--project", "proj-1", ...flags]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(text);
    expect(t.files.writes).toEqual([]);
  });
});

describe("dispatch init: what stops it", () => {
  it("[U1432] exits 1, names the listed provider IDs, and writes nothing for a provider that bb does not list", async () => {
    const t = setup();
    const result = await run(t, ["--provider", "mystery", "--project", "proj-1"]);
    expect(result).toEqual({ exitCode: 1, stderr: "bb does not list the provider `mystery`. It lists: codex, acp-omp, pi.\n" });
    expect(t.files.writes).toEqual([]);
  });

  it("[U1433] exits 1 for a project with no local checkout", async () => {
    const t = setup();
    t.bb.checkouts.clear();
    const result = await run(t, ARGS);
    expect(result).toEqual({ exitCode: 1, stderr: "The project proj-1 has no local checkout on the server, so no dispatch.json can be written there.\n" });
    expect(t.files.writes).toEqual([]);
  });

  it("[U1474] exits 1 and writes nothing when the read of the project's checkout throws", async () => {
    const t = setup();
    t.bb.checkoutError = new Error("bb is down");
    expect(await run(t, ARGS)).toEqual({ exitCode: 1, stderr: "Could not read the project proj-1: bb is down.\n" });
    expect(t.files.writes).toEqual([]);
  });

  it("[U1475] exits 1 and writes nothing when the read of the providers throws", async () => {
    const t = setup();
    t.bb.providersError = new Error("HTTP 500");
    expect(await run(t, ARGS)).toEqual({ exitCode: 1, stderr: "Could not read bb's providers: HTTP 500.\n" });
    expect(t.files.writes).toEqual([]);
  });

  it("[U1476] takes the default level from the provider-wide list, medium first, when bb does not know the model's levels", async () => {
    const unknown = { models: [modelEntry("m", { isDefault: true, defaultReasoningLevel: "", reasoningKnown: false, reasoningLevels: ["max"] })], loadError: null };
    const withMedium = setup({ models: unknown });
    await run(withMedium, ARGS);
    expect(profileOf(withMedium)).toMatchObject({ model: "m", reasoningLevel: "medium" });
    const withoutMedium = setup({ models: unknown, providers: [{ id: "codex", available: true, permissionModes: ["auto"], reasoningLevels: ["low", "high"] }] });
    await run(withoutMedium, ARGS);
    expect(profileOf(withoutMedium)).toMatchObject({ model: "m", reasoningLevel: "low" });
  });

  it("[U1476] takes the default level from the provider-wide list when --model names a model that bb does not list", async () => {
    const t = setup();
    expect((await run(t, [...ARGS, "--model", "gpt-9-unlisted"])).exitCode).toBe(0);
    expect(profileOf(t)).toMatchObject({ model: "gpt-9-unlisted", reasoningLevel: "medium" });
  });

  it("[U1434] exits 1 when the models read throws", async () => {
    const t = setup();
    t.bb.modelsError = new Error("HTTP 503");
    const result = await run(t, ARGS);
    expect(result).toEqual({ exitCode: 1, stderr: "Could not read bb's models: HTTP 503.\n" });
    expect(t.files.writes).toEqual([]);
  });

  it.each([
    ["a valid file", JSON.stringify({ version: 1, profiles: {}, rules: [] })],
    ["an invalid file", "{ not json"],
  ])("[U1435] exits 1 when %s exists, and leaves it unchanged", async (_label, existing) => {
    const t = setup();
    t.files.files.set(FILE, existing);
    const result = await run(t, ARGS);
    expect(result).toEqual({ exitCode: 1, stderr: `${FILE} already exists, so nothing was written. Set \`default\` in it instead.\n` });
    expect(t.files.files.get(FILE)).toBe(existing);
    expect(t.files.writes).toEqual([]);
  });

  it("[U1436] exits 1 when the write throws", async () => {
    const t = setup();
    t.files.writeErrors.set(FILE, new Error("EACCES: permission denied"));
    const result = await run(t, ARGS);
    expect(result).toEqual({ exitCode: 1, stderr: `Could not write ${FILE}: EACCES: permission denied.\n` });
  });
});

describe("dispatch init: the file and the output", () => {
  it("[U1437] writes a file that the plugin's parser accepts, with one profile, a default, and no rules, in two-space JSON with a trailing newline", async () => {
    const t = setup();
    await run(t, ARGS);
    const text = written(t) ?? "";
    expect(text.endsWith("}\n")).toBe(true);
    expect(text).toBe(
      JSON.stringify(
        { version: 1, profiles: { codex: { provider: "codex", model: "gpt-6-luna", reasoningLevel: "medium", permissionMode: "auto" } }, default: "codex", rules: [] },
        null,
        2,
      ) + "\n",
    );
    const parsed = parseDispatchConfig(JSON.parse(text));
    expect(parsed.ok && parsed.config.default).toBe("codex");
    expect(parsed.ok && parsed.config.rules).toEqual([]);
    expect(parsed.ok && Object.keys(parsed.config.profiles)).toEqual(["codex"]);
  });

  it("[U1438] prints the path, the profile, and the note that readiness is checked at dispatch", async () => {
    const t = setup();
    const result = await run(t, ARGS);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      `Wrote ${FILE}.\n` +
        'Profile "codex": codex gpt-6-luna medium auto. It is the default for this project.\n' +
        "Dispatch checks readiness, the model, and the delivery mode each time, so this file does not make the harness ready.\n",
    );
  });

  it("[U1439] does not check readiness: a provider that is not signed in still gets a file", async () => {
    const t = setup();
    t.bb.states = [providerState("codex", { status: "unauthenticated", localLoginCommand: "codex login" })];
    expect((await run(t, ARGS)).exitCode).toBe(0);
    expect(t.files.writes).toEqual([FILE]);
    expect(t.bb.callsTo("getProviderStates")).toEqual([]);
  });

  it("[U1440] makes only read calls to bb", async () => {
    const t = setup();
    await run(t, ARGS);
    // Every method of BbPort that only reads. A method that is not listed here, such as a new write, fails this test.
    const READS = ["getThread", "getEnvironmentPath", "getProjectCheckout", "getProjectRemote", "getThreadCost", "listProjects", "readTerminal", "listProviders", "getProviderStates", "listMachines", "getProjectSources", "listModels", "getFailureCause"];
    const called = new Set(t.bb.calls.map((call) => call.method));
    expect([...called].filter((method) => !READS.includes(method))).toEqual([]);
    // The command reads the checkout, the providers, and the models, and nothing else. (The first allowlist version of this test had dropped this exact set.)
    expect([...called].sort()).toEqual(["getProjectCheckout", "listModels", "listProviders"]);
  });
});
