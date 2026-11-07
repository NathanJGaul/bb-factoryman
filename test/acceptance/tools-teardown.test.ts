import { describe, expect, it } from "vitest";
import type { ExecResult } from "../../src/exec";
import { DISPATCH, loadWorld, type World } from "../fixtures/plugin-host";

const PR = "https://github.com/acme/widgets/pull/7";

const git = (facts: { status?: string; count?: string }) => (command: string, args: readonly string[]): ExecResult => {
  if (command === "git" && args[0] === "status") return { code: 0, stdout: facts.status ?? "", stderr: "" };
  if (command === "git" && args[0] === "rev-list") return { code: 0, stdout: facts.count ?? "0\n", stderr: "" };
  return { code: 0, stdout: "", stderr: "" };
};

/** A merged task, merged through the yolo path so that no form is needed. */
async function mergedWorld(): Promise<World> {
  const world = await loadWorld();
  world.setProject({ deliveryMode: "direct-PR", yolo: true });
  world.paths.set("env-thr-w1", "/work/tree");
  await world.call("factoryman_dispatch", DISPATCH);
  await world.call("factoryman_report", { outcome: "done", evidence: "PR open.", prUrl: PR }, { threadId: "thr-w1" });
  await world.call("factoryman_merge", { taskId: "t1" });
  expect(world.store.getTask("t1")?.state).toBe("merged");
  world.execHandler = git({});
  return world;
}

describe("factoryman_teardown through the plugin factory", () => {
  it("[A15] refuses uncommitted changes and unpushed commits, logs the refusal, and removes no environment", async () => {
    for (const facts of [{ status: " M a.ts\n" }, { count: "3\n" }]) {
      const world = await mergedWorld();
      world.execHandler = git(facts);
      const result = await world.call("factoryman_teardown", { taskId: "t1" });
      expect(result.isError).toBe(true);
      expect(result.text).toContain("unlanded_work");
      expect(world.store.listEvents({ taskId: "t1" }).at(-1)).toMatchObject({ event: "teardown", outcome: "refused", reasonCode: "unlanded_work" });
      expect(world.store.getTask("t1")?.state).toBe("merged");
      expect(world.sdkCalls("threads.archive")).toEqual([]);
      expect(world.sdkCalls("environments.delete")).toEqual([]);
    }
  });

  it("[A16] records torn_down for a landed worktree and then retires the worker environment", async () => {
    const world = await mergedWorld();
    const result = await world.call("factoryman_teardown", { taskId: "t1" });
    expect(result).toEqual({ isError: false, text: "Task t1 is torn down." });
    expect(world.store.getTask("t1")?.state).toBe("torn_down");
    expect(world.sdkCalls("threads.archive")).toEqual([[{ threadId: "thr-w1" }]]);
    expect(world.sdkCalls("environments.delete")).toEqual([[{ environmentId: "env-thr-w1" }]]);
  });
});
