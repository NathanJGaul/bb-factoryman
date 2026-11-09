import type { ProviderAvailability, ProviderState } from "../bb/port";
import type { Profile } from "../machine/types";

/** What bb reports about the profile's provider on the host that will run the worker. */
export interface ProfileFacts {
  /** The machine's name, or "the default host". Messages name it. */
  host: string;
  providers: readonly ProviderAvailability[];
  states: readonly ProviderState[];
}

const NO_OTHER = "No other provider was tried.";

/**
 * Why a provider cannot run a worker on a host, or null when bb reports it `ready`. Only `ready` passes: every other
 * status, a state that bb does not report, and a status that this plugin does not know all block (hard rule 8).
 * The text has no closing sentence, so the machine preflight can reuse it.
 */
export function readinessProblem(providerId: string, states: readonly ProviderState[], host: string): string | null {
  const found = states.find((candidate) => candidate.providerId === providerId);
  const name = `The provider \`${providerId}\``;
  if (found === undefined) {
    return `bb reports no state for the provider \`${providerId}\` on ${host}. It reports: ${states.map((state) => state.providerId).join(", ") || "none"}.`;
  }
  const signIn = found.localLoginCommand === null ? "Sign in to it on that machine." : `Run \`${found.localLoginCommand}\` on that machine.`;
  switch (found.status) {
    case "ready":
      return null;
    case "not_installed":
      return `${name} is not installed on ${host} (bb status: not_installed). Install its CLI there.`;
    case "unauthenticated":
      return `${name} is not signed in on ${host} (bb status: unauthenticated). ${signIn}`;
    case "expired":
      return `${name} has an expired login on ${host} (bb status: expired). ${signIn}`;
    case "unsupported_version":
      return `${name} is too old on ${host} (bb status: unsupported_version): installed ${found.installedVersion ?? "unknown"}, minimum ${found.minimumSupportedVersion ?? "unknown"}. Update its CLI there.`;
    case "unknown":
      return `${name} is in a state that bb does not describe on ${host} (bb status: unknown)${found.statusMessage === null ? "" : `: ${found.statusMessage}`}.`;
  }
}

/**
 * Check a resolved profile against what bb reports. Returns the reason to
 * block, or null when the profile can run. A provider that bb does not list
 * counts as unavailable, so the check fails closed (spike item 29).
 */
export function checkProfile(profile: Profile, facts: ProfileFacts): string | null {
  const { providers } = facts;
  const notReady = readinessProblem(profile.provider, facts.states, facts.host);
  if (notReady !== null) return `${notReady} ${NO_OTHER}`;
  const found = providers.find((candidate) => candidate.id === profile.provider);
  if (found === undefined || !found.available) {
    const known = providers.filter((candidate) => candidate.available).map((candidate) => candidate.id);
    return `The provider \`${profile.provider}\` is not available in bb. Available providers: ${known.length > 0 ? known.join(", ") : "none"}. ${NO_OTHER}`;
  }
  if (!found.permissionModes.includes(profile.permissionMode)) {
    return `The provider \`${profile.provider}\` does not offer the permission mode \`${profile.permissionMode}\`. It offers: ${found.permissionModes.join(", ") || "none"}.`;
  }
  if (found.reasoningLevels.length > 0 && !found.reasoningLevels.includes(profile.reasoningLevel)) {
    return `The provider \`${profile.provider}\` does not list the reasoning level \`${profile.reasoningLevel}\`. It lists: ${found.reasoningLevels.join(", ")}.`;
  }
  return null;
}
