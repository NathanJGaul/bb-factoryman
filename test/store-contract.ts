import { describe, expect, it } from "vitest";
import type { Store } from "../src/store/store";
import type { NewTaskEvent, TaskRow } from "../src/store/types";

export const AT = "2026-11-05T12:00:00.000Z";

export function newEvent(overrides: Partial<NewTaskEvent> = {}): NewTaskEvent {
  return {
    taskId: "task-1",
    at: AT,
    fromState: null,
    toState: "queued",
    event: "create",
    actor: "supervisor",
    evidence: null,
    payload: { projectId: "proj-1", kind: "ship", mode: "no-mistakes" },
    outcome: "applied",
    reasonCode: null,
    reasonMessage: null,
    ...overrides,
  };
}

export function taskRow(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    taskId: "task-1",
    projectId: "proj-1",
    kind: "ship",
    mode: "no-mistakes",
    state: "queued",
    workerThreadId: null,
    branch: null,
    machine: null,
    pullRequestUrl: null,
    ...overrides,
  };
}

/**
 * The behaviors every Store must show. Run it against each implementation so
 * the in-memory store that tests use cannot drift from the SQLite store.
 */
export function describeStoreContract(name: string, makeStore: () => Store): void {
  describe(`${name} store contract`, () => {
    it("assigns strictly increasing seq values to appended events", () => {
      const store = makeStore();
      const seqs = [1, 2, 3].map(() => store.appendEvent(newEvent()).seq);
      expect(seqs[0]).toBeGreaterThanOrEqual(1);
      expect(seqs[1]).toBeGreaterThan(seqs[0] as number);
      expect(seqs[2]).toBeGreaterThan(seqs[1] as number);
      store.close();
    });

    it("reads back an appended event equal to what was written, with null fields and a nested payload", () => {
      const store = makeStore();
      const input = newEvent({
        fromState: "working",
        toState: "blocked",
        event: "block",
        actor: "system",
        evidence: "machine offline",
        payload: { a: { b: [1, 2, { c: null }] }, flag: true, text: "x" },
      });
      const written = store.appendEvent(input);
      expect(written).toMatchObject(input);
      const [read] = store.listEvents();
      expect(read).toEqual(written);
      const bare = store.appendEvent(newEvent({ evidence: null, payload: {}, outcome: "refused", reasonCode: "illegal_transition", reasonMessage: "no" }));
      expect(store.listEvents().at(-1)).toEqual(bare);
      store.close();
    });

    it("does not let a caller change the store by mutating a returned row", () => {
      const store = makeStore();
      store.appendEvent(newEvent({ payload: { nested: { value: 1 } } }));
      store.putTask(taskRow());
      store.addApproval({ taskId: "task-1", scope: "merge", decision: "approved", at: AT });
      const events = store.listEvents();
      const before = structuredClone({ events, task: store.getTask("task-1"), approvals: store.listApprovals("task-1") });
      const attempts: Array<() => void> = [
        () => {
          (events[0] as { event: string }).event = "hacked";
        },
        () => {
          (events[0]?.payload as { nested: { value: number } }).nested.value = 99;
        },
        () => {
          (store.getTask("task-1") as { state: string }).state = "merged";
        },
        () => {
          (store.listApprovals("task-1")[0] as { decision: string }).decision = "denied";
        },
      ];
      for (const attempt of attempts) {
        try {
          attempt();
        } catch {
          // A frozen row throws in strict mode. Either outcome is fine as long as the store is unchanged.
        }
      }
      expect({ events: store.listEvents(), task: store.getTask("task-1"), approvals: store.listApprovals("task-1") }).toEqual(before);
      store.close();
    });

    it("filters events by task and by afterSeq and returns them in seq order", () => {
      const store = makeStore();
      const a1 = store.appendEvent(newEvent({ taskId: "a" }));
      const b1 = store.appendEvent(newEvent({ taskId: "b" }));
      const a2 = store.appendEvent(newEvent({ taskId: "a", event: "start" }));
      const b2 = store.appendEvent(newEvent({ taskId: "b", event: "start" }));
      expect(store.listEvents().map((e) => e.seq)).toEqual([a1.seq, b1.seq, a2.seq, b2.seq]);
      expect(store.listEvents({ taskId: "a" }).map((e) => e.seq)).toEqual([a1.seq, a2.seq]);
      expect(store.listEvents({ afterSeq: b1.seq }).map((e) => e.seq)).toEqual([a2.seq, b2.seq]);
      expect(store.listEvents({ taskId: "b", afterSeq: b1.seq }).map((e) => e.seq)).toEqual([b2.seq]);
      expect(store.listEvents({ taskId: "nobody" })).toEqual([]);
      store.close();
    });

    it("commits every write of a transaction and returns the function's value", () => {
      const store = makeStore();
      const value = store.transaction(() => {
        store.appendEvent(newEvent());
        store.putTask(taskRow());
        store.addApproval({ taskId: "task-1", scope: "merge", decision: "approved", at: AT });
        return 42;
      });
      expect(value).toBe(42);
      expect(store.listEvents()).toHaveLength(1);
      expect(store.getTask("task-1")).toEqual(taskRow());
      expect(store.listApprovals("task-1")).toHaveLength(1);
      store.close();
    });

    it("rolls back every write of a transaction and rethrows when the function throws", () => {
      const store = makeStore();
      store.appendEvent(newEvent({ taskId: "kept" }));
      const boom = new Error("boom");
      expect(() =>
        store.transaction(() => {
          store.appendEvent(newEvent({ taskId: "lost" }));
          store.putTask(taskRow({ taskId: "lost" }));
          store.addApproval({ taskId: "lost", scope: "merge", decision: "approved", at: AT });
          store.putProjectConfig({ projectId: "lost", deliveryMode: "local-only", yolo: true, branchPrefix: null, baseBranch: null, defaultMachine: null });
          throw boom;
        }),
      ).toThrow(boom);
      expect(store.listEvents().map((e) => e.taskId)).toEqual(["kept"]);
      expect(store.getTask("lost")).toBeNull();
      expect(store.listApprovals("lost")).toEqual([]);
      expect(store.getProjectConfig("lost").yolo).toBe(false);
      // The next event still gets a fresh, increasing seq.
      const next = store.appendEvent(newEvent({ taskId: "after" }));
      expect(next.seq).toBeGreaterThan(store.listEvents()[0]?.seq as number);
      store.close();
    });

    it("returns the default config for an unknown project and the stored config after a put", () => {
      const store = makeStore();
      expect(store.getProjectConfig("proj-x")).toEqual({
        projectId: "proj-x",
        deliveryMode: "no-mistakes",
        yolo: false,
        branchPrefix: null,
        baseBranch: null,
        defaultMachine: null,
      });
      const config = { projectId: "proj-x", deliveryMode: "direct-PR" as const, yolo: true, branchPrefix: "fm/", baseBranch: "main", defaultMachine: "builder-1" };
      store.putProjectConfig(config);
      expect(store.getProjectConfig("proj-x")).toEqual(config);
      store.putProjectConfig({ ...config, yolo: false, defaultMachine: null });
      expect(store.getProjectConfig("proj-x")).toEqual({ ...config, yolo: false, defaultMachine: null });
      expect(store.getProjectConfig("proj-y").deliveryMode).toBe("no-mistakes");
      store.close();
    });

    it("puts, gets, replaces, lists, filters, and clears task rows without touching events or approvals", () => {
      const store = makeStore();
      expect(store.getTask("nope")).toBeNull();
      store.putTask(taskRow({ taskId: "b", projectId: "p2", state: "working", branch: "fm/b" }));
      store.putTask(taskRow({ taskId: "a", projectId: "p1", state: "queued" }));
      store.putTask(taskRow({ taskId: "c", projectId: "p1", state: "merged" }));
      expect(store.getTask("b")).toEqual(taskRow({ taskId: "b", projectId: "p2", state: "working", branch: "fm/b" }));
      store.putTask(taskRow({ taskId: "b", projectId: "p2", state: "review_ready" }));
      expect(store.getTask("b")).toEqual(taskRow({ taskId: "b", projectId: "p2", state: "review_ready" }));
      expect(store.listTasks().map((t) => t.taskId)).toEqual(["a", "b", "c"]);
      expect(store.listTasks({ projectId: "p1" }).map((t) => t.taskId)).toEqual(["a", "c"]);
      expect(store.listTasks({ states: ["merged", "review_ready"] }).map((t) => t.taskId)).toEqual(["b", "c"]);
      expect(store.listTasks({ projectId: "p1", states: ["merged"] }).map((t) => t.taskId)).toEqual(["c"]);
      store.appendEvent(newEvent());
      store.addApproval({ taskId: "a", scope: "merge", decision: "approved", at: AT });
      store.clearTasks();
      expect(store.listTasks()).toEqual([]);
      expect(store.listEvents()).toHaveLength(1);
      expect(store.listApprovals("a")).toHaveLength(1);
      store.close();
    });

    it("keeps approvals in insertion order per task", () => {
      const store = makeStore();
      const first = store.addApproval({ taskId: "a", scope: "merge", decision: "denied", at: AT });
      store.addApproval({ taskId: "b", scope: "merge", decision: "approved", at: AT });
      const third = store.addApproval({ taskId: "a", scope: "merge", decision: "approved", at: "2026-11-05T12:00:01.000Z" });
      expect(third.id).toBeGreaterThan(first.id);
      expect(store.listApprovals("a").map((x) => x.decision)).toEqual(["denied", "approved"]);
      expect(store.listApprovals("b")).toHaveLength(1);
      expect(store.listApprovals("none")).toEqual([]);
      store.close();
    });
  });
}
