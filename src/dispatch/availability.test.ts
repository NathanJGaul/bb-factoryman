import { describe, expect, it } from "vitest";
import type { ModelList, ProviderAvailability, ProviderState } from "../bb/port";
import { modelEntry, providerState } from "../../test/fixtures/bb-port";
import type { Profile } from "../machine/types";
import { checkProfile, readinessProblem, type ProfileFacts } from "./availability";

const profile: Profile = { provider: "claude-code", model: "m", reasoningLevel: "high", permissionMode: "auto" };
const provider = (overrides: Partial<ProviderAvailability> = {}): ProviderAvailability => ({
  id: "claude-code",
  available: true,
  permissionModes: ["accept-edits", "auto", "full"],
  reasoningLevels: ["low", "medium", "high"],
  ...overrides,
});
const state = (overrides: Partial<ProviderState> = {}): ProviderState => providerState("claude-code", overrides);
const HOST = "gpu-box";
const NO_MODELS: ModelList = { models: [], loadError: null };
const facts = (overrides: Partial<ProfileFacts> = {}): ProfileFacts => ({ host: HOST, providers: [provider()], states: [state()], models: NO_MODELS, ...overrides });

describe("checkProfile", () => {
  it("[U730] passes an available provider that lists the permission mode and the reasoning level", () => {
    expect(checkProfile(profile, facts())).toBeNull();
  });

  it("[U731] blocks a provider that bb does not list, and names the providers it knows", () => {
    const message = checkProfile(profile, facts({ providers: [provider({ id: "codex" })] }));
    expect(message).toMatch(/claude-code.*not available/);
    expect(message).toMatch(/codex/);
  });

  it("[U732] blocks a provider with available false", () => {
    expect(checkProfile(profile, facts({ providers: [provider({ available: false })] }))).toMatch(/not available/);
  });

  it("[U733] blocks a permission mode that the provider does not list", () => {
    expect(checkProfile(profile, facts({ providers: [provider({ permissionModes: ["full"] })] }))).toMatch(/permission mode `auto`/);
  });

  it("[U734] blocks a reasoning level that the provider does not list", () => {
    expect(checkProfile({ ...profile, reasoningLevel: "max" }, facts())).toMatch(/reasoning level `max`/);
  });

  it("[U735] skips the level check when the provider lists no reasoning levels", () => {
    expect(checkProfile({ ...profile, reasoningLevel: "max" }, facts({ providers: [provider({ reasoningLevels: [] })] }))).toBeNull();
  });

  it("[U1336] checks the permission mode before the level", () => {
    const message = checkProfile({ ...profile, reasoningLevel: "max" }, facts({ providers: [provider({ permissionModes: ["full"] })] }));
    expect(message).toMatch(/permission mode `auto`/);
    expect(message).not.toMatch(/reasoning level/);
  });
});

describe("checkProfile: readiness", () => {
  const blockedBy = (override: Partial<ProviderState>) => checkProfile(profile, facts({ states: [state(override)] }));

  it("[U1323] blocks a provider that is not installed, and says to install its CLI", () => {
    expect(blockedBy({ status: "not_installed" })).toBe(
      "The provider `claude-code` is not installed on gpu-box (bb status: not_installed). Install its CLI there. No other provider was tried.",
    );
  });

  it("[U1324] blocks a provider that is not signed in, and names bb's login command", () => {
    expect(blockedBy({ status: "unauthenticated", localLoginCommand: "claude login" })).toBe(
      "The provider `claude-code` is not signed in on gpu-box (bb status: unauthenticated). Run `claude login` on that machine. No other provider was tried.",
    );
  });

  it("[U1325] says to sign in when bb gives no login command", () => {
    expect(blockedBy({ status: "unauthenticated", localLoginCommand: null })).toBe(
      "The provider `claude-code` is not signed in on gpu-box (bb status: unauthenticated). Sign in to it on that machine. No other provider was tried.",
    );
  });

  it("[U1326] blocks an expired login with the login command, and with the same fallback when bb gives none", () => {
    expect(blockedBy({ status: "expired", localLoginCommand: "codex login" })).toBe(
      "The provider `claude-code` has an expired login on gpu-box (bb status: expired). Run `codex login` on that machine. No other provider was tried.",
    );
    expect(blockedBy({ status: "expired", localLoginCommand: null })).toBe(
      "The provider `claude-code` has an expired login on gpu-box (bb status: expired). Sign in to it on that machine. No other provider was tried.",
    );
  });

  it("[U1327] blocks a version that is too old, and shows the installed and the minimum version", () => {
    expect(blockedBy({ status: "unsupported_version", installedVersion: "0.100.0", minimumSupportedVersion: "0.136.0" })).toBe(
      "The provider `claude-code` is too old on gpu-box (bb status: unsupported_version): installed 0.100.0, minimum 0.136.0. Update its CLI there. No other provider was tried.",
    );
  });

  it("[U1328] says unknown for each version that bb does not give", () => {
    expect(blockedBy({ status: "unsupported_version" })).toContain("installed unknown, minimum unknown");
  });

  it("[U1329] blocks status unknown, adds bb's status message when it has one, and adds nothing when it has none", () => {
    expect(blockedBy({ status: "unknown", statusMessage: "CLI timed out" })).toBe(
      "The provider `claude-code` is in a state that bb does not describe on gpu-box (bb status: unknown): CLI timed out. No other provider was tried.",
    );
    expect(blockedBy({ status: "unknown", statusMessage: null })).toBe(
      "The provider `claude-code` is in a state that bb does not describe on gpu-box (bb status: unknown). No other provider was tried.",
    );
  });

  it("[U1330] blocks a provider with no state, and lists the provider IDs that bb reports, or none", () => {
    expect(checkProfile(profile, facts({ states: [providerState("codex"), providerState("pi")] }))).toBe(
      "bb reports no state for the provider `claude-code` on gpu-box. It reports: codex, pi. No other provider was tried.",
    );
    expect(checkProfile(profile, facts({ states: [] }))).toContain("It reports: none.");
  });

  it("[U1331] judges by the state of the profile's provider, not by the first state in the list", () => {
    const states = [providerState("codex", { status: "unauthenticated" }), providerState("claude-code")];
    expect(checkProfile(profile, facts({ states }))).toBeNull();
    const reversed = [providerState("codex"), providerState("claude-code", { status: "expired" })];
    expect(checkProfile(profile, facts({ states: reversed }))).toContain("expired login");
  });

  it("[U1332] checks readiness before the listing", () => {
    const message = checkProfile(profile, facts({ providers: [], states: [state({ status: "unauthenticated", localLoginCommand: "claude login" })] }));
    expect(message).toContain("not signed in");
    expect(message).not.toContain("not available in bb");
  });

});

describe("readinessProblem", () => {
  it("returns the readiness text without the closing sentence, for the preflight to reuse", () => {
    expect(readinessProblem("claude-code", [state({ status: "unauthenticated", localLoginCommand: "claude login" })], "gpu-box")).toBe(
      "The provider `claude-code` is not signed in on gpu-box (bb status: unauthenticated). Run `claude login` on that machine.",
    );
    expect(readinessProblem("claude-code", [state()], "gpu-box")).toBeNull();
  });
});

describe("checkProfile: the model and its levels", () => {
  const PI_LEVELS = ["none", "low", "medium", "high"];
  const piProfile: Profile = { provider: "pi", model: "openai/gpt-6-luna", reasoningLevel: "medium", permissionMode: "full" };
  const piFacts = (models: ModelList, providers: ProviderAvailability[] = [provider({ id: "pi", permissionModes: ["full"], reasoningLevels: ["low", "medium", "high"] })]): ProfileFacts =>
    facts({ providers, states: [providerState("pi")], models });
  const luna = (overrides: Partial<ReturnType<typeof modelEntry>> = {}) => modelEntry("openai/gpt-6-luna", { model: "gpt-6-luna", reasoningLevels: PI_LEVELS, ...overrides });
  const list = (...models: Array<ReturnType<typeof modelEntry>>): ModelList => ({ models, loadError: null });

  it("[U1374] passes a level that the listed model lists and the provider-wide list lacks (omp off)", () => {
    expect(checkProfile({ ...piProfile, reasoningLevel: "none" }, piFacts(list(luna())))).toBeNull();
  });

  it("[U1375] refuses a level that the listed model does not list, and names the model, the provider, and the levels", () => {
    expect(checkProfile({ ...piProfile, reasoningLevel: "max" }, piFacts(list(luna({ reasoningLevels: ["low", "medium"] }))))).toBe(
      "The model `openai/gpt-6-luna` of the provider `pi` does not list the reasoning level `max`. It lists: low, medium.",
    );
    expect(checkProfile(piProfile, piFacts(list(luna({ reasoningLevels: [] }))))).toContain("It lists: none.");
  });

  it("[U1376] passes a level that is on both lists", () => {
    expect(checkProfile(piProfile, piFacts(list(luna())))).toBeNull();
  });

  it("[U1377] uses the provider-wide list when the model's levels are unknown, and refuses a level outside it", () => {
    const unknown = list(luna({ reasoningKnown: false, reasoningLevels: ["max"] }));
    expect(checkProfile({ ...piProfile, reasoningLevel: "max" }, piFacts(unknown))).toContain("The provider `pi` does not list the reasoning level `max`");
  });

  it("[U1378] passes a level on the provider-wide list when the model's levels are unknown", () => {
    expect(checkProfile(piProfile, piFacts(list(luna({ reasoningKnown: false, reasoningLevels: [] }))))).toBeNull();
  });

  it("[U1379] refuses an unlisted model on pi and lists the model IDs", () => {
    const models = list(modelEntry("openai/gpt-6-sol"), modelEntry("openai/gpt-6-terra"));
    expect(checkProfile(piProfile, piFacts(models))).toBe("The model `openai/gpt-6-luna` is not listed for the provider `pi` on gpu-box. It lists: openai/gpt-6-sol, openai/gpt-6-terra.");
  });

  it("[U1380] says that bb lists no models when the list is empty", () => {
    expect(checkProfile(piProfile, piFacts(NO_MODELS))).toBe("The model `openai/gpt-6-luna` is not listed for the provider `pi` on gpu-box. It lists: no models.");
  });

  it("[U1381] adds the load error when bb gives one", () => {
    const failed: ModelList = { models: [], loadError: { code: "auth_required", detail: "Run pi login" } };
    expect(checkProfile(piProfile, piFacts(failed))).toBe(
      "The model `openai/gpt-6-luna` is not listed for the provider `pi` on gpu-box. It lists: no models. bb could not load the models (auth_required: Run pi login).",
    );
    expect(checkProfile(piProfile, piFacts({ models: [], loadError: { code: "timeout", detail: null } }))).toContain("bb could not load the models (timeout).");
  });

  it.each(["acp-omp", "acp-opencode", "never-heard-of-it"])("[U1382] refuses an unlisted model on %s", (id) => {
    const profileFor: Profile = { provider: id, model: "not-listed", reasoningLevel: "medium", permissionMode: "accept-edits" };
    const result = checkProfile(profileFor, facts({ providers: [provider({ id })], states: [providerState(id)], models: list(modelEntry("listed")) }));
    expect(result).toBe(`The model \`not-listed\` is not listed for the provider \`${id}\` on gpu-box. It lists: listed.`);
  });

  it("[U1383] passes an unlisted model on claude-code when the level is on the provider-wide list", () => {
    expect(checkProfile({ ...profile, model: "sonnet-latest" }, facts({ models: list(modelEntry("opus")) }))).toBeNull();
  });

  it("[U1384] refuses an unlisted model on codex with today's level message when the level is off the provider-wide list", () => {
    const codex: Profile = { provider: "codex", model: "gpt-9", reasoningLevel: "ultra", permissionMode: "auto" };
    const result = checkProfile(codex, facts({ providers: [provider({ id: "codex" })], states: [providerState("codex")], models: list(modelEntry("gpt-6-luna")) }));
    expect(result).toBe("The provider `codex` does not list the reasoning level `ultra`. It lists: low, medium, high.");
  });

  it("[U1385] falls back to the provider-wide list for an unlisted model on claude-code when bb also reports a load error", () => {
    const failed: ModelList = { models: [], loadError: { code: "timeout", detail: null } };
    expect(checkProfile(profile, facts({ models: failed }))).toBeNull();
    expect(checkProfile({ ...profile, reasoningLevel: "max" }, facts({ models: failed }))).toContain("does not list the reasoning level `max`");
  });

  it("[U1386] matches a profile's model to a listed model by its id", () => {
    expect(checkProfile({ ...piProfile, reasoningLevel: "none" }, piFacts(list(luna({ id: "openai/gpt-6-luna", model: "other-name" }))))).toBeNull();
  });

  it("[U1387] matches a profile's model to a listed model by its model field when that differs from the id", () => {
    expect(checkProfile({ ...piProfile, model: "gpt-6-luna", reasoningLevel: "none" }, piFacts(list(luna())))).toBeNull();
  });

  it("[U1388] uses a listed model even when bb also reports a load error", () => {
    const partial: ModelList = { models: [luna()], loadError: { code: "timeout", detail: null } };
    expect(checkProfile({ ...piProfile, reasoningLevel: "none" }, piFacts(partial))).toBeNull();
  });
});
