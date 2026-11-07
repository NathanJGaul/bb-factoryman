import { describe, expect, it } from "vitest";
import { testRuntime, type TestRuntime } from "../../test/fixtures/runtime";
import { fakeClock } from "../../test/fixtures/store";
import { checkBudget, type Limits } from "./budget";

const LIMITS: Limits = { budgetCurrency: "USD" };

function setup(startDay = "2026-11-07") {
  const now = { value: `${startDay}T10:00:00.000Z` };
  const t = testRuntime({ now: () => now.value });
  t.bb.addThread({ id: "thr-sup" });
  void fakeClock;
  return { t, now };
}

/** A task created now in project `proj-1`, with a worker thread whose cost is `cost`. */
function task(t: TestRuntime, id: string, options: { project?: string; cost?: { amount: number; currency: string } | null; state?: "working" | "failed" } = {}): void {
  const project = options.project ?? "proj-1";
  t.runtime.log.create({ type: "create", actor: "supervisor", taskId: id, projectId: project, kind: "ship", mode: "no-mistakes" });
  t.runtime.log.apply(id, { type: "start", actor: "supervisor", profile: { provider: "claude", model: "opus", reasoningLevel: "high", permissionMode: "auto" }, threadId: `thr-${id}`, branch: `fm/${id}`, evidence: "Do it." });
  if (options.state === "failed") t.runtime.log.apply(id, { type: "fail", actor: "system", evidence: "Gave up." });
  if (options.cost !== undefined) t.bb.costs.set(`thr-${id}`, options.cost);
}

describe("checkBudget", () => {
  it("[U1011] counts the tasks created on the UTC date of the injected clock, and starts a new count on the next day", async () => {
    const { t, now } = setup();
    task(t, "a");
    task(t, "b");
    now.value = "2026-11-07T23:59:59.000Z";
    const full = await checkBudget(t.runtime, "proj-1", { ...LIMITS, maxTasksPerDay: 2 });
    expect(full).toMatchObject({ ok: false });
    expect(full.ok ? "" : full.text).toMatch(/2 tasks today.*limit 2.*2026-11-07/);
    expect(await checkBudget(t.runtime, "proj-1", { ...LIMITS, maxTasksPerDay: 3 })).toEqual({ ok: true, notes: [] });
    now.value = "2026-11-08T00:00:00.000Z";
    expect(await checkBudget(t.runtime, "proj-1", { ...LIMITS, maxTasksPerDay: 2 })).toEqual({ ok: true, notes: [] });
    expect((await checkBudget(t.runtime, "proj-2", { ...LIMITS, maxTasksPerDay: 1 })).ok).toBe(true);
  });

  it("[U1012] sums known costs in the budget currency and counts the rest as unknown", async () => {
    const { t } = setup();
    task(t, "a", { cost: { amount: 2, currency: "USD" } });
    task(t, "b", { cost: { amount: 2.5, currency: "USD" } });
    task(t, "c", { cost: { amount: 100, currency: "EUR" } });
    task(t, "d", { cost: null });
    const result = await checkBudget(t.runtime, "proj-1", { ...LIMITS, perDayBudget: 5 });
    expect(result.ok).toBe(true);
    const notes = result.ok ? result.notes.join(" ") : "";
    expect(notes).toMatch(/2 tasks/);
    expect(notes).toMatch(/could not be checked|unknown/i);
    const over = await checkBudget(t.runtime, "proj-1", { ...LIMITS, perDayBudget: 4.5 });
    expect(over.ok).toBe(false);
  });

  it("[U1013] refuses at or above the day budget and not below it", async () => {
    const { t } = setup();
    task(t, "a", { cost: { amount: 5, currency: "USD" } });
    expect((await checkBudget(t.runtime, "proj-1", { ...LIMITS, perDayBudget: 5 })).ok).toBe(false);
    expect((await checkBudget(t.runtime, "proj-1", { ...LIMITS, perDayBudget: 5.01 })).ok).toBe(true);
    const refused = await checkBudget(t.runtime, "proj-1", { ...LIMITS, perDayBudget: 4 });
    expect(refused.ok ? "" : refused.text).toMatch(/spent 5.*USD.*4/);
  });

  it("[U1014] refuses while a running task is over its per-task budget, and not for an ended task", async () => {
    const { t } = setup();
    task(t, "a", { cost: { amount: 4, currency: "USD" } });
    const refused = await checkBudget(t.runtime, "proj-1", { ...LIMITS, perTaskBudget: 3 });
    expect(refused.ok).toBe(false);
    expect(refused.ok ? "" : refused.text).toContain("a");
    expect((await checkBudget(t.runtime, "proj-1", { ...LIMITS, perTaskBudget: 4 })).ok).toBe(true);
    await t.runtime.apply("a", { type: "fail", actor: "system", evidence: "Stopped." });
    expect((await checkBudget(t.runtime, "proj-1", { ...LIMITS, perTaskBudget: 3 })).ok).toBe(true);
  });

  it("[U1015] counts a cost read that fails as unknown, and logs it", async () => {
    const { t } = setup();
    task(t, "a", { cost: { amount: 100, currency: "USD" } });
    t.bb.costError = new Error("bb is down");
    const result = await checkBudget(t.runtime, "proj-1", { ...LIMITS, perDayBudget: 5 });
    expect(result.ok).toBe(true);
    expect(t.lines.some((line) => line.level === "warn" && line.message.includes("bb is down"))).toBe(true);
  });

  it("[U1016] says which budgets could not be checked when no cost is known, and says nothing when none is set", async () => {
    const { t } = setup();
    task(t, "a", { cost: null });
    const both = await checkBudget(t.runtime, "proj-1", { ...LIMITS, perDayBudget: 5, perTaskBudget: 2, maxTasksPerDay: 10 });
    expect(both.ok).toBe(true);
    const notes = both.ok ? both.notes.join(" ") : "";
    expect(notes).toContain("perDayBudget");
    expect(notes).toContain("perTaskBudget");
    expect(notes).toContain("maxTasksPerDay");
    expect(await checkBudget(t.runtime, "proj-1", LIMITS)).toEqual({ ok: true, notes: [] });
    expect(t.bb.callsTo("getThreadCost")).toHaveLength(1);
  });

  it("reads no cost when no budget is set", async () => {
    const { t } = setup();
    task(t, "a", { cost: { amount: 1, currency: "USD" } });
    await checkBudget(t.runtime, "proj-1", { ...LIMITS, maxTasksPerDay: 5 });
    expect(t.bb.callsTo("getThreadCost")).toEqual([]);
  });

  it("[U1061] counts only the project's own tasks for the day cap", async () => {
    const { t } = setup();
    task(t, "a", { project: "proj-2" });
    task(t, "b", { project: "proj-2" });
    task(t, "c", { project: "proj-2" });
    expect((await checkBudget(t.runtime, "proj-1", { ...LIMITS, maxTasksPerDay: 2 })).ok).toBe(true);
    expect((await checkBudget(t.runtime, "proj-2", { ...LIMITS, maxTasksPerDay: 2 })).ok).toBe(false);
  });

  it("[U1062] reads a running task from an earlier day for the per-task budget, and leaves earlier days out of the day spend", async () => {
    const { t, now } = setup("2026-11-06");
    task(t, "old", { cost: { amount: 9, currency: "USD" } });
    now.value = "2026-11-07T10:00:00.000Z";
    const refused = await checkBudget(t.runtime, "proj-1", { ...LIMITS, perTaskBudget: 3 });
    expect(refused.ok).toBe(false);
    expect(refused.ok ? "" : refused.text).toContain("old");
    task(t, "new", { cost: { amount: 1, currency: "USD" } });
    expect((await checkBudget(t.runtime, "proj-1", { ...LIMITS, perDayBudget: 5 })).ok).toBe(true);
    expect((await checkBudget(t.runtime, "proj-1", { ...LIMITS, perDayBudget: 1 })).ok).toBe(false);
  });

  it("[U1063] counts a cost read that fails as zero spend and says the cost is unknown", async () => {
    const { t } = setup();
    task(t, "a", { cost: { amount: 100, currency: "USD" } });
    t.bb.costError = new Error("bb is down");
    const result = await checkBudget(t.runtime, "proj-1", { ...LIMITS, perDayBudget: 5 });
    expect(result.ok).toBe(true);
    expect(result.ok ? result.notes.join(" ") : "").toMatch(/unavailable|unknown/i);
  });

  it("[U1064] reads no cost for a queued task that has no worker thread yet", async () => {
    const { t } = setup();
    t.runtime.log.create({ type: "create", actor: "supervisor", taskId: "q", projectId: "proj-1", kind: "ship", mode: "no-mistakes" });
    await checkBudget(t.runtime, "proj-1", { ...LIMITS, perDayBudget: 5 });
    expect(t.bb.callsTo("getThreadCost")).toEqual([]);
  });
});
