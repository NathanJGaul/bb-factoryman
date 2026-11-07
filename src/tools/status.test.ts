import { describe, expect, it } from "vitest";
import { SUPERVISOR, WORKER, withDispatchedTask } from "../../test/fixtures/runtime";
import { status } from "./status";

describe("factoryman_status", () => {
  it("[U62] returns one block with the ID, kind, mode, state, thread, branch, pull request, and description", async () => {
    const t = await withDispatchedTask();
    const outcome = await status(t.runtime, SUPERVISOR, { taskId: "t1" });
    expect(outcome.ok).toBe(true);
    expect(outcome.text).toBe(
      [
        "Task t1: ship, no-mistakes, state working",
        "  worker thread: thr-w1",
        "  branch: fm/t1",
        "  description: Add a --json flag to the status command.",
      ].join("\n"),
    );
  });

  it("[U63] lists the project's tasks in task ID order", async () => {
    const t = await withDispatchedTask();
    const { dispatch } = await import("./dispatch");
    const { DISPATCH_ARGS } = await import("../../test/fixtures/runtime");
    await dispatch(t.runtime, SUPERVISOR, { ...DISPATCH_ARGS, kind: "scout" });
    const outcome = await status(t.runtime, SUPERVISOR, {});
    expect(outcome.text.split("\n").filter((line) => line.startsWith("Task "))).toEqual([
      "Task t1: ship, no-mistakes, state working",
      "Task t2: scout, no-mistakes, state working",
    ]);
  });

  it("[U64] keeps only the listed states when a state filter is given", async () => {
    const t = await withDispatchedTask();
    const { report } = await import("./report");
    await report(t.runtime, WORKER, { outcome: "blocked", evidence: "Waiting." });
    expect((await status(t.runtime, SUPERVISOR, { states: ["working"] })).text).toBe("No tasks match.");
    expect((await status(t.runtime, SUPERVISOR, { states: ["blocked", "failed"] })).text).toContain("Task t1");
  });

  it("[U65] reports an unknown task ID as an error", async () => {
    const t = await withDispatchedTask();
    const outcome = await status(t.runtime, SUPERVISOR, { taskId: "t9" });
    expect(outcome).toEqual({ ok: false, text: "No task t9 exists in this project." });
  });

  it("[U66] does not show a task from another project", async () => {
    const t = await withDispatchedTask();
    const outcome = await status(t.runtime, { threadId: "thr-sup2", projectId: "proj-2" }, { taskId: "t1" });
    expect(outcome).toEqual({ ok: false, text: "No task t1 exists in this project." });
    expect((await status(t.runtime, { threadId: "thr-sup2", projectId: "proj-2" }, {})).text).toBe("No tasks match.");
  });

  it("[U67] leaves the log with the same number of rows", async () => {
    const t = await withDispatchedTask();
    const before = t.runtime.deps.store.listEvents().length;
    await status(t.runtime, SUPERVISOR, { taskId: "t1" });
    await status(t.runtime, SUPERVISOR, {});
    await status(t.runtime, SUPERVISOR, { taskId: "t9" });
    expect(t.runtime.deps.store.listEvents().length).toBe(before);
  });

  it("[U215] takes the description from an applied start row and never from a refused one", async () => {
    const t = await withDispatchedTask();
    t.runtime.log.create({ type: "create", actor: "supervisor", taskId: "t7", projectId: "proj-1", kind: "ship", mode: "no-mistakes" });
    const refused = await t.runtime.apply("t7", { type: "start", actor: "supervisor", profile: null, threadId: "thr-x", branch: "fm/t7", evidence: "REFUSED start text" });
    expect(refused.ok).toBe(false);
    await t.runtime.apply("t7", { type: "start", actor: "supervisor", profile: { provider: "claude", model: "opus", reasoningLevel: "high", permissionMode: "auto" }, threadId: "thr-x", branch: "fm/t7", evidence: "Real description." });
    const text = (await status(t.runtime, SUPERVISOR, { taskId: "t7" })).text;
    expect(text).toContain("description: Real description.");
    expect(text).not.toContain("REFUSED");
  });

  it("[U68] shows the first line of the start evidence as the description, and none before start", async () => {
    const t = await withDispatchedTask();
    expect((await status(t.runtime, SUPERVISOR, { taskId: "t1" })).text).toContain("description: Add a --json flag to the status command.");
    t.runtime.log.create({ type: "create", actor: "supervisor", taskId: "t7", projectId: "proj-1", kind: "ship", mode: "no-mistakes" });
    const queued = (await status(t.runtime, SUPERVISOR, { taskId: "t7" })).text;
    expect(queued).toBe("Task t7: ship, no-mistakes, state queued");
  });

  it("[U855] shows the machine of a task that has one, and no machine line for a task without one", async () => {
    const t = await withDispatchedTask();
    t.bb.machines.push({ id: "host_gpu", name: "gpu-box", status: "connected", phase: "active", online: true });
    t.bb.sources.push({ hostId: "host_gpu", path: "/work/gpu", isDefault: false });
    const { dispatch } = await import("./dispatch");
    const { DISPATCH_ARGS } = await import("../../test/fixtures/runtime");
    await dispatch(t.runtime, SUPERVISOR, { ...DISPATCH_ARGS, machine: "gpu-box" });
    expect((await status(t.runtime, SUPERVISOR, { taskId: "t2" })).text).toContain("  machine: host_gpu");
    expect((await status(t.runtime, SUPERVISOR, { taskId: "t1" })).text).not.toContain("machine:");
  });
  it("[U1031] shows a queued task with the description from its stored request", async () => {
    const t = await withDispatchedTask();
    const queued = t.runtime.log.create({
      type: "create",
      actor: "supervisor",
      taskId: "q1",
      projectId: "proj-1",
      kind: "ship",
      mode: "no-mistakes",
      request: { v: 1, description: "Queued work.\nWith details.", tags: [], profile: { provider: "claude", model: "opus", reasoningLevel: "high", permissionMode: "auto" }, machine: null, cloneHost: null, parentThreadId: "thr-sup", branchPrefix: null, baseBranch: null },
    });
    expect(queued.ok).toBe(true);
    const text = (await status(t.runtime, SUPERVISOR, { taskId: "q1" })).text;
    expect(text).toContain("Task q1: ship, no-mistakes, state queued");
    expect(text).toContain("  description: Queued work.");
    expect(text).not.toContain("With details");
  });
});
