import { describe, expect, it } from "vitest";
import { fakeOffers, modelsReady, readWakes, startedThreadId, stubOffers, type LogLine, type ThreadEvent } from "./readers.ts";

const requested = (seq: number, text: string, plugin: string | null = "bb-factoryman"): ThreadEvent => ({
  seq,
  type: "client/turn/requested",
  data: { ...(plugin === null ? {} : { originPluginId: plugin }), source: "tell", input: [{ type: "text", text }] },
});
const started = (seq: number): ThreadEvent => ({ seq, type: "turn/started", data: {} });
const completed = (seq: number): ThreadEvent => ({ seq, type: "turn/completed", data: {} });
const WAKE = "[factoryman] Task t-1 (scout, local-only) is now report_ready.\nEvidence: x";

describe("readWakes", () => {
  it("[U1374] counts only the wakes the plugin sent, in order, and flags a turn that was running at the time", () => {
    const events: ThreadEvent[] = [
      requested(1, "CALL factoryman_dispatch {}", null),
      started(2),
      requested(3, WAKE),
      completed(4),
      requested(5, "[factoryman] Task t-2 (scout, local-only) is now failed."),
      requested(6, "a plain message from another plugin", "other-plugin"),
      requested(7, "a message from the plugin that is not a wake", "bb-factoryman"),
      { seq: 8, type: "item/started", data: {} },
    ];
    expect(readWakes(events)).toEqual([
      { seq: 3, text: WAKE, busy: true },
      { seq: 5, text: "[factoryman] Task t-2 (scout, local-only) is now failed.", busy: false },
    ]);
  });
});

const line = (kind: string, extra: LogLine = {}): LogLine => ({ kind, session: "s1", ...extra });

describe("offers", () => {
  it("[U1375] reads the stub's offers from the session whose prompt names the task or the supervisor label", () => {
    const log: LogLine[] = [
      line("session-new", { session: "s1" }),
      line("mcp-ready", { session: "s1", servers: [{ tools: ["factoryman_report"] }] }),
      line("prompt", { session: "s1", text: "<system_instructions>Available bb skills: factoryman-worker</system_instructions>\nYou are the worker for scout task t-9. The delivery mode is local-only. Read the factoryman-supervisor skill." }),
      line("mcp-ready", { session: "s2", servers: [{ tools: ["update_environment_directory"] }] }),
      line("prompt", { session: "s2", text: "[conformance:sup=late]\nhello" }),
      line("mcp-ready", { session: "s3", servers: [{ tools: ["factoryman_dispatch", "factoryman_merge", "factoryman_status", "factoryman_teardown", "update_environment_directory"] }] }),
      line("prompt", { session: "s3", text: "<system_instructions>Skills: factoryman-supervisor</system_instructions>\n[conformance:sup=late]\nhello again" }),
    ];
    expect(stubOffers(log, { kind: "worker", taskId: "t-9" })).toEqual({ tools: ["factoryman_report"], skills: ["factoryman-worker"] });
    expect(stubOffers(log, { kind: "supervisor", label: "late" })).toEqual({ tools: ["factoryman_dispatch", "factoryman_merge", "factoryman_status", "factoryman_teardown"], skills: ["factoryman-supervisor"] });
    expect(stubOffers(log, { kind: "worker", taskId: "t-404" })).toEqual({ tools: [], skills: [] });
  });

  it("[U1375] reads the fake model's offers from the last request logged for the actor", () => {
    const log: LogLine[] = [
      { actor: "sup:late", pluginTools: [], skills: [] },
      { actor: "worker:t-9", pluginTools: ["factoryman_report"], skills: ["factoryman-worker"] },
      { actor: "sup:late", pluginTools: ["factoryman_dispatch", "factoryman_status"], skills: ["factoryman-supervisor"] },
    ];
    expect(fakeOffers(log, { kind: "supervisor", label: "late" })).toEqual({ tools: ["factoryman_dispatch", "factoryman_status"], skills: ["factoryman-supervisor"] });
    expect(fakeOffers(log, { kind: "worker", taskId: "t-9" })).toEqual({ tools: ["factoryman_report"], skills: ["factoryman-worker"] });
    expect(fakeOffers(log, { kind: "worker", taskId: "t-1" })).toEqual({ tools: [], skills: [] });
  });
});

describe("startedThreadId", () => {
  it("[U1707] takes the ID from the first line of the start command's output, and returns null when the line has none", () => {
    const ok = "Started factoryman supervisor thread thr_abc123 with the profile harness (claude-code, claude-haiku-5-5).\nThe role is set at spawn, so the thread has the five supervisor tools and the factoryman-supervisor skill from its first turn.";
    expect(startedThreadId(ok)).toBe("thr_abc123");
    expect(startedThreadId("No supervisor profile is set for project proj_x. Pass --profile <name>.\nNothing was spawned.")).toBeNull();
    expect(startedThreadId("Usage: bb factoryman supervisor <thread-id>")).toBeNull();
    expect(startedThreadId("")).toBeNull();
    // Only the first line counts: a later line must not be taken for the start line.
    expect(startedThreadId("Cannot start a supervisor: x.\nStarted factoryman supervisor thread thr_zzz with the profile p (a, b).")).toBeNull();
  });
});

describe("modelsReady", () => {
  const WANTED = "mock/mock-1";

  it("[U1850] is false for an empty list, a value that is not a list, and a list that holds only the placeholder acp-default", () => {
    expect(modelsReady([], WANTED)).toBe(false);
    expect(modelsReady(null, WANTED)).toBe(false);
    expect(modelsReady({ models: [{ id: "acp-default" }] }, WANTED)).toBe(false);
    expect(modelsReady([{ id: "acp-default" }], WANTED)).toBe(false);
    expect(modelsReady(["acp-default"], WANTED)).toBe(false);
  });

  it("[U1850] is true when the list holds the model that the driver dispatches with", () => {
    expect(modelsReady([{ id: "acp-default" }, { id: WANTED }], WANTED)).toBe(true);
    expect(modelsReady([WANTED], WANTED)).toBe(true);
  });

  it("[U1850] is true when the list holds a real model beside or instead of the placeholder, because bb lists its own catalog for the other harnesses", () => {
    expect(modelsReady([{ id: "claude-haiku-5-5" }], WANTED)).toBe(true);
    expect(modelsReady([{ id: "acp-default" }, { id: "gpt-5" }], WANTED)).toBe(true);
  });

  it("[U1850] is true when the model that the driver dispatches with is the placeholder itself, as for the stub agent", () => {
    expect(modelsReady([{ id: "acp-default" }], "acp-default")).toBe(true);
  });

  it("[U1850] is true for a non-empty list whose entries name no model ID, so a change of shape cannot stall a run", () => {
    expect(modelsReady([{ label: "x" }], WANTED)).toBe(true);
  });
});

