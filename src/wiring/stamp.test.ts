import { describe, expect, it } from "vitest";
import { DISPATCH_ARGS, SUPERVISOR, testRuntime, type TestRuntime } from "../../test/fixtures/runtime";
import { dispatch } from "../tools/dispatch";
import { registerStamper } from "./stamp";

function setup(): TestRuntime {
  const t = testRuntime();
  t.bb.addThread({ id: SUPERVISOR.threadId });
  registerStamper(t.runtime);
  return t;
}

const stamps = (t: TestRuntime) => t.bb.callsTo("setThreadMetadata") as Array<[string, Record<string, unknown>]>;

describe("registerStamper", () => {
  it("[U925] writes taskId, kind, mode, state, and machine to the worker thread after each applied event", async () => {
    const t = setup();
    await dispatch(t.runtime, SUPERVISOR, DISPATCH_ARGS);
    expect(stamps(t)).toEqual([["thr-w1", { taskId: "t1", kind: "ship", mode: "no-mistakes", state: "working", machine: null }]]);
    await t.runtime.apply("t1", { type: "handoff", actor: "worker", evidence: "Committed." });
    expect(stamps(t).at(-1)).toEqual(["thr-w1", { taskId: "t1", kind: "ship", mode: "no-mistakes", state: "validating", machine: null }]);
  });

  it("[U926] skips a task that has no worker thread", async () => {
    const t = setup();
    t.bb.spawnError = new Error("host is gone");
    await dispatch(t.runtime, SUPERVISOR, DISPATCH_ARGS);
    expect(t.runtime.deps.store.getTask("t1")?.state).toBe("failed");
    expect(stamps(t)).toEqual([]);
  });

  it("[U927] logs a warning, and keeps the event, when the write fails", async () => {
    const t = setup();
    await dispatch(t.runtime, SUPERVISOR, DISPATCH_ARGS);
    t.bb.setMetadataError = new Error("bb is down");
    const applied = await t.runtime.apply("t1", { type: "handoff", actor: "worker", evidence: "Committed." });
    expect(applied.ok).toBe(true);
    expect(t.runtime.deps.store.getTask("t1")?.state).toBe("validating");
    expect(t.lines.some((line) => line.level === "warn" && line.message.includes("bb is down") && line.message.includes("t1"))).toBe(true);
  });

  it("[U928] never writes the role, so tool visibility is untouched", async () => {
    const t = setup();
    await dispatch(t.runtime, SUPERVISOR, DISPATCH_ARGS);
    await t.runtime.apply("t1", { type: "handoff", actor: "worker", evidence: "Committed." });
    for (const [, metadata] of stamps(t)) expect(Object.keys(metadata)).not.toContain("role");
  });

  it("[U941] does not write after a refused event", async () => {
    const t = setup();
    await dispatch(t.runtime, SUPERVISOR, DISPATCH_ARGS);
    const before = stamps(t).length;
    const refused = await t.runtime.apply("t1", { type: "handoff", actor: "worker", evidence: "" });
    expect(refused.ok).toBe(false);
    expect(stamps(t)).toHaveLength(before);
  });
});
