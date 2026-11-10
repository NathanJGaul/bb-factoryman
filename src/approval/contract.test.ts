import { describe, expect, it } from "vitest";
import { DISPATCH, loadWorld, nextForm } from "../../test/fixtures/plugin-host";
import { approvalAnswerSchema } from "../tools/merge";
import { DECISION_RENDERER_ID, MERGE_RENDERER_ID, answerFor, readDecisionPayload, readMergePayload, type DecisionRequestPayload, type MergeRequestPayload } from "./contract";

const PAYLOAD: MergeRequestPayload = {
  taskId: "t1",
  branch: "fm/t1",
  prUrl: "https://github.com/acme/widgets/pull/7",
  evidence: "PR open.",
};
const FIELDS = ["taskId", "branch", "prUrl", "evidence"] as const;
const DECISIONS = ["approved", "denied"] as const;

describe("readMergePayload", () => {
  it("[U1201] returns the payload for an object with exactly the four string fields", () => {
    expect(readMergePayload({ ...PAYLOAD })).toEqual(PAYLOAD);
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "text"],
    ["a number", 3],
    ["an empty array", []],
    ["an array that holds a payload", [PAYLOAD]],
  ])("[U1202] returns null for %s", (_name, value) => {
    expect(readMergePayload(value)).toBeNull();
  });

  it.each(FIELDS)("[U1203] returns null when %s is missing", (field) => {
    const without: Record<string, string> = { ...PAYLOAD };
    delete without[field];
    expect(readMergePayload(without)).toBeNull();
  });

  it.each(FIELDS.flatMap((field) => [1, null, {}].map((wrong) => [field, JSON.stringify(wrong), wrong] as const)))(
    "[U1204] returns null when %s is %s",
    (field, _label, wrong) => {
      expect(readMergePayload({ ...PAYLOAD, [field]: wrong })).toBeNull();
    },
  );

  it("[U1205] returns null when the object carries a fifth field", () => {
    expect(readMergePayload({ ...PAYLOAD, extra: "x" })).toBeNull();
  });

  it("[U1206] accepts empty strings in every field, because a local-only task has no pull request", () => {
    const empty = { taskId: "", branch: "", prUrl: "", evidence: "" };
    expect(readMergePayload(empty)).toEqual(empty);
  });
});

describe("answerFor", () => {
  it.each(DECISIONS)("[U1207] carries only the decision for %s when there is no comment", (decision) => {
    expect(answerFor(decision)).toStrictEqual({ decision });
    expect(answerFor(decision, undefined)).toStrictEqual({ decision });
  });

  it("[U1208] trims the comment and keeps the text between", () => {
    expect(answerFor("approved", "  Ship it.  ")).toStrictEqual({ decision: "approved", comment: "Ship it." });
    expect(answerFor("denied", "a  b\nc")).toStrictEqual({ decision: "denied", comment: "a  b\nc" });
  });

  it.each([
    ["empty", ""],
    ["a space", " "],
    ["a line break", "\n"],
    ["tabs, spaces, and a line break", "\t \n"],
  ])("[U1209] leaves out a comment that is %s", (_name, blank) => {
    expect(answerFor("approved", blank)).toStrictEqual({ decision: "approved" });
  });

  it("[U1209] keeps a one-character comment", () => {
    expect(answerFor("approved", "a")).toStrictEqual({ decision: "approved", comment: "a" });
  });

  it.each(DECISIONS.flatMap((decision) => [undefined, "", "  ", "Ship it.", " padded "].map((comment) => [decision, JSON.stringify(comment), comment] as const)))(
    "[U1210] passes the strict schema that factoryman_merge reads: %s with the comment %s",
    (decision, _label, comment) => {
      expect(approvalAnswerSchema.safeParse(answerFor(decision, comment)).success).toBe(true);
    },
  );
});

describe("the contract with factoryman_merge", () => {
  it("[U1211] reads the payload that factoryman_merge builds for a ship task", async () => {
    const world = await loadWorld();
    world.setProject({ deliveryMode: "direct-PR", yolo: false });
    await world.call("factoryman_dispatch", DISPATCH);
    const prUrl = "https://github.com/acme/widgets/pull/7";
    await world.call("factoryman_report", { outcome: "done", evidence: "PR open.", prUrl }, { threadId: "thr-w1" });
    const call = world.call("factoryman_merge", { taskId: "t1" });
    const formId = await nextForm(world);
    const form = world.host.harness.inspection.pendingInteractions.find((pending) => pending.id === formId);
    expect(form?.rendererId).toBe(MERGE_RENDERER_ID);
    expect(readMergePayload(form?.payload)).toEqual({ taskId: "t1", branch: expect.stringMatching(/^fm\//), prUrl, evidence: "PR open." });
    world.host.harness.behavior.cancelInteraction(formId);
    await call;
  });

  it("[U1212] names the renderer factoryman-merge-approval, in the form that bb accepts and that an extension kind allows", () => {
    expect(MERGE_RENDERER_ID).toBe("factoryman-merge-approval");
    // Lowercase letters, digits, and "-" only: bb's renderer id pattern allows more, and an extension kind allows exactly this.
    expect(MERGE_RENDERER_ID).toMatch(/^[a-z0-9-]+$/);
  });
});

const FINDING = (id: string) => ({ id, severity: "error", file: "sum.js", action: "ask-user", description: `Problem ${id}.` });
const GATE: DecisionRequestPayload = {
  taskId: "t1",
  key: "nm-r1-review-0a1b2c3d",
  kind: "gate",
  step: "review",
  status: "awaiting_approval",
  outcome: "",
  findings: [FINDING("review-1"), FINDING("review-2")],
  answer: { action: "fix", findingIds: ["review-2"], instructions: "Use a parameterized query." },
};
const FINISHED: DecisionRequestPayload = {
  taskId: "t1",
  key: "nm-r1-passed-with-override-0a1b2c3d",
  kind: "finished",
  step: "",
  status: "",
  outcome: "passed-with-override",
  findings: [],
  answer: { action: "rerun", findingIds: [], instructions: "" },
};
/** A copy that a case can change without touching the constants. */
const copy = (payload: DecisionRequestPayload): DecisionRequestPayload => structuredClone(payload);
/** The payload with some top-level fields replaced. The result is `unknown` because a case may break the type on purpose. */
const withFields = (base: DecisionRequestPayload, fields: Record<string, unknown>): unknown => ({ ...copy(base), ...fields });
const withAnswer = (base: DecisionRequestPayload, answer: Record<string, unknown>): unknown => ({ ...copy(base), answer: { ...base.answer, ...answer } });
const withFinding = (base: DecisionRequestPayload, finding: Record<string, unknown>): unknown => ({ ...copy(base), findings: [{ ...base.findings[0], ...finding }, ...base.findings.slice(1)] });
const without = (base: DecisionRequestPayload, field: string): unknown => {
  const { [field]: _removed, ...rest } = copy(base) as Record<string, unknown>;
  void _removed;
  return rest;
};

describe("DECISION_RENDERER_ID", () => {
  it("[U1813] is factoryman-decision-approval, in bb's renderer id form, and differs from the merge renderer id", () => {
    expect(DECISION_RENDERER_ID).toBe("factoryman-decision-approval");
    expect(DECISION_RENDERER_ID).toMatch(/^[a-z0-9-]+$/);
    expect(DECISION_RENDERER_ID).not.toBe(MERGE_RENDERER_ID);
  });
});

describe("readDecisionPayload", () => {
  it("[U1814] returns a gate payload and a finished-run payload unchanged", () => {
    expect(readDecisionPayload(copy(GATE))).toEqual(GATE);
    expect(readDecisionPayload(copy(FINISHED))).toEqual(FINISHED);
  });

  it.each([
    ["approve", { action: "approve", findingIds: [], instructions: "" }],
    ["skip", { action: "skip", findingIds: [], instructions: "" }],
    ["fix of every finding", { action: "fix", findingIds: ["review-1", "review-2"], instructions: "" }],
  ])("[U1814] accepts a gate payload with the answer %s", (_name, answer) => {
    expect(readDecisionPayload(withFields(GATE, { answer }))).toEqual({ ...GATE, answer });
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a string", "text"],
    ["an empty array", []],
    ["an array that holds a payload", [GATE]],
    ["an extra key", withFields(GATE, { extra: "x" })],
    ["a missing key", without(GATE, "key")],
    ["a number for taskId", withFields(GATE, { taskId: 1 })],
    ["a null step", withFields(GATE, { step: null })],
    ["a kind outside its set", withFields(GATE, { kind: "other" })],
    ["findings that is not an array", withFields(GATE, { findings: {} })],
    ["a finding with an extra key", withFinding(GATE, { extra: "x" })],
    ["a finding with a missing field", withFinding(GATE, { file: undefined })],
    ["a finding with a number for its ID", withFinding(GATE, { id: 1 })],
    ["an answer that is not an object", withFields(GATE, { answer: "fix" })],
    ["an answer with an extra key", withAnswer(GATE, { extra: 1 })],
    ["an action outside its set", withAnswer(GATE, { action: "yes" })],
    ["finding IDs that are not strings", withAnswer(GATE, { findingIds: [1] })],
    ["instructions that are not a string", withAnswer(GATE, { instructions: null })],
    ["a finding ID that no finding shows", withAnswer(GATE, { findingIds: ["review-9"] })],
    ["a fix with no finding IDs", withAnswer(GATE, { findingIds: [] })],
    ["a repeated finding ID", withAnswer(GATE, { findingIds: ["review-1", "review-1"] })],
    ["finding IDs on an approve", withAnswer(GATE, { action: "approve", findingIds: ["review-1"], instructions: "" })],
    ["instructions on a skip", withAnswer(GATE, { action: "skip", findingIds: [], instructions: "text" })],
    ["a rerun on a gate", withAnswer(GATE, { action: "rerun", findingIds: [], instructions: "" })],
    ["an approve on a finished run", withAnswer(FINISHED, { action: "approve" })],
    ["findings on a finished run", withFields(FINISHED, { findings: [FINDING("review-1")] })],
  ])("[U1815] returns null for %s", (_name, value) => {
    expect(readDecisionPayload(value)).toBeNull();
  });
});
