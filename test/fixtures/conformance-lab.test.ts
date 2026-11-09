import { describe, expect, it } from "vitest";
import { HARNESS_IDS, resolveDriver } from "../../tools/conformance/drivers/index.ts";
import { deliveryModeOf } from "../../tools/conformance/drivers/types.ts";
import { contractFor } from "../../src/harness/contracts";
import { FakeLab } from "./conformance-lab.ts";

const PR = "https://github.com/conformance/lab/pull/1";
const stateOf = async (lab: FakeLab, taskId: string | null) => (await lab.tasks()).find((t) => t.taskId === taskId);

describe("the fake lab's project mode", () => {
  it("[U1514] takes the task mode from the driver, and uses local-only when the driver names none", async () => {
    const pi = new FakeLab("pi");
    const piTask = await stateOf(pi, (await pi.dispatch("scout", "mode probe")).taskId);
    expect(piTask?.mode).toBe("direct-PR");
    expect(pi.projectMode).toBe("direct-PR");
    const codex = new FakeLab("codex");
    const codexTask = await stateOf(codex, (await codex.dispatch("scout", "mode probe")).taskId);
    expect(codexTask?.mode).toBe("local-only");
    expect(codex.projectMode).toBe("local-only");
  });

  it("[U1515] blocks a provider that its contract refuses in the project's mode, with provider_not_admitted and no task", async () => {
    const lab = new FakeLab("pi", { projectMode: "local-only" });
    const out = await lab.dispatch("scout", "admission probe");
    expect(out.taskId).toBeNull();
    expect(out.result.isError).toBe(true);
    expect(out.result.text).toMatch(/provider_not_admitted/);
    expect(await lab.tasks()).toEqual([]);
    // A provider that the contract admits in that mode still dispatches.
    const codex = new FakeLab("codex", { projectMode: "local-only" });
    expect((await codex.dispatch("scout", "admission probe")).taskId).not.toBeNull();
  });

  it("[U1529] gives every harness driver a mode that its provider's contract admits", () => {
    for (const id of HARNESS_IDS) {
      const driver = resolveDriver(id);
      if (!driver.ok) throw new Error(driver.message);
      expect(contractFor(driver.driver.provider).refusedModes, id).not.toContain(deliveryModeOf(driver.driver));
    }
  });
});

describe("the fake lab's ship task in direct-PR mode", () => {
  it("[U1516] reaches review_ready with a pull request URL and stays working without one", async () => {
    const withPr = new FakeLab("pi");
    const ready = await stateOf(withPr, (await withPr.dispatch("ship", "ship probe", { flag: `pr=${PR}` })).taskId);
    expect(ready?.state).toBe("review_ready");
    expect(ready?.pullRequestUrl).toBe(PR);
    const without = new FakeLab("pi");
    const stuck = await stateOf(without, (await without.dispatch("ship", "ship probe")).taskId);
    expect(stuck?.state).toBe("working");
    expect(stuck?.pullRequestUrl).toBeNull();
    const refused = (await without.events(stuck?.taskId)).filter((e) => e.outcome === "refused" && e.reasonCode === "mode_check_failed");
    expect(refused).toHaveLength(1);
  });
});

describe("the fake lab's reasoning levels", () => {
  it("[U1518] blocks a profile whose reasoning level the model does not list, and names the levels it lists", async () => {
    const lab = new FakeLab("omp");
    const low = await lab.dispatch("scout", "level probe", { profile: { ...lab.driver.profile, reasoningLevel: "low" } });
    expect(low.taskId).toBeNull();
    expect(low.result.text).toMatch(/provider_unavailable/);
    expect(low.result.text).toMatch(/does not list the reasoning level `low`/);
    expect(low.result.text).toMatch(/It lists: off, auto/);
    for (const level of ["off", "auto"]) {
      const ok = await lab.dispatch("scout", "level probe", { profile: { ...lab.driver.profile, reasoningLevel: level } });
      expect(ok.taskId, level).not.toBeNull();
    }
  });
});

describe("the fake lab's ship task in local-only mode", () => {
  it("[U1530] stays working with a refused report when the worker reports a pull request and no landed commits", async () => {
    const lab = new FakeLab("codex");
    const task = await stateOf(lab, (await lab.dispatch("ship", "ship probe", { flag: `pr=${PR}` })).taskId);
    expect(task?.mode).toBe("local-only");
    expect(task?.state).toBe("working");
    expect(task?.pullRequestUrl).toBeNull();
    const refused = (await lab.events(task?.taskId)).filter((e) => e.outcome === "refused" && e.reasonCode === "mode_check_failed");
    expect(refused).toHaveLength(1);
  });
});

describe("the fake lab's block of an unsupported profile", () => {
  it("[U1533] names what differs from the driver's profile: the reasoning level for Claude Code, the permission mode for omp", async () => {
    const claude = new FakeLab("claude-code");
    const level = await claude.dispatch("scout", "unsupported probe", { profile: claude.driver.unsupportedProfile });
    expect(level.taskId).toBeNull();
    expect(level.result.text).toMatch(/reasoning level `no-such-level`/);
    expect(level.result.text).not.toMatch(/permission mode/);
    const omp = new FakeLab("omp");
    const mode = await omp.dispatch("scout", "unsupported probe", { profile: omp.driver.unsupportedProfile });
    expect(mode.taskId).toBeNull();
    expect(mode.result.text).toMatch(/permission mode `auto`/);
    expect(mode.result.text).not.toMatch(/reasoning level/);
  });
});
