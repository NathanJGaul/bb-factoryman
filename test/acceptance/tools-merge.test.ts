import { describe, expect, it } from "vitest";
import { DISPATCH, loadWorld, nextForm, type World } from "../fixtures/plugin-host";

const PR = "https://github.com/acme/widgets/pull/7";
const worker = { threadId: "thr-w1" };

/** A direct-PR task at review_ready. The pull request modes need no validator. */
async function readyWorld(options: { yolo?: boolean; settings?: Record<string, string | number> } = {}): Promise<World> {
  const world = await loadWorld({ settings: options.settings });
  world.setProject({ deliveryMode: "direct-PR", yolo: options.yolo ?? false });
  await world.call("factoryman_dispatch", DISPATCH);
  await world.call("factoryman_report", { outcome: "done", evidence: "PR open.", prUrl: PR }, worker);
  expect(world.store.getTask("t1")?.state).toBe("review_ready");
  return world;
}

const merges = (world: World) => world.execCalls.filter((call) => call.command === "gh");
const state = (world: World) => world.store.getTask("t1")?.state;
const rows = (world: World) => world.store.listEvents({ taskId: "t1" }).map((row) => `${row.event}:${row.outcome}`);

async function answer(world: World, value: unknown) {
  const call = world.call("factoryman_merge", { taskId: "t1" });
  world.host.harness.behavior.submitInteraction(await nextForm(world), value as never);
  return call;
}

describe("factoryman_merge through the plugin factory", () => {
  it("[A8] records the request and the owner's approval, runs the merge once, and ends the task merged", async () => {
    const world = await readyWorld();
    const result = await answer(world, { decision: "approved", comment: "Ship it." });
    expect(result.isError).toBe(false);
    expect(merges(world)).toEqual([{ command: "gh", args: ["pr", "merge", PR, "--squash"], cwd: undefined }]);
    expect(state(world)).toBe("merged");
    expect(rows(world).slice(-3)).toEqual(["request_approval:applied", "record_approval:applied", "merge:applied"]);
    expect(world.store.listApprovals("t1")).toMatchObject([{ scope: "merge", decision: "approved" }]);
  });

  it("[A8] merges with the method from the mergeMethod setting", async () => {
    const world = await readyWorld({ settings: { mergeMethod: "rebase" } });
    await answer(world, { decision: "approved" });
    expect(merges(world)[0]?.args).toEqual(["pr", "merge", PR, "--rebase"]);
  });

  it("[A9] records a denial, merges nothing, and leaves the task awaiting approval", async () => {
    const world = await readyWorld();
    const result = await answer(world, { decision: "denied", comment: "Not yet." });
    expect(result.isError).toBe(true);
    expect(merges(world)).toEqual([]);
    expect(state(world)).toBe("awaiting_approval");
    expect(world.store.listApprovals("t1")).toMatchObject([{ decision: "denied" }]);
  });

  it("[A10] records nothing for a cancelled form or a timed-out form, and a later call opens a new form", async () => {
    const cancelled = await readyWorld();
    const call = cancelled.call("factoryman_merge", { taskId: "t1" });
    cancelled.host.harness.behavior.cancelInteraction(await nextForm(cancelled));
    const result = await call;
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/did not answer/i);
    expect(merges(cancelled)).toEqual([]);
    expect(state(cancelled)).toBe("awaiting_approval");
    expect(cancelled.store.listApprovals("t1")).toEqual([]);
    const again = cancelled.call("factoryman_merge", { taskId: "t1" });
    cancelled.host.harness.behavior.submitInteraction(await nextForm(cancelled), { decision: "approved" });
    expect((await again).isError).toBe(false);
    expect(state(cancelled)).toBe("merged");

    const timedOut = await readyWorld({ settings: { approvalTimeoutMinutes: 0.0005 } });
    const late = await timedOut.call("factoryman_merge", { taskId: "t1" });
    expect(late.isError).toBe(true);
    expect(late.text).toContain("timeout");
    expect(merges(timedOut)).toEqual([]);
    expect(state(timedOut)).toBe("awaiting_approval");
    expect(timedOut.store.listApprovals("t1")).toEqual([]);
  });

  it("[A11] records nothing and reports an unreadable answer when the form value is not exactly an approval or a denial", async () => {
    for (const value of [{ decision: "approved", extra: 1 }, { decision: "yes" }, "approved", null]) {
      const world = await readyWorld();
      const result = await answer(world, value);
      expect(result.text, JSON.stringify(value)).toMatch(/unreadable/i);
      expect(merges(world)).toEqual([]);
      expect(world.store.listApprovals("t1")).toEqual([]);
      expect(state(world)).toBe("awaiting_approval");
    }
  });

  it("[A12] opens no form under yolo, runs the merge, and records the yolo flag", async () => {
    const world = await readyWorld({ yolo: true });
    const result = await world.call("factoryman_merge", { taskId: "t1" });
    expect(result.isError).toBe(false);
    expect(world.host.harness.inspection.pendingInteractions).toEqual([]);
    expect(merges(world)).toHaveLength(1);
    expect(state(world)).toBe("merged");
    expect(world.store.listEvents({ taskId: "t1" }).at(-1)).toMatchObject({ event: "merge", payload: { yolo: true } });
  });

  it("[A13] records no merge event and stays awaiting approval when the merge command fails", async () => {
    const world = await readyWorld();
    world.execHandler = () => ({ code: 1, stdout: "", stderr: "Pull request is not mergeable" });
    const result = await answer(world, { decision: "approved" });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("not mergeable");
    expect(state(world)).toBe("awaiting_approval");
    expect(rows(world).some((row) => row.startsWith("merge:"))).toBe(false);
  });

  it("[A14] refuses a wrong state, a scout, and a worker caller, and opens no form", async () => {
    const working = await loadWorld();
    working.setProject({ deliveryMode: "direct-PR" });
    await working.call("factoryman_dispatch", DISPATCH);
    expect((await working.call("factoryman_merge", { taskId: "t1" })).text).toContain("illegal_transition");

    const scout = await loadWorld();
    await scout.call("factoryman_dispatch", { ...DISPATCH, kind: "scout" });
    expect((await scout.call("factoryman_merge", { taskId: "t1" })).text).toContain("illegal_transition");

    const ready = await readyWorld();
    expect((await ready.call("factoryman_merge", { taskId: "t1" }, worker)).text).toContain("actor_forbidden");
    for (const world of [working, scout, ready]) {
      expect(world.host.harness.inspection.pendingInteractions).toEqual([]);
      expect(merges(world)).toEqual([]);
    }
  });
});
