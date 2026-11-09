import { describe, expect, it } from "vitest";
import { providerState } from "../../test/fixtures/bb-port";
import { PROFILE } from "../../test/fixtures/machine";
import { testRuntime } from "../../test/fixtures/runtime";
import { defaultProjectConfig } from "../store/store";
import type { Caller } from "./dispatch";
import { dispatch } from "./dispatch";

const supervisor: Caller = { threadId: "thr-sup", projectId: "proj-1" };
const profile = { ...PROFILE, permissionMode: "accept-edits" };
const valid = { kind: "ship", description: "Add a --json flag to the status command.", profile };

function setup() {
  const t = testRuntime();
  t.bb.addThread({ id: "thr-sup" });
  return t;
}

describe("factoryman_dispatch", () => {
  it("[U41] creates a ship task in the project's configured delivery mode", async () => {
    const t = setup();
    t.runtime.deps.store.putProjectConfig({ ...defaultProjectConfig("proj-1"), deliveryMode: "direct-PR" });
    const outcome = await dispatch(t.runtime, supervisor, valid);
    expect(outcome.ok).toBe(true);
    expect(t.runtime.deps.store.getTask("t1")).toMatchObject({ kind: "ship", mode: "direct-PR", state: "working", projectId: "proj-1" });
  });

  it("[U42] dispatches a project with no config in no-mistakes mode", async () => {
    const t = setup();
    await dispatch(t.runtime, supervisor, valid);
    expect(t.runtime.deps.store.getTask("t1")?.mode).toBe("no-mistakes");
  });

  it("[U43] creates a scout task for a scout dispatch", async () => {
    const t = setup();
    await dispatch(t.runtime, supervisor, { ...valid, kind: "scout" });
    expect(t.runtime.deps.store.getTask("t1")).toMatchObject({ kind: "scout", state: "working" });
  });

  it("[U44] plans the branch as the configured prefix plus the task ID, or fm/ plus the task ID", async () => {
    const plain = setup();
    await dispatch(plain.runtime, supervisor, valid);
    expect(plain.runtime.deps.store.getTask("t1")?.branch).toBe("fm/t1");
    const prefixed = setup();
    prefixed.runtime.deps.store.putProjectConfig({ ...defaultProjectConfig("proj-1"), branchPrefix: "wip/" });
    await dispatch(prefixed.runtime, supervisor, valid);
    expect(prefixed.runtime.deps.store.getTask("t1")?.branch).toBe("wip/t1");
  });

  it("[U45] records start with the profile, the worker thread, the branch, and the description as evidence", async () => {
    const t = setup();
    await dispatch(t.runtime, supervisor, valid);
    const start = t.runtime.deps.store.listEvents({ taskId: "t1" }).find((row) => row.event === "start");
    expect(start).toMatchObject({ outcome: "applied", actor: "supervisor", evidence: valid.description });
    expect(start?.payload).toEqual({ profile, threadId: "thr-w1", branch: "fm/t1", machine: null, cloneMachine: "host_local" });
  });

  it("[U46] spawns one worker as a child of the caller with role metadata and the built prompt", async () => {
    const t = setup();
    await dispatch(t.runtime, supervisor, valid);
    expect(t.bb.callsTo("spawnWorker")).toHaveLength(1);
    const [[request]] = t.bb.callsTo("spawnWorker") as [[{ projectId: string; parentThreadId: string; metadata: unknown; prompt: string; profile: unknown; baseBranch: unknown }]];
    expect(request).toMatchObject({ projectId: "proj-1", parentThreadId: "thr-sup", metadata: { role: "worker", taskId: "t1", kind: "ship" }, profile, baseBranch: null });
    expect(request.prompt).toContain("fm/t1");
    expect(request.prompt).toContain(valid.description);
  });

  it("[U47] refuses a worker caller with no task and no spawn", async () => {
    const t = setup();
    await dispatch(t.runtime, supervisor, valid);
    const second = await dispatch(t.runtime, { threadId: "thr-w1", projectId: "proj-1" }, valid);
    expect(second.ok).toBe(false);
    expect(second.text).toContain("actor_forbidden");
    expect(t.runtime.deps.store.listTasks()).toHaveLength(1);
    expect(t.bb.callsTo("spawnWorker")).toHaveLength(1);
  });

  it("[U48] refuses invalid arguments with no task and no spawn", async () => {
    const cases: unknown[] = [
      { ...valid, kind: "epic" },
      { ...valid, description: "   " },
      { ...valid, profile: { ...profile, model: "" } },
      { ...valid, profile: { ...profile, permissionMode: "yolo" } },
      { ...valid, extra: true },
      { kind: "ship" },
    ];
    for (const raw of cases) {
      const t = setup();
      const outcome = await dispatch(t.runtime, supervisor, raw);
      expect(outcome.ok, JSON.stringify(raw)).toBe(false);
      expect(t.runtime.deps.store.listTasks()).toEqual([]);
      expect(t.bb.callsTo("spawnWorker")).toEqual([]);
    }
  });

  it("[U49] records fail with the spawn error as evidence when the spawn fails", async () => {
    const t = setup();
    t.bb.spawnError = new Error("host offline");
    const outcome = await dispatch(t.runtime, supervisor, valid);
    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("host offline");
    expect(t.runtime.deps.store.getTask("t1")?.state).toBe("failed");
    const fail = t.runtime.deps.store.listEvents({ taskId: "t1" }).find((row) => row.event === "fail");
    expect(fail).toMatchObject({ actor: "system", outcome: "applied" });
    expect(fail?.evidence).toContain("host offline");
  });

  it("[U50] records fail when the worker thread is already in error after start", async () => {
    const t = setup();
    const original = t.bb.spawnWorker.bind(t.bb);
    t.bb.spawnWorker = async (request) => {
      const result = await original(request);
      t.bb.threads.get(result.threadId)!.status = "error";
      return result;
    };
    const outcome = await dispatch(t.runtime, supervisor, valid);
    expect(outcome.ok).toBe(false);
    expect(t.runtime.deps.store.getTask("t1")?.state).toBe("failed");
  });

  it("[U51] names the task ID, the worker thread, and the branch in the result", async () => {
    const t = setup();
    const outcome = await dispatch(t.runtime, supervisor, valid);
    expect(outcome).toEqual({ ok: true, text: "Dispatched ship task t1 in no-mistakes mode. Worker thread thr-w1, branch fm/t1." });
  });
});

describe("factoryman_dispatch placement failures", () => {
  function remote() {
    const t = setup();
    t.bb.machines.push({ id: "host_gpu", name: "gpu-box", status: "connected", phase: "active", online: true });
    t.bb.sources.push({ hostId: "host_gpu", path: "/work/gpu", isDefault: false });
    return t;
  }

  it.each([
    ["the machines cannot be listed", (t: ReturnType<typeof remote>) => void (t.bb.machinesError = new Error("bb is down"))],
    ["the project sources cannot be read", (t: ReturnType<typeof remote>) => void (t.bb.sourcesError = new Error("bb is down"))],
  ])("[U857] stops, and spawns nothing on any host, when %s", async (_label, break_) => {
    const t = remote();
    break_(t);
    const outcome = await dispatch(t.runtime, supervisor, { ...valid, machine: "gpu-box" });
    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("could not read bb's machines");
    expect(outcome.text).toContain("No task was created");
    expect(t.bb.callsTo("spawnWorker")).toEqual([]);
    expect(t.runtime.deps.store.listTasks()).toEqual([]);
  });

  it("[U858] stops when the preflight cannot run, and spawns nothing", async () => {
    const t = remote();
    t.runtime.deps.exec = async () => {
      throw new Error("terminal exploded");
    };
    const outcome = await dispatch(t.runtime, supervisor, { ...valid, machine: "gpu-box" });
    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("preflight");
    expect(outcome.text).toContain("terminal exploded");
    expect(t.bb.callsTo("spawnWorker")).toEqual([]);
    expect(t.runtime.deps.store.listTasks()).toEqual([]);
  });

  it("[U859] checks the provider on the target host and not only on the default host", async () => {
    const t = remote();
    t.bb.providersByHost.set("host_gpu", [{ id: "claude", available: false, permissionModes: ["accept-edits"], reasoningLevels: [] }]);
    const outcome = await dispatch(t.runtime, supervisor, { ...valid, machine: "gpu-box" });
    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("provider_unavailable");
    expect(t.bb.callsTo("listProviders").map(([host]) => host)).toContain("host_gpu");
    expect(t.bb.callsTo("spawnWorker")).toEqual([]);
  });

  it("[U860] still checks the provider after a preflight pass is cached", async () => {
    const t = remote();
    expect((await dispatch(t.runtime, supervisor, { ...valid, machine: "gpu-box" })).ok).toBe(true);
    t.bb.providersByHost.set("host_gpu", [{ id: "claude", available: false, permissionModes: ["accept-edits"], reasoningLevels: [] }]);
    const second = await dispatch(t.runtime, supervisor, { ...valid, machine: "gpu-box" });
    expect(second.ok).toBe(false);
    expect(second.text).toContain("provider_unavailable");
    expect(t.bb.callsTo("spawnWorker")).toHaveLength(1);
  });
});

describe("factoryman_dispatch provider gate", () => {
  it("[U1355] prints a gate block as `Dispatch blocked (<code>): <message> No task was created.`", async () => {
    const t = setup();
    t.bb.states = [providerState("claude", { status: "unauthenticated", localLoginCommand: "claude login" })];
    const outcome = await dispatch(t.runtime, supervisor, valid);
    expect(outcome).toEqual({
      ok: false,
      text:
        "Dispatch blocked (provider_unavailable): The provider `claude` is not signed in on the default host (bb status: unauthenticated). " +
        "Run `claude login` on that machine. No other provider was tried. No task was created.",
    });
    expect(t.runtime.deps.store.listTasks()).toEqual([]);
    expect(t.bb.callsTo("spawnWorker")).toEqual([]);
  });

  it("[U1356] prints a read failure as `Dispatch failed: <message>. No task was created.`", async () => {
    const t = setup();
    t.bb.statesError = new Error("bb is down");
    const outcome = await dispatch(t.runtime, supervisor, valid);
    expect(outcome).toEqual({ ok: false, text: "Dispatch failed: could not read bb's provider states (bb is down). No task was created." });
    expect(t.runtime.deps.store.listTasks()).toEqual([]);
    expect(t.bb.callsTo("spawnWorker")).toEqual([]);
  });

  it("[U1357] blocks a task pinned to an offline machine before it reads any provider state", async () => {
    const t = setup();
    t.bb.machines.push({ id: "host_gpu", name: "gpu-box", status: "disconnected", phase: "active", online: false });
    t.bb.sources.push({ hostId: "host_gpu", path: "/work/gpu", isDefault: false });
    const outcome = await dispatch(t.runtime, supervisor, { ...valid, machine: "gpu-box" });
    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("offline");
    expect(t.bb.callsTo("getProviderStates")).toEqual([]);
    expect(t.bb.callsTo("listProviders")).toEqual([]);
    expect(t.bb.callsTo("spawnWorker")).toEqual([]);
  });
});

describe("factoryman_dispatch with no built-in default", () => {
  const CHECKOUT = "/work/repo";
  const configure = (t: ReturnType<typeof setup>, dispatchJson: unknown) => {
    t.bb.checkouts.set("proj-1", CHECKOUT);
    t.files.files.set(`${CHECKOUT}/.bb/factoryman/dispatch.json`, JSON.stringify(dispatchJson));
  };
  const steady = { provider: "claude", model: "opus", reasoningLevel: "high", permissionMode: "accept-edits" };

  it("[U1411] says the profile came from the configured default, and names no built-in default", async () => {
    const t = setup();
    configure(t, { version: 1, profiles: { steady }, default: "steady", rules: [] });
    const outcome = await dispatch(t.runtime, supervisor, { kind: "ship", description: "Add a --json flag to the status command." });
    expect(outcome.ok).toBe(true);
    expect(outcome.text).toContain("Profile: claude opus high accept-edits, from the configured default.");
    expect(outcome.text).not.toMatch(/built-in/i);
  });

  it("[U1411] blocks a dispatch with no profile source and prints the init hint", async () => {
    const t = setup();
    const outcome = await dispatch(t.runtime, supervisor, { kind: "ship", description: "Add a --json flag to the status command." });
    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("Dispatch blocked (no_default_profile)");
    expect(outcome.text).toContain("bb factoryman dispatch init --provider <id>");
    expect(outcome.text).toContain("No task was created.");
    expect(t.runtime.deps.store.listTasks()).toEqual([]);
    expect(t.bb.callsTo("spawnWorker")).toEqual([]);
  });
});
