import type { ResultFile } from "../../tools/conformance/result.ts";
import type { ScenarioVerdict } from "../../tools/conformance/verdict.ts";

export const SCENARIO_IDS = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12"];

/** A scenario that passed, or was skipped (S10 at tier 1.5). */
export const passing = (id: string): ScenarioVerdict => ({
  id,
  verdict: id === "S10" ? "skipped" : "pass",
  checks: id === "S10" ? [] : [{ id: `${id}.a`, title: "a check", ok: true, evidence: "seen" }],
});

/** A known gap on one check of a scenario. */
export const gapped = (id: string, check: string, task: string, reason: string): ScenarioVerdict => ({
  id,
  verdict: "known-gap",
  checks: [
    { id: `${id}.ok`, title: "t", ok: true, evidence: "e" },
    { id: check, title: "A check that waits for a plugin change", ok: false, evidence: "evidence: before the change", gap: { task, reason } },
  ],
});

/** A tier 1.5 result for a harness in which every scenario passed. Override any field. */
export function resultFile(harness: string, overrides: Partial<ResultFile> = {}): ResultFile {
  return {
    version: 1,
    tier: "1.5",
    harness,
    cli: { name: harness, version: "1.4.0" },
    bb: { version: "0.49.0" },
    plugin: { commit: "abc1234", dirty: false },
    startedAt: "2026-11-08T21:05:00.000Z",
    finishedAt: "2026-11-08T21:14:00.000Z",
    offline: true,
    isolation: { clean: true, report: "no change" },
    scenarios: SCENARIO_IDS.map(passing),
    ...overrides,
  };
}
