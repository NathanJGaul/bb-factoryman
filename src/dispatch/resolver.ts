import type { Profile } from "../machine/types";
import type { Candidate, Choice, DispatchConfig, DispatchResolver, Resolution, Rule, TaskFacts } from "./types";

/**
 * The last resort when nothing else names a profile (D-063). It is not an
 * owner declaration, so it sets no reasoning floor (D-064).
 */
export const BUILTIN_PROFILE: Profile = {
  provider: "claude-code",
  model: "claude-sonnet-5-5",
  reasoningLevel: "high",
  permissionMode: "auto",
};

const sameProfile = (a: Profile, b: Profile): boolean =>
  a.provider === b.provider && a.model === b.model && a.reasoningLevel === b.reasoningLevel && a.permissionMode === b.permissionMode;

/** Two candidates are the same choice only when profile and machine both agree (D-065, D-075). */
const sameChoice = (a: Candidate, b: Candidate): boolean => sameProfile(a.profile, b.profile) && a.machine === b.machine;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when `keyword` appears in `text` as a whole word or phrase, in any case. */
function hasWord(text: string, keyword: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(keyword.trim())}(?![\\p{L}\\p{N}_])`, "iu").test(text);
}

function matches(rule: Rule, facts: TaskFacts): boolean {
  const { kind, mode, tags, keywords } = rule.when;
  if (kind !== undefined && kind !== facts.kind) return false;
  if (mode !== undefined && mode !== facts.mode) return false;
  if (tags !== undefined) {
    const have = new Set(facts.tags.map((tag) => tag.trim().toLowerCase()));
    if (!tags.every((tag) => have.has(tag.trim().toLowerCase()))) return false;
  }
  if (keywords !== undefined && !keywords.some((keyword) => hasWord(facts.description, keyword))) return false;
  return true;
}

function blocked(code: "reasoning_lowered" | "rule_not_applicable" | "invalid_choice", message: string): Resolution {
  return { status: "blocked", code, message };
}

/** Compare an explicit level with one owner-declared level. Returns a message when the explicit level must block. */
function loweredReason(explicit: string, base: string, ladder: readonly string[], from: string): string | null {
  if (explicit === base) return null;
  const have = ladder.indexOf(explicit);
  const want = ladder.indexOf(base);
  if (have === -1 || want === -1) {
    return `The reasoning level \`${explicit}\` cannot be ranked against \`${base}\`, which ${from} sets. List both in \`reasoningLevels\` in dispatch.json, or grant \`standingPermission.lowerReasoning\`.`;
  }
  return have < want
    ? `The reasoning level \`${explicit}\` is below \`${base}\`, which ${from} sets. The owner must grant \`standingPermission.lowerReasoning\` in dispatch.json first.`
    : null;
}

/** The first rung of firstmate's precedence that applies (docs/DESIGN.md, Dispatch profiles). */
export class RulesTableResolver implements DispatchResolver {
  resolve(facts: TaskFacts, config: DispatchConfig, choice: Choice): Resolution {
    if (choice.profile !== undefined && choice.rule !== undefined) {
      return blocked("invalid_choice", "Pass either `profile` or `rule`, not both.");
    }
    const matching = config.rules.filter((rule) => matches(rule, facts));
    const profileOf = (rule: Rule): Profile => config.profiles[rule.profile] as Profile;

    if (choice.profile !== undefined) {
      if (!config.standingPermission.lowerReasoning) {
        const baselines: Array<{ profile: Profile; from: string }> =
          matching.length > 0
            ? matching.map((rule) => ({ profile: profileOf(rule), from: `rule \`${rule.id}\`` }))
            : config.default !== null
              ? [{ profile: config.profiles[config.default] as Profile, from: "the configured default" }]
              : [];
        for (const { profile, from } of baselines) {
          const reason = loweredReason(choice.profile.reasoningLevel, profile.reasoningLevel, config.reasoningLevels, from);
          if (reason !== null) return blocked("reasoning_lowered", reason);
        }
      }
      return { status: "clear", profile: choice.profile, source: "override", ruleId: null, machine: null };
    }

    if (choice.rule !== undefined) {
      const picked = matching.find((rule) => rule.id === choice.rule);
      return picked === undefined
        ? blocked("rule_not_applicable", `Rule \`${choice.rule}\` does not exist or does not match this task.`)
        : { status: "clear", profile: profileOf(picked), source: "rule", ruleId: picked.id, machine: picked.machine ?? null };
    }

    const [first] = matching;
    if (first !== undefined) {
      const candidates: Candidate[] = matching.map((rule) => ({ ruleId: rule.id, profileName: rule.profile, profile: profileOf(rule), machine: rule.machine ?? null }));
      const [head] = candidates as [Candidate, ...Candidate[]];
      const distinct = candidates.some((candidate) => !sameChoice(candidate, head));
      return distinct ? { status: "ambiguous", candidates } : { status: "clear", profile: head.profile, source: "rule", ruleId: first.id, machine: head.machine };
    }
    if (config.default !== null) {
      return { status: "clear", profile: config.profiles[config.default] as Profile, source: "default", ruleId: null, machine: null };
    }
    return { status: "clear", profile: BUILTIN_PROFILE, source: "builtin", ruleId: null, machine: null };
  }
}
