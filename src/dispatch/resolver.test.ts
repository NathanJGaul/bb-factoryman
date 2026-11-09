import { describe, expect, it } from "vitest";
import type { Profile } from "../machine/types";
import * as resolverModule from "./resolver";
import { RulesTableResolver } from "./resolver";
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
  it("[U710] lets an explicit profile win over a matching rule and the default", () => {
    const cfg = config([rule("r", { kind: "ship" }, "fast")], { default: "steady", standingPermission: { lowerReasoning: true } });
    expect(resolve(cfg, {}, { profile: deep })).toEqual({ status: "clear", profile: deep, source: "override", ruleId: null, machine: null });
  });

  it("[U711] is clear with source rule and its ID for the one matching rule", () => {
    const cfg = config([rule("scouting", { kind: "scout" }, "fast"), rule("shipping", { kind: "ship" }, "steady")]);
    expect(resolve(cfg)).toEqual({ status: "clear", profile: steady, source: "rule", ruleId: "shipping", machine: null });
  });

  it("[U712] is ambiguous with both candidates in config order when two matching rules name different profiles", () => {
    const cfg = config([rule("a", { kind: "ship" }, "steady"), rule("b", { mode: "no-mistakes" }, "deep")]);
    expect(resolve(cfg)).toEqual({
      status: "ambiguous",
      candidates: [
        { ruleId: "a", profileName: "steady", profile: steady, machine: null },
        { ruleId: "b", profileName: "deep", profile: deep, machine: null },
      ],
    });
  });

  it.each([
    ["provider", { ...steady, provider: "other" }],
    ["model", { ...steady, model: "other" }],
    ["reasoning level", { ...steady, reasoningLevel: "low" }],
    ["permission mode", { ...steady, permissionMode: "full" as const }],
  ])("[U712] is ambiguous when two matching rules differ only in the %s", (_field, variant) => {
    const cfg = config([rule("a", { kind: "ship" }, "steady"), rule("b", { mode: "no-mistakes" }, "variant")], { profiles: { steady, variant } });
    expect(resolve(cfg).status).toBe("ambiguous");
  });

  it("[U811] carries the rule's machine on a clear result, and no machine from any other source", () => {
    const withMachine = config([{ ...rule("m", { kind: "ship" }, "deep"), machine: "gpu-box" }]);
    expect(resolve(withMachine)).toMatchObject({ status: "clear", source: "rule", machine: "gpu-box" });
    expect(resolve(withMachine, {}, { rule: "m" })).toMatchObject({ machine: "gpu-box" });
    expect(resolve(config([rule("m", { kind: "ship" })]))).toMatchObject({ source: "rule", machine: null });
    expect(resolve(config([], { default: "steady" }))).toMatchObject({ source: "default", machine: null });
    expect(resolve(config(), {}, { profile: deep })).toMatchObject({ source: "override", machine: null });
    // With no source at all the resolver blocks (U1408) and carries no machine.
    expect(resolve(config())).toMatchObject({ status: "blocked", code: "no_default_profile" });
  });

  it("[U812] is ambiguous when two matching rules have equal profiles and different machines", () => {
    const cfg = config([{ ...rule("a", { kind: "ship" }, "deep"), machine: "one" }, { ...rule("b", { mode: "no-mistakes" }, "deep"), machine: "two" }]);
    expect(resolve(cfg)).toMatchObject({ status: "ambiguous", candidates: [{ ruleId: "a", machine: "one" }, { ruleId: "b", machine: "two" }] });
    const same = config([{ ...rule("a", { kind: "ship" }, "deep"), machine: "one" }, { ...rule("b", { mode: "no-mistakes" }, "deep"), machine: "one" }]);
    expect(resolve(same).status).toBe("clear");
    const oneBare = config([{ ...rule("a", { kind: "ship" }, "deep"), machine: "one" }, rule("b", { mode: "no-mistakes" }, "deep")]);
    expect(resolve(oneBare).status).toBe("ambiguous");
  });

  it("[U713] is clear when two matching rules name equal profiles", () => {
    const cfg = config([rule("a", { kind: "ship" }, "deep"), rule("b", { mode: "no-mistakes" }, "deep")]);
    expect(resolve(cfg)).toMatchObject({ status: "clear", profile: deep, source: "rule", ruleId: "a" });
  });

  it("[U714] lets rule pick one of the matching rules", () => {
    const cfg = config([rule("a", { kind: "ship" }, "steady"), rule("b", { mode: "no-mistakes" }, "deep")]);
    expect(resolve(cfg, {}, { rule: "b" })).toEqual({ status: "clear", profile: deep, source: "rule", ruleId: "b", machine: null });
  });

  it.each(["scouting", "ghost"])("[U715] blocks the rule `%s`, which does not exist or does not match the task", (id) => {
    const cfg = config([rule("scouting", { kind: "scout" }, "fast")]);
    expect(resolve(cfg, {}, { rule: id })).toMatchObject({ status: "blocked", code: "rule_not_applicable" });
  });

  it("[U716] applies the configured default when no rule matches", () => {
    expect(resolve(config([rule("scouting", { kind: "scout" })], { default: "steady" }))).toEqual({ status: "clear", profile: steady, source: "default", ruleId: null, machine: null });
  });

  const NO_PROFILE_MESSAGE =
    "No profile applies to this task. The project has no `default` in `.bb/factoryman/dispatch.json`, and no rule matches. " +
    "The plugin does not choose a harness for you. Run `bb factoryman dispatch init --provider <id>` to write a starter file, set `default` in dispatch.json, or pass `profile`.";

  it("[U1408] blocks with no_default_profile when there is no override, no matching rule, and no default", () => {
    expect(resolve(config())).toEqual({ status: "blocked", code: "no_default_profile", message: NO_PROFILE_MESSAGE });
    // A rule that does not match the task leaves the same block.
    expect(resolve(config([rule("scouting", { kind: "scout" })]))).toEqual({ status: "blocked", code: "no_default_profile", message: NO_PROFILE_MESSAGE });
  });

  it("[U1410] exports no BUILTIN_PROFILE, and no resolution has the source builtin", () => {
    expect(Object.keys(resolverModule)).not.toContain("BUILTIN_PROFILE");
    expect(resolve(config())).toMatchObject({ status: "blocked" });
    expect(resolve(config([rule("r", { kind: "ship" })]))).toMatchObject({ status: "clear", source: "rule" });
    expect(resolve(config([], { default: "steady" }))).toMatchObject({ status: "clear", source: "default" });
    expect(resolve(config(), {}, { profile: deep })).toMatchObject({ status: "clear", source: "override" });
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

  it("[U721] matches a keyword as a whole word in any case, and not as a prefix or a suffix of another word", () => {
    expect(matches({ keywords: ["refactor"] }, { description: "Please REFACTOR the store." })).toBe(true);
    expect(matches({ keywords: ["refactor"] }, { description: "Do a prefactoring pass." })).toBe(false);
    expect(matches({ keywords: ["refactor"] }, { description: "Do a prerefactor pass." })).toBe(false);
    expect(matches({ keywords: ["refactor"] }, { description: "Keep refactoring the store." })).toBe(false);
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

  it("[U726] sets no baseline when no rule matches and there is no default, so a low explicit level is clear", () => {
    expect(resolve(config(), {}, { profile: fast }).status).toBe("clear");
  });

  describe("a ladder for each provider", () => {
    const CODEX_LADDER = ["none", "low", "medium", "high", "xhigh", "max", "ultra"];
    const codexHigh: Profile = { provider: "codex", model: "gpt-6-luna", reasoningLevel: "high", permissionMode: "auto" };
    const codexConfig = (reasoningLevels: DispatchConfig["reasoningLevels"]) => config([rule("r", { kind: "ship" }, "codexHigh")], { profiles: { codexHigh, deep }, reasoningLevels });

    it("[U1400] clears a Codex profile at ultra against a Codex baseline at high, with a Codex ladder that ends in ultra", () => {
      const result = resolve(codexConfig({ codex: CODEX_LADDER }), {}, { profile: { ...codexHigh, reasoningLevel: "ultra" } });
      expect(result.status).toBe("clear");
    });

    it("[U1401] blocks a lowered Codex level with reasoning_lowered, and not with cannot be ranked, on the same ladder", () => {
      const result = resolve(codexConfig({ codex: CODEX_LADDER }), {}, { profile: { ...codexHigh, reasoningLevel: "low" } });
      expect(result).toMatchObject({ status: "blocked", code: "reasoning_lowered" });
      expect((result as { message: string }).message).toContain("is below");
      expect((result as { message: string }).message).not.toContain("cannot be ranked");
    });

    it("[U1402] ranks a provider that the record omits in the default ladder", () => {
      const cfg = codexConfig({ claude: ["low", "ultracode"] });
      expect(resolve(cfg, {}, { profile: { ...codexHigh, reasoningLevel: "low" } })).toMatchObject({ status: "blocked", code: "reasoning_lowered" });
      expect(resolve(cfg, {}, { profile: { ...codexHigh, reasoningLevel: "max" } }).status).toBe("clear");
      // ultra is off the default ladder, so it cannot be ranked there.
      const offLadder = resolve(cfg, {}, { profile: { ...codexHigh, reasoningLevel: "ultra" } });
      expect(offLadder).toMatchObject({ status: "blocked", code: "reasoning_lowered" });
      expect((offLadder as { message: string }).message).toContain("cannot be ranked");
    });

    it("[U1403] blocks with cannot be ranked when the baseline's level is not on the explicit profile's ladder, and standing permission lifts the block", () => {
      const claudeDeepBase: Profile = { provider: "claude-code", model: "m", reasoningLevel: "ultracode", permissionMode: "auto" };
      const cfg = config([rule("r", { kind: "ship" }, "base")], { profiles: { base: claudeDeepBase }, reasoningLevels: { codex: CODEX_LADDER } });
      const blocked = resolve(cfg, {}, { profile: { ...codexHigh, reasoningLevel: "max" } });
      expect(blocked).toMatchObject({ status: "blocked", code: "reasoning_lowered" });
      expect((blocked as { message: string }).message).toContain("cannot be ranked");
      const lifted = { ...cfg, standingPermission: { lowerReasoning: true } };
      expect(resolve(lifted, {}, { profile: { ...codexHigh, reasoningLevel: "max" } }).status).toBe("clear");
    });
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

  it("[U744] takes the baseline from the matched rule and not from the default when both exist", () => {
    const cfg = config([rule("r", { kind: "ship" }, "deep")], { default: "fast" });
    expect(resolve(cfg, {}, { profile: { ...deep, reasoningLevel: "medium" } })).toMatchObject({ status: "blocked", code: "reasoning_lowered" });
    const lowRule = config([rule("r", { kind: "ship" }, "fast")], { default: "deep" });
    expect(resolve(lowRule, {}, { profile: { ...deep, reasoningLevel: "medium" } }).status).toBe("clear");
  });

  it("[U729] blocks a choice that sets both a profile and a rule", () => {
    expect(resolve(config(rules), {}, { profile: deep, rule: "r" })).toMatchObject({ status: "blocked", code: "invalid_choice" });
  });
});
