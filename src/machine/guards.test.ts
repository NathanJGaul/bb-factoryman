import { describe, expect, it } from "vitest";
import { context, parsedEvent } from "../../test/fixtures/machine";
import { GUARDS } from "./guards";
import type { TaskContext } from "./types";

describe("evidenceProvided", () => {
  it.each(["", "   ", "\n\t", undefined])("refuses evidence %j", (evidence) => {
    const refusal = GUARDS.evidenceProvided(context(), parsedEvent("fail", { evidence }));
    expect(refusal?.code).toBe("evidence_required");
    expect(refusal?.message.length).toBeGreaterThan(0);
  });

  it.each(["x", "  x  ", "tests pass; pull request open"])("accepts evidence %j", (evidence) => {
    expect(GUARDS.evidenceProvided(context(), parsedEvent("fail", { evidence }))).toBeNull();
  });
});

describe("profileResolved", () => {
  it.each([null, undefined])("refuses a start event with profile %j", (profile) => {
    expect(GUARDS.profileResolved(context(), parsedEvent("start", { profile }))?.code).toBe("profile_required");
  });

  it("accepts a start event with a complete profile", () => {
    expect(GUARDS.profileResolved(context(), parsedEvent("start"))).toBeNull();
  });
});

describe("notWorker and ownerOnly", () => {
  it("notWorker refuses only the worker actor", () => {
    expect(GUARDS.notWorker(context(), parsedEvent("merge", { actor: "worker" }))?.code).toBe("actor_forbidden");
    for (const actor of ["supervisor", "user", "system"]) {
      expect(GUARDS.notWorker(context(), parsedEvent("merge", { actor }))).toBeNull();
    }
  });

  it("ownerOnly accepts only the user actor", () => {
    expect(GUARDS.ownerOnly(context(), parsedEvent("record_approval", { actor: "user" }))).toBeNull();
    for (const actor of ["worker", "supervisor", "system"]) {
      expect(GUARDS.ownerOnly(context(), parsedEvent("record_approval", { actor }))?.code).toBe("actor_forbidden");
    }
  });
});

describe("mode guards", () => {
  it("modeIsNoMistakes accepts only the no-mistakes mode", () => {
    const event = parsedEvent("handoff");
    expect(GUARDS.modeIsNoMistakes(context({ mode: "no-mistakes" }), event)).toBeNull();
    for (const mode of ["direct-PR", "local-only"] as const) {
      expect(GUARDS.modeIsNoMistakes(context({ mode }), event)?.code).toBe("mode_mismatch");
    }
  });

  it("modeIsNotNoMistakes accepts direct-PR and local-only and refuses no-mistakes", () => {
    const event = parsedEvent("ready");
    expect(GUARDS.modeIsNotNoMistakes(context({ mode: "no-mistakes" }), event)?.code).toBe("mode_mismatch");
    for (const mode of ["direct-PR", "local-only"] as const) {
      expect(GUARDS.modeIsNotNoMistakes(context({ mode }), event)).toBeNull();
    }
  });
});

describe("readyModeCheck", () => {
  const noPr = { prUrl: undefined };
  const check = (mode: "direct-PR" | "local-only" | "no-mistakes", overrides: Record<string, unknown>) =>
    GUARDS.readyModeCheck(context({ mode }), parsedEvent("ready", overrides));

  it("direct-PR needs a pull request URL", () => {
    expect(check("direct-PR", noPr)?.code).toBe("mode_check_failed");
    expect(check("direct-PR", {})).toBeNull();
  });

  it("direct-PR does not need landed commits", () => {
    expect(check("direct-PR", { landedCommits: 0 })).toBeNull();
  });

  it("local-only needs one or more landed commits, so 0 and a missing count fail and 1 passes", () => {
    expect(check("local-only", { landedCommits: undefined })?.code).toBe("mode_check_failed");
    expect(check("local-only", { landedCommits: 0 })?.code).toBe("mode_check_failed");
    expect(check("local-only", { landedCommits: 1 })).toBeNull();
  });

  it("local-only does not need a pull request URL", () => {
    expect(check("local-only", { prUrl: undefined, landedCommits: 3 })).toBeNull();
  });

  it("refuses for the no-mistakes mode, which reaches review ready through validated", () => {
    expect(check("no-mistakes", {})?.code).toBe("mode_mismatch");
  });

  it("refuses an event that is not a ready event", () => {
    expect(GUARDS.readyModeCheck(context({ mode: "direct-PR" }), parsedEvent("handoff"))?.code).toBe("mode_check_failed");
  });
});

describe("pipelineFinishedWithPr", () => {
  it("refuses an unfinished pipeline and accepts a finished one", () => {
    expect(GUARDS.pipelineFinishedWithPr(context(), parsedEvent("validated", { pipelineFinished: false }))?.code).toBe("mode_check_failed");
    expect(GUARDS.pipelineFinishedWithPr(context(), parsedEvent("validated", { pipelineFinished: true }))).toBeNull();
  });

  it("refuses an event that is not a validated event", () => {
    expect(GUARDS.pipelineFinishedWithPr(context(), parsedEvent("ready"))?.code).toBe("mode_check_failed");
  });
});

describe("approval scope guards", () => {
  it("approvalScopeIsMerge accepts only the merge scope", () => {
    expect(GUARDS.approvalScopeIsMerge(context(), parsedEvent("record_approval", { scope: "merge" }))).toBeNull();
    expect(GUARDS.approvalScopeIsMerge(context(), parsedEvent("record_approval", { scope: "promote" }))?.code).toBe("approval_scope_mismatch");
  });

  it("approvalScopeIsPromote accepts only the promote scope", () => {
    expect(GUARDS.approvalScopeIsPromote(context(), parsedEvent("record_approval", { scope: "promote" }))).toBeNull();
    expect(GUARDS.approvalScopeIsPromote(context(), parsedEvent("record_approval", { scope: "merge" }))?.code).toBe("approval_scope_mismatch");
  });

  it("refuse an event that is not an approval event", () => {
    expect(GUARDS.approvalScopeIsMerge(context(), parsedEvent("merge"))?.code).toBe("approval_scope_mismatch");
    expect(GUARDS.approvalScopeIsPromote(context(), parsedEvent("merge"))?.code).toBe("approval_scope_mismatch");
  });
});

describe("mergeAuthorized", () => {
  const merge = (yolo: boolean) => parsedEvent("merge", { yolo });
  const withApprovals = (approvals: TaskContext["approvals"]) => context({ approvals });

  it("accepts yolo with no approval", () => {
    expect(GUARDS.mergeAuthorized(context(), merge(true))).toBeNull();
  });

  it("accepts an approved merge decision", () => {
    expect(GUARDS.mergeAuthorized(withApprovals({ merge: "approved" }), merge(false))).toBeNull();
  });

  it("refuses without yolo when the merge decision is denied, missing, or for another scope", () => {
    for (const approvals of [{ merge: "denied" as const }, {}, { promote: "approved" as const }]) {
      expect(GUARDS.mergeAuthorized(withApprovals(approvals), merge(false))?.code, JSON.stringify(approvals)).toBe("approval_required");
    }
  });

  it("refuses an event that is not a merge event, even under yolo", () => {
    expect(GUARDS.mergeAuthorized(context({ approvals: { merge: "approved" } }), parsedEvent("promote"))?.code).toBe("approval_required");
  });
});

describe("promotionAuthorized", () => {
  it("accepts an approved promote decision", () => {
    expect(GUARDS.promotionAuthorized(context({ approvals: { promote: "approved" } }), parsedEvent("promote"))).toBeNull();
  });

  it("refuses a denied, missing, or other-scope decision", () => {
    for (const approvals of [{ promote: "denied" as const }, {}, { merge: "approved" as const }]) {
      expect(GUARDS.promotionAuthorized(context({ approvals }), parsedEvent("promote"))?.code, JSON.stringify(approvals)).toBe("approval_required");
    }
  });
});

describe("worktreeLanded", () => {
  const teardown = (worktree: { uncommittedChanges: boolean; unpushedCommits: number }) => parsedEvent("teardown", { worktree });

  it("accepts a clean worktree with zero unpushed commits", () => {
    expect(GUARDS.worktreeLanded(context(), teardown({ uncommittedChanges: false, unpushedCommits: 0 }))).toBeNull();
  });

  it("refuses uncommitted changes", () => {
    expect(GUARDS.worktreeLanded(context(), teardown({ uncommittedChanges: true, unpushedCommits: 0 }))?.code).toBe("unlanded_work");
  });

  it("refuses a single unpushed commit", () => {
    expect(GUARDS.worktreeLanded(context(), teardown({ uncommittedChanges: false, unpushedCommits: 1 }))?.code).toBe("unlanded_work");
  });

  it("refuses an event that is not a teardown event", () => {
    expect(GUARDS.worktreeLanded(context(), parsedEvent("merge"))?.code).toBe("unlanded_work");
  });
});

describe("localOnlyStaysOnClone", () => {
  const check = (mode: "local-only" | "direct-PR" | "no-mistakes", fields: Record<string, unknown>) =>
    GUARDS.localOnlyStaysOnClone(context({ mode }), parsedEvent("start", fields));

  it("[U814] refuses a local-only start on a machine other than the clone machine", () => {
    const refusal = check("local-only", { machine: "host_b", cloneMachine: "host_a" });
    expect(refusal?.code).toBe("machine_mismatch");
    expect(refusal?.message).toMatch(/local-only/);
  });

  it("[U815] accepts a local-only start on the clone machine, and one with no machine", () => {
    expect(check("local-only", { machine: "host_a", cloneMachine: "host_a" })).toBeNull();
    expect(check("local-only", { machine: undefined, cloneMachine: "host_a" })).toBeNull();
    expect(check("local-only", { machine: null, cloneMachine: null })).toBeNull();
  });

  it("[U816] refuses a local-only start on a machine when no clone machine is known", () => {
    expect(check("local-only", { machine: "host_b", cloneMachine: undefined })?.code).toBe("machine_mismatch");
    expect(check("local-only", { machine: "host_b", cloneMachine: null })?.code).toBe("machine_mismatch");
  });

  it.each(["direct-PR", "no-mistakes"] as const)("[U817] ignores the clone machine in %s mode", (mode) => {
    expect(check(mode, { machine: "host_b", cloneMachine: "host_a" })).toBeNull();
  });
});

describe("customChecksPassed", () => {
  const check = (type: "handoff" | "ready", checks: unknown) => GUARDS.customChecksPassed(context(), parsedEvent(type, { checks }));

  it("[U915] refuses any check with passed false and names every failure", () => {
    for (const type of ["handoff", "ready"] as const) {
      const refusal = check(type, [{ name: "lint", passed: true }, { name: "test", passed: false }, { name: "docs", passed: false }]);
      expect(refusal?.code, type).toBe("check_failed");
      expect(refusal?.message).toContain("test");
      expect(refusal?.message).toContain("docs");
      expect(refusal?.message).not.toContain("lint");
    }
  });

  it("[U916] passes with no checks, an empty list, or all checks passed", () => {
    for (const type of ["handoff", "ready"] as const) {
      expect(check(type, undefined), type).toBeNull();
      expect(check(type, []), type).toBeNull();
      expect(check(type, [{ name: "lint", passed: true }]), type).toBeNull();
    }
  });
});
