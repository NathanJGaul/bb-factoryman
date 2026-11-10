import { describe, expect, it } from "vitest";
import { loadGaps } from "../../tools/conformance/gaps.ts";
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

  it("[A1501] runs every scenario for Pi in a direct-PR project, and the same run in a local-only project is refused by the plugin's rule", async () => {
    const { deps, rec } = fakeDeps();
    expect(await main(["--tier", "1.5", "--harness", "pi"], deps)).toBe(0);
    expect(rec.labs[0]?.projectMode).toBe("direct-PR");
    expect(rows(rec.out).map((line) => line.split(/\s+/).slice(0, 2).join(" "))).toEqual([
      "S1 pass", "S2 pass", "S3 pass", "S4 pass", "S5 pass", "S6 pass", "S7 pass", "S8 pass", "S9 pass", "S10 skipped", "S11 pass", "S12 pass",
    ]);
    const refused = fakeDeps({ faults: { projectMode: "local-only" } });
    expect(await main(["--tier", "1.5", "--harness", "pi"], refused.deps)).toBe(1);
    const verdicts = Object.fromEntries(rows(refused.rec.out).map((line) => line.split(/\s+/).slice(0, 2) as [string, string]));
    expect([verdicts["S3"], verdicts["S4"], verdicts["S11"]]).toEqual(["fail", "fail", "fail"]);
    expect(refused.rec.out.join("\n")).toMatch(/S3 +fail/);
  });

  it("[A1502] keeps Claude Code, Codex, and omp in a local-only project, and each still passes every scenario", async () => {
    for (const harness of ["claude-code", "codex", "omp"]) {
      const { deps, rec } = fakeDeps();
      expect(await main(["--tier", "1.5", "--harness", harness], deps), harness).toBe(0);
      expect(rec.labs[0]?.projectMode, harness).toBe("local-only");
      expect(rows(rec.out).filter((line) => / fail /.test(line)), harness).toEqual([]);
    }
  });

  it("[A1503] writes a mode note on Pi's S4 result and no note on the S4 result of the other harnesses", async () => {
    const note = async (harness: string) => {
      const { deps, rec } = fakeDeps();
      await main(["--tier", "1.5", "--harness", harness, "--results-dir", "out"], deps);
      const result = parseResult(rec.files.get(`out/1.5-${harness}.json`) as string);
      return result.scenarios.find((s) => s.id === "S4")?.checks.find((c) => c.id === "S4.review-ready")?.note;
    };
    expect(await note("pi")).toMatch(/direct-PR mode, because the plugin does not admit it in local-only mode/);
    for (const harness of ["claude-code", "codex", "omp"]) expect(await note(harness), harness).toBeUndefined();
  });

  it("[A1505] runs every scenario for omp with a reasoning level that its model lists", async () => {
    const { deps, rec } = fakeDeps();
    expect(await main(["--tier", "1.5", "--harness", "omp"], deps)).toBe(0);
    const dispatched = (rec.labs[0]?.calls ?? []).filter((call) => call.startsWith("dispatch "));
    expect(dispatched).toContain("dispatch scout acp-omp/mock/mock-1/auto/full");
    expect(dispatched.filter((call) => /\/low\//.test(call))).toEqual([]);
    expect(rows(rec.out).map((line) => line.split(/\s+/).slice(0, 2).join(" "))).toEqual([
      "S1 pass", "S2 pass", "S3 pass", "S4 pass", "S5 pass", "S6 pass", "S7 pass", "S8 pass", "S9 pass", "S10 skipped", "S11 pass", "S12 pass",
    ]);
  });

  it("[A1506] blocks the omp unsupported profile with no task, and the block names the permission mode and not the reasoning level", async () => {
    const { deps, rec } = fakeDeps();
    await main(["--tier", "1.5", "--harness", "omp"], deps);
    const lab = rec.labs[0];
    if (lab === undefined) throw new Error("no lab");
    const before = (await lab.tasks()).length;
    const out = await lab.dispatch("scout", "unsupported probe", { profile: lab.driver.unsupportedProfile });
    expect(out.taskId).toBeNull();
    expect(out.result.isError).toBe(true);
    expect(out.result.text).toMatch(/permission mode `auto`/);
    expect(out.result.text).not.toMatch(/reasoning level/);
    expect((await lab.tasks()).length).toBe(before);
  });

  it("[A1614] runs S9 to pass with the check S9.start-tools for the stub and the four harnesses, with the committed empty gap list, and exits 0 with no stale gap", async () => {
    const gaps = await loadGaps(new URL("../../conformance/known-gaps.json", import.meta.url).pathname);
    expect(gaps).toEqual([]);
    const runs: string[][] = [["--tier", "1"], ["--tier", "1.5", "--harness", "claude-code"], ["--tier", "1.5", "--harness", "codex"], ["--tier", "1.5", "--harness", "pi"], ["--tier", "1.5", "--harness", "omp"]];
    for (const argv of runs) {
      const { deps, rec } = fakeDeps({ gaps });
      expect(await main([...argv, "--results-dir", "out/results"], deps), argv.join(" ")).toBe(0);
      expect(rec.out.join("\n"), argv.join(" ")).not.toMatch(/stale gap/);
      expect(rec.out.find((line) => line.startsWith("S9 ")), argv.join(" ")).toMatch(/^S9\s+pass/);
      const [file] = [...rec.files.keys()];
      const s9 = parseResult(rec.files.get(file as string) as string).scenarios.find((scenario) => scenario.id === "S9");
      expect(s9?.checks.map((check) => check.id), argv.join(" ")).toContain("S9.start-tools");
      expect(s9?.checks.every((check) => check.ok), argv.join(" ")).toBe(true);
    }
  });

  it("[A1817] runs S5, S8, and S9 with five supervisor tools and the S8 decide check for the stub and the four harnesses, with the committed empty gap list", async () => {
    const gaps = await loadGaps(new URL("../../conformance/known-gaps.json", import.meta.url).pathname);
    expect(gaps).toEqual([]);
    const runs: string[][] = [["--tier", "1"], ["--tier", "1.5", "--harness", "claude-code"], ["--tier", "1.5", "--harness", "codex"], ["--tier", "1.5", "--harness", "pi"], ["--tier", "1.5", "--harness", "omp"]];
    for (const argv of runs) {
      const { deps, rec } = fakeDeps({ gaps });
      expect(await main([...argv, "--results-dir", "out/results"], deps), argv.join(" ")).toBe(0);
      const [file] = [...rec.files.keys()];
      const result = parseResult(rec.files.get(file as string) as string);
      const check = (scenario: string, id: string) => result.scenarios.find((entry) => entry.id === scenario)?.checks.find((entry) => entry.id === id);
      const offered = ["S5.supervisor-tools", "S9.start-tools", "S9.tools-after-step"].map((id) => check(id.slice(0, 2), id));
      for (const entry of offered) {
        expect(entry?.ok, `${argv.join(" ")} ${entry?.id}`).toBe(true);
        expect(entry?.evidence, `${argv.join(" ")} ${entry?.id}`).toContain("factoryman_decide");
      }
      const decide = check("S8", "S8.decide-wrong-state");
      expect(decide?.ok, argv.join(" ")).toBe(true);
      expect(decide?.evidence, argv.join(" ")).toMatch(/0 resolve row\(s\); state working/);
    }
  });
});
