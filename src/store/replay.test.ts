import { describe, expect, it } from "vitest";
import { validEvent } from "../../test/fixtures/machine";
import { row, writeHistory } from "../../test/fixtures/history";
import { drive, scoutPath, shipPath } from "../../test/fixtures/store";
import { createMemoryStore } from "./memory";
import { rebuildCache, recover, replayTask } from "./replay";
import { TaskLog } from "./task-log";
import type { TaskRow } from "./types";

describe("replayTask", () => {
  it("returns the snapshot that folding the recorded events through the machine produces", () => {
    const store = createMemoryStore();
    const expected = writeHistory(store, "task-1", shipPath().slice(0, 5));
    const result = replayTask(store, "task-1");
    expect(result).toEqual({ ok: true, snapshot: expected, lastSeq: store.listEvents().at(-1)?.seq });
    expect(result.ok && result.snapshot.state).toBe("review_ready");
    // Pin the projection with literals, so the test does not only compare the fold with itself.
    expect(result.ok && result.snapshot.context).toMatchObject({
      taskId: "task-1",
      kind: "ship",
      mode: "no-mistakes",
      workerThreadId: "thread-1",
      branch: "fm/task-1",
      prUrl: "https://github.com/acme/widgets/pull/7",
      approvals: {},
    });
  });

  it("replays only the asked-for task", () => {
    const store = createMemoryStore();
    writeHistory(store, "a", [validEvent("start")]);
    const b = writeHistory(store, "b", [validEvent("start"), validEvent("block")]);
    expect(replayTask(store, "b")).toMatchObject({ ok: true, snapshot: b });
    expect(replayTask(store, "a")).toMatchObject({ ok: true, snapshot: { state: "working" } });
  });

  it("skips refused rows and reconcile rows", () => {
    const store = createMemoryStore();
    const expected = writeHistory(store, "task-1", [validEvent("start")]);
    store.appendEvent(row({ fromState: "working", toState: "working", event: "merge", outcome: "refused", reasonCode: "illegal_transition", reasonMessage: "no" }));
    store.appendEvent(row({ fromState: "working", toState: "working", event: "reconcile", actor: "system", evidence: "bb says failed", payload: { observed: "failed" } }));
    store.appendEvent(row({ fromState: "working", toState: "working", event: "explode", actor: "unknown", outcome: "refused", reasonCode: "unknown_event", reasonMessage: "no" }));
    expect(replayTask(store, "task-1")).toMatchObject({ ok: true, snapshot: expected });
  });

  it("reports not_found for a task with no applied rows", () => {
    const store = createMemoryStore();
    expect(replayTask(store, "ghost")).toEqual({ ok: false, reason: "not_found" });
    store.appendEvent(row({ taskId: "ghost", event: "start", fromState: null, toState: null, outcome: "refused", reasonCode: "unknown_task", reasonMessage: "no such task" }));
    expect(replayTask(store, "ghost")).toEqual({ ok: false, reason: "not_found" });
  });

  it("reports a task as corrupt when an applied row is refused by the machine", () => {
    const store = createMemoryStore();
    writeHistory(store, "task-1", shipPath().slice(0, 5));
    const forged = store.appendEvent(
      row({ fromState: "review_ready", toState: "merged", event: "merge", actor: "supervisor", payload: { yolo: false } }),
    );
    const result = replayTask(store, "task-1");
    expect(result).toMatchObject({ ok: false, reason: "corrupt", seq: forged.seq });
    if (!result.ok && result.reason === "corrupt") {
      expect(result.refusal.code).toBe("corrupt_log");
      expect(result.refusal.message).toContain("illegal_transition");
    }
  });

  it("reports a task as corrupt when an applied row's to_state differs from the machine's result", () => {
    const store = createMemoryStore();
    writeHistory(store, "task-1", []);
    const forged = store.appendEvent(
      row({ fromState: "queued", toState: "blocked", event: "start", payload: { profile: null, threadId: "t", branch: "b" }, actor: "supervisor" }),
    );
    expect(replayTask(store, "task-1")).toMatchObject({ ok: false, reason: "corrupt", seq: forged.seq });
    const store2 = createMemoryStore();
    writeHistory(store2, "task-1", []);
    const forgedFrom = store2.appendEvent(
      row({
        fromState: "working",
        toState: "working",
        event: "start",
        actor: "supervisor",
        payload: { profile: { provider: "p", model: "m", reasoningLevel: "r", permissionMode: "pm" }, threadId: "t", branch: "b" },
      }),
    );
    expect(replayTask(store2, "task-1")).toMatchObject({ ok: false, reason: "corrupt", seq: forgedFrom.seq });
  });

  it("reports a task as corrupt when its first applied row is not create, or it has a second create", () => {
    const store = createMemoryStore();
    const first = store.appendEvent(row({ event: "start", fromState: "queued", toState: "working", actor: "supervisor" }));
    expect(replayTask(store, "task-1")).toMatchObject({ ok: false, reason: "corrupt", seq: first.seq });

    // A forged row that carries create-shaped fields under another event name must not create a task.
    const disguised = createMemoryStore();
    const fake = disguised.appendEvent(
      row({ event: "start", toState: "queued", payload: { projectId: "proj-1", kind: "ship", mode: "no-mistakes" } }),
    );
    expect(replayTask(disguised, "task-1")).toMatchObject({ ok: false, reason: "corrupt", seq: fake.seq });

    // A create row must record the move from nothing to queued.
    const skewed = createMemoryStore();
    const odd = skewed.appendEvent(row({ toState: "working", payload: { projectId: "proj-1", kind: "ship", mode: "no-mistakes" } }));
    expect(replayTask(skewed, "task-1")).toMatchObject({ ok: false, reason: "corrupt", seq: odd.seq });

    const twice = createMemoryStore();
    writeHistory(twice, "task-1", [validEvent("start")]);
    const second = twice.appendEvent(row({ toState: "queued", payload: { projectId: "proj-1", kind: "ship", mode: "no-mistakes" } }));
    expect(replayTask(twice, "task-1")).toMatchObject({ ok: false, reason: "corrupt", seq: second.seq });
  });
});

/** A spread of tasks written through the task log: finished, failed, mid-flight, and promoted. */
function populate(log: TaskLog): void {
  drive(log, "done", shipPath());
  drive(log, "failed", [validEvent("start"), validEvent("fail", { evidence: "crashed" })]);
  drive(log, "queued", []);
  drive(log, "running", [validEvent("start"), validEvent("block")], { mode: "direct-PR" });
  drive(log, "promoted", [...scoutPath(), validEvent("promote"), validEvent("start")], { kind: "scout" });
}

function forgeMerge(store: ReturnType<typeof createMemoryStore>, taskId: string): number {
  return store.appendEvent(
    row({ taskId, fromState: "review_ready", toState: "merged", event: "merge", actor: "supervisor", payload: { yolo: false } }),
  ).seq;
}

describe("rebuildCache", () => {
  it("produces rows equal to the incrementally written rows after the cache is cleared", () => {
    const store = createMemoryStore();
    populate(new TaskLog(store));
    const before = store.listTasks();
    expect(before.map((t) => t.taskId)).toEqual(["done", "failed", "promoted", "queued", "running"]);

    store.clearTasks();
    const report = rebuildCache(store);

    expect(report).toEqual({ rebuilt: ["done", "failed", "promoted", "queued", "running"], corrupt: [] });
    expect(store.listTasks()).toEqual(before);
  });

  it("writes no row for a corrupt task, lists it, and still rebuilds the healthy tasks", () => {
    const store = createMemoryStore();
    populate(new TaskLog(store));
    writeHistory(store, "forged", shipPath().slice(0, 5));
    const seq = forgeMerge(store, "forged");
    store.putTask({ taskId: "forged", projectId: "proj-1", kind: "ship", mode: "no-mistakes", state: "merged", workerThreadId: null, branch: null, machine: null, pullRequestUrl: null });
    const healthy = store.listTasks().filter((t) => t.taskId !== "forged");

    const report = rebuildCache(store);

    expect(report.corrupt).toEqual([{ taskId: "forged", seq, message: expect.stringContaining("Log row") }]);
    expect(report.rebuilt).not.toContain("forged");
    expect(store.getTask("forged")).toBeNull();
    expect(store.listTasks()).toEqual(healthy);
  });
});

describe("recover", () => {
  it("replays every non-terminal task and skips torn_down tasks", () => {
    const store = createMemoryStore();
    populate(new TaskLog(store));
    const report = recover(store);
    expect(report.replayed.map((r) => r.taskId)).toEqual(["failed", "promoted", "queued", "running"]);
    expect(report.replayed.find((r) => r.taskId === "running")?.snapshot).toMatchObject({ state: "blocked" });
    expect(report.skipped).toEqual(["done"]);
    expect(report.corrupt).toEqual([]);
    expect(report.repaired).toEqual([]);
  });

  it("repairs a missing or diverged cache row, reports it, and leaves matching rows alone", () => {
    const store = createMemoryStore();
    populate(new TaskLog(store));
    const original = store.listTasks();
    store.clearTasks();
    for (const taskRow of original) {
      if (taskRow.taskId === "running") store.putTask({ ...taskRow, state: "working", branch: "tampered" } as TaskRow);
      else if (taskRow.taskId !== "queued" && taskRow.taskId !== "failed") store.putTask(taskRow);
    }

    const report = recover(store);

    expect(report.repaired).toEqual(["failed", "queued", "running"]);
    expect(store.listTasks().filter((t) => t.taskId !== "done")).toEqual(original.filter((t) => t.taskId !== "done"));
  });

  it.each(["branch", "workerThreadId", "machine", "pullRequestUrl", "projectId", "mode", "kind"] as const)(
    "repairs a row that differs from its replay in only the %s field",
    (field) => {
      const store = createMemoryStore();
      populate(new TaskLog(store));
      const original = store.getTask("running") as TaskRow;
      store.putTask({ ...original, [field]: "tampered" } as unknown as TaskRow);

      const report = recover(store);

      expect(report.repaired).toEqual(["running"]);
      expect(store.getTask("running")).toEqual(original);
    },
  );

  it("reports a corrupt non-terminal task and does not guess its row", () => {
    const store = createMemoryStore();
    populate(new TaskLog(store));
    writeHistory(store, "forged", shipPath().slice(0, 5));
    const seq = forgeMerge(store, "forged");
    const report = recover(store);
    expect(report.corrupt).toMatchObject([{ taskId: "forged", seq }]);
    expect(report.replayed.map((r) => r.taskId)).not.toContain("forged");
    expect(store.getTask("forged")).toBeNull();
  });
});
