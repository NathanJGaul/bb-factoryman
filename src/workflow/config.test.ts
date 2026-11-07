import { describe, expect, it } from "vitest";
import { GATE_KEYS, emptyWorkflowConfig, parseWorkflowConfig } from "./config";

const valid = (extra: Record<string, unknown> = {}) => ({ version: 1, ...extra });
const CHECK = { name: "lint", argv: ["pnpm", "run", "lint"] };

function failure(raw: unknown): string {
  const result = parseWorkflowConfig(raw);
  if (result.ok) throw new Error("expected the file to be rejected");
  return result.message;
}

describe("parseWorkflowConfig", () => {
  it("[U901] parses a minimal file and fills an empty project and no checks", () => {
    expect(parseWorkflowConfig(valid())).toEqual({ ok: true, config: { version: 1, project: {}, checks: {} } });
    expect(emptyWorkflowConfig()).toEqual({ version: 1, project: {}, checks: {} });
    const full = parseWorkflowConfig(valid({ project: { deliveryMode: "direct-PR", branchPrefix: "wip/", defaultMachine: "gpu-box" }, checks: { "direct-PR": [{ ...CHECK, timeoutSeconds: 60 }] } }));
    expect(full).toMatchObject({ ok: true, config: { project: { deliveryMode: "direct-PR", branchPrefix: "wip/", defaultMachine: "gpu-box" }, checks: { "direct-PR": [{ name: "lint", argv: ["pnpm", "run", "lint"], timeoutSeconds: 60 }] } } });
  });

  it.each(GATE_KEYS)("[U902] rejects the gate-like key `%s` and names hard rule 7", (key) => {
    expect(failure(valid({ [key]: true }))).toMatch(/never remove a gate/);
    expect(failure(valid({ project: { [key]: true } }))).toMatch(/never remove a gate/);
    expect(failure(valid({ checks: { "direct-PR": [{ ...CHECK, [key]: true }] } }))).toMatch(/never remove a gate/);
  });

  it("[U902] has a list of gate-like keys that includes yolo, gates, skip, and approval", () => {
    expect(GATE_KEYS).toEqual(expect.arrayContaining(["yolo", "gates", "skip", "approval", "requireApproval", "disable", "teardown", "evidence", "merge"]));
  });

  it("[U903] rejects project.baseBranch with a message about the landed-work check", () => {
    expect(failure(valid({ project: { baseBranch: "main" } }))).toMatch(/landed-work check/);
    expect(failure(valid({ baseBranch: "main" }))).toMatch(/landed-work check/);
  });

  it.each([
    ["the top level", valid({ surprise: 1 })],
    ["project", valid({ project: { color: "red" } })],
    ["a check", valid({ checks: { "direct-PR": [{ ...CHECK, shell: true }] } })],
  ])("[U904] rejects an unknown key in %s", (_where, raw) => {
    expect(failure(raw)).toMatch(/Unrecognized key|unknown/i);
  });

  it("[U905] needs a name and a non-empty argv, unique names per mode, at most 20 checks, and a timeout of 1 to 3600 seconds", () => {
    expect(failure(valid({ checks: { "direct-PR": [{ name: "", argv: ["x"] }] } }))).toMatch(/name/);
    expect(failure(valid({ checks: { "direct-PR": [{ name: "a", argv: [] }] } }))).toMatch(/argv/);
    expect(failure(valid({ checks: { "direct-PR": [{ name: "a", argv: [" "] }] } }))).toMatch(/argv/);
    expect(failure(valid({ checks: { "direct-PR": [CHECK, CHECK] } }))).toMatch(/duplicate/i);
    const many = Array.from({ length: 21 }, (_, i) => ({ name: `c${i}`, argv: ["true"] }));
    expect(failure(valid({ checks: { "direct-PR": many } }))).toMatch(/at most 20/);
    expect(parseWorkflowConfig(valid({ checks: { "direct-PR": many.slice(0, 20) } })).ok).toBe(true);
    for (const timeoutSeconds of [0, 3601, 1.5, -1]) {
      expect(failure(valid({ checks: { "direct-PR": [{ ...CHECK, timeoutSeconds }] } })), String(timeoutSeconds)).toMatch(/timeoutSeconds/);
    }
    expect(parseWorkflowConfig(valid({ checks: { "direct-PR": [{ ...CHECK, timeoutSeconds: 1 }, { name: "b", argv: ["x"], timeoutSeconds: 3600 }] } })).ok).toBe(true);
    expect(parseWorkflowConfig(valid({ checks: { "direct-PR": [CHECK], "local-only": [CHECK] } })).ok).toBe(true);
  });

  it("[U906] accepts the three delivery modes and nothing else, and only modes as check keys", () => {
    for (const mode of ["no-mistakes", "direct-PR", "local-only"]) expect(parseWorkflowConfig(valid({ project: { deliveryMode: mode } })).ok, mode).toBe(true);
    expect(failure(valid({ project: { deliveryMode: "yolo" } }))).toMatch(/deliveryMode/);
    expect(failure(valid({ checks: { everything: [CHECK] } }))).toMatch(/Unrecognized key|everything/);
  });

  it("rejects a version other than 1 and input that is not an object", () => {
    expect(failure(valid({ version: 2 }))).toMatch(/version/);
    expect(failure("text")).toMatch(/object/);
    expect(failure(null)).toMatch(/object/);
  });
});
