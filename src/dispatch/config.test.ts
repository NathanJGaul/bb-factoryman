import { describe, expect, it } from "vitest";
import { emptyDispatchConfig, parseDispatchConfig } from "./config";

const PROFILE = { provider: "claude", model: "opus", reasoningLevel: "high", permissionMode: "auto" };
const valid = (extra: Record<string, unknown> = {}) => ({ version: 1, profiles: { deep: PROFILE }, rules: [], ...extra });

function failure(raw: unknown): string {
  const result = parseDispatchConfig(raw);
  if (result.ok) throw new Error("expected the config to be rejected");
  return result.message;
}

describe("parseDispatchConfig", () => {
  it("[U701] parses a minimal config and fills the default ladder, the absent default, and the permissions", () => {
    const result = parseDispatchConfig(valid());
    expect(result).toEqual({
      ok: true,
      config: {
        version: 1,
        profiles: { deep: PROFILE },
        default: null,
        rules: [],
        reasoningLevels: ["none", "low", "medium", "high", "xhigh", "max"],
        standingPermission: { lowerReasoning: false },
      },
    });
    expect(emptyDispatchConfig().profiles).toEqual({});
  });

  it("[U702] rejects an unknown top-level key", () => {
    expect(failure(valid({ surprise: 1 }))).toMatch(/surprise/);
  });

  it.each([
    ["when", valid({ rules: [{ id: "r", when: { kind: "ship", keyword: ["x"] }, profile: "deep" }] }), /keyword/],
    ["a rule", valid({ rules: [{ id: "r", when: { kind: "ship" }, profile: "deep", machine: "m" }] }), /machine/],
    ["a profile", valid({ profiles: { deep: { ...PROFILE, effort: "max" } } }), /effort/],
    ["the standing permissions", valid({ standingPermission: { lowerReasoning: false, other: true } }), /other/],
  ])("[U702] rejects an unknown key in %s", (_where, raw, pattern) => {
    expect(failure(raw)).toMatch(pattern);
  });

  it("[U703] rejects a rule that names an undefined profile", () => {
    expect(failure(valid({ rules: [{ id: "r", when: { kind: "ship" }, profile: "ghost" }] }))).toMatch(/ghost/);
  });

  it("[U704] rejects a default that names an undefined profile", () => {
    expect(failure(valid({ default: "ghost" }))).toMatch(/ghost/);
  });

  it("[U705] rejects a rule with an empty when and a rule with an empty list", () => {
    expect(failure(valid({ rules: [{ id: "r", when: {}, profile: "deep" }] }))).toMatch(/condition/);
    expect(failure(valid({ rules: [{ id: "r", when: { tags: [] }, profile: "deep" }] }))).toMatch(/condition|tags/);
  });

  it("[U706] rejects two rules with the same ID", () => {
    const rule = { id: "r", when: { kind: "ship" }, profile: "deep" };
    expect(failure(valid({ rules: [rule, rule] }))).toMatch(/duplicate/i);
  });

  it("[U707] rejects a ladder with a repeated level", () => {
    expect(failure(valid({ reasoningLevels: ["low", "high", "low"] }))).toMatch(/duplicate|repeat/i);
  });

  it("[U708] rejects a profile with a missing field or an unknown permission mode", () => {
    expect(failure(valid({ profiles: { deep: { provider: "claude" } } }))).toMatch(/model|reasoningLevel/);
    expect(failure(valid({ profiles: { deep: { ...PROFILE, permissionMode: "yolo" } } }))).toMatch(/permissionMode/);
  });

  it("[U709] rejects a version other than 1 and input that is not an object", () => {
    expect(failure(valid({ version: 2 }))).toMatch(/version/);
    expect(failure("text")).toMatch(/object/);
  });
});
