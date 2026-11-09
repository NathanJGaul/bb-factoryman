import { describe, expect, it } from "vitest";
import { DEFAULT_REASONING_LEVELS, emptyDispatchConfig, ladderFor, parseDispatchConfig } from "./config";

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
        roles: { supervisor: { profile: null }, validator: { agent: "observe" } },
      },
    });
    expect(emptyDispatchConfig().profiles).toEqual({});
  });

  it("[U702] rejects an unknown top-level key", () => {
    expect(failure(valid({ surprise: 1 }))).toMatch(/surprise/);
  });

  it.each([
    ["when", valid({ rules: [{ id: "r", when: { kind: "ship", keyword: ["x"] }, profile: "deep" }] }), /keyword/],
    ["a rule", valid({ rules: [{ id: "r", when: { kind: "ship" }, profile: "deep", color: "red" }] }), /color/],
    ["a profile", valid({ profiles: { deep: { ...PROFILE, effort: "max" } } }), /effort/],
    ["the standing permissions", valid({ standingPermission: { lowerReasoning: false, other: true } }), /other/],
  ])("[U702] rejects an unknown key in %s", (_where, raw, pattern) => {
    expect(failure(raw)).toMatch(pattern);
  });

  it("[U810] accepts an optional machine on a rule and rejects a blank one", () => {
    const withMachine = parseDispatchConfig(valid({ rules: [{ id: "r", when: { kind: "ship" }, profile: "deep", machine: "gpu-box" }] }));
    expect(withMachine.ok && withMachine.config.rules[0]).toMatchObject({ machine: "gpu-box" });
    const without = parseDispatchConfig(valid({ rules: [{ id: "r", when: { kind: "ship" }, profile: "deep" }] }));
    expect(without.ok && without.config.rules[0]?.machine).toBeUndefined();
    expect(failure(valid({ rules: [{ id: "r", when: { kind: "ship" }, profile: "deep", machine: "  " }] }))).toMatch(/machine/);
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

  describe("reasoningLevels as an array or a record by provider", () => {
    const LADDERS = { codex: ["none", "low", "medium", "high", "xhigh", "max", "ultra"], "claude-code": ["low", "medium", "high", "xhigh", "ultracode", "max"] };

    it("[U1389] accepts an array and keeps it", () => {
      const result = parseDispatchConfig(valid({ reasoningLevels: ["low", "high"] }));
      expect(result.ok && result.config.reasoningLevels).toEqual(["low", "high"]);
    });

    it("[U1390] accepts a record from provider ID to array and keeps it", () => {
      const result = parseDispatchConfig(valid({ reasoningLevels: LADDERS }));
      expect(result.ok && result.config.reasoningLevels).toEqual(LADDERS);
    });

    it("[U1391] rejects a record with a blank key", () => {
      expect(failure(valid({ reasoningLevels: { " ": ["low"] } }))).toMatch(/ at `reasoningLevels`$/);
    });

    it("[U1392] rejects an empty array at the top level and inside a record, and accepts an array of one level", () => {
      expect(failure(valid({ reasoningLevels: [] }))).toMatch(/ at `reasoningLevels`$/);
      expect(failure(valid({ reasoningLevels: { codex: [] } }))).toMatch(/ at `reasoningLevels(\.codex)?`$/);
      expect(parseDispatchConfig(valid({ reasoningLevels: ["low"] })).ok).toBe(true);
      expect(parseDispatchConfig(valid({ reasoningLevels: { codex: ["low"] } })).ok).toBe(true);
    });

    it("[U1393] rejects a record entry with a repeated level", () => {
      expect(failure(valid({ reasoningLevels: { codex: ["low", "high", "low"] } }))).toMatch(/duplicate|repeat/i);
    });

    it.each([["a string", "low"], ["a number", 3], ["null", null], ["a record of strings", { codex: "low" }]])("[U1395] rejects reasoningLevels that is %s", (_label, value) => {
      expect(parseDispatchConfig(valid({ reasoningLevels: value })).ok).toBe(false);
    });
  });

  describe("ladderFor", () => {
    it("[U1396] returns the array for any provider when the setting is an array", () => {
      expect(ladderFor(["low", "high"], "claude-code")).toEqual(["low", "high"]);
      expect(ladderFor(["low", "high"], "anything")).toEqual(["low", "high"]);
    });

    it("[U1397] returns the record's entry for a provider that has one", () => {
      expect(ladderFor({ codex: ["low", "ultra"], pi: ["low"] }, "codex")).toEqual(["low", "ultra"]);
    });

    it("[U1398] returns the default ladder for a provider that the record omits, including an inherited key", () => {
      expect(ladderFor({ codex: ["low", "ultra"] }, "pi")).toEqual([...DEFAULT_REASONING_LEVELS]);
      expect(ladderFor({ codex: ["low", "ultra"] }, "constructor")).toEqual([...DEFAULT_REASONING_LEVELS]);
      expect(ladderFor({}, "pi")).toEqual([...DEFAULT_REASONING_LEVELS]);
    });
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

describe("parseDispatchConfig: roles", () => {
  const DEFAULT_ROLES = { supervisor: { profile: null }, validator: { agent: "observe" } };
  const roles = (raw: unknown) => {
    const result = parseDispatchConfig(raw);
    if (!result.ok) throw new Error(`expected the config to parse: ${result.message}`);
    return result.config.roles;
  };

  it("[U1612] parses a version 1 file with no roles and carries the default roles", () => {
    expect(roles(valid())).toEqual(DEFAULT_ROLES);
  });

  it("[U1613] carries a supervisor profile that names a defined profile", () => {
    expect(roles(valid({ roles: { supervisor: { profile: "deep" } } }))).toEqual({ supervisor: { profile: "deep" }, validator: { agent: "observe" } });
  });

  it("[U1614] rejects a supervisor profile that names an undefined profile, and names it with the path", () => {
    const message = failure(valid({ roles: { supervisor: { profile: "ghost" } } }));
    expect(message).toMatch(/roles\.supervisor\.profile names the undefined profile `ghost`/);
    expect(message).toMatch(/at `roles\.supervisor\.profile`/);
  });

  it("[U1615] rejects a blank supervisor profile", () => {
    expect(failure(valid({ roles: { supervisor: { profile: "  " } } }))).toMatch(/at `roles\.supervisor\.profile`/);
  });

  it("[U1616] parses the validator agent observe", () => {
    expect(roles(valid({ roles: { validator: { agent: "observe" } } }))).toEqual(DEFAULT_ROLES);
  });

  it.each(["inherit", "set", "anything", ""])("[U1617] rejects the validator agent %j and names the field and the accepted value", (agent) => {
    const message = failure(valid({ roles: { validator: { agent } } }));
    expect(message).toContain('roles.validator.agent must be "observe"');
    expect(message).toMatch(/at `roles\.validator\.agent`/);
  });

  it.each([
    ["roles", { roles: { surprise: 1 } }, /surprise/],
    ["roles.supervisor", { roles: { supervisor: { surprise: 1 } } }, /surprise/],
    ["roles.validator", { roles: { validator: { surprise: 1 } } }, /surprise/],
  ])("[U1618] rejects an unknown key in %s", (_where, extra, pattern) => {
    expect(failure(valid(extra))).toMatch(pattern);
  });

  it("[U1619] parses an empty roles, an empty supervisor, and an empty validator with the defaults filled in", () => {
    expect(roles(valid({ roles: {} }))).toEqual(DEFAULT_ROLES);
    expect(roles(valid({ roles: { supervisor: {} } }))).toEqual(DEFAULT_ROLES);
    expect(roles(valid({ roles: { validator: {} } }))).toEqual(DEFAULT_ROLES);
  });

  it("[U1620] gives the empty config the default roles", () => {
    expect(emptyDispatchConfig().roles).toEqual(DEFAULT_ROLES);
  });
});
