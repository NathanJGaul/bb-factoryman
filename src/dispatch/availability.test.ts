import { describe, expect, it } from "vitest";
import type { ProviderAvailability, ProviderState } from "../bb/port";
import { providerState } from "../../test/fixtures/bb-port";
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
const facts = (overrides: Partial<ProfileFacts> = {}): ProfileFacts => ({ host: HOST, providers: [provider()], states: [state()], ...overrides });

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

  it("[U1322] passes a ready provider (the readiness text is only for the other states)", () => {
    expect(checkProfile(profile, facts({ states: [state({ status: "ready" })] }))).toBeNull();
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
