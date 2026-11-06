import { describe, expect, it } from "vitest";
import { validEvent } from "../../test/fixtures/machine";
import { row, writeHistory } from "../../test/fixtures/history";
import { shipPath } from "../../test/fixtures/store";
import { createMemoryStore } from "./memory";
import { replayTask } from "./replay";

describe("replayTask", () => {
  it("returns the snapshot that folding the recorded events through the machine produces", () => {
    const store = createMemoryStore();
    const expected = writeHistory(store, "task-1", shipPath().slice(0, 5));
    const result = replayTask(store, "task-1");
    expect(result).toEqual({ ok: true, snapshot: expected, lastSeq: store.listEvents().at(-1)?.seq });
    expect(result.ok && result.snapshot.state).toBe("review_ready");
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
