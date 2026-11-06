import { createMachine } from "xstate";
import { describe, expect, it } from "vitest";
import { context, parsedEvent, snapshot, validEvent } from "../../test/fixtures/machine";
import { MACHINES } from "./machines";
import { REASON_CODES } from "./refusal";
import { createTask, transition, transitionUsing } from "./transition";
import type { TaskSnapshot } from "./types";

const CREATE = { type: "create", actor: "supervisor", taskId: "task-9", projectId: "proj-9", kind: "scout", mode: "direct-PR" };

describe("createTask", () => {
  it("returns a queued snapshot with null defaults and no approvals", () => {
    const result = createTask(CREATE);
    expect(result).toEqual({
      ok: true,
      snapshot: {
        state: "queued",
        context: {
          taskId: "task-9",
          projectId: "proj-9",
          kind: "scout",
          mode: "direct-PR",
          profile: null,
          workerThreadId: null,
          branch: null,
          machine: null,
          prUrl: null,
          approvals: {},
        },
      },
    });
  });

  it.each([
    ["a blank task ID", { taskId: "" }],
    ["a whitespace task ID", { taskId: "   " }],
    ["a blank project ID", { projectId: "" }],
    ["an unknown kind", { kind: "epic" }],
    ["an unknown mode", { mode: "yolo" }],
    ["a missing actor", { actor: undefined }],
    ["an extra key", { branch: "x" }],
    ["the wrong event type", { type: "start" }],
  ])("refuses %s", (_name, overrides) => {
    const result = createTask({ ...CREATE, ...overrides });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.code).toBe("invalid_event");
  });

  it.each([undefined, null, 5, "create", []])("refuses non-object input %j", (raw) => {
    const result = createTask(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.code).toBe("invalid_event");
  });
});

describe("transition never throws", () => {
  it.each([undefined, null, 5, "start", [], {}, { type: 5 }, { type: "start" }, { type: "explode", actor: "system" }])(
    "returns a refusal for the event %j",
    (raw) => {
      const result = transition(snapshot("queued"), raw);
      expect(result.ok).toBe(false);
    },
  );

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a number", 5],
    ["an empty object", {}],
    ["an unknown state", { state: "exploded", context: context() }],
    ["a missing context", { state: "queued" }],
    ["an unknown kind", { state: "queued", context: context({ kind: "epic" as never }) }],
    ["a state outside the kind's lane", { state: "validating", context: context({ kind: "scout" }) }],
  ])("returns a refusal for a snapshot that is %s", (_name, bad) => {
    const result = transition(bad as unknown as TaskSnapshot, validEvent("fail"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.code).toBe("illegal_transition");
  });
});

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

describe("transition is pure", () => {
  it("returns equal results for equal inputs and works on frozen inputs", () => {
    const task = deepFreeze(snapshot("queued", { profile: null }));
    const event = deepFreeze(validEvent("start"));
    const first = transition(task, event);
    const second = transition(task, event);
    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
  });

  it("leaves its input unchanged and returns a snapshot that shares nothing with it", () => {
    const task = snapshot("queued", { profile: null });
    const copy = structuredClone(task);
    const result = transition(task, validEvent("start"));
    expect(task).toEqual(copy);
    if (!result.ok) throw new Error("expected success");
    expect(result.snapshot).not.toBe(task);
    expect(result.snapshot.context).not.toBe(task.context);
    expect(result.snapshot.context.approvals).not.toBe(task.context.approvals);
  });
});

describe("transition results", () => {
  it("gives every refusal a code from the closed list and a message", () => {
    const refusals = [
      transition(snapshot("queued"), undefined),
      transition(snapshot("queued"), { type: "explode", actor: "system" }),
      transition(snapshot("queued"), validEvent("merge")),
      transition(snapshot("queued"), validEvent("fail", { evidence: "" })),
      transition(snapshot("queued", { profile: null }), validEvent("start", { profile: null })),
    ];
    for (const result of refusals) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(REASON_CODES).toContain(result.refusal.code);
        expect(result.refusal.message.length).toBeGreaterThan(0);
      }
    }
  });

  it("carries the from state, the to state, and the parsed event on success", () => {
    const result = transition(snapshot("working"), validEvent("block"));
    expect(result).toMatchObject({ ok: true, from: "working", to: "blocked", snapshot: { state: "blocked" } });
    if (result.ok) expect(result.event).toEqual(parsedEvent("block"));
  });
});

function refusedCode(task: TaskSnapshot, raw: unknown): string {
  const result = transition(task, raw);
  if (result.ok) throw new Error(`expected a refusal but the task moved to ${result.snapshot.state}`);
  return result.refusal.code;
}

function nextSnapshot(task: TaskSnapshot, raw: unknown): TaskSnapshot {
  const result = transition(task, raw);
  if (!result.ok) throw new Error(`expected success but got ${result.refusal.code}: ${result.refusal.message}`);
  return result.snapshot;
}

describe("guard order", () => {
  it("names the actor before the missing approval on a worker merge", () => {
    const task = snapshot("awaiting_approval");
    expect(refusedCode(task, validEvent("merge", { actor: "worker", yolo: false }))).toBe("actor_forbidden");
  });

  it("names the mode before the missing evidence on a ready event in a no-mistakes project", () => {
    const task = snapshot("working", { mode: "no-mistakes" });
    expect(refusedCode(task, validEvent("ready", { evidence: "" }))).toBe("mode_mismatch");
  });

  it("names the missing evidence before the missing pull request on a direct-PR ready event", () => {
    const task = snapshot("working", { mode: "direct-PR" });
    const event = validEvent("ready", { evidence: "  ", prUrl: undefined });
    expect(refusedCode(task, event)).toBe("evidence_required");
  });

  it("names the actor before the unlanded work on a worker teardown", () => {
    const task = snapshot("merged");
    const worktree = { uncommittedChanges: true, unpushedCommits: 2 };
    expect(refusedCode(task, validEvent("teardown", { actor: "worker", worktree }))).toBe("actor_forbidden");
  });
});

describe("start", () => {
  it("moves queued to working and records the profile, thread, branch, and machine", () => {
    const task = snapshot("queued", { profile: null, workerThreadId: null, branch: null });
    const next = nextSnapshot(task, validEvent("start", { threadId: "thread-7", branch: "fm/task-7", machine: "builder-2" }));
    expect(next.state).toBe("working");
    expect(next.context).toMatchObject({
      profile: { provider: "claude", model: "opus", reasoningLevel: "high", permissionMode: "acceptEdits" },
      workerThreadId: "thread-7",
      branch: "fm/task-7",
      machine: "builder-2",
    });
  });

  it("records a null machine when none is pinned", () => {
    const next = nextSnapshot(snapshot("queued", { profile: null }), validEvent("start", { machine: undefined }));
    expect(next.context.machine).toBeNull();
  });
});

describe("pull request URL", () => {
  it("is recorded by ready and by validated", () => {
    const direct = nextSnapshot(snapshot("working", { mode: "direct-PR" }), validEvent("ready", { prUrl: "https://github.com/acme/widgets/pull/9" }));
    expect(direct.context.prUrl).toBe("https://github.com/acme/widgets/pull/9");
    const validated = nextSnapshot(snapshot("validating"), validEvent("validated", { prUrl: "https://github.com/acme/widgets/pull/11" }));
    expect(validated.context.prUrl).toBe("https://github.com/acme/widgets/pull/11");
  });

  it("stays null when a local-only ready event carries none", () => {
    const next = nextSnapshot(snapshot("working", { mode: "local-only" }), validEvent("ready", { prUrl: undefined, landedCommits: 2 }));
    expect(next.context.prUrl).toBeNull();
  });
});

describe("record_approval", () => {
  it("stores the decision, keeps the state, and lets a later decision replace an earlier one", () => {
    let task = snapshot("awaiting_approval");
    task = nextSnapshot(task, validEvent("record_approval", { decision: "denied" }));
    expect(task.state).toBe("awaiting_approval");
    expect(task.context.approvals).toEqual({ merge: "denied" });
    task = nextSnapshot(task, validEvent("record_approval", { decision: "approved" }));
    expect(task.state).toBe("awaiting_approval");
    expect(task.context.approvals).toEqual({ merge: "approved" });
  });

  it("stores a promote decision for a scout in report_ready", () => {
    const task = nextSnapshot(
      snapshot("report_ready", { kind: "scout", approvals: { merge: "approved" } }),
      validEvent("record_approval", { scope: "promote", decision: "approved" }),
    );
    expect(task.state).toBe("report_ready");
    expect(task.context.approvals).toEqual({ merge: "approved", promote: "approved" });
  });

  it("is refused outside awaiting_approval and report_ready, so approval cannot be banked in advance", () => {
    for (const state of ["queued", "working", "blocked", "validating", "needs_decision", "review_ready", "merged", "failed", "torn_down"] as const) {
      expect(refusedCode(snapshot(state), validEvent("record_approval")), state).toBe("illegal_transition");
    }
  });

  it("is refused for the wrong scope in each state", () => {
    expect(refusedCode(snapshot("awaiting_approval"), validEvent("record_approval", { scope: "promote" }))).toBe("approval_scope_mismatch");
    expect(refusedCode(snapshot("report_ready", { kind: "scout" }), validEvent("record_approval", { scope: "merge" }))).toBe("approval_scope_mismatch");
  });
});

describe("merge under yolo", () => {
  it("is still refused from review_ready, because every merge passes through awaiting_approval", () => {
    expect(refusedCode(snapshot("review_ready"), validEvent("merge", { yolo: true }))).toBe("illegal_transition");
  });
});

describe("promote", () => {
  const scoutReady = () =>
    snapshot("report_ready", {
      kind: "scout",
      mode: "direct-PR",
      machine: "builder-2",
      prUrl: "https://github.com/acme/widgets/pull/3",
      approvals: { promote: "approved", merge: "denied" },
    });

  it("makes a queued ship task, keeps the identity and placement, and clears profile, approvals, and URL", () => {
    const before = scoutReady();
    const next = nextSnapshot(before, validEvent("promote"));
    expect(next.state).toBe("queued");
    expect(next.context).toEqual({
      ...before.context,
      kind: "ship",
      profile: null,
      prUrl: null,
      approvals: {},
    });
    expect(next.context.taskId).toBe(before.context.taskId);
    expect(next.context.workerThreadId).toBe(before.context.workerThreadId);
    expect(next.context.branch).toBe(before.context.branch);
    expect(next.context.machine).toBe("builder-2");
  });

  it("accepts ship events afterwards and refuses scout events", () => {
    const promoted = nextSnapshot(scoutReady(), validEvent("promote"));
    expect(refusedCode(promoted, validEvent("start", { profile: null }))).toBe("profile_required");
    const working = nextSnapshot(promoted, validEvent("start"));
    expect(working.state).toBe("working");
    expect(refusedCode(working, validEvent("report"))).toBe("illegal_transition");
    expect(nextSnapshot(working, validEvent("ready")).state).toBe("review_ready");
  });

  it("needs a fresh merge approval after promotion", () => {
    let task = nextSnapshot(scoutReady(), validEvent("promote"));
    task = nextSnapshot(task, validEvent("start"));
    task = nextSnapshot(task, validEvent("ready"));
    task = nextSnapshot(task, validEvent("request_approval"));
    expect(refusedCode(task, validEvent("merge", { yolo: false }))).toBe("approval_required");
  });
});

describe("fail", () => {
  it("is refused from failed and from torn_down", () => {
    expect(refusedCode(snapshot("failed"), validEvent("fail"))).toBe("illegal_transition");
    expect(refusedCode(snapshot("torn_down"), validEvent("fail"))).toBe("illegal_transition");
  });

  it("records the failing state's evidence in the result and leaves the context as it was", () => {
    const before = snapshot("working");
    const result = transition(before, validEvent("fail", { evidence: "worker crashed twice" }));
    expect(result).toMatchObject({ ok: true, from: "working", to: "failed" });
    if (result.ok) {
      expect(result.snapshot.context).toEqual(before.context);
      expect(result.event.evidence).toBe("worker crashed twice");
    }
  });
});

describe("teardown", () => {
  const dirty = { uncommittedChanges: true, unpushedCommits: 0 };
  const unpushed = { uncommittedChanges: false, unpushedCommits: 1 };
  const sources = [
    ["a merged ship task", snapshot("merged")],
    ["a scout task with a ready report", snapshot("report_ready", { kind: "scout" })],
    ["a failed ship task", snapshot("failed")],
    ["a failed scout task", snapshot("failed", { kind: "scout" })],
  ] as const;

  it.each(sources)("tears down %s when the worktree is clean", (_name, task) => {
    expect(nextSnapshot(task, validEvent("teardown")).state).toBe("torn_down");
  });

  it.each(sources)("refuses to tear down %s with uncommitted changes or an unpushed commit", (_name, task) => {
    expect(refusedCode(task, validEvent("teardown", { worktree: dirty }))).toBe("unlanded_work");
    expect(refusedCode(task, validEvent("teardown", { worktree: unpushed }))).toBe("unlanded_work");
  });

  it("refuses teardown from the states that still hold work", () => {
    for (const state of ["queued", "working", "blocked", "validating", "needs_decision", "review_ready", "awaiting_approval"] as const) {
      expect(refusedCode(snapshot(state), validEvent("teardown")), state).toBe("illegal_transition");
    }
  });
});

describe("fail-closed cross-check", () => {
  const goodMachines = MACHINES;

  it("refuses with internal_mismatch when the xstate machine lands somewhere the table does not allow", () => {
    const wrong = createMachine({
      id: "ship",
      initial: "working",
      states: { working: { on: { block: { target: "failed" } } }, blocked: {}, failed: {} },
    });
    const result = transitionUsing({ ...goodMachines, ship: wrong as never }, snapshot("working"), validEvent("block"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.code).toBe("internal_mismatch");
  });

  it("refuses with internal_mismatch when the xstate machine throws", () => {
    const throwing = createMachine({
      id: "ship",
      initial: "working",
      states: {
        working: {
          on: {
            block: {
              target: "blocked",
              guard: () => {
                throw new Error("boom");
              },
            },
          },
        },
        blocked: {},
      },
    });
    const result = transitionUsing({ ...goodMachines, ship: throwing as never }, snapshot("working"), validEvent("block"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.refusal.code).toBe("internal_mismatch");
      expect(result.refusal.message).toContain("boom");
    }
  });

  it("agrees with the real machines on the same input", () => {
    expect(transitionUsing(goodMachines, snapshot("working"), validEvent("block"))).toEqual(transition(snapshot("working"), validEvent("block")));
  });
});
