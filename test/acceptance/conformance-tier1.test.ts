import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { labPaths } from "../../tools/conformance/lab-env.ts";
import { parseResult } from "../../tools/conformance/result.ts";
import { main } from "../../tools/conformance/run.ts";
import { fakeDeps } from "../fixtures/conformance-run";

const rows = (out: string[]) => out.filter((line) => /^S\d+ /.test(line));
const verdictOf = (out: string[], id: string) => rows(out).find((line) => line.startsWith(`${id} `))?.split(/\s+/)[1];

describe("pnpm run conformance -- --tier 1", () => {
  it("[A1301] starts the lab, runs S1 to S12 in order, stops the lab, and prints one verdict line per scenario", async () => {
    const { deps, rec } = fakeDeps();
    const code = await main(["--tier", "1"], deps);
    expect(code).toBe(0);
    expect(rec.events).toEqual(["open", "close"]);
    expect(rec.opened[0]).toMatchObject({ driver: "stub", binds: [] });
    expect(rows(rec.out).map((line) => line.split(/\s+/)[0])).toEqual(["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12"]);
    expect(rows(rec.out).every((line) => line.split(/\s+/)[1] === "pass")).toBe(true);
  });

  it("[A1302] prints only the four verdict words, and exits 0 only when no scenario failed", async () => {
    const clean = fakeDeps();
    expect(await main(["--tier", "1"], clean.deps)).toBe(0);
    const broken = fakeDeps({ faults: { noWake: true } });
    expect(await main(["--tier", "1"], broken.deps)).toBe(1);
    for (const line of rows(broken.rec.out)) expect(["pass", "fail", "known-gap", "skipped"]).toContain(line.split(/\s+/)[1]);
    expect(verdictOf(broken.rec.out, "S3")).toBe("fail");
    expect(broken.rec.out.join("\n")).toMatch(/FAIL S3\.wake/);
  });

  it("[A1303] reads no model text: the lab port has no method that returns it, and no scenario asks for one", () => {
    const port = readFileSync(new URL("../../tools/conformance/port.ts", import.meta.url), "utf8");
    expect(port).not.toMatch(/transcript|modelText|threadOutput|output\(|lastMessage/i);
    const dir = new URL("../../tools/conformance/scenarios/", import.meta.url);
    for (const name of readdirSync(dir).filter((n) => /^s\d+-.*\.ts$/.test(n) && !n.endsWith(".test.ts"))) {
      expect(readFileSync(new URL(name, dir), "utf8"), name).not.toMatch(/transcript|modelText|threadOutput|\.output\(|lastMessage/i);
    }
  });

  it("[A1304] writes conformance/results/1-stub.json with the tier, harness, versions, commit, start time, and every verdict with its checks", async () => {
    const { deps, rec } = fakeDeps();
    await main(["--tier", "1"], deps);
    expect([...rec.files.keys()]).toEqual(["conformance/results/1-stub.json"]);
    const result = parseResult(rec.files.get("conformance/results/1-stub.json") as string);
    expect(result).toMatchObject({ tier: "1", harness: "stub", cli: { name: "stub-agent", version: "9.9.9" }, bb: { version: "0.49.0" }, plugin: { commit: "abc1234", dirty: false }, startedAt: "2026-11-08T22:00:00.000Z" });
    expect(result.scenarios).toHaveLength(12);
    expect(result.scenarios.every((s) => s.checks.length > 0)).toBe(true);
    expect(result.scenarios[0]?.checks[0]).toMatchObject({ id: "S1.ready", ok: true });
  });

  it("[A1305] stops the lab and runs the isolation check when a scenario throws, and fails the run when the snapshot changed", async () => {
    const boom = fakeDeps({ wrap: (lab) => Object.assign(lab, { callTool: async () => Promise.reject(new Error("the supervisor thread died")) }) });
    expect(await main(["--tier", "1"], boom.deps)).toBe(1);
    expect(boom.rec.closed).toBe(1);
    expect(boom.rec.out.join("\n")).toContain("the supervisor thread died");
    const leak = fakeDeps({ isolation: { clean: false, report: "LEAK: lab process visible on host" } });
    expect(await main(["--tier", "1"], leak.deps)).toBe(1);
    expect(leak.rec.out.join("\n")).toMatch(/isolation: CHANGED.*LEAK/);
  });

  it("[A1306] names the lab tools by repository path, so a decoy bblab on the PATH is never run", () => {
    const decoy = mkdtempSync(join(tmpdir(), "decoy-"));
    writeFileSync(join(decoy, "bblab"), "#!/bin/sh\necho decoy\n", { mode: 0o755 });
    const paths = labPaths("/work/repo");
    expect(paths.bblab).toBe("/work/repo/tools/bblab/bblab");
    expect(paths.stubAgent).toBe("/work/repo/tools/stub-agent/stub-agent.ts");
    expect(paths.bblab.startsWith(decoy)).toBe(false);
    expect(paths.bblab.startsWith("/")).toBe(true);
  });
});
