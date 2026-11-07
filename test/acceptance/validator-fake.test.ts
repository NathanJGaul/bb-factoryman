import { afterEach, describe, expect, it } from "vitest";
import { FakeValidator } from "../../src/validator/fake";
import { NoMistakesValidator } from "../../src/validator/no-mistakes";
import type { Outcome, RunView, Validator } from "../../src/validator/types";
import { DISPATCH, loadWorld, settle, type World } from "../fixtures/plugin-host";

const PR = "https://github.com/acme/widgets/pull/7";
const w1 = { threadId: "thr-w1" };
const view = (overrides: Partial<RunView> = {}): RunView => ({ runId: "r1", branch: "fm/t1", phase: "running", gate: null, outcome: null, prUrl: null, error: null, ...overrides });
const gate = (...ids: string[]): RunView =>
  view({ phase: "gate", gate: { step: "review", status: "awaiting_approval", findings: ids.map((id) => ({ id, severity: "error", file: "sum.js", action: id === "review-2" ? "ask-user" : "auto-fix", description: `Problem ${id}, "quoted" and \`ticked\`.` })) } });
const finished = (outcome: Outcome, overrides: Partial<RunView> = {}): RunView => view({ phase: "finished", outcome, ...overrides });
const ok = (value: RunView) => ({ ok: true as const, value });

const worlds: World[] = [];
afterEach(async () => {
  for (const world of worlds.splice(0)) await world.host.harness.lifecycle.dispose();
});

async function handedOff(validator: FakeValidator, mode: "no-mistakes" | "direct-PR" | "local-only" = "no-mistakes") {
  const world = await loadWorld({ validator });
  worlds.push(world);
  world.setProject({ deliveryMode: mode });
  world.paths.set("env-thr-w1", "/work/tree");
  await world.call("factoryman_dispatch", DISPATCH);
  world.sent("thr-sup").length = 0;
  return world;
}
const handoff = (world: World) => world.call("factoryman_report", { outcome: "done", evidence: "Committed abc123." }, w1);
const state = (world: World) => world.store.getTask("t1")?.state;
const startCalls = (v: FakeValidator) => v.calls.filter((call) => call.operation === "start");

describe("validator through the plugin factory", () => {
  it("[A29] offers start, status, findings, answer, and cancel on the fake and on the no-mistakes adapter", () => {
    const real: Validator = new NoMistakesValidator(async () => ({ code: 0, stdout: "", stderr: "" }));
    for (const validator of [new FakeValidator(), real]) {
      for (const operation of ["start", "status", "findings", "answer", "cancel"] as const) expect(typeof validator[operation]).toBe("function");
    }
  });

  it("[A30] makes the task validating on handoff and starts the validator in the worktree with the task's intent", async () => {
    const validator = new FakeValidator();
    validator.script("start", [ok(view())]);
    const world = await handedOff(validator);
    expect((await handoff(world)).text).toBe("Task t1 is now validating.");
    await settle(() => startCalls(validator).length > 0);
    expect(state(world)).toBe("validating");
    expect(startCalls(validator)[0]?.input).toMatchObject({ cwd: "/work/tree", intent: expect.stringContaining(DISPATCH.description) });
  });

  it("[A31] makes the task needs_decision on a gate and wakes the supervisor with each finding verbatim", async () => {
    const validator = new FakeValidator();
    validator.script("start", [ok(gate("review-1", "review-2"))]);
    validator.script("status", [ok(gate("review-1", "review-2"))]);
    const world = await handedOff(validator);
    await handoff(world);
    await settle(() => state(world) === "needs_decision");
    expect(state(world)).toBe("needs_decision");
    await settle(() => world.sent("thr-sup").length > 0);
    const [message] = world.sent("thr-sup");
    expect(message).toContain("Task t1 (ship, no-mistakes) is now needs_decision.");
    expect(message).toContain('- review-1 [error] sum.js: auto-fix: Problem review-1, "quoted" and `ticked`.');
    expect(message).toContain('- review-2 [error] sum.js: ask-user: Problem review-2, "quoted" and `ticked`.');
  });

  it("[A32] returns the task to validating when the validator's view changes, and never answers a finding itself", async () => {
    const validator = new FakeValidator();
    validator.script("start", [ok(gate("review-1")), ok(view())]);
    validator.script("status", [ok(gate("review-1")), ok(gate("review-1")), ok(view())]);
    const world = await handedOff(validator);
    await handoff(world);
    await settle(() => world.store.listEvents({ taskId: "t1" }).some((row) => row.event === "resolve"));
    expect(world.store.listEvents({ taskId: "t1" }).some((row) => row.event === "resolve")).toBe(true);
    expect(validator.calls.filter((call) => call.operation === "answer")).toEqual([]);
  });

  it("[A33] makes the task review_ready with the pull request when the run finishes with checks-passed and a pull request", async () => {
    const validator = new FakeValidator();
    validator.script("start", [ok(finished("checks-passed", { prUrl: PR }))]);
    const world = await handedOff(validator);
    await handoff(world);
    await settle(() => state(world) === "review_ready");
    expect(world.store.getTask("t1")).toMatchObject({ state: "review_ready", pullRequestUrl: PR });
    await settle(() => world.sent("thr-sup").length > 0);
    expect(world.sent("thr-sup")[0]).toContain("is now review_ready");
  });

  it("[A34] makes the task failed with the validator's error when the run ends failed or cancelled", async () => {
    for (const outcome of ["failed", "cancelled"] as const) {
      const validator = new FakeValidator();
      validator.script("start", [ok(finished(outcome, { error: "ci failed after 3 attempts" }))]);
      const world = await handedOff(validator);
      await handoff(world);
      await settle(() => state(world) === "failed");
      expect(state(world), outcome).toBe("failed");
      expect(world.store.listEvents({ taskId: "t1" }).findLast((row) => row.event === "fail")?.evidence, outcome).toContain("ci failed after 3 attempts");
    }
  });

  it("[A35] parks the task for an override, skipped steps, or a missing pull request, and advances nothing on unreadable output", async () => {
    for (const result of [ok(finished("passed-with-override", { prUrl: PR })), ok(finished("passed-with-skips", { prUrl: PR })), ok(finished("checks-passed"))]) {
      const validator = new FakeValidator();
      validator.script("start", [result]);
      validator.script("status", [result]);
      const world = await handedOff(validator);
      await handoff(world);
      await settle(() => state(world) === "needs_decision");
      expect(state(world)).toBe("needs_decision");
      expect(world.store.getTask("t1")?.pullRequestUrl).toBeNull();
    }
    const unreadable = new FakeValidator();
    unreadable.script("start", [{ ok: false, error: { kind: "unreadable", message: "not TOON" } }]);
    const world = await handedOff(unreadable);
    await handoff(world);
    await settle(() => startCalls(unreadable).length >= 3);
    expect(state(world)).toBe("validating");
    expect(world.store.getTask("t1")?.pullRequestUrl).toBeNull();
  });

  it("[A37] resumes a validating task after a restart from the worktree, with one loop and no cancel", async () => {
    const validator = new FakeValidator();
    validator.script("start", [ok(view())]);
    const world = await handedOff(validator);
    await handoff(world);
    await settle(() => startCalls(validator).length >= 1);
    const before = startCalls(validator).length;
    validator.script("start", [ok(finished("checks-passed", { prUrl: PR }))]);
    await world.restart();
    await world.runStartup();
    await settle(() => state(world) === "review_ready");
    expect(state(world)).toBe("review_ready");
    expect(startCalls(validator).length).toBeGreaterThan(before);
    expect(validator.calls.filter((call) => call.operation === "cancel")).toEqual([]);
  });

  it("[A38] never starts the validator for a direct-PR or local-only task", async () => {
    for (const mode of ["direct-PR", "local-only"] as const) {
      const validator = new FakeValidator();
      validator.script("start", [ok(finished("checks-passed", { prUrl: PR }))]);
      const world = await handedOff(validator, mode);
      await world.call("factoryman_report", { outcome: "done", evidence: "Ready.", prUrl: PR, landedCommits: 1 }, w1);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(state(world), mode).toBe("review_ready");
      expect(validator.calls, mode).toEqual([]);
    }
  });
});
