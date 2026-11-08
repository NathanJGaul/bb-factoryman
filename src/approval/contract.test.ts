import { describe, expect, it } from "vitest";
import { DISPATCH, loadWorld, nextForm } from "../../test/fixtures/plugin-host";
import { approvalAnswerSchema } from "../tools/merge";
import { MERGE_RENDERER_ID, answerFor, readMergePayload, type MergeRequestPayload } from "./contract";

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
