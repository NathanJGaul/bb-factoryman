import { describe, expect, it } from "vitest";
import { parseResult, resultFileName, serializeResult, type ResultFile } from "./result.ts";

const sample = (): ResultFile => ({
  version: 1,
  tier: "1.5",
  harness: "pi",
  cli: { name: "pi", version: "1.4.0" },
  bb: { version: "0.49.0" },
  plugin: { commit: "8148863", dirty: false },
  startedAt: "2026-11-08T21:00:00.000Z",
  finishedAt: "2026-11-08T21:09:00.000Z",
  offline: true,
  isolation: { clean: true, report: "no change to the real home" },
  scenarios: [
    { id: "S3", verdict: "pass", checks: [{ id: "S3.states", title: "queued, working, report_ready", ok: true, evidence: "events 1 to 4" }] },
    { id: "S1", verdict: "known-gap", checks: [{ id: "S1.remedy", title: "refusal names the login command", ok: false, evidence: "no login command", gap: { task: "H1", reason: "providerStates is not read yet" } }] },
    { id: "S10", verdict: "skipped", checks: [] },
  ],
});

describe("result file", () => {
  it("[U1317] keeps tier, harness, CLI version, bb version, plugin commit, start time, offline flag, isolation outcome, and every verdict with its checks", () => {
    const parsed = parseResult(serializeResult(sample()));
    expect(parsed.tier).toBe("1.5");
    expect(parsed.harness).toBe("pi");
    expect(parsed.cli).toEqual({ name: "pi", version: "1.4.0" });
    expect(parsed.bb.version).toBe("0.49.0");
    expect(parsed.plugin.commit).toBe("8148863");
    expect(parsed.startedAt).toBe("2026-11-08T21:00:00.000Z");
    expect(parsed.offline).toBe(true);
    expect(parsed.isolation.clean).toBe(true);
    expect(parsed.scenarios.map((s) => s.verdict)).toEqual(["pass", "known-gap", "skipped"]);
    expect(parsed.scenarios[1]?.checks[0]?.gap).toEqual({ task: "H1", reason: "providerStates is not read yet" });
  });

  it("[U1318] writes and reads a result back to an equal value, with a trailing newline", () => {
    const text = serializeResult(sample());
    expect(text.endsWith("\n")).toBe(true);
    expect(parseResult(text)).toEqual(sample());
  });

  it.each([
    ["the CLI version", "cli.version", (r: Record<string, unknown>) => delete (r["cli"] as Record<string, unknown>)["version"]],
    ["the bb version", "bb", (r: Record<string, unknown>) => delete r["bb"]],
    ["the plugin commit", "plugin.commit", (r: Record<string, unknown>) => ((r["plugin"] as Record<string, unknown>)["commit"] = 7)],
    ["the isolation outcome", "isolation", (r: Record<string, unknown>) => delete r["isolation"]],
    ["the verdict value", "scenarios.0.verdict", (r: Record<string, unknown>) => (((r["scenarios"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>)["verdict"] = "maybe")],
  ])("[U1319] rejects a result file with %s missing or wrongly typed, and names the field", (_name, path, damage) => {
    const raw = JSON.parse(serializeResult(sample())) as Record<string, unknown>;
    damage(raw);
    expect(() => parseResult(JSON.stringify(raw))).toThrow(`at \`${path}\``);
  });

  it("[U1320] names the file <tier>-<harness>.json, with stub as the harness at tier 1", () => {
    expect(resultFileName("1.5", "claude-code")).toBe("1.5-claude-code.json");
    expect(resultFileName("1", "stub")).toBe("1-stub.json");
  });
});
