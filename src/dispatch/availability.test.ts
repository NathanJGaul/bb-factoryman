import { describe, expect, it } from "vitest";
import type { ProviderAvailability } from "../bb/port";
import type { Profile } from "../machine/types";
import { checkProfile } from "./availability";

const profile: Profile = { provider: "claude-code", model: "m", reasoningLevel: "high", permissionMode: "auto" };
const provider = (overrides: Partial<ProviderAvailability> = {}): ProviderAvailability => ({
  id: "claude-code",
  available: true,
  permissionModes: ["accept-edits", "auto", "full"],
  reasoningLevels: ["low", "medium", "high"],
  ...overrides,
});

describe("checkProfile", () => {
  it("[U730] passes an available provider that lists the permission mode and the reasoning level", () => {
    expect(checkProfile(profile, [provider()])).toBeNull();
  });

  it("[U731] blocks a provider that bb does not list, and names the providers it knows", () => {
    const message = checkProfile(profile, [provider({ id: "codex" })]);
    expect(message).toMatch(/claude-code.*not available/);
    expect(message).toMatch(/codex/);
  });

  it("[U732] blocks a provider with available false", () => {
    expect(checkProfile(profile, [provider({ available: false })])).toMatch(/not available/);
  });

  it("[U733] blocks a permission mode that the provider does not list", () => {
    expect(checkProfile(profile, [provider({ permissionModes: ["full"] })])).toMatch(/permission mode `auto`/);
  });

  it("[U734] blocks a reasoning level that the provider does not list", () => {
    expect(checkProfile({ ...profile, reasoningLevel: "max" }, [provider()])).toMatch(/reasoning level `max`/);
  });

  it("[U735] skips the level check when the provider lists no reasoning levels", () => {
    expect(checkProfile({ ...profile, reasoningLevel: "max" }, [provider({ reasoningLevels: [] })])).toBeNull();
  });
});
