import type { ProviderAvailability } from "../bb/port";
import type { Profile } from "../machine/types";

/**
 * Check a resolved profile against what bb reports. Returns the reason to
 * block, or null when the profile can run. A provider that bb does not list
 * counts as unavailable, so the check fails closed (spike item 29).
 */
export function checkProfile(profile: Profile, providers: readonly ProviderAvailability[]): string | null {
  const found = providers.find((candidate) => candidate.id === profile.provider);
  if (found === undefined || !found.available) {
    const known = providers.filter((candidate) => candidate.available).map((candidate) => candidate.id);
    return `The provider \`${profile.provider}\` is not available in bb. Available providers: ${known.length > 0 ? known.join(", ") : "none"}. No other provider was tried.`;
  }
  if (!found.permissionModes.includes(profile.permissionMode)) {
    return `The provider \`${profile.provider}\` does not offer the permission mode \`${profile.permissionMode}\`. It offers: ${found.permissionModes.join(", ") || "none"}.`;
  }
  if (found.reasoningLevels.length > 0 && !found.reasoningLevels.includes(profile.reasoningLevel)) {
    return `The provider \`${profile.provider}\` does not list the reasoning level \`${profile.reasoningLevel}\`. It lists: ${found.reasoningLevels.join(", ")}.`;
  }
  return null;
}
