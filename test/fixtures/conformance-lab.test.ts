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

describe("the fake lab's supervisors", () => {
  const SUPERVISOR_TOOLS = ["factoryman_dispatch", "factoryman_merge", "factoryman_status", "factoryman_teardown"];
  const DRIVERS: Array<[string, "1" | "1.5"]> = [["stub", "1"], ["claude-code", "1.5"], ["codex", "1.5"], ["pi", "1.5"], ["omp", "1.5"]];

  it("[U1709] starts a supervisor with a thread ID and the role seeded at spawn, so its offers are complete before any clear, on every driver", async () => {
    for (const [id, tier] of DRIVERS) {
      const lab = new FakeLab(id, {}, tier);
      const started = await lab.startSupervisor("S9start");
      expect(started.code, id).toBe(0);
      expect(started.threadId, id).toMatch(/^thr_/);
      expect(started.text.split("\n")[0], id).toBe(`Started factoryman supervisor thread ${started.threadId} with the profile harness (${lab.driver.profile.provider}, ${lab.driver.profile.model}).`);
      expect(await lab.offers({ kind: "supervisor", label: "S9start" }), id).toEqual({ tools: SUPERVISOR_TOOLS, skills: ["factoryman-supervisor"] });
    }
    const missing = new FakeLab("pi", { noStartCommand: true });
    expect(await missing.startSupervisor("S9start")).toMatchObject({ code: 2, threadId: null });
  });

  const ONE = "Thread THREAD is now a factoryman supervisor.\n";
  const NEXT_TURN = `${ONE}It gets the four supervisor tools and the factoryman-supervisor skill on its next turn.`;
  const CLEAR = (why: string) => `${ONE}${why}\nRun \`bb thread clear THREAD\` so the thread gets the four supervisor tools and the factoryman-supervisor skill.`;

  it.each([
    ["stub", "1", CLEAR("The harness acp-stub has no recorded role-change behavior.")],
    ["claude-code", "1.5", NEXT_TURN],
    ["codex", "1.5", CLEAR("This harness (codex) applies a new role only when its session is rebuilt.")],
    ["pi", "1.5", NEXT_TURN],
    ["omp", "1.5", CLEAR("This harness (acp-omp) applies a new role only when its session is rebuilt.")],
  ] as const)("[U1710] prints the advice for the %s driver's provider after a stamp, as literal text", async (id, tier, expected) => {
    const lab = new FakeLab(id, {}, tier);
    const thread = await lab.spawnSupervisor("late");
    const stamp = await lab.stamp(thread);
    expect(stamp).toEqual({ code: 0, text: expected.replaceAll("THREAD", thread) });
  });
});
