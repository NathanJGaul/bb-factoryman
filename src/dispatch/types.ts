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
  /** Reasoning levels from lowest to highest. */
  readonly reasoningLevels: readonly string[];
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

export type ProfileSource = "override" | "rule" | "default" | "builtin";

export type BlockCode = "reasoning_lowered" | "rule_not_applicable" | "invalid_choice" | "config_invalid" | "provider_unavailable" | "provider_not_admitted";

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
