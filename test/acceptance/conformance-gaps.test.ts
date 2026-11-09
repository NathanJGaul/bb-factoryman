import { describe, expect, it } from "vitest";
import { loadGaps } from "../../tools/conformance/gaps.ts";
import { main } from "../../tools/conformance/run.ts";
import type { Gap } from "../../tools/conformance/verdict.ts";
import { fakeDeps } from "../fixtures/conformance-run";

const gap = (check: string, extra: Partial<Gap> = {}): Gap => ({ check, harness: "*", task: "H1", reason: "dispatch does not read providerStates yet", ...extra });

describe("known gaps through the runner", () => {
  it("[A1308] gives known-gap to a failing check that a gap names, prints the task and the failure, and exits 0", async () => {
    const { deps, rec } = fakeDeps({ faults: { noReadinessGate: true }, gaps: [gap("S1.unready-blocks"), gap("S1.remedy")] });
    expect(await main(["--tier", "1.5", "--harness", "pi"], deps)).toBe(0);
    expect(rec.out.find((line) => line.startsWith("S1 "))).toMatch(/known-gap/);
    expect(rec.out.join("\n")).toMatch(/known gap S1\.unready-blocks \(H1\): dispatch does not read providerStates yet\. Failed: /);
  });

  it("[A1309] exits 1 and says to remove the entry when a gap names a check that passes", async () => {
    const { deps, rec } = fakeDeps({ gaps: [gap("S1.unready-blocks")] });
    expect(await main(["--tier", "1.5", "--harness", "pi"], deps)).toBe(1);
    expect(rec.out.join("\n")).toMatch(/stale gap S1\.unready-blocks \(H1\).*remove the entry/);
  });

  it("[A1310] gives fail to a failing check that no gap names and exits 1", async () => {
    const { deps, rec } = fakeDeps({ faults: { noReadinessGate: true }, gaps: [gap("S1.remedy")] });
    expect(await main(["--tier", "1.5", "--harness", "pi"], deps)).toBe(1);
    expect(rec.out.find((line) => line.startsWith("S1 "))).toMatch(/fail/);
  });
});

describe("the committed known-gap file through the runner", () => {
  const committed = () => loadGaps(new URL("../../conformance/known-gaps.json", import.meta.url).pathname);

  it("[A1507] holds exactly the three S9 entries that wait for report task H4", async () => {
    const gaps = await committed();
    expect(gaps.map((gap) => `${gap.check} ${gap.harness} ${gap.task}`).sort()).toEqual(["S9.stamp-advice codex H4", "S9.stamp-advice omp H4", "S9.start-command * H4"]);
  });

  it("[A1508] lets every run exit 0 and print no stale gap when only the S9 checks fail, as in the real lab", async () => {
    const gaps = await committed();
    const runs: Array<[string[], Record<string, boolean>]> = [
      [["--tier", "1"], { noStartCommand: true }],
      [["--tier", "1.5", "--harness", "claude-code"], { noStartCommand: true }],
      [["--tier", "1.5", "--harness", "pi"], { noStartCommand: true }],
      [["--tier", "1.5", "--harness", "codex"], { noStartCommand: true, noClearAdvice: true }],
      [["--tier", "1.5", "--harness", "omp"], { noStartCommand: true, noClearAdvice: true }],
    ];
    for (const [argv, faults] of runs) {
      const { deps, rec } = fakeDeps({ faults, gaps });
      expect(await main(argv, deps), argv.join(" ")).toBe(0);
      expect(rec.out.join("\n"), argv.join(" ")).not.toMatch(/stale gap/);
      expect(rec.out.find((line) => line.startsWith("S9 ")), argv.join(" ")).toMatch(/known-gap/);
    }
  });
});
