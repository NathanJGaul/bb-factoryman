import { afterEach, describe, expect, it } from "vitest";
import { FakeBbPort } from "./bb-port";
import { makeCheckout, removeCheckouts } from "./checkout";
import { DISPATCH, loadWorld, providerFixture, TEST_DEFAULT_DISPATCH } from "./plugin-host";

afterEach(removeCheckouts);

// The model IDs that the existing tests dispatch with, written out. This is the pin: a change to the shared list in models.ts fails here.
const DEFAULT_MODEL_IDS_LITERAL = ["opus", "sonnet", "haiku", "claude-sonnet-5-5", "stub-model", "m", "b", "other", "opus-strict"];

// Many tests rely on these defaults without saying so (they dispatch a model such as "opus" and expect a ready
// provider). This file pins them, so a change to one fails here and not in forty other places.

describe("the defaults of FakeBbPort", () => {
  it("reports every listed provider as ready when it is available and not installed when it is not", async () => {
    const bb = new FakeBbPort();
    bb.providers = [
      { id: "codex", available: true, permissionModes: ["auto"], reasoningLevels: [] },
      { id: "pi", available: false, permissionModes: ["full"], reasoningLevels: [] },
    ];
    expect((await bb.getProviderStates()).map((state) => [state.providerId, state.status])).toEqual([["codex", "ready"], ["pi", "not_installed"]]);
  });

  it("lists the default model IDs, with levels low to max that bb knows, for any provider, and no load error", async () => {
    const bb = new FakeBbPort();
    for (const provider of ["claude", "pi", "acp-omp", "a-provider-nobody-has-heard-of"]) {
      const list = await bb.listModels(provider);
      expect(list.models.map((model) => model.id), provider).toEqual(DEFAULT_MODEL_IDS_LITERAL);
      expect(list.loadError, provider).toBeNull();
      for (const model of list.models) {
        expect(model.reasoningLevels).toEqual(["low", "medium", "high", "xhigh", "max"]);
        expect(model.reasoningKnown).toBe(true);
      }
    }
  });

  it("knows no failure cause for a thread", async () => {
    expect(await new FakeBbPort().getFailureCause("thr-w1")).toBeNull();
  });
});

describe("the defaults of loadWorld", () => {
  it("answers providerStates with ready for the default providers, and not_installed for an unavailable one", async () => {
    const world = await loadWorld();
    const states = await world.host.bb.sdk.system.providerStates();
    expect(states.providers.map((state) => [state.providerId, state.status])).toEqual([["claude", "ready"], ["claude-code", "ready"]]);
    const down = await loadWorld({ providers: [providerFixture("pi", { available: false })] });
    expect((await down.host.bb.sdk.system.providerStates()).providers.map((state) => state.status)).toEqual(["not_installed"]);
  });

  it("lists the same default model IDs as FakeBbPort for any provider, with no load error", async () => {
    const world = await loadWorld();
    for (const providerId of ["claude", "pi", "acp-omp"]) {
      const answer = await world.host.bb.sdk.providers.models({ providerId });
      expect(answer.models.map((model) => model.id), providerId).toEqual(DEFAULT_MODEL_IDS_LITERAL);
      expect(answer.modelLoadError).toBeNull();
    }
  });

  it("has no error event in any thread log", async () => {
    const world = await loadWorld();
    expect(await world.host.bb.sdk.threads.events.list({ threadId: "thr-w1", types: ["provider/error", "system/error"] })).toEqual([]);
  });

  it("supplies the old built-in profile as the default dispatch.json without bareConfig, and none with it", async () => {
    expect(TEST_DEFAULT_DISPATCH).toMatchObject({ default: "test-default", standingPermission: { lowerReasoning: true } });
    const supplied = await loadWorld({ checkout: makeCheckout() });
    const result = await supplied.call("factoryman_dispatch", { kind: "ship", description: "Add a flag." });
    expect(result.isError, result.text).toBe(false);
    expect(result.text).toContain("from the configured default");
    const bare = await loadWorld({ checkout: makeCheckout(), bareConfig: true });
    const blocked = await bare.call("factoryman_dispatch", { kind: "ship", description: "Add a flag." });
    expect(blocked.isError).toBe(true);
    expect(blocked.text).toContain("no_default_profile");
  });

  it("dispatches the explicit test profile without any script", async () => {
    const world = await loadWorld();
    expect((await world.call("factoryman_dispatch", DISPATCH)).isError).toBe(false);
  });
});
