import { describe, expect, it } from "vitest";
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
    expect(start?.payload).toEqual({ profile, threadId: "thr-w1", branch: "fm/t1" });
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
