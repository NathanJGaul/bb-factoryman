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

  it.each(["ship", "scout"] as const)("[U818] records the machine in a %s task and refuses a local-only start on another machine", (kind) => {
    const task = snapshot("queued", { kind, profile: null, mode: "local-only" });
    const moved = nextSnapshot(task, validEvent("start", { machine: "host_a", cloneMachine: "host_a" }));
    expect(moved.context.machine).toBe("host_a");
    const refused = transition(task, validEvent("start", { machine: "host_b", cloneMachine: "host_a" }));
    expect(refused).toMatchObject({ ok: false, refusal: { code: "machine_mismatch" } });
  });

  it("records a null machine when none is pinned", () => {
    const next = nextSnapshot(snapshot("queued", { profile: null }), validEvent("start", { machine: undefined }));
    expect(next.context.machine).toBeNull();
  });
});

describe("custom checks", () => {
  it("[U918] refuses handoff and ready with check_failed, and still runs the earlier guards first", () => {
    const failing = [{ name: "lint", passed: false }];
    const noMistakes = snapshot("working", { mode: "no-mistakes" });
    expect(transition(noMistakes, validEvent("handoff", { checks: failing }))).toMatchObject({ ok: false, refusal: { code: "check_failed" } });
    expect(transition(noMistakes, validEvent("handoff", { checks: [{ name: "lint", passed: true }] })).ok).toBe(true);
    const direct = snapshot("working", { mode: "direct-PR" });
    expect(transition(direct, validEvent("ready", { checks: failing }))).toMatchObject({ ok: false, refusal: { code: "check_failed" } });
    expect(transition(direct, validEvent("ready", { checks: [] })).ok).toBe(true);
    // The evidence gate comes first, so passing checks cannot stand in for evidence.
    expect(transition(noMistakes, validEvent("handoff", { evidence: "", checks: [{ name: "lint", passed: true }] }))).toMatchObject({ ok: false, refusal: { code: "evidence_required" } });
    // A mode mismatch comes first too.
    expect(transition(direct, validEvent("handoff", { checks: failing }))).toMatchObject({ ok: false, refusal: { code: "mode_mismatch" } });
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

  it("lands the real machines on the table's target for a legal move", () => {
    expect(transitionUsing(goodMachines, snapshot("working"), validEvent("block"))).toMatchObject({
      ok: true,
      from: "working",
      to: "blocked",
      snapshot: { state: "blocked" },
    });
  });
});

describe("request_changes", () => {
  it.each(["review_ready", "awaiting_approval"] as const)("returns a ship task in %s to working and keeps what the worker built", (state) => {
    const before = snapshot(state, { prUrl: "https://github.com/acme/widgets/pull/7", machine: "builder-2" });
    const next = nextSnapshot(before, validEvent("request_changes"));
    expect(next.state).toBe("working");
    expect(next.context).toEqual({ ...before.context, approvals: {} });
  });

  it("clears the merge decision, whether it was a denial or an approval, so a later approval is a fresh one", () => {
    for (const decision of ["denied", "approved"] as const) {
      const next = nextSnapshot(snapshot("awaiting_approval", { approvals: { merge: decision } }), validEvent("request_changes"));
      expect(next.context.approvals, decision).toEqual({});
    }
  });

  it("makes the task earn a new approval before it can merge again", () => {
    let task = snapshot("awaiting_approval");
    task = nextSnapshot(task, validEvent("record_approval", { decision: "denied" }));
    task = nextSnapshot(task, validEvent("request_changes"));
    for (const type of ["handoff", "validated", "request_approval"] as const) task = nextSnapshot(task, validEvent(type));
    expect(task.state).toBe("awaiting_approval");
    expect(refusedCode(task, validEvent("merge", { yolo: false }))).toBe("approval_required");
    task = nextSnapshot(task, validEvent("record_approval", { decision: "approved" }));
    expect(nextSnapshot(task, validEvent("merge", { yolo: false })).state).toBe("merged");
  });

  it("does not let an approval given before the rework carry over", () => {
    let task = snapshot("awaiting_approval");
    task = nextSnapshot(task, validEvent("record_approval", { decision: "approved" }));
    task = nextSnapshot(task, validEvent("request_changes"));
    for (const type of ["handoff", "validated", "request_approval"] as const) task = nextSnapshot(task, validEvent(type));
    expect(refusedCode(task, validEvent("merge", { yolo: false }))).toBe("approval_required");
  });

  it("is refused for a worker actor", () => {
    for (const state of ["review_ready", "awaiting_approval"] as const) {
      expect(refusedCode(snapshot(state), validEvent("request_changes", { actor: "worker" })), state).toBe("actor_forbidden");
    }
  });

  it("is accepted from the supervisor, the owner, and the system", () => {
    for (const actor of ["supervisor", "user", "system"]) {
      expect(nextSnapshot(snapshot("review_ready"), validEvent("request_changes", { actor })).state, actor).toBe("working");
    }
  });

  it("is refused outside review_ready and awaiting_approval, and for scout tasks", () => {
    for (const state of ["queued", "working", "blocked", "validating", "needs_decision", "merged", "failed", "torn_down"] as const) {
      expect(refusedCode(snapshot(state), validEvent("request_changes")), state).toBe("illegal_transition");
    }
    for (const state of ["working", "report_ready", "failed"] as const) {
      expect(refusedCode(snapshot(state, { kind: "scout" }), validEvent("request_changes")), `scout ${state}`).toBe("illegal_transition");
    }
  });
});
