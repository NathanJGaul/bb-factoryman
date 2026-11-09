import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderSupport } from "../../tools/conformance/docs.ts";
import { parseResult, serializeResult, type ResultFile } from "../../tools/conformance/result.ts";
import { gapped, passing, resultFile, SCENARIO_IDS } from "../fixtures/conformance-result";
import { tmpDir } from "../fixtures/git-repo";

const CLI = new URL("../../tools/conformance/docs-cli.ts", import.meta.url).pathname;
const ROOT = new URL("../../", import.meta.url).pathname;
const result = (harness: string, gap = false): ResultFile =>
  resultFile(harness, {
    cli: { name: harness, version: "2.0.0" },
    plugin: { commit: "feed123", dirty: false },
    isolation: { clean: true, report: "ok" },
    scenarios: SCENARIO_IDS.map((id) => (gap && id === "S1" ? gapped("S1", "S1.remedy", "H1", "providerStates is not read") : passing(id))),
  });

function generate(results: ResultFile[], extra: Record<string, string> = {}): string {
  const root = tmpDir("docs-root-");
  mkdirSync(join(root, "conformance/results"), { recursive: true });
  for (const r of results) writeFileSync(join(root, "conformance/results", `${r.tier}-${r.harness}.json`), serializeResult(r));
  for (const [name, text] of Object.entries(extra)) writeFileSync(join(root, "conformance/results", name), text);
  const run = spawnSync(process.execPath, [CLI, "--root", root], { encoding: "utf8" });
  expect(run.status, run.stderr).toBe(0);
  return readFileSync(join(root, "docs/HARNESS-SUPPORT.md"), "utf8");
}

describe("pnpm run conformance:docs", () => {
  it("[A1326] writes docs/HARNESS-SUPPORT.md from the result files and from nothing else", () => {
    const results = [result("pi"), result("codex")];
    const doc = generate(results, { "notes.txt": "ignored", "README.md": "ignored too" });
    expect(doc).toBe(renderSupport(results));
    expect(doc).not.toContain("ignored");
  });

  it("[A1327] lists each harness with its CLI version, bb version, plugin commit, date, and a verdict per scenario", () => {
    const doc = generate([result("pi"), result("omp"), result("codex"), result("claude-code")]);
    for (const name of ["Claude Code", "Codex", "Pi", "omp"]) expect(doc).toMatch(new RegExp(`^## ${name}$`, "m"));
    expect(doc.match(/\| CLI \| \w[\w-]* 2\.0\.0 \|/g)).toHaveLength(4);
    expect(doc.match(/\| Plugin commit \| feed123 \|/g)).toHaveLength(4);
    expect(doc.match(/\| Date \| 2026-11-08 \|/g)).toHaveLength(4);
    expect(doc.match(/^\| S12 \| pass \|/gm)).toHaveLength(4);
  });

  it("[A1311] shows a known gap as a gap with its task, and never as a pass", () => {
    const doc = generate([result("pi", true)]);
    const row = doc.split("\n").find((line) => line.startsWith("| S1 |")) as string;
    expect(row).toMatch(/known gap \(H1\)/);
    expect(row).not.toMatch(/\bpass\b/);
    expect(doc).toContain("providerStates is not read");
  });

  it("[A1328] lists a harness with no result file as unsupported, with the reason that no tier 1.5 result exists", () => {
    const doc = generate([result("pi")]);
    const section = doc.split(/^## /m).find((s) => s.startsWith("Codex")) as string;
    expect(section).toMatch(/Status: unsupported\. No tier 1\.5 result exists/);
  });

  it("[A1329] fails when the committed document differs from the document generated from the committed result files", () => {
    const dir = join(ROOT, "conformance/results");
    const results = readdirSync(dir).filter((n) => n.endsWith(".json")).sort().map((n) => parseResult(readFileSync(join(dir, n), "utf8")));
    expect(readFileSync(join(ROOT, "docs/HARNESS-SUPPORT.md"), "utf8")).toBe(renderSupport(results));
  });
});
