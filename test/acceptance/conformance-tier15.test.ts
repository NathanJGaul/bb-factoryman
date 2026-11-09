import { describe, expect, it } from "vitest";
import { parseResult } from "../../tools/conformance/result.ts";
import { main } from "../../tools/conformance/run.ts";
import { fakeDeps } from "../fixtures/conformance-run";

const rows = (out: string[]) => out.filter((line) => /^S\d+ /.test(line));

describe("pnpm run conformance -- --tier 1.5 --harness <id>", () => {
  it("[A1312] opens the lab for that harness with its CLI bound read-only and the harness's profile", async () => {
    const { deps, rec } = fakeDeps();
    expect(await main(["--tier", "1.5", "--harness", "claude-code"], deps)).toBe(0);
    expect(rec.opened).toHaveLength(1);
    expect(rec.opened[0]).toMatchObject({ driver: "claude-code", binds: ["/m/installs/claude/9.9.9"] });
    // Every task the scenarios dispatched used the Claude Code profile: the scout profile, and the ship profile for ship tasks.
    const dispatched = (rec.labs[0]?.calls ?? []).filter((call) => call.startsWith("dispatch "));
    expect(dispatched.length).toBeGreaterThan(5);
    expect(dispatched).toContain("dispatch scout claude-code/claude-haiku-5-5/low/accept-edits");
    expect(dispatched).toContain("dispatch ship claude-code/claude-haiku-5-5/low/full");
  });

  it("[A1313] runs S1 to S9, S11, and S12, marks S10 skipped, and writes only into the results directory", async () => {
    const { deps, rec } = fakeDeps();
    await main(["--tier", "1.5", "--harness", "pi", "--results-dir", "out/results"], deps);
    expect(rows(rec.out).map((line) => line.split(/\s+/).slice(0, 2).join(" "))).toEqual([
      "S1 pass", "S2 pass", "S3 pass", "S4 pass", "S5 pass", "S6 pass", "S7 pass", "S8 pass", "S9 pass", "S10 skipped", "S11 pass", "S12 pass",
    ]);
    expect([...rec.files.keys()]).toEqual(["out/results/1.5-pi.json"]);
    expect(parseResult(rec.files.get("out/results/1.5-pi.json") as string).scenarios.find((s) => s.id === "S10")?.verdict).toBe("skipped");
  });

  it("[A1316] refuses an unknown harness id with the known ids and starts no lab", async () => {
    const { deps, rec } = fakeDeps();
    expect(await main(["--tier", "1.5", "--harness", "gemini"], deps)).toBe(2);
    expect(rec.out.join("\n")).toMatch(/claude-code, codex, pi, omp|claude-code.*codex.*pi.*omp/);
    expect(rec.opened).toEqual([]);
  });

  it("[A1317] reports a harness whose CLI is missing as unable to run, exits 1, and records no result", async () => {
    const { deps, rec } = fakeDeps({ missing: ["codex"] });
    expect(await main(["--tier", "1.5", "--harness", "codex"], deps)).toBe(1);
    expect(rec.out.join("\n")).toMatch(/Cannot run codex: codex is not installed/);
    expect(rec.opened).toEqual([]);
    expect(rec.files.size).toBe(0);
  });

  it("[A1324] runs offline by default, and a lab that cannot start offline fails the run with the reason and is not retried online", async () => {
    const offline = fakeDeps();
    await main(["--tier", "1.5", "--harness", "pi"], offline.deps);
    expect(offline.rec.opened[0]?.args.offline).toBe(true);
    const online = fakeDeps();
    await main(["--tier", "1.5", "--harness", "pi", "--no-offline"], online.deps);
    expect(online.rec.opened[0]?.args.offline).toBe(false);
    const broken = fakeDeps({ openError: new Error("bb did not start with no network: npm install failed (EAI_AGAIN)") });
    expect(await main(["--tier", "1.5", "--harness", "pi"], broken.deps)).toBe(1);
    expect(broken.rec.out.join("\n")).toMatch(/The lab did not start: bb did not start with no network/);
    expect(broken.rec.opened).toHaveLength(1);
    expect(broken.rec.files.size).toBe(0);
  });
});
