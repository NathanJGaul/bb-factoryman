import { describe, expect, it } from "vitest";
import { SUPERVISOR, WORKER, scriptGit, toMerged, withDispatchedTask, type TestRuntime } from "../../test/fixtures/runtime";
import { teardown } from "./teardown";

const state = (t: TestRuntime) => t.runtime.deps.store.getTask("t1")?.state;
const rows = (t: TestRuntime) => t.runtime.deps.store.listEvents({ taskId: "t1" }).map((row) => `${row.event}:${row.outcome}`);

async function merged() {
  const t = await withDispatchedTask();
  await toMerged(t);
  scriptGit(t);
  return t;
}

describe("factoryman_teardown", () => {
  it("[U107] records teardown for a landed worktree and then retires the worker, in that order", async () => {
    const t = await merged();
    const order: string[] = [];
    t.runtime.onApplied(({ event }) => void order.push(`event:${event.event}`));
    const retire = t.bb.retireWorker.bind(t.bb);
    t.bb.retireWorker = async (threadId, environmentId) => {
      order.push("retire");
      await retire(threadId, environmentId);
    };
    const outcome = await teardown(t.runtime, SUPERVISOR, { taskId: "t1" });
    expect(outcome).toEqual({ ok: true, text: "Task t1 is torn down." });
    expect(order).toEqual(["event:teardown", "retire"]);
    expect(t.bb.callsTo("retireWorker")).toEqual([["thr-w1", "env-thr-w1"]]);
    expect(state(t)).toBe("torn_down");
  });

  it("[U108] refuses a dirty worktree with a logged refusal and does not retire the worker", async () => {
    const t = await merged();
    scriptGit(t, { status: " M src/a.ts\n" });
    const outcome = await teardown(t.runtime, SUPERVISOR, { taskId: "t1" });
    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("unlanded_work");
    expect(rows(t).at(-1)).toBe("teardown:refused");
    expect(state(t)).toBe("merged");
    expect(t.bb.callsTo("retireWorker")).toEqual([]);
  });

  it("[U109] refuses unpushed commits with a logged refusal and does not retire the worker", async () => {
    const t = await merged();
    scriptGit(t, { count: "2\n" });
    const outcome = await teardown(t.runtime, SUPERVISOR, { taskId: "t1" });
    expect(outcome.text).toContain("2 unpushed commit");
    expect(rows(t).at(-1)).toBe("teardown:refused");
    expect(t.bb.callsTo("retireWorker")).toEqual([]);
  });

  it("[U110] refuses when the worktree report cannot be read, and records no event", async () => {
    const t = await merged();
    scriptGit(t, { code: 128 });
    const before = rows(t).length;
    const outcome = await teardown(t.runtime, SUPERVISOR, { taskId: "t1" });
    expect(outcome.ok).toBe(false);
    expect(outcome.text).toMatch(/could not read the worktree/i);
    expect(rows(t)).toHaveLength(before);
    expect(t.bb.callsTo("retireWorker")).toEqual([]);
  });

  it("[U111] tears down a failed task through the same check", async () => {
    const t = await withDispatchedTask();
    await t.runtime.apply("t1", { type: "fail", actor: "system", evidence: "worker died" });
    scriptGit(t);
    expect((await teardown(t.runtime, SUPERVISOR, { taskId: "t1" })).ok).toBe(true);
    expect(state(t)).toBe("torn_down");
    const dirty = await withDispatchedTask();
    await dirty.runtime.apply("t1", { type: "fail", actor: "system", evidence: "worker died" });
    scriptGit(dirty, { status: "?? new.txt\n" });
    expect((await teardown(dirty.runtime, SUPERVISOR, { taskId: "t1" })).ok).toBe(false);
    expect(state(dirty)).toBe("failed");
  });

  it("[U112] refuses a task whose state does not allow teardown", async () => {
    const t = await withDispatchedTask();
    scriptGit(t);
    const outcome = await teardown(t.runtime, SUPERVISOR, { taskId: "t1" });
    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("illegal_transition");
    expect(state(t)).toBe("working");
    expect(t.bb.callsTo("retireWorker")).toEqual([]);
  });

  it("[U113] reports a retire failure after the event and keeps the task torn down", async () => {
    const t = await merged();
    t.bb.retireError = new Error("Environment still has live threads");
    const outcome = await teardown(t.runtime, SUPERVISOR, { taskId: "t1" });
    expect(outcome.ok).toBe(true);
    expect(outcome.text).toContain("torn down");
    expect(outcome.text).toContain("Environment still has live threads");
    expect(state(t)).toBe("torn_down");
  });

  it("[U114] refuses a task whose environment has no path, and records no event", async () => {
    const t = await merged();
    t.bb.envPaths.clear();
    const before = rows(t).length;
    const outcome = await teardown(t.runtime, SUPERVISOR, { taskId: "t1" });
    expect(outcome.ok).toBe(false);
    expect(outcome.text).toMatch(/no worktree path/i);
    expect(rows(t)).toHaveLength(before);
  });

  it("[U209] refuses a supervisor in another project, records no event, and retires no worker", async () => {
    const t = await merged();
    const before = rows(t).length;
    const outcome = await teardown(t.runtime, { threadId: "thr-sup2", projectId: "proj-2" }, { taskId: "t1" });
    expect(outcome).toEqual({ ok: false, text: "No task t1 exists in this project." });
    expect(rows(t)).toHaveLength(before);
    expect(state(t)).toBe("merged");
    expect(t.bb.callsTo("retireWorker")).toEqual([]);
  });

  it("[U115] refuses a worker caller", async () => {
    const t = await merged();
    const outcome = await teardown(t.runtime, WORKER, { taskId: "t1" });
    expect(outcome.text).toContain("actor_forbidden");
    expect(state(t)).toBe("merged");
  });

  it("[U116] uses the project's base branch for a local-only report", async () => {
    const t = await withDispatchedTask({ mode: "local-only", baseBranch: "main" });
    await t.runtime.apply("t1", { type: "ready", actor: "worker", evidence: "Landed.", landedCommits: 1 });
    for (const event of [
      { type: "request_approval", actor: "supervisor" },
      { type: "merge", actor: "supervisor", yolo: true },
    ]) await t.runtime.apply("t1", event);
    scriptGit(t);
    await teardown(t.runtime, SUPERVISOR, { taskId: "t1" });
    const revList = t.execCalls.find((call) => call.args[0] === "rev-list");
    expect(revList?.args).toEqual(["rev-list", "--count", "main..HEAD"]);
    expect(state(t)).toBe("torn_down");
  });
});

describe("factoryman_teardown on a remote machine", () => {
  it("[U861] refuses, records nothing, and removes nothing when the project sources cannot be read", async () => {
    const t = await withDispatchedTask();
    t.bb.machines.push({ id: "host_gpu", name: "gpu-box", status: "connected", phase: "active", online: true });
    t.bb.sources.push({ hostId: "host_gpu", path: "/work/gpu", isDefault: false });
    const { dispatch } = await import("./dispatch");
    const { DISPATCH_ARGS } = await import("../../test/fixtures/runtime");
    expect((await dispatch(t.runtime, SUPERVISOR, { ...DISPATCH_ARGS, machine: "gpu-box" })).ok).toBe(true);
    await t.runtime.apply("t2", { type: "fail", actor: "system", evidence: "Gave up." });
    t.bb.envPaths.set("env-thr-w2", "/work/gpu/tree");
    t.execHandler = (command, args) => ({ code: 0, stdout: command === "git" && args[0] === "rev-list" ? "0\n" : "", stderr: "" });
    t.bb.sourcesError = new Error("bb is down");
    const before = t.runtime.deps.store.listEvents({ taskId: "t2" }).length;
    const mark = t.execCalls.length;
    const outcome = await teardown(t.runtime, SUPERVISOR, { taskId: "t2" });
    expect(outcome.ok).toBe(false);
    expect(outcome.text).toContain("Teardown refused");
    expect(outcome.text).toContain("which machine");
    expect(t.runtime.deps.store.listEvents({ taskId: "t2" })).toHaveLength(before);
    expect(t.execCalls.slice(mark)).toEqual([]);
    expect(t.bb.callsTo("retireWorker")).toEqual([]);
  });
});
