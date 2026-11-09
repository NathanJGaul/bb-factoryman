import { describe, expect, it } from "vitest";
import type { MachineInfo } from "../bb/port";
import { FakeBbPort, modelEntry, providerState } from "../../test/fixtures/bb-port";
import type { Profile } from "../machine/types";
import { admit, gateProfile } from "./gate";

const profile: Profile = { provider: "claude", model: "opus", reasoningLevel: "high", permissionMode: "auto" };
const GPU: MachineInfo = { id: "host_gpu", name: "gpu-box", status: "connected", phase: "active", online: true };

describe("gateProfile: reads", () => {
  it("[U1339] returns ok for a ready profile", async () => {
    expect(await gateProfile(new FakeBbPort(), profile, "direct-PR", null)).toEqual({ ok: true });
  });

  it("[U1340] reads the providers and the states with the placed machine's ID, and a remote machine's own states decide", async () => {
    const bb = new FakeBbPort();
    bb.statesByHost.set("host_gpu", [providerState("claude", { status: "unauthenticated", localLoginCommand: "claude login" })]);
    const result = await gateProfile(bb, profile, "direct-PR", GPU);
    expect(bb.callsTo("listProviders")).toEqual([["host_gpu"]]);
    expect(bb.callsTo("getProviderStates")).toEqual([["host_gpu"]]);
    expect(bb.callsTo("listModels")).toEqual([["claude", "host_gpu"]]);
    expect(result).toMatchObject({ ok: false, code: "provider_unavailable" });
    expect(result).toMatchObject({ message: expect.stringContaining("not signed in on gpu-box") });
  });

  it("[U1340] lets the default host's own ready states pass the same profile that the remote machine's states block", async () => {
    expect(await gateProfile(new FakeBbPort(), profile, "direct-PR", null)).toEqual({ ok: true });
  });

  it("[U1341] reads with no host ID for the default host, and names it in a message", async () => {
    const bb = new FakeBbPort();
    bb.states = [providerState("claude", { status: "not_installed" })];
    const result = await gateProfile(bb, profile, "direct-PR", null);
    expect(bb.callsTo("listProviders")).toEqual([[undefined]]);
    expect(bb.callsTo("getProviderStates")).toEqual([[undefined]]);
    expect(result).toMatchObject({ ok: false, message: expect.stringContaining("not installed on the default host") });
  });

  it("[U1342] returns read_failed when the providers read throws", async () => {
    const bb = new FakeBbPort();
    bb.providersError = new Error("HTTP 500");
    expect(await gateProfile(bb, profile, "direct-PR", null)).toEqual({ ok: false, code: "read_failed", message: "could not read bb's providers (HTTP 500)" });
  });

  it("[U1343] returns read_failed when the states read throws", async () => {
    const bb = new FakeBbPort();
    bb.statesError = new Error("HTTP 404");
    expect(await gateProfile(bb, profile, "direct-PR", null)).toEqual({ ok: false, code: "read_failed", message: "could not read bb's provider states (HTTP 404)" });
  });

  it("[U1344] returns read_failed when the models read throws", async () => {
    const bb = new FakeBbPort();
    bb.modelsError = new Error("HTTP 503");
    expect(await gateProfile(bb, profile, "direct-PR", null)).toEqual({ ok: false, code: "read_failed", message: "could not read bb's models (HTTP 503)" });
  });

  it("[U1345] returns provider_unavailable, not permanent, for a provider that is not ready", async () => {
    const bb = new FakeBbPort();
    bb.states = [providerState("claude", { status: "expired" })];
    expect(await gateProfile(bb, profile, "direct-PR", null)).toMatchObject({ ok: false, code: "provider_unavailable", permanent: false });
  });
});

const MODES = ["no-mistakes", "direct-PR", "local-only"] as const;
const pi: Profile = { provider: "pi", model: "openai/gpt-6-luna", reasoningLevel: "medium", permissionMode: "full" };

describe("admit", () => {
  it("[U1358] refuses pi in local-only mode", () => {
    expect(admit("pi", "local-only")).toEqual(expect.stringContaining("`pi` is not admitted for local-only projects"));
  });

  it("[U1359] admits pi in direct-PR mode", () => {
    expect(admit("pi", "direct-PR")).toBeNull();
  });

  it("[U1360] admits pi in no-mistakes mode", () => {
    expect(admit("pi", "no-mistakes")).toBeNull();
  });

  it.each(["claude-code", "codex", "acp-omp"])("[U1361] never refuses %s in any mode", (provider) => {
    for (const mode of MODES) expect(admit(provider, mode), `${provider} ${mode}`).toBeNull();
  });

  it.each(["acp-opencode", "never-heard-of-it", ""])("[U1362] never refuses the provider %j, which has no refused mode, in any mode", (provider) => {
    for (const mode of MODES) expect(admit(provider, mode), `${provider} ${mode}`).toBeNull();
  });

  it("[U1364] names the provider and the mode, gives the row's reason, lists exactly the modes where the provider is allowed, and ends with no other provider was tried", () => {
    expect(admit("pi", "local-only")).toBe(
      "The provider `pi` is not admitted for local-only projects. " +
        "It runs workers with no sandbox (it offers only the permission mode `full`), so a worker can answer the owner's merge form with `bb thread interactions respond` (D-030), and local-only mode has no pull request backstop. " +
        "It is allowed in: no-mistakes, direct-PR. No other provider was tried.",
    );
  });
});

describe("gateProfile: admission", () => {
  it("[U1363] returns provider_not_admitted, permanent, for a refused provider", async () => {
    const result = await gateProfile(new FakeBbPort(), pi, "local-only", null);
    expect(result).toMatchObject({ ok: false, code: "provider_not_admitted", permanent: true });
    expect(result).toMatchObject({ message: expect.stringContaining("The provider `pi` is not admitted for local-only projects. It runs workers with no sandbox") });
  });

  it("[U1365] refuses before it makes any bb read", async () => {
    const bb = new FakeBbPort();
    await gateProfile(bb, pi, "local-only", null);
    expect(bb.calls).toEqual([]);
  });

  it("[U1366] refuses before it checks readiness: pi in local-only mode with a signed-out state gets the admission message", async () => {
    const bb = new FakeBbPort();
    bb.states = [providerState("pi", { status: "unauthenticated" })];
    expect(await gateProfile(bb, pi, "local-only", null)).toMatchObject({ code: "provider_not_admitted" });
  });

  it("passes pi in direct-PR and no-mistakes modes on to the other checks", async () => {
    const bb = new FakeBbPort();
    bb.providers = [{ id: "pi", available: true, permissionModes: ["full"], reasoningLevels: ["medium"] }];
    bb.states = [providerState("pi")];
    // Pi refuses a model that bb does not list (feature 009, H2), so the model is listed here.
    bb.models.set("pi", { models: [modelEntry(pi.model, { reasoningLevels: ["medium"] })], loadError: null });
    for (const mode of ["direct-PR", "no-mistakes"] as const) expect(await gateProfile(bb, pi, mode, null), mode).toEqual({ ok: true });
  });
});
