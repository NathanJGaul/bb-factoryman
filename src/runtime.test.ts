import { describe, expect, it } from "vitest";
import { createEvent } from "../test/fixtures/store";
import { testRuntime } from "../test/fixtures/runtime";
import { validEvent } from "../test/fixtures/machine";

function started() {
  const t = testRuntime();
  expect(t.runtime.log.create(createEvent({ taskId: "k1" })).ok).toBe(true);
  return t;
}

describe("Runtime.apply", () => {
  it("[U6] records the event through the task log and returns its outcome", async () => {
    const t = started();
    const outcome = await t.runtime.apply("k1", validEvent("start"));
    expect(outcome.ok).toBe(true);
    expect(outcome.ok && outcome.task.state).toBe("working");
    expect(t.runtime.deps.store.listEvents({ taskId: "k1" }).map((row) => row.event)).toEqual(["create", "start"]);
  });

  it("[U7] calls every listener once with the applied task and event", async () => {
    const t = started();
    const seen: string[] = [];
    t.runtime.onApplied(({ task, event }) => void seen.push(`a:${task.state}:${event.event}`));
    t.runtime.onApplied(async ({ task }) => void seen.push(`b:${task.state}`));
    await t.runtime.apply("k1", validEvent("start"));
    expect(seen).toEqual(["a:working:start", "b:working"]);
  });

  it("[U8] calls no listener for a refused event", async () => {
    const t = started();
    const seen: string[] = [];
    t.runtime.onApplied(() => void seen.push("called"));
    const outcome = await t.runtime.apply("k1", validEvent("merge", { yolo: true }));
    expect(outcome.ok).toBe(false);
    expect(seen).toEqual([]);
  });

  it("[U9] logs a throwing listener, keeps the event, and still runs the other listeners", async () => {
    const t = started();
    const seen: string[] = [];
    t.runtime.onApplied(() => {
      throw new Error("listener boom");
    });
    t.runtime.onApplied(async () => {
      throw new Error("async boom");
    });
    t.runtime.onApplied(() => void seen.push("third"));
    const outcome = await t.runtime.apply("k1", validEvent("start"));
    expect(outcome.ok).toBe(true);
    expect(seen).toEqual(["third"]);
    expect(t.runtime.deps.store.getTask("k1")?.state).toBe("working");
    expect(t.lines.filter((l) => l.level === "error").map((l) => l.message)).toEqual([
      expect.stringContaining("listener boom"),
      expect.stringContaining("async boom"),
    ]);
  });
});
