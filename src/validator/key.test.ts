import { describe, expect, it } from "vitest";
import { decisionKey, viewSignature } from "./key";
import type { Finding, Outcome, RunView } from "./types";

const finding = (id: string): Finding => ({ id, severity: "error", file: "sum.js", action: "ask-user", description: `Problem ${id}.` });
const view = (overrides: Partial<RunView> = {}): RunView => ({ runId: "r1", branch: "fm/t1", phase: "running", gate: null, outcome: null, prUrl: null, error: null, ...overrides });
const gate = (status: string, ...ids: string[]): RunView => view({ phase: "gate", gate: { step: "review", status, findings: ids.map(finding) } });
const finished = (outcome: Outcome, overrides: Partial<RunView> = {}): RunView => view({ phase: "finished", outcome, ...overrides });

const HEX = "[0-9a-f]{8}";

describe("decisionKey", () => {
  it("[U1801] names the run and the step of a gate, then eight hex characters", () => {
    expect(decisionKey(gate("awaiting_approval", "review-1"))).toMatch(new RegExp(`^nm-r1-review-${HEX}$`));
  });

  it("[U1802] names the outcome of a finished run, uses unknown for a missing run ID, and running for a running view", () => {
    expect(decisionKey(finished("passed-with-override"))).toMatch(new RegExp(`^nm-r1-passed-with-override-${HEX}$`));
    expect(decisionKey(finished("passed", { runId: null }))).toMatch(new RegExp(`^nm-unknown-passed-${HEX}$`));
    expect(decisionKey(view())).toMatch(new RegExp(`^nm-r1-running-${HEX}$`));
  });

  it("[U1803] is equal for equal views and changes when any one field of the view changes", () => {
    const base = gate("awaiting_approval", "review-1", "review-2");
    expect(decisionKey(gate("awaiting_approval", "review-1", "review-2"))).toBe(decisionKey(base));
    const changed: Array<[string, RunView]> = [
      ["status", gate("fix_review", "review-1", "review-2")],
      ["a dropped finding", gate("awaiting_approval", "review-2")],
      ["a new finding ID", gate("awaiting_approval", "review-1", "review-3")],
      ["finding order", gate("awaiting_approval", "review-2", "review-1")],
      ["run ID", { ...base, runId: "r2" }],
      ["phase and outcome", finished("passed")],
    ];
    for (const [what, other] of changed) expect(decisionKey(other), what).not.toBe(decisionKey(base));
    expect(decisionKey(finished("passed"))).not.toBe(decisionKey(finished("passed-with-skips")));
  });

  it("[U1803] ignores fields that the driver ignores: the branch, the pull request, and the error text", () => {
    const base = finished("passed", { prUrl: null });
    const noisy = finished("passed", { branch: "other", prUrl: "https://github.com/acme/widgets/pull/9", error: "text" });
    expect(viewSignature(noisy)).toBe(viewSignature(base));
    expect(decisionKey(noisy)).toBe(decisionKey(base));
  });
});
