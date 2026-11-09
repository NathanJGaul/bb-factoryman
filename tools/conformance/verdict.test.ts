import { describe, expect, it } from "vitest";
import type { Check, ScenarioOutcome } from "./port.ts";
import { judge, type Gap } from "./verdict.ts";

const check = (id: string, ok: boolean): Check => ({ id, title: `title of ${id}`, ok, evidence: `evidence of ${id}` });
const outcome = (id: string, ...checks: Check[]): ScenarioOutcome => ({ id, checks });
const gap = (id: string, overrides: Partial<Gap> = {}): Gap => ({ check: id, harness: "*", task: "H1", reason: "the readiness gate does not exist yet", ...overrides });

describe("judge", () => {
  it("[U1301] gives pass to a scenario whose checks all pass", () => {
    const run = judge([outcome("S3", check("S3.a", true), check("S3.b", true))], [], "pi");
    expect(run.scenarios.map((s) => [s.id, s.verdict])).toEqual([["S3", "pass"]]);
  });

  it("[U1302] gives fail to a scenario with a failing check that no gap names", () => {
    const run = judge([outcome("S3", check("S3.a", true), check("S3.b", false))], [gap("S1.x")], "pi");
    expect(run.scenarios[0]?.verdict).toBe("fail");
    expect(run.exitCode).toBe(1);
  });

  it("[U1303] gives known-gap when every failing check is named by a gap, and carries the task and reason", () => {
    const run = judge([outcome("S1", check("S1.ready", true), check("S1.remedy", false))], [gap("S1.remedy", { task: "H1", reason: "no remedy text yet" })], "pi");
    const verdict = run.scenarios[0];
    expect(verdict?.verdict).toBe("known-gap");
    expect(verdict?.checks.find((c) => c.id === "S1.remedy")?.gap).toEqual({ task: "H1", reason: "no remedy text yet" });
    expect(verdict?.checks.find((c) => c.id === "S1.ready")?.gap).toBeUndefined();
    expect(run.exitCode).toBe(0);
  });

  it("[U1304] gives fail when one failing check is a gap and another is not", () => {
    const run = judge([outcome("S1", check("S1.remedy", false), check("S1.ready", false))], [gap("S1.remedy")], "pi");
    expect(run.scenarios[0]?.verdict).toBe("fail");
    expect(run.exitCode).toBe(1);
  });

  it("[U1305] reports a gap whose check passes as stale, fails the run, and says to remove the entry", () => {
    const run = judge([outcome("S1", check("S1.remedy", true))], [gap("S1.remedy")], "pi");
    expect(run.staleGaps).toEqual([gap("S1.remedy")]);
    expect(run.exitCode).toBe(1);
    expect(run.scenarios[0]?.verdict).toBe("pass");
    expect(run.scenarios[0]?.message).toMatch(/remove/i);
  });

  it("[U1306] does not apply a gap that names one harness to another harness", () => {
    const gaps = [gap("S1.remedy", { harness: "codex" })];
    const forPi = judge([outcome("S1", check("S1.remedy", false))], gaps, "pi");
    expect(forPi.scenarios[0]?.verdict).toBe("fail");
    const forCodex = judge([outcome("S1", check("S1.remedy", false))], gaps, "codex");
    expect(forCodex.scenarios[0]?.verdict).toBe("known-gap");
  });

  it("[U1307] applies a gap with harness * to every harness", () => {
    for (const harness of ["pi", "codex", "claude-code", "omp", "stub"]) {
      const run = judge([outcome("S1", check("S1.remedy", false))], [gap("S1.remedy")], harness);
      expect(run.scenarios[0]?.verdict, harness).toBe("known-gap");
    }
  });

  it("[U1308] gives skipped to a skipped scenario, and a gap on one of its checks is not stale", () => {
    const run = judge([{ id: "S10", skipped: true, checks: [] }], [gap("S10.reload")], "pi");
    expect(run.scenarios[0]?.verdict).toBe("skipped");
    expect(run.staleGaps).toEqual([]);
    expect(run.exitCode).toBe(0);
  });

  it("[U1309] exits 0 only when no scenario fails and no gap is stale", () => {
    expect(judge([outcome("S3", check("S3.a", true))], [], "pi").exitCode).toBe(0);
    expect(judge([outcome("S3", check("S3.a", false))], [], "pi").exitCode).toBe(1);
    expect(judge([outcome("S3", check("S3.a", true))], [gap("S3.a")], "pi").exitCode).toBe(1);
    expect(judge([outcome("S3", check("S3.a", false))], [gap("S3.a")], "pi").exitCode).toBe(0);
  });

  it("[U1310] gives fail to a scenario that returns no checks", () => {
    const run = judge([outcome("S3")], [], "pi");
    expect(run.scenarios[0]?.verdict).toBe("fail");
    expect(run.scenarios[0]?.message).toMatch(/no checks/i);
  });

  it("[U1311] gives fail to a scenario that threw, with the error text", () => {
    const run = judge([{ id: "S3", checks: [], error: "lab unreachable" }], [], "pi");
    expect(run.scenarios[0]?.verdict).toBe("fail");
    expect(run.scenarios[0]?.message).toContain("lab unreachable");
  });
});
