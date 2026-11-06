import { describe, expect, it } from "vitest";
import { transition, type TransitionResult } from "../../src/machine/transition";
import type { DeliveryMode, TaskKind, TaskSnapshot, TaskState } from "../../src/machine/types";
import { PR_URL, PROFILE, snapshot, validEvent } from "../fixtures/machine";

function refused(result: TransitionResult): { code: string; message: string } {
  if (result.ok) throw new Error(`expected a refusal but the task moved to ${result.snapshot.state}`);
  return result.refusal;
}

function applied(result: TransitionResult): TaskSnapshot {
  if (!result.ok) throw new Error(`expected success but got ${result.refusal.code}: ${result.refusal.message}`);
  return result.snapshot;
}

describe("hard rule 1: merge needs a recorded approval", () => {
  it("refuses merge without an approval and without yolo, and the task stays put", () => {
    const task = snapshot("awaiting_approval");
    const result = transition(task, validEvent("merge", { yolo: false }));
    expect(refused(result).code).toBe("approval_required");
    expect(task.state).toBe("awaiting_approval");
  });

  it("merges under yolo without an approval", () => {
    const next = applied(transition(snapshot("awaiting_approval"), validEvent("merge", { yolo: true })));
    expect(next.state).toBe("merged");
  });

  it("merges after the owner approves, and not after a denial", () => {
    let task = snapshot("awaiting_approval");
    task = applied(transition(task, validEvent("record_approval", { decision: "denied" })));
    expect(refused(transition(task, validEvent("merge", { yolo: false }))).code).toBe("approval_required");
    task = applied(transition(task, validEvent("record_approval", { decision: "approved" })));
    expect(applied(transition(task, validEvent("merge", { yolo: false }))).state).toBe("merged");
  });
});

describe("hard rule 2: teardown needs landed work", () => {
  const dirty = [
    { uncommittedChanges: true, unpushedCommits: 0 },
    { uncommittedChanges: false, unpushedCommits: 1 },
    { uncommittedChanges: true, unpushedCommits: 3 },
  ];

  it.each(dirty)("refuses teardown with %j and the task stays merged", (worktree) => {
    const task = snapshot("merged");
    expect(refused(transition(task, validEvent("teardown", { worktree }))).code).toBe("unlanded_work");
    expect(task.state).toBe("merged");
  });

  it("tears down a clean worktree", () => {
    const next = applied(transition(snapshot("merged"), validEvent("teardown")));
    expect(next.state).toBe("torn_down");
  });

  it("refuses teardown with no worktree report", () => {
    const event = validEvent("teardown");
    delete event.worktree;
    expect(refused(transition(snapshot("merged"), event)).code).toBe("invalid_event");
  });
});

describe("hard rule 3: completion and failure need evidence", () => {
  const cases: Array<{ name: string; from: TaskState; kind: TaskKind; mode: DeliveryMode; type: "handoff" | "ready" | "report" | "validated" | "fail" }> = [
    { name: "handoff", from: "working", kind: "ship", mode: "no-mistakes", type: "handoff" },
    { name: "ready", from: "working", kind: "ship", mode: "direct-PR", type: "ready" },
    { name: "report", from: "working", kind: "scout", mode: "no-mistakes", type: "report" },
    { name: "validated", from: "validating", kind: "ship", mode: "no-mistakes", type: "validated" },
    { name: "fail", from: "queued", kind: "ship", mode: "no-mistakes", type: "fail" },
  ];

  it.each(cases)("refuses $name with empty, blank, or missing evidence", ({ from, kind, mode, type }) => {
    for (const evidence of ["", "   ", "\n\t"]) {
      const result = transition(snapshot(from, { kind, mode }), validEvent(type, { evidence }));
      expect(refused(result).code).toBe("evidence_required");
    }
    const missing = validEvent(type);
    delete missing.evidence;
    expect(refused(transition(snapshot(from, { kind, mode }), missing)).code).toBe("evidence_required");
  });

  it.each(cases)("accepts $name with evidence", ({ from, kind, mode, type }) => {
    expect(transition(snapshot(from, { kind, mode }), validEvent(type)).ok).toBe(true);
  });
});

describe("hard rule 4: promotion needs a recorded approval", () => {
  it("refuses promote without an approval", () => {
    const task = snapshot("report_ready", { kind: "scout" });
    expect(refused(transition(task, validEvent("promote"))).code).toBe("approval_required");
  });

  it("promotes a scout to a queued ship task after the owner approves", () => {
    let task = snapshot("report_ready", { kind: "scout" });
    task = applied(transition(task, validEvent("record_approval", { scope: "promote", decision: "approved" })));
    task = applied(transition(task, validEvent("promote")));
    expect(task.state).toBe("queued");
    expect(task.context.kind).toBe("ship");
  });

  it("does not accept a merge approval as a promotion approval", () => {
    const task = snapshot("report_ready", { kind: "scout", approvals: { merge: "approved" } });
    expect(refused(transition(task, validEvent("promote"))).code).toBe("approval_required");
  });
});

describe("hard rule 8: illegal transitions are refused with a reason", () => {
  it("refuses an event that is not legal in the state, with a stable code", () => {
    const task = snapshot("working");
    const refusal = refused(transition(task, validEvent("merge")));
    expect(refusal.code).toBe("illegal_transition");
    expect(refusal.message).not.toBe("");
  });

  it("refuses everything once the task is torn down", () => {
    for (const type of ["start", "fail", "teardown", "merge"] as const) {
      expect(refused(transition(snapshot("torn_down"), validEvent(type))).code).toBe("illegal_transition");
    }
  });
});

describe("delivery modes decide what review ready means", () => {
  it("no-mistakes needs a finished pipeline and an open pull request", () => {
    const task = snapshot("validating", { mode: "no-mistakes" });
    expect(refused(transition(task, validEvent("validated", { pipelineFinished: false }))).code).toBe("mode_check_failed");
    const next = applied(transition(task, validEvent("validated")));
    expect(next.state).toBe("review_ready");
    expect(next.context.prUrl).toBe(PR_URL);
  });

  it("direct-PR needs an open pull request", () => {
    const task = snapshot("working", { mode: "direct-PR" });
    const noPr = validEvent("ready");
    delete noPr.prUrl;
    expect(refused(transition(task, noPr)).code).toBe("mode_check_failed");
    expect(applied(transition(task, validEvent("ready"))).state).toBe("review_ready");
  });

  it("local-only needs landed commits on the branch", () => {
    const task = snapshot("working", { mode: "local-only" });
    expect(refused(transition(task, validEvent("ready", { landedCommits: 0 }))).code).toBe("mode_check_failed");
    const noCount = validEvent("ready");
    delete noCount.landedCommits;
    expect(refused(transition(task, noCount)).code).toBe("mode_check_failed");
    expect(applied(transition(task, validEvent("ready", { landedCommits: 1 }))).state).toBe("review_ready");
  });

  it("refuses the other modes' completion events", () => {
    expect(refused(transition(snapshot("working", { mode: "no-mistakes" }), validEvent("ready"))).code).toBe("mode_mismatch");
    expect(refused(transition(snapshot("working", { mode: "direct-PR" }), validEvent("handoff"))).code).toBe("mode_mismatch");
    expect(refused(transition(snapshot("working", { mode: "local-only" }), validEvent("handoff"))).code).toBe("mode_mismatch");
  });
});

describe("validating and needs_decision belong to no-mistakes projects", () => {
  it("walks a no-mistakes ship task from handoff to review ready through a finding", () => {
    let task = snapshot("working", { mode: "no-mistakes" });
    const path: TaskState[] = [];
    for (const type of ["handoff", "finding", "resolve", "validated"] as const) {
      task = applied(transition(task, validEvent(type)));
      path.push(task.state);
    }
    expect(path).toEqual(["validating", "needs_decision", "validating", "review_ready"]);
  });

  it("never reaches validating or needs_decision in the other two modes", () => {
    for (const mode of ["direct-PR", "local-only"] as const) {
      for (const kind of ["ship", "scout"] as const) {
        const reached = reachableStates(snapshot("queued", { kind, mode, profile: null }));
        expect(reached.has("validating"), `${mode}/${kind}`).toBe(false);
        expect(reached.has("needs_decision"), `${mode}/${kind}`).toBe(false);
      }
    }
    const shipReach = reachableStates(snapshot("queued", { kind: "ship", mode: "no-mistakes" }));
    expect(shipReach.has("validating")).toBe(true);
    expect(shipReach.has("needs_decision")).toBe(true);
  });
});

/** Explore every state reachable from `start` when each event arrives with its gates satisfied. */
function reachableStates(start: TaskSnapshot): Set<TaskState> {
  const eventVariants = [
    validEvent("start"),
    validEvent("block"),
    validEvent("unblock"),
    validEvent("handoff"),
    validEvent("ready"),
    validEvent("report"),
    validEvent("finding"),
    validEvent("resolve"),
    validEvent("validated"),
    validEvent("request_approval"),
    validEvent("record_approval", { scope: "merge" }),
    validEvent("record_approval", { scope: "promote" }),
    validEvent("merge", { yolo: true }),
    validEvent("promote"),
    validEvent("teardown"),
    validEvent("fail"),
  ];
  const seen = new Set<string>();
  const states = new Set<TaskState>();
  const queue: TaskSnapshot[] = [start];
  while (queue.length > 0) {
    const current = queue.shift() as TaskSnapshot;
    const key = `${current.context.kind}:${current.state}:${JSON.stringify(current.context.approvals)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    states.add(current.state);
    for (const event of eventVariants) {
      const result = transition(current, event);
      if (result.ok) queue.push(result.snapshot);
    }
  }
  return states;
}

describe("start needs a resolved profile", () => {
  it("refuses start without a profile", () => {
    for (const profile of [null, undefined]) {
      const result = transition(snapshot("queued", { profile: null }), validEvent("start", { profile }));
      expect(refused(result).code).toBe("profile_required");
    }
    const task = snapshot("queued", { profile: null });
    const missing = validEvent("start");
    delete missing.profile;
    expect(refused(transition(task, missing)).code).toBe("profile_required");
  });

  it("starts with a complete profile and records it", () => {
    const next = applied(transition(snapshot("queued", { profile: null }), validEvent("start")));
    expect(next.state).toBe("working");
    expect(next.context.profile).toEqual(PROFILE);
  });
});

describe("blocked loops back to working", () => {
  it("blocks a working task and unblocks it", () => {
    const blocked = applied(transition(snapshot("working"), validEvent("block")));
    expect(blocked.state).toBe("blocked");
    expect(applied(transition(blocked, validEvent("unblock"))).state).toBe("working");
  });

  it("refuses block outside working", () => {
    for (const state of ["queued", "validating", "review_ready", "merged", "blocked", "failed", "torn_down"] as const) {
      expect(refused(transition(snapshot(state), validEvent("block"))).code, state).toBe("illegal_transition");
    }
  });
});

describe("any state before torn_down can fail with evidence", () => {
  const shipStates: TaskState[] = ["queued", "working", "blocked", "validating", "needs_decision", "review_ready", "awaiting_approval", "merged"];
  const scoutStates: TaskState[] = ["queued", "working", "blocked", "report_ready"];

  it.each([
    ...shipStates.map((state) => ({ kind: "ship" as const, state })),
    ...scoutStates.map((state) => ({ kind: "scout" as const, state })),
  ])("moves $kind task in $state to failed", ({ kind, state }) => {
    expect(applied(transition(snapshot(state, { kind }), validEvent("fail"))).state).toBe("failed");
  });

  it("refuses fail from failed and torn_down", () => {
    expect(refused(transition(snapshot("failed"), validEvent("fail"))).code).toBe("illegal_transition");
    expect(refused(transition(snapshot("torn_down"), validEvent("fail"))).code).toBe("illegal_transition");
  });
});

describe("approvals and authority", () => {
  it("accepts approval events only from the owner", () => {
    for (const actor of ["worker", "supervisor", "system"] as const) {
      const result = transition(snapshot("awaiting_approval"), validEvent("record_approval", { actor }));
      expect(refused(result).code, actor).toBe("actor_forbidden");
    }
    expect(transition(snapshot("awaiting_approval"), validEvent("record_approval", { actor: "user" })).ok).toBe(true);
  });

  it("refuses a worker on request_approval, merge, promote, and teardown", () => {
    const cases = [
      { task: snapshot("review_ready"), event: validEvent("request_approval", { actor: "worker" }) },
      { task: snapshot("awaiting_approval"), event: validEvent("merge", { actor: "worker", yolo: true }) },
      { task: snapshot("report_ready", { kind: "scout", approvals: { promote: "approved" } }), event: validEvent("promote", { actor: "worker" }) },
      { task: snapshot("merged"), event: validEvent("teardown", { actor: "worker" }) },
    ];
    for (const { task, event } of cases) {
      expect(refused(transition(task, event)).code, String(event.type)).toBe("actor_forbidden");
    }
  });
});

describe("request_changes sends a denied task back to rework", () => {
  it("returns a task from review_ready or awaiting_approval to working", () => {
    for (const state of ["review_ready", "awaiting_approval"] as const) {
      expect(applied(transition(snapshot(state), validEvent("request_changes"))).state, state).toBe("working");
    }
  });

  it("keeps hard rule 1: after a denial and a rework, merge still needs a new recorded approval", () => {
    let task = snapshot("awaiting_approval");
    task = applied(transition(task, validEvent("record_approval", { decision: "denied" })));
    expect(refused(transition(task, validEvent("merge", { yolo: false }))).code).toBe("approval_required");

    task = applied(transition(task, validEvent("request_changes")));
    expect(task.state).toBe("working");
    for (const type of ["handoff", "validated", "request_approval"] as const) task = applied(transition(task, validEvent(type)));

    expect(refused(transition(task, validEvent("merge", { yolo: false }))).code).toBe("approval_required");
    task = applied(transition(task, validEvent("record_approval", { decision: "approved" })));
    expect(applied(transition(task, validEvent("merge", { yolo: false }))).state).toBe("merged");
  });

  it("does not let a worker ask for changes, and refuses the event anywhere else", () => {
    expect(refused(transition(snapshot("review_ready"), validEvent("request_changes", { actor: "worker" }))).code).toBe("actor_forbidden");
    expect(refused(transition(snapshot("merged"), validEvent("request_changes"))).code).toBe("illegal_transition");
    expect(refused(transition(snapshot("report_ready", { kind: "scout" }), validEvent("request_changes"))).code).toBe("illegal_transition");
  });
});
