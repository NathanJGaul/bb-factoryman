import { describe, expect, it } from "vitest";
import { fakeDeps } from "../../test/fixtures/conformance-run.ts";
import { parseResult } from "./result.ts";
import { main } from "./run.ts";

const rows = (out: string[]) => out.filter((line) => /^S\d+ /.test(line));

describe("main", () => {
  it("[U1406] runs the scenarios in order, rolls the checks up with the gaps, and returns the verdict table and the exit code", async () => {
    const { deps, rec } = fakeDeps({ faults: { noCause: true }, gaps: [{ check: "S7.cause", harness: "*", task: "H3", reason: "the cause is not read yet" }] });
    const code = await main(["--tier", "1.5", "--harness", "pi"], deps);
    expect(code).toBe(0);
    expect(rows(rec.out).map((line) => line.split(/\s+/)[0])).toEqual(["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12"]);
    expect(rows(rec.out).find((line) => line.startsWith("S7 "))).toMatch(/known-gap/);
    expect(rows(rec.out).find((line) => line.startsWith("S10 "))).toMatch(/skipped/);
    expect(rec.out.join("\n")).toMatch(/H3.*the cause is not read yet/);
  });

  it("[U1407] stops the lab and runs the isolation check when a scenario throws, and a changed snapshot fails the run", async () => {
    const thrown = fakeDeps({ wrap: (lab) => Object.assign(lab, { providerStates: async () => Promise.reject(new Error("lab unreachable")) }) });
    expect(await main(["--tier", "1.5", "--harness", "pi"], thrown.deps)).toBe(1);
    expect(thrown.rec.closed).toBe(1);
    expect(thrown.rec.out.join("\n")).toContain("lab unreachable");
    const dirty = fakeDeps({ isolation: { clean: false, report: "LEAK: a file changed in the real home" } });
    expect(await main(["--tier", "1.5", "--harness", "pi"], dirty.deps)).toBe(1);
    expect(dirty.rec.out.join("\n")).toContain("LEAK: a file changed in the real home");
  });

  it("[U1408] records the CLI and bb versions that the lab reports in the result", async () => {
    const { deps, rec } = fakeDeps();
    await main(["--tier", "1.5", "--harness", "codex"], deps);
    const [text] = [...rec.files.values()];
    const result = parseResult(text as string);
    expect(result).toMatchObject({ tier: "1.5", harness: "codex", cli: { name: "codex", version: "9.9.9" }, bb: { version: "0.49.0" }, plugin: { commit: "abc1234" }, offline: true });
  });

  it("[U1409] reports a missing CLI as cannot run before any scenario and writes no result", async () => {
    const { deps, rec } = fakeDeps({ missing: ["omp"] });
    expect(await main(["--tier", "1.5", "--harness", "omp"], deps)).toBe(1);
    expect(rec.out.join("\n")).toMatch(/omp is not installed/);
    expect(rec.opened).toEqual([]);
    expect(rec.files.size).toBe(0);
  });
});
