import { describe, expect, it } from "vitest";
import type { Profile } from "../machine/types";
import { BUILTIN_PROFILE, RulesTableResolver } from "./resolver";
import { emptyDispatchConfig } from "./config";
import type { DispatchConfig, Rule, TaskFacts } from "./types";

const deep: Profile = { provider: "claude", model: "opus", reasoningLevel: "xhigh", permissionMode: "auto" };
const steady: Profile = { provider: "claude", model: "sonnet", reasoningLevel: "high", permissionMode: "auto" };
const fast: Profile = { provider: "claude", model: "haiku", reasoningLevel: "low", permissionMode: "accept-edits" };

const TASK: TaskFacts = { kind: "ship", mode: "no-mistakes", description: "Add a flag to the status command.", tags: [] };

function config(rules: Rule[] = [], extra: Partial<DispatchConfig> = {}): DispatchConfig {
  return { ...emptyDispatchConfig(), profiles: { deep, steady, fast }, rules, ...extra };
}
const rule = (id: string, when: Rule["when"], profile = "deep"): Rule => ({ id, when, profile });

const resolver = new RulesTableResolver();
const resolve = (cfg: DispatchConfig, facts: Partial<TaskFacts> = {}, choice = {}) => resolver.resolve({ ...TASK, ...facts }, cfg, choice);

describe("RulesTableResolver precedence", () => {
  it("[U710] lets an explicit profile win over a matching rule, the default, and the built-in default", () => {
    const cfg = config([rule("r", { kind: "ship" }, "fast")], { default: "steady", standingPermission: { lowerReasoning: true } });
    expect(resolve(cfg, {}, { profile: deep })).toEqual({ status: "clear", profile: deep, source: "override", ruleId: null });
  });

  it("[U711] is clear with source rule and its ID for the one matching rule", () => {
    const cfg = config([rule("scouting", { kind: "scout" }, "fast"), rule("shipping", { kind: "ship" }, "steady")]);
    expect(resolve(cfg)).toEqual({ status: "clear", profile: steady, source: "rule", ruleId: "shipping" });
  });

  it("[U712] is ambiguous with both candidates in config order when two matching rules name different profiles", () => {
    const cfg = config([rule("a", { kind: "ship" }, "steady"), rule("b", { mode: "no-mistakes" }, "deep")]);
    expect(resolve(cfg)).toEqual({
      status: "ambiguous",
      candidates: [
        { ruleId: "a", profileName: "steady", profile: steady },
        { ruleId: "b", profileName: "deep", profile: deep },
      ],
    });
  });

  it("[U713] is clear when two matching rules name equal profiles", () => {
    const cfg = config([rule("a", { kind: "ship" }, "deep"), rule("b", { mode: "no-mistakes" }, "deep")]);
    expect(resolve(cfg)).toMatchObject({ status: "clear", profile: deep, source: "rule", ruleId: "a" });
  });

  it("[U714] lets rule pick one of the matching rules", () => {
    const cfg = config([rule("a", { kind: "ship" }, "steady"), rule("b", { mode: "no-mistakes" }, "deep")]);
    expect(resolve(cfg, {}, { rule: "b" })).toEqual({ status: "clear", profile: deep, source: "rule", ruleId: "b" });
  });

  it("[U715] blocks a rule that does not exist or does not match the task", () => {
    const cfg = config([rule("scouting", { kind: "scout" }, "fast")]);
    for (const id of ["scouting", "ghost"]) {
      expect(resolve(cfg, {}, { rule: id })).toMatchObject({ status: "blocked", code: "rule_not_applicable" });
    }
  });

  it("[U716] applies the configured default when no rule matches", () => {
    expect(resolve(config([rule("scouting", { kind: "scout" })], { default: "steady" }))).toEqual({ status: "clear", profile: steady, source: "default", ruleId: null });
  });

  it("[U717] applies the built-in default when there is no rule match and no default", () => {
    expect(resolve(config())).toEqual({ status: "clear", profile: BUILTIN_PROFILE, source: "builtin", ruleId: null });
    expect(BUILTIN_PROFILE).toEqual({ provider: "claude-code", model: "claude-sonnet-5-5", reasoningLevel: "high", permissionMode: "auto" });
  });
});

describe("RulesTableResolver matching", () => {
  const matches = (when: Rule["when"], facts: Partial<TaskFacts> = {}) => {
    const result = resolve(config([rule("r", when)]), facts);
    return result.status === "clear" && result.source === "rule";
  };

  it("[U718] matches kind only for that kind", () => {
    expect(matches({ kind: "scout" }, { kind: "scout" })).toBe(true);
    expect(matches({ kind: "scout" }, { kind: "ship" })).toBe(false);
  });

  it("[U719] matches mode only for that delivery mode", () => {
    expect(matches({ mode: "local-only" }, { mode: "local-only" })).toBe(true);
    expect(matches({ mode: "local-only" }, { mode: "direct-PR" })).toBe(false);
  });

  it("[U720] needs every tag, and a task with no tags matches no tags rule", () => {
    expect(matches({ tags: ["docs", "small"] }, { tags: ["small", "docs", "extra"] })).toBe(true);
    expect(matches({ tags: ["docs", "small"] }, { tags: ["docs"] })).toBe(false);
    expect(matches({ tags: ["docs"] }, { tags: [] })).toBe(false);
    expect(matches({ tags: ["Docs"] }, { tags: ["docs"] })).toBe(true);
  });

  it("[U721] matches a keyword as a whole word in any case and not as a substring", () => {
    expect(matches({ keywords: ["refactor"] }, { description: "Please REFACTOR the store." })).toBe(true);
    expect(matches({ keywords: ["refactor"] }, { description: "Do a prefactoring pass." })).toBe(false);
    expect(matches({ keywords: ["fix", "bug"] }, { description: "A bug in the parser." })).toBe(true);
    expect(matches({ keywords: ["a.b"] }, { description: "uses axb here" })).toBe(false);
  });

  it("requires every present condition together", () => {
    expect(matches({ kind: "ship", keywords: ["flag"] }, { kind: "scout" })).toBe(false);
    expect(matches({ kind: "ship", keywords: ["flag"] }, { description: "Add a flag." })).toBe(true);
  });
});

describe("RulesTableResolver reasoning floor", () => {
  const rules = [rule("r", { kind: "ship" }, "deep")];
  const lowered: Profile = { ...deep, reasoningLevel: "medium" };

  it("[U722] blocks an explicit level below the matched rule's level", () => {
    expect(resolve(config(rules), {}, { profile: lowered })).toMatchObject({ status: "blocked", code: "reasoning_lowered" });
  });

  it("[U723] clears an explicit level equal to or above the baseline", () => {
    expect(resolve(config(rules), {}, { profile: deep }).status).toBe("clear");
    expect(resolve(config(rules), {}, { profile: { ...deep, reasoningLevel: "max" } }).status).toBe("clear");
  });

  it("[U724] lets standing permission lift the block", () => {
    const cfg = config(rules, { standingPermission: { lowerReasoning: true } });
    expect(resolve(cfg, {}, { profile: lowered }).status).toBe("clear");
  });

  it("[U725] blocks a differing level that is off the ladder, on either side", () => {
    expect(resolve(config(rules), {}, { profile: { ...deep, reasoningLevel: "ultracode" } })).toMatchObject({ status: "blocked", code: "reasoning_lowered" });
    const offLadderBase = config([rule("r", { kind: "ship" }, "odd")], { profiles: { odd: { ...deep, reasoningLevel: "ultracode" }, deep } });
    expect(resolve(offLadderBase, {}, { profile: deep })).toMatchObject({ status: "blocked", code: "reasoning_lowered" });
    expect(resolve(offLadderBase, {}, { profile: { ...deep, reasoningLevel: "ultracode" } }).status).toBe("clear");
  });

  it("[U726] sets no baseline from the built-in default, so a low explicit level is clear", () => {
    expect(resolve(config(), {}, { profile: fast }).status).toBe("clear");
  });

  it("[U727] blocks an explicit level below any candidate when the baseline is ambiguous", () => {
    const cfg = config([rule("a", { kind: "ship" }, "steady"), rule("b", { mode: "no-mistakes" }, "deep")]);
    expect(resolve(cfg, {}, { profile: { ...steady, reasoningLevel: "high" } })).toMatchObject({ status: "blocked", code: "reasoning_lowered" });
    expect(resolve(cfg, {}, { profile: deep }).status).toBe("clear");
  });

  it("[U728] takes the baseline from the configured default when no rule matches", () => {
    const cfg = config([], { default: "deep" });
    expect(resolve(cfg, {}, { profile: lowered })).toMatchObject({ status: "blocked", code: "reasoning_lowered" });
  });

  it("[U729] blocks a choice that sets both a profile and a rule", () => {
    expect(resolve(config(rules), {}, { profile: deep, rule: "r" })).toMatchObject({ status: "blocked", code: "invalid_choice" });
  });
});
