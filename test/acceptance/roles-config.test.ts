import { afterEach, describe, expect, it } from "vitest";
import { makeCheckout, removeCheckouts } from "../fixtures/checkout";
import { loadWorld } from "../fixtures/plugin-host";

afterEach(removeCheckouts);

const TASK = { kind: "ship", description: "Add a --json flag to the status command." } as const;
const PROFILE = { provider: "claude", model: "opus", reasoningLevel: "high", permissionMode: "auto" };
const file = (extra: Record<string, unknown> = {}) => ({ version: 1, profiles: { deep: PROFILE }, default: "deep", rules: [], ...extra });
const bare = (dispatch: unknown) => loadWorld({ bareConfig: true, checkout: makeCheckout({ dispatch }) });

describe("the roles block of dispatch.json, through the plugin factory", () => {
  it("[A1606] blocks a dispatch when the roles block is invalid, and names the field", async () => {
    const cases: Array<[unknown, string]> = [
      [{ validator: { agent: "set" } }, 'roles.validator.agent must be "observe"'],
      [{ validator: { agent: "inherit" } }, 'roles.validator.agent must be "observe"'],
      [{ supervisor: { profile: "ghost" } }, "roles.supervisor.profile names the undefined profile `ghost`"],
      [{ surprise: true }, 'Unrecognized key: "surprise"'],
    ];
    for (const [roles, reason] of cases) {
      const world = await bare(file({ roles }));
      const result = await world.call("factoryman_dispatch", TASK);
      expect(result.isError, JSON.stringify(roles)).toBe(true);
      expect(result.text).toContain("Dispatch blocked (config_invalid): dispatch.json is invalid:");
      expect(result.text).toContain(reason);
      expect(result.text).toContain("No task was created.");
      expect(world.store.listTasks()).toEqual([]);
      expect(world.sdkCalls("threads.spawn")).toEqual([]);
    }
  });

  it("[A1606] dispatches as before when the roles block is valid, and when there is none", async () => {
    for (const roles of [{ roles: { supervisor: { profile: "deep" }, validator: { agent: "observe" } } }, {}]) {
      const world = await bare(file(roles));
      const result = await world.call("factoryman_dispatch", TASK);
      expect(result.isError, JSON.stringify(roles)).toBe(false);
      expect(world.store.listTasks()).toHaveLength(1);
      expect(world.sdkCalls("threads.spawn")).toHaveLength(1);
    }
  });
});
