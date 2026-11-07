import { afterEach, describe, expect, it } from "vitest";
import { makeCheckout, removeCheckouts } from "../fixtures/checkout";
import { loadWorld, type World } from "../fixtures/plugin-host";

afterEach(removeCheckouts);

const TASK = { kind: "ship", description: "Add a --json flag to the status command." } as const;

async function setup(limits: Record<string, unknown>): Promise<World> {
  return loadWorld({ checkout: makeCheckout({ workflow: { version: 1, limits } }) });
}

describe("budgets through the plugin factory", () => {
  it("[A1008] refuses the next dispatch at maxTasksPerDay, and a new UTC day resets the count", async () => {
    const world = await setup({ maxTasksPerDay: 2 });
    expect((await world.call("factoryman_dispatch", TASK)).isError).toBe(false);
    expect((await world.call("factoryman_dispatch", TASK)).isError).toBe(false);
    const refused = await world.call("factoryman_dispatch", TASK);
    expect(refused.isError).toBe(true);
    expect(refused.text).toMatch(/2 tasks today.*limit 2/);
    expect(refused.text).toContain("No task was created");
    expect(world.store.listTasks()).toHaveLength(2);
    world.skewClock(24 * 3600 * 1000);
    expect((await world.call("factoryman_dispatch", TASK)).isError).toBe(false);
    expect(world.store.listTasks()).toHaveLength(3);
  });

  it("[A1009] refuses a dispatch when the recorded spend reaches perDayBudget", async () => {
    const world = await setup({ perDayBudget: 5 });
    expect((await world.call("factoryman_dispatch", TASK)).isError).toBe(false);
    world.costs.set("thr-w1", { amount: 6, currency: "USD" });
    const refused = await world.call("factoryman_dispatch", TASK);
    expect(refused.isError).toBe(true);
    expect(refused.text).toMatch(/perDayBudget|daily budget/i);
    expect(refused.text).toContain("USD");
    expect(world.store.listTasks()).toHaveLength(1);
  });

  it("[A1010] refuses a dispatch while a running task is over perTaskBudget, and allows it after that task stops", async () => {
    const world = await setup({ perTaskBudget: 3 });
    await world.call("factoryman_dispatch", TASK);
    world.costs.set("thr-w1", { amount: 4, currency: "USD" });
    const refused = await world.call("factoryman_dispatch", TASK);
    expect(refused.isError).toBe(true);
    expect(refused.text).toContain("t1");
    await world.call("factoryman_report", { outcome: "failed", evidence: "Stopped for cost." }, { threadId: "thr-w1" });
    expect((await world.call("factoryman_dispatch", TASK)).isError).toBe(false);
  });

  it("[A1011] enforces no budget without cost data, still enforces maxTasksPerDay, and says so", async () => {
    const world = await setup({ perDayBudget: 1, perTaskBudget: 1, maxTasksPerDay: 3 });
    const first = await world.call("factoryman_dispatch", TASK);
    expect(first.isError).toBe(false);
    const second = await world.call("factoryman_dispatch", TASK);
    expect(second.isError).toBe(false);
    expect(second.text).toMatch(/perDayBudget.*could not be checked|could not be checked.*perDayBudget/s);
    await world.call("factoryman_dispatch", TASK);
    expect((await world.call("factoryman_dispatch", TASK)).isError).toBe(true);
  });

  it.each([
    ["the day cap", { maxTasksPerDay: 1 }, false],
    ["the day budget", { perDayBudget: 1 }, true],
    ["the task budget", { perTaskBudget: 1 }, true],
  ])("[A1012] leaves the log and the spawns unchanged when %s refuses a dispatch", async (_label, limits, needsCost) => {
    const world = await setup(limits);
    await world.call("factoryman_dispatch", TASK);
    if (needsCost) world.costs.set("thr-w1", { amount: 9, currency: "USD" });
    const events = world.store.listEvents().length;
    const refused = await world.call("factoryman_dispatch", TASK);
    expect(refused.isError).toBe(true);
    expect(world.store.listEvents()).toHaveLength(events);
    expect(world.store.listTasks()).toHaveLength(1);
    expect(world.sdkCalls("threads.spawn")).toHaveLength(1);
  });
});
