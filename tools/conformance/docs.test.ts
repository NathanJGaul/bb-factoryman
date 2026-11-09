import { describe, expect, it } from "vitest";
import { renderSupport } from "./docs.ts";
import type { ResultFile } from "./result.ts";
import type { ScenarioVerdict } from "./verdict.ts";

const ids = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12"];
const passing = (id: string): ScenarioVerdict => ({ id, verdict: id === "S10" ? "skipped" : "pass", checks: id === "S10" ? [] : [{ id: `${id}.a`, title: "a check", ok: true, evidence: "seen" }] });

const result = (harness: string, overrides: Partial<ResultFile> = {}): ResultFile => ({
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
  scenarios: ids.map(passing),
  ...overrides,
});

const gapped = (): ScenarioVerdict => ({
  id: "S7",
  verdict: "known-gap",
  checks: [
    { id: "S7.failed", title: "t", ok: true, evidence: "e" },
    { id: "S7.cause", title: "The failure evidence holds the cause", ok: false, evidence: "evidence: provider error", gap: { task: "H3", reason: "the plugin reads only the thread error, not the provider detail" } },
  ],
});

describe("renderSupport", () => {
  it("[U1376] writes one section per harness with the CLI version, bb version, plugin commit, date, and a verdict for each scenario", () => {
    const doc = renderSupport([result("pi"), result("codex", { cli: { name: "codex", version: "0.166.0" } })]);
    expect(doc).toMatch(/^# Harness support/m);
    expect(doc).toMatch(/^## Codex$/m);
    expect(doc).toMatch(/^## Pi$/m);
    expect(doc).toContain("0.166.0");
    expect(doc).toContain("0.49.0");
    expect(doc).toContain("abc1234");
    expect(doc).toContain("2026-11-08");
    for (const id of ids) expect(doc, id).toMatch(new RegExp(`\\| ${id} \\|`));
    expect(doc).toMatch(/\| S10 \| .*skipped/);
  });

  it("[U1377] shows a known gap with its task and reason, and never as a pass", () => {
    const doc = renderSupport([result("pi", { scenarios: ids.map((id) => (id === "S7" ? gapped() : passing(id))) })]);
    const row = doc.split("\n").find((line) => line.startsWith("| S7 |")) ?? "";
    expect(row).toMatch(/known gap/i);
    expect(row).not.toMatch(/\bpass\b/);
    expect(doc).toContain("H3");
    expect(doc).toContain("the plugin reads only the thread error, not the provider detail");
  });

  it("[U1425] shows a note on a check in the detail column of a passing scenario", () => {
    const noted: ScenarioVerdict = { id: "S7", verdict: "pass", checks: [{ id: "S7.ends-quiet", title: "t", ok: true, evidence: "e", note: "This harness ends the turn normally and shows the model error as text." }] };
    const doc = renderSupport([result("omp", { scenarios: ids.map((id) => (id === "S7" ? noted : passing(id))) })]);
    const row = doc.split("\n").find((line) => line.startsWith("| S7 |")) ?? "";
    expect(row).toMatch(/\| pass \|/);
    expect(row).toContain("ends the turn normally");
  });

  it("[U1378] lists a harness with no result file as unsupported, with the reason", () => {
    const doc = renderSupport([result("pi")]);
    const section = doc.split(/^## /m).find((s) => s.startsWith("Claude Code")) ?? "";
    expect(section).toMatch(/unsupported/i);
    expect(section).toMatch(/no tier 1\.5 result exists/i);
    for (const name of ["Codex", "omp"]) expect(doc).toMatch(new RegExp(`^## ${name}$`, "m"));
  });

  it("[U1379] is stable: the same text for any input order, and no clock, no machine path", () => {
    const a = renderSupport([result("pi"), result("codex"), result("omp")]);
    const b = renderSupport([result("omp"), result("pi"), result("codex")]);
    expect(a).toBe(b);
    expect(a).not.toMatch(/\/var\/tmp|\/home\/|generated on|Date\.now/i);
    expect(a.endsWith("\n")).toBe(true);
  });

  it("[U1380] marks a harness supported only with a tier 1.5 result in which no scenario failed and the isolation was clean", () => {
    const supported = (doc: string, name: string) => doc.split(/^## /m).find((s) => s.startsWith(name)) ?? "";
    const ok = renderSupport([result("pi")]);
    expect(supported(ok, "Pi")).toMatch(/Status: supported at tier 1\.5/);
    const failing = renderSupport([result("pi", { scenarios: ids.map((id) => (id === "S3" ? { id, verdict: "fail" as const, checks: [{ id: "S3.a", title: "t", ok: false, evidence: "e" }] } : passing(id))) })]);
    expect(supported(failing, "Pi")).toMatch(/Status: not supported/);
    expect(supported(failing, "Pi")).toMatch(/S3/);
    const leaky = renderSupport([result("pi", { isolation: { clean: false, report: "LEAK" } })]);
    expect(supported(leaky, "Pi")).toMatch(/Status: not supported/);
    const tier1 = renderSupport([result("pi", { tier: "1", harness: "stub" })]);
    expect(supported(tier1, "Pi")).toMatch(/unsupported/i);
    expect(tier1).toMatch(/Tier 1/);
  });
});
