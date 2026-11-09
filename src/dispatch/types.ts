import type { DeliveryMode, Profile, TaskKind } from "../machine/types";

/** What a rule needs from a task. Every present field must hold, and a rule has at least one. */
export interface RuleCondition {
  readonly kind?: TaskKind;
  readonly mode?: DeliveryMode;
  /** The task must carry every tag. */
  readonly tags?: readonly string[];
  /** Any keyword that appears as a whole word in the description matches. */
  readonly keywords?: readonly string[];
}

export interface Rule {
  readonly id: string;
  readonly when: RuleCondition;
  /** A key of `DispatchConfig.profiles`. */
  readonly profile: string;
  /** The machine to run on, by ID or name. Absent means the call or the project decides. */
  readonly machine?: string;
}

/** The owner's standing permissions. Each is off unless the file turns it on. */
export interface StandingPermission {
  readonly lowerReasoning: boolean;
}

/** The parsed `.bb/factoryman/dispatch.json`. */
export interface DispatchConfig {
  readonly version: 1;
  readonly profiles: Readonly<Record<string, Profile>>;
  /** A key of `profiles`, or null when the file sets none. */
  readonly default: string | null;
  readonly rules: readonly Rule[];
  /**
   * Reasoning levels from lowest to highest: one ladder for every provider, or a record from provider ID to its own
   * ladder (a provider that the record omits uses the default ladder). Read it with `ladderFor`.
   */
  readonly reasoningLevels: readonly string[] | Readonly<Record<string, readonly string[]>>;
  readonly standingPermission: StandingPermission;
}

/** The facts about a task that rules can match. */
export interface TaskFacts {
  readonly kind: TaskKind;
  readonly mode: DeliveryMode;
  readonly description: string;
  readonly tags: readonly string[];
}

/** What the supervisor passed to the call. The two fields exclude each other. */
export interface Choice {
  readonly profile?: Profile;
  readonly rule?: string;
}

export type ProfileSource = "override" | "rule" | "default";

export type BlockCode = "reasoning_lowered" | "rule_not_applicable" | "invalid_choice" | "config_invalid" | "provider_unavailable" | "provider_not_admitted" | "no_default_profile";

export interface Candidate {
  readonly ruleId: string;
  readonly profileName: string;
  readonly profile: Profile;
  readonly machine: string | null;
}

export type Resolution =
  | {
      readonly status: "clear";
      readonly profile: Profile;
      readonly source: ProfileSource;
      readonly ruleId: string | null;
      /** The matching rule's machine, or null. A resolver that has no machine column may omit it. */
      readonly machine?: string | null;
    }
  | { readonly status: "ambiguous"; readonly candidates: readonly Candidate[] }
  | { readonly status: "blocked"; readonly code: BlockCode; readonly message: string };

/** A resolver turns task facts and a config into a profile. A faster classifier can replace the rules table. */
export interface DispatchResolver {
  resolve(facts: TaskFacts, config: DispatchConfig, choice: Choice): Resolution;
}

/** Lowest to highest. The owner can replace it, because reasoning level IDs belong to each provider (spike item 29). */
export const DEFAULT_REASONING_LEVELS = ["none", "low", "medium", "high", "xhigh", "max"] as const;

/**
 * The ladder for one provider. An array applies to every provider. A record applies its entry to that provider and
 * leaves every other provider on the default ladder, because level IDs belong to one provider (D-105).
 * It sits here, with no imports, so the resolver stays pure (test A718).
 */
export function ladderFor(levels: DispatchConfig["reasoningLevels"], providerId: string): readonly string[] {
  if (Array.isArray(levels)) return levels;
  const byProvider = levels as Readonly<Record<string, readonly string[]>>;
  return Object.hasOwn(byProvider, providerId) ? (byProvider[providerId] as readonly string[]) : DEFAULT_REASONING_LEVELS;
}
