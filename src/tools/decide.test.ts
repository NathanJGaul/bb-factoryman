import { describe, expect, it } from "vitest";
import type { Finding, Outcome, RunView } from "../validator/types";
import { decideSchema, decisionEvidence, decisionRequest, planAnswer, type DecideCall } from "./decide";

const finding = (id: string, action = "ask-user"): Finding => ({ id, severity: "error", file: "sum.js", action, description: `Problem ${id}, with "quotes" and \`ticks\`.` });
const view = (overrides: Partial<RunView> = {}): RunView => ({ runId: "r1", branch: "fm/t1", phase: "running", gate: null, outcome: null, prUrl: null, error: null, ...overrides });
const gate = (...ids: string[]): RunView => view({ phase: "gate", gate: { step: "review", status: "awaiting_approval", findings: ids.map((id) => finding(id, id === "review-2" ? "ask-user" : "auto-fix")) } });
const finished = (outcome: Outcome, overrides: Partial<RunView> = {}): RunView => view({ phase: "finished", outcome, ...overrides });
const PR = "https://github.com/acme/widgets/pull/7";
const call = (overrides: Partial<DecideCall> = {}): DecideCall => ({ taskId: "t1", key: "nm-r1-review-0a1b2c3d", action: "approve", ...overrides });
const KEY = "nm-r1-review-0a1b2c3d";

describe("decideSchema", () => {
  it("[U1816] accepts a call with the three required fields, and with fix fields", () => {
    expect(decideSchema.safeParse({ taskId: "t1", key: KEY, action: "approve" }).success).toBe(true);
    expect(decideSchema.safeParse({ taskId: "t1", key: KEY, action: "fix", findingIds: ["review-1"], instructions: "Fix it." }).success).toBe(true);
  });

  it.each([
    ["an unknown key", { taskId: "t1", key: KEY, action: "approve", yes: true }],
    ["a missing key field", { taskId: "t1", action: "approve" }],
    ["an empty key", { taskId: "t1", key: "", action: "approve" }],
    ["an empty taskId", { taskId: "", key: KEY, action: "approve" }],
    ["an action outside the four", { taskId: "t1", key: KEY, action: "maybe" }],
    ["an empty finding ID", { taskId: "t1", key: KEY, action: "fix", findingIds: [""] }],
    ["findingIds that is not an array", { taskId: "t1", key: KEY, action: "fix", findingIds: "review-1" }],
    ["instructions that is not a string", { taskId: "t1", key: KEY, action: "fix", findingIds: ["review-1"], instructions: 3 }],
  ])("[U1816] refuses %s", (_name, value) => {
    expect(decideSchema.safeParse(value).success).toBe(false);
  });
});

describe("planAnswer for a pending gate", () => {
  const live = gate("review-1", "review-2");

  it.each([
    ["approve", call({ action: "approve" }), { kind: "answer", answer: { action: "approve" } }],
    ["skip", call({ action: "skip" }), { kind: "answer", answer: { action: "skip" } }],
    ["fix of one finding", call({ action: "fix", findingIds: ["review-2"] }), { kind: "answer", answer: { action: "fix", findingIds: ["review-2"] } }],
    ["fix of every finding", call({ action: "fix", findingIds: ["review-1", "review-2"] }), { kind: "answer", answer: { action: "fix", findingIds: ["review-1", "review-2"] } }],
    ["fix with instructions", call({ action: "fix", findingIds: ["review-1"], instructions: "  Use a query.\n" }), { kind: "answer", answer: { action: "fix", findingIds: ["review-1"], instructions: "  Use a query.\n" } }],
    ["fix with blank instructions", call({ action: "fix", findingIds: ["review-1"], instructions: " \n" }), { kind: "answer", answer: { action: "fix", findingIds: ["review-1"] } }],
    ["approve with empty IDs and blank instructions", call({ action: "approve", findingIds: [], instructions: "  " }), { kind: "answer", answer: { action: "approve" } }],
  ])("[U1817] accepts %s", (_name, input, plan) => {
    expect(planAnswer(input, live)).toEqual({ ok: true, plan });
  });

  it.each([
    ["approve with finding IDs", call({ action: "approve", findingIds: ["review-1"] }), /approve takes no finding IDs/],
    ["skip with instructions", call({ action: "skip", instructions: "text" }), /skip takes no finding IDs and no instructions/],
    ["fix with no IDs", call({ action: "fix" }), /at least one finding ID/],
    ["fix with an empty list", call({ action: "fix", findingIds: [] }), /at least one finding ID/],
    ["fix with a duplicate ID", call({ action: "fix", findingIds: ["review-1", "review-1"] }), /review-1 twice/],
    ["fix with an ID that is not in the gate", call({ action: "fix", findingIds: ["review-9"] }), /review-9.*not in the gate.*review-1, review-2/],
    ["rerun on a gate", call({ action: "rerun" }), /rerun is for a run that finished.*approve, skip, or fix/],
  ])("[U1817] refuses %s", (_name, input, reason) => {
    const planned = planAnswer(input, live);
    expect(planned.ok).toBe(false);
    expect(planned.ok ? "" : planned.message).toMatch(reason);
  });

  it("[U1817] refuses a fix on a gate with no findings, and accepts approve and skip there", () => {
    const empty = gate();
    expect(planAnswer(call({ action: "fix", findingIds: ["review-1"] }), empty).ok).toBe(false);
    expect(planAnswer(call({ action: "approve" }), empty).ok).toBe(true);
    expect(planAnswer(call({ action: "skip" }), empty).ok).toBe(true);
  });
});

describe("planAnswer for a finished run", () => {
  it.each([
    ["passed", finished("passed", { prUrl: PR })],
    ["passed-with-override", finished("passed-with-override", { prUrl: PR })],
    ["passed-with-skips", finished("passed-with-skips", { prUrl: PR })],
    ["checks-passed with no pull request", finished("checks-passed")],
  ])("[U1818] accepts rerun for %s", (_name, live) => {
    expect(planAnswer(call({ action: "rerun" }), live)).toEqual({ ok: true, plan: { kind: "rerun" } });
  });

  it.each([
    ["checks-passed with a pull request", finished("checks-passed", { prUrl: PR })],
    ["failed", finished("failed", { error: "ci failed" })],
    ["cancelled", finished("cancelled")],
    ["a running view", view()],
  ])("[U1818] refuses rerun for %s", (_name, live) => {
    const planned = planAnswer(call({ action: "rerun" }), live);
    expect(planned.ok).toBe(false);
    expect(planned.ok ? "" : planned.message).toMatch(/not waiting for a decision/);
  });

  it.each(["approve", "skip", "fix"] as const)("[U1818] refuses %s for every finished view", (action) => {
    for (const live of [finished("passed-with-override", { prUrl: PR }), finished("checks-passed"), finished("failed"), view()]) {
      const planned = planAnswer(call({ action, findingIds: action === "fix" ? ["review-1"] : undefined }), live);
      expect(planned.ok, `${action} on ${live.outcome ?? live.phase}`).toBe(false);
    }
    const finishedPlan = planAnswer(call({ action }), finished("passed-with-override", { prUrl: PR }));
    expect(finishedPlan.ok ? "" : finishedPlan.message).toMatch(/No gate is pending.*passed-with-override.*only decision is rerun/);
  });
});

describe("decisionRequest", () => {
  it("[U1819] builds a gate payload with the findings verbatim and empty instructions when there are none", () => {
    const live = gate("review-1", "review-2");
    const payload = decisionRequest("t1", KEY, live, { kind: "answer", answer: { action: "fix", findingIds: ["review-2"] } });
    expect(payload).toEqual({
      taskId: "t1",
      key: KEY,
      kind: "gate",
      step: "review",
      status: "awaiting_approval",
      outcome: "",
      findings: live.gate!.findings,
      answer: { action: "fix", findingIds: ["review-2"], instructions: "" },
    });
  });

  it("[U1819] carries the instructions exactly, and none for approve and skip", () => {
    const live = gate("review-1");
    expect(decisionRequest("t1", KEY, live, { kind: "answer", answer: { action: "fix", findingIds: ["review-1"], instructions: " Do it.\n" } }).answer.instructions).toBe(" Do it.\n");
    expect(decisionRequest("t1", KEY, live, { kind: "answer", answer: { action: "skip" } }).answer).toEqual({ action: "skip", findingIds: [], instructions: "" });
  });

  it("[U1819] builds a finished-run payload with the outcome, no findings, and the rerun answer", () => {
    const payload = decisionRequest("t1", KEY, finished("passed-with-override", { prUrl: PR }), { kind: "rerun" });
    expect(payload).toEqual({ taskId: "t1", key: KEY, kind: "finished", step: "", status: "", outcome: "passed-with-override", findings: [], answer: { action: "rerun", findingIds: [], instructions: "" } });
  });
});

describe("decisionEvidence", () => {
  it("[U1820] names the action, the finding IDs, the instructions, the key, and the owner's comment for a fix", () => {
    const text = decisionEvidence({ kind: "answer", answer: { action: "fix", findingIds: ["review-1", "review-2"], instructions: "Use a query." } }, KEY, gate("review-1", "review-2"), "Go ahead.");
    expect(text).toContain("answered the gate: fix review-1, review-2");
    expect(text).toContain("instructions: Use a query.");
    expect(text).toContain(`key ${KEY}`);
    expect(text).toMatch(/owner approved this answer in the decision form/);
    expect(text).toContain("Comment: Go ahead.");
  });

  it("[U1820] names the bare action for approve and skip, and leaves out a missing comment", () => {
    const text = decisionEvidence({ kind: "answer", answer: { action: "skip" } }, KEY, gate("review-1"), undefined);
    expect(text).toContain("answered the gate: skip");
    expect(text).not.toContain("instructions");
    expect(text).not.toContain("Comment:");
  });

  it("[U1820] names the run's outcome for a rerun", () => {
    const text = decisionEvidence({ kind: "rerun" }, KEY, finished("passed-with-override", { prUrl: PR }), "Try once more.");
    expect(text).toMatch(/owner approved a new no-mistakes run in the decision form/);
    expect(text).toContain("passed-with-override");
    expect(text).toContain(`key ${KEY}`);
    expect(text).toContain("Comment: Try once more.");
  });
});
