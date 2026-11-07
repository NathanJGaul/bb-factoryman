import { describe, expect, it } from "vitest";
import { EVENT_TYPES, validEvent } from "../../test/fixtures/machine";
import { parseEvent } from "./events";

function refusalCode(raw: unknown): string {
  const result = parseEvent(raw);
  if (result.ok) throw new Error(`expected a refusal but the event parsed: ${JSON.stringify(raw)}`);
  expect(result.refusal.message.length).toBeGreaterThan(0);
  return result.refusal.code;
}

describe("parseEvent", () => {
  it.each(EVENT_TYPES)("parses a valid %s event", (type) => {
    const result = parseEvent(validEvent(type));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.event.type).toBe(type);
  });

  it("covers all 16 event types", () => {
    expect(EVENT_TYPES).toHaveLength(16);
  });

  it("refuses an unknown event type as unknown_event", () => {
    expect(refusalCode({ type: "explode", actor: "system" })).toBe("unknown_event");
  });

  it("refuses a missing or non-string type as invalid_event", () => {
    expect(refusalCode({ actor: "system" })).toBe("invalid_event");
    expect(refusalCode({ type: 5, actor: "system" })).toBe("invalid_event");
  });

  it("refuses an event with an unknown extra key", () => {
    expect(refusalCode({ ...validEvent("merge"), extra: true })).toBe("invalid_event");
    expect(refusalCode({ ...validEvent("fail"), yolo: true })).toBe("invalid_event");
  });

  it.each([
    ["start", "threadId"],
    ["start", "branch"],
    ["validated", "prUrl"],
    ["validated", "pipelineFinished"],
    ["merge", "yolo"],
    ["teardown", "worktree"],
    ["record_approval", "scope"],
    ["record_approval", "decision"],
    ["fail", "actor"],
  ] as const)("refuses %s without %s as invalid_event", (type, field) => {
    const event = validEvent(type);
    delete event[field];
    expect(refusalCode(event)).toBe("invalid_event");
  });

  it.each([
    ["teardown", { worktree: { uncommittedChanges: false, unpushedCommits: -1 } }],
    ["teardown", { worktree: { uncommittedChanges: false, unpushedCommits: 1.5 } }],
    ["teardown", { worktree: { uncommittedChanges: "no", unpushedCommits: 0 } }],
    ["teardown", { worktree: { uncommittedChanges: false, unpushedCommits: 0, extra: 1 } }],
    ["ready", { landedCommits: -1 }],
    ["ready", { landedCommits: 1.5 }],
    ["ready", { prUrl: "not a url" }],
    ["validated", { prUrl: "not a url" }],
    ["validated", { pipelineFinished: "yes" }],
    ["merge", { yolo: "yes" }],
    ["record_approval", { scope: "teardown" }],
    ["record_approval", { decision: "maybe" }],
    ["start", { threadId: "" }],
    ["start", { profile: { provider: "claude", model: "", reasoningLevel: "high", permissionMode: "plan" } }],
    ["fail", { actor: "root" }],
    ["fail", { evidence: 5 }],
  ] as const)("refuses %s with a bad value %j as invalid_event", (type, overrides) => {
    expect(refusalCode(validEvent(type, overrides))).toBe("invalid_event");
  });

  it.each([undefined, null, 5, "start", true, []])("refuses non-object input %j as invalid_event", (raw) => {
    expect(refusalCode(raw)).toBe("invalid_event");
  });

  it("[U813] accepts cloneMachine on a start event and refuses a blank one", () => {
    expect(parseEvent(validEvent("start", { machine: "host_b", cloneMachine: "host_a" })).ok).toBe(true);
    expect(parseEvent(validEvent("start", { cloneMachine: null })).ok).toBe(true);
    expect(parseEvent(validEvent("start", { cloneMachine: "" })).ok).toBe(false);
    expect(parseEvent(validEvent("merge", { cloneMachine: "host_a" })).ok).toBe(false);
  });
});
