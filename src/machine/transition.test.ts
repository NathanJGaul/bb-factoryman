import { describe, expect, it } from "vitest";
import { context, parsedEvent, snapshot, validEvent } from "../../test/fixtures/machine";
import { REASON_CODES } from "./refusal";
import { createTask, transition } from "./transition";
import type { TaskSnapshot } from "./types";

const CREATE = { type: "create", actor: "supervisor", taskId: "task-9", projectId: "proj-9", kind: "scout", mode: "direct-PR" };

describe("createTask", () => {
  it("returns a queued snapshot with null defaults and no approvals", () => {
    const result = createTask(CREATE);
    expect(result).toEqual({
      ok: true,
      snapshot: {
        state: "queued",
        context: {
          taskId: "task-9",
          projectId: "proj-9",
          kind: "scout",
          mode: "direct-PR",
          profile: null,
          workerThreadId: null,
          branch: null,
          machine: null,
          prUrl: null,
          approvals: {},
        },
      },
    });
  });

  it.each([
    ["a blank task ID", { taskId: "" }],
    ["a whitespace task ID", { taskId: "   " }],
    ["a blank project ID", { projectId: "" }],
    ["an unknown kind", { kind: "epic" }],
    ["an unknown mode", { mode: "yolo" }],
    ["a missing actor", { actor: undefined }],
    ["an extra key", { branch: "x" }],
    ["the wrong event type", { type: "start" }],
  ])("refuses %s", (_name, overrides) => {
    const result = createTask({ ...CREATE, ...overrides });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.code).toBe("invalid_event");
  });

  it.each([undefined, null, 5, "create", []])("refuses non-object input %j", (raw) => {
    const result = createTask(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.code).toBe("invalid_event");
  });
});

describe("transition never throws", () => {
  it.each([undefined, null, 5, "start", [], {}, { type: 5 }, { type: "start" }, { type: "explode", actor: "system" }])(
    "returns a refusal for the event %j",
    (raw) => {
      const result = transition(snapshot("queued"), raw);
      expect(result.ok).toBe(false);
    },
  );

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a number", 5],
    ["an empty object", {}],
    ["an unknown state", { state: "exploded", context: context() }],
    ["a missing context", { state: "queued" }],
    ["an unknown kind", { state: "queued", context: context({ kind: "epic" as never }) }],
    ["a state outside the kind's lane", { state: "validating", context: context({ kind: "scout" }) }],
  ])("returns a refusal for a snapshot that is %s", (_name, bad) => {
    const result = transition(bad as unknown as TaskSnapshot, validEvent("fail"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal.code).toBe("illegal_transition");
  });
});

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

describe("transition is pure", () => {
  it("returns equal results for equal inputs and works on frozen inputs", () => {
    const task = deepFreeze(snapshot("queued", { profile: null }));
    const event = deepFreeze(validEvent("start"));
    const first = transition(task, event);
    const second = transition(task, event);
    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
  });

  it("leaves its input unchanged and returns a snapshot that shares nothing with it", () => {
    const task = snapshot("queued", { profile: null });
    const copy = structuredClone(task);
    const result = transition(task, validEvent("start"));
    expect(task).toEqual(copy);
    if (!result.ok) throw new Error("expected success");
    expect(result.snapshot).not.toBe(task);
    expect(result.snapshot.context).not.toBe(task.context);
    expect(result.snapshot.context.approvals).not.toBe(task.context.approvals);
  });
});

describe("transition results", () => {
  it("gives every refusal a code from the closed list and a message", () => {
    const refusals = [
      transition(snapshot("queued"), undefined),
      transition(snapshot("queued"), { type: "explode", actor: "system" }),
      transition(snapshot("queued"), validEvent("merge")),
      transition(snapshot("queued"), validEvent("fail", { evidence: "" })),
      transition(snapshot("queued", { profile: null }), validEvent("start", { profile: null })),
    ];
    for (const result of refusals) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(REASON_CODES).toContain(result.refusal.code);
        expect(result.refusal.message.length).toBeGreaterThan(0);
      }
    }
  });

  it("carries the from state, the to state, and the parsed event on success", () => {
    const result = transition(snapshot("working"), validEvent("block"));
    expect(result).toMatchObject({ ok: true, from: "working", to: "blocked", snapshot: { state: "blocked" } });
    if (result.ok) expect(result.event).toEqual(parsedEvent("block"));
  });
});
