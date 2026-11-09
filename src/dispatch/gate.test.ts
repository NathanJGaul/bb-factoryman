import { describe, expect, it } from "vitest";
import type { MachineInfo } from "../bb/port";
import { FakeBbPort, providerState } from "../../test/fixtures/bb-port";
import type { Profile } from "../machine/types";
import { gateProfile } from "./gate";

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
    expect(result).toMatchObject({ ok: false, code: "provider_unavailable" });
    expect(result).toMatchObject({ message: expect.stringContaining("not signed in on gpu-box") });
    // The default host's states would have passed it.
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

  it("[U1345] returns provider_unavailable, not permanent, for a provider that is not ready", async () => {
    const bb = new FakeBbPort();
    bb.states = [providerState("claude", { status: "expired" })];
    expect(await gateProfile(bb, profile, "direct-PR", null)).toMatchObject({ ok: false, code: "provider_unavailable", permanent: false });
  });
});
