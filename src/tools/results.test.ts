import { describe, expect, it } from "vitest";
import { refuse } from "../machine/refusal";
import type { TaskRow } from "../store/types";
import { clip, failure, refusalOutcome, stateText, success } from "./results";

const row: TaskRow = {
  taskId: "k1",
  projectId: "proj-1",
  kind: "ship",
  mode: "no-mistakes",
  state: "validating",
  workerThreadId: "thr-w1",
  branch: "fm/k1",
  machine: null,
  pullRequestUrl: null,
};

describe("tool results", () => {
  it("[U26] turns a refusal into error text with its reason code and message", () => {
    const outcome = refusalOutcome(refuse("evidence_required", "A `handoff` event needs non-empty evidence."));
    expect(outcome).toEqual({ ok: false, text: "Refused (evidence_required): A `handoff` event needs non-empty evidence." });
    expect(failure("Spawn failed.")).toEqual({ ok: false, text: "Spawn failed." });
  });

  it("[U27] turns a success into plain text that names the task and its state", () => {
    expect(stateText(row)).toBe("Task k1 is now validating.");
    expect(success(stateText(row))).toEqual({ ok: true, text: "Task k1 is now validating." });
  });

  it("[U28] cuts text longer than the limit and leaves text at or under the limit unchanged", () => {
    const limit = 10;
    expect(clip("a".repeat(9), limit)).toBe("a".repeat(9));
    expect(clip("a".repeat(10), limit)).toBe("a".repeat(10));
    const cut = clip("a".repeat(11), limit);
    expect(cut).toBe(`${"a".repeat(9)}…`);
    expect(cut).toHaveLength(limit);
  });
});
