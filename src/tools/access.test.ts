import { describe, expect, it } from "vitest";
import { validEvent } from "../../test/fixtures/machine";
import { createEvent } from "../../test/fixtures/store";
import { testRuntime } from "../../test/fixtures/runtime";
import { identify, sameProject } from "./access";

async function withWorker(projectId = "proj-1") {
  const t = testRuntime();
  t.runtime.log.create(createEvent({ taskId: "k1", projectId }));
  await t.runtime.apply("k1", validEvent("start", { threadId: "thr-w1" }));
  return t;
}

describe("identify", () => {
  it("[U19] reads a thread recorded as a task's worker as a worker with that task", async () => {
    const t = await withWorker();
    const identity = identify(t.runtime.deps.store, "thr-w1");
    expect(identity.role).toBe("worker");
    expect(identity.role === "worker" && identity.task.taskId).toBe("k1");
  });

  it("[U20] reads a thread that no task records as other", async () => {
    const t = await withWorker();
    expect(identify(t.runtime.deps.store, "thr-sup")).toEqual({ role: "other" });
  });

  it("[U21] still reads the worker thread of a torn down task as a worker", async () => {
    const t = testRuntime();
    t.runtime.log.create(createEvent({ taskId: "k1" }));
    for (const type of ["start", "handoff", "validated", "request_approval", "record_approval", "merge", "teardown"] as const) {
      const overrides = type === "start" ? { threadId: "thr-w1" } : type === "merge" ? { yolo: true } : {};
      const outcome = await t.runtime.apply("k1", validEvent(type, overrides));
      expect(outcome.ok, type).toBe(true);
    }
    expect(t.runtime.deps.store.getTask("k1")?.state).toBe("torn_down");
    expect(identify(t.runtime.deps.store, "thr-w1").role).toBe("worker");
  });

  it("[U22] keeps a task out of reach of a caller in another project", async () => {
    const t = await withWorker("proj-1");
    const task = t.runtime.deps.store.getTask("k1")!;
    expect(sameProject(task, "proj-1")).toBe(true);
    expect(sameProject(task, "proj-2")).toBe(false);
  });
});
