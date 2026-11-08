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

describe("readMergePayload", () => {
  it("[U1201] returns the payload for an object with exactly the four string fields", () => {
    expect(readMergePayload({ ...PAYLOAD })).toEqual(PAYLOAD);
  });

  it("[U1202] returns null for null, undefined, a string, a number, and an array", () => {
    for (const value of [null, undefined, "text", 3, [], [PAYLOAD]]) {
      expect(readMergePayload(value), JSON.stringify(value)).toBeNull();
    }
  });

  it("[U1203] returns null when any one of the four fields is missing", () => {
    for (const field of FIELDS) {
      const without: Record<string, string> = { ...PAYLOAD };
      delete without[field];
      expect(readMergePayload(without), `missing ${field}`).toBeNull();
    }
  });

  it("[U1204] returns null when a field is a number, null, or an object", () => {
    for (const field of FIELDS) {
      for (const wrong of [1, null, {}]) {
        expect(readMergePayload({ ...PAYLOAD, [field]: wrong }), `${field} = ${JSON.stringify(wrong)}`).toBeNull();
      }
    }
  });

  it("[U1205] returns null when the object carries a fifth field", () => {
    expect(readMergePayload({ ...PAYLOAD, extra: "x" })).toBeNull();
  });

  it("[U1206] accepts empty strings in every field, because a local-only task has no pull request", () => {
    const empty = { taskId: "", branch: "", prUrl: "", evidence: "" };
    expect(readMergePayload(empty)).toEqual(empty);
  });
});

describe("answerFor", () => {
  it("[U1207] carries only the decision when there is no comment", () => {
    for (const decision of ["approved", "denied"] as const) {
      expect(answerFor(decision)).toStrictEqual({ decision });
      expect(answerFor(decision, undefined)).toStrictEqual({ decision });
    }
  });

  it("[U1208] trims the comment and keeps the text between", () => {
    expect(answerFor("approved", "  Ship it.  ")).toStrictEqual({ decision: "approved", comment: "Ship it." });
    expect(answerFor("denied", "a  b\nc")).toStrictEqual({ decision: "denied", comment: "a  b\nc" });
  });

  it("[U1209] leaves out a comment that is empty, spaces, or a line break, and keeps a one-character comment", () => {
    for (const blank of ["", " ", "\n", "\t \n"]) {
      expect(answerFor("approved", blank), JSON.stringify(blank)).toStrictEqual({ decision: "approved" });
    }
    expect(answerFor("approved", "a")).toStrictEqual({ decision: "approved", comment: "a" });
  });

  it("[U1210] passes the strict schema that factoryman_merge reads, and a stray field would not", () => {
    for (const decision of ["approved", "denied"] as const) {
      for (const comment of [undefined, "", "  ", "Ship it.", " padded "]) {
        expect(approvalAnswerSchema.safeParse(answerFor(decision, comment)).success, `${decision} / ${JSON.stringify(comment)}`).toBe(true);
      }
    }
    expect(approvalAnswerSchema.safeParse({ ...answerFor("approved"), stray: 1 }).success).toBe(false);
  });
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
    expect(MERGE_RENDERER_ID).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(MERGE_RENDERER_ID).toMatch(/^[a-z0-9-]+$/);
  });
});
