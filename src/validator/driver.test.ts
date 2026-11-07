import { afterEach, describe, expect, it } from "vitest";
import { DISPATCH_ARGS, SUPERVISOR, withDispatchedTask, type TestRuntime } from "../../test/fixtures/runtime";
import { defaultProjectConfig } from "../store/store";
import { dispatch } from "../tools/dispatch";
import { ValidationDriver } from "./driver";
import { FakeValidator } from "./fake";
import type { Outcome, RunView } from "./types";

const PR = "https://github.com/acme/widgets/pull/7";
const finding = (id: string, action = "auto-fix") => ({ id, severity: "error", file: "sum.js", action, description: `Problem ${id}, with "quotes" and \`ticks\`.` });
const view = (overrides: Partial<RunView> = {}): RunView => ({ runId: "r1", branch: "fm/t1", phase: "running", gate: null, outcome: null, prUrl: null, error: null, ...overrides });
const gateView = (...ids: string[]): RunView => view({ phase: "gate", gate: { step: "review", status: "awaiting_approval", findings: ids.map((id) => finding(id)) } });
const done = (outcome: Outcome, overrides: Partial<RunView> = {}): RunView => view({ phase: "finished", outcome, ...overrides });
const ok = (value: RunView) => ({ ok: true as const, value });
const err = (message: string) => ({ ok: false as const, error: { kind: "command_failed" as const, message } });

const drivers: ValidationDriver[] = [];
afterEach(() => drivers.splice(0).forEach((driver) => driver.dispose()));

/** A task in `validating` with its worktree path known. */
async function validating(options: { mode?: "no-mistakes" | "direct-PR" } = {}) {
  const t = await withDispatchedTask({ mode: options.mode });
  t.bb.envPaths.set("env-thr-w1", "/work/tree");
  await t.runtime.apply("t1", { type: "handoff", actor: "worker", evidence: "Committed." });
  return driverFor(t);
}

function driverFor(t: TestRuntime, validator = new FakeValidator(), options: { maxErrors?: number } = {}) {
  const driver = new ValidationDriver(t.runtime, validator, options);
  drivers.push(driver);
  return { t, driver, validator };
}

const state = (t: TestRuntime) => t.runtime.deps.store.getTask("t1")?.state;
const state2 = (t: TestRuntime) => t.runtime.deps.store.getTask("t2")?.state;
const lastEvent = (t: TestRuntime) => t.runtime.deps.store.listEvents({ taskId: "t1" }).findLast((row) => row.outcome === "applied")!;
const calls = (v: FakeValidator, op: string) => v.calls.filter((call) => call.operation === op);
const slowSleep = () => new Promise<void>((resolve) => setTimeout(resolve, 1));
const settle = async (until: () => boolean) => {
  for (let i = 0; i < 400 && !until(); i += 1) await new Promise((resolve) => setTimeout(resolve, 2));
};

describe("ValidationDriver.step in validating", () => {
  it("[U186] calls start with the worker environment's path and the start evidence as the intent", async () => {
    const { driver, validator } = await validating();
    validator.script("start", [ok(view())]);
    await driver.step("t1");
    expect(validator.calls[0]).toEqual({ operation: "start", input: { cwd: "/work/tree", intent: expect.stringContaining("Add a --json flag to the status command."), wait: undefined } });
  });

  it("[U187] applies finding for a gate with evidence that names the step, the count, and each finding verbatim", async () => {
    const { t, driver, validator } = await validating();
    validator.script("start", [ok(gateView("review-1", "review-2"))]);
    expect(await driver.step("t1")).toBe("continue");
    expect(state(t)).toBe("needs_decision");
    expect(lastEvent(t)).toMatchObject({ event: "finding", actor: "system" });
    expect(lastEvent(t).evidence).toBe(
      ["Gate review (awaiting_approval) has 2 findings:", '- review-1 [error] sum.js: auto-fix: Problem review-1, with "quotes" and `ticks`.', '- review-2 [error] sum.js: auto-fix: Problem review-2, with "quotes" and `ticks`.'].join("\n"),
    );
  });

  it("[U195] applies validated with the pull request for checks-passed, and the task becomes review_ready", async () => {
    const { t, driver, validator } = await validating();
    validator.script("start", [ok(done("checks-passed", { prUrl: PR }))]);
    expect(await driver.step("t1")).toBe("stop");
    expect(state(t)).toBe("review_ready");
    expect(t.runtime.deps.store.getTask("t1")?.pullRequestUrl).toBe(PR);
    expect(lastEvent(t)).toMatchObject({ event: "validated", payload: { prUrl: PR, pipelineFinished: true } });
  });

  it("[U196] applies finding for checks-passed without a pull request", async () => {
    const { t, driver, validator } = await validating();
    validator.script("start", [ok(done("checks-passed"))]);
    await driver.step("t1");
    expect(state(t)).toBe("needs_decision");
    expect(lastEvent(t).evidence).toMatch(/no pull request/i);
  });

  it("[U197] applies finding for passed-with-override, passed-with-skips, and passed", async () => {
    for (const outcome of ["passed-with-override", "passed-with-skips", "passed"] as const) {
      const { t, driver, validator } = await validating();
      validator.script("start", [ok(done(outcome, { prUrl: PR }))]);
      await driver.step("t1");
      expect(state(t), outcome).toBe("needs_decision");
      expect(lastEvent(t).evidence, outcome).toContain(outcome);
    }
  });

  it("[U198] applies fail with the validator's error for failed and cancelled", async () => {
    for (const outcome of ["failed", "cancelled"] as const) {
      const { t, driver, validator } = await validating();
      validator.script("start", [ok(done(outcome, { error: "ci failed after 3 attempts" }))]);
      expect(await driver.step("t1")).toBe("stop");
      expect(state(t), outcome).toBe("failed");
      expect(lastEvent(t)).toMatchObject({ event: "fail", actor: "system" });
      expect(lastEvent(t).evidence).toContain(`run r1 ${outcome}: ci failed after 3 attempts`);
    }
  });

  it("[U199] keeps trying through four validator errors and applies finding on the fifth", async () => {
    const { t, driver, validator } = await validating();
    validator.script("start", [err("no-mistakes is not installed")]);
    for (let i = 0; i < 4; i += 1) {
      expect(await driver.step("t1")).toBe("continue");
      expect(state(t)).toBe("validating");
    }
    await driver.step("t1");
    expect(state(t)).toBe("needs_decision");
    expect(lastEvent(t).evidence).toContain("5 times in a row");
    expect(lastEvent(t).evidence).toContain("no-mistakes is not installed");
  });

  it("[U200] resets the error count after a successful call", async () => {
    const { t, driver, validator } = await validating();
    validator.script("start", [err("x"), err("x"), err("x"), err("x"), ok(view()), err("x"), err("x"), err("x"), err("x")]);
    for (let i = 0; i < 9; i += 1) await driver.step("t1");
    expect(state(t)).toBe("validating");
  });

  it("[U206] counts an unreadable worktree path as a validator error", async () => {
    const { t, driver, validator } = await validating();
    t.bb.envPaths.clear();
    for (let i = 0; i < 5; i += 1) await driver.step("t1");
    expect(validator.calls).toEqual([]);
    expect(state(t)).toBe("needs_decision");
    expect(lastEvent(t).evidence).toMatch(/worktree/i);
  });
});

describe("ValidationDriver.step in needs_decision", () => {
  async function parked() {
    const ctx = await validating();
    ctx.validator.script("start", [ok(gateView("review-1"))]);
    await ctx.driver.step("t1");
    expect(state(ctx.t)).toBe("needs_decision");
    return ctx;
  }

  it("[U188] stays parked while the validator's view equals the view that parked the task", async () => {
    const { t, driver, validator } = await parked();
    validator.script("status", [ok(gateView("review-1"))]);
    for (let i = 0; i < 3; i += 1) expect(await driver.step("t1")).toBe("continue");
    expect(state(t)).toBe("needs_decision");
  });

  it("[U189] applies resolve when the view changed", async () => {
    const { t, driver, validator } = await parked();
    validator.script("status", [ok(gateView("review-1")), ok(gateView("review-2"))]);
    await driver.step("t1");
    await driver.step("t1");
    expect(state(t)).toBe("validating");
    expect(lastEvent(t)).toMatchObject({ event: "resolve", actor: "system" });
  });

  it("[U190] applies resolve when the run is running again", async () => {
    const { t, driver, validator } = await parked();
    validator.script("status", [ok(view())]);
    await driver.step("t1");
    expect(state(t)).toBe("validating");
  });

  it("[U191] keeps waiting when status fails", async () => {
    const { t, driver, validator } = await parked();
    validator.script("status", [err("daemon is restarting")]);
    for (let i = 0; i < 6; i += 1) expect(await driver.step("t1")).toBe("continue");
    expect(state(t)).toBe("needs_decision");
  });

  it("[U207] takes the first view after a restart as the baseline", async () => {
    const { t } = await parked();
    const restarted = driverFor(t, new FakeValidator());
    restarted.validator.script("status", [ok(gateView("review-1")), ok(gateView("review-1")), ok(gateView("review-3"))]);
    await restarted.driver.step("t1");
    await restarted.driver.step("t1");
    expect(state(t)).toBe("needs_decision");
    await restarted.driver.step("t1");
    expect(state(t)).toBe("validating");
  });

  it("[U192] answer calls the validator and then applies resolve with the caller's actor", async () => {
    const { t, driver, validator } = await parked();
    validator.script("answer", [ok(gateView("review-1"))]);
    validator.script("start", [ok(view())]);
    const result = await driver.answer("t1", { action: "fix", findingIds: ["review-1"], instructions: "Small fix." }, "user");
    expect(result).toEqual({ ok: true });
    expect(calls(validator, "answer")).toEqual([{ operation: "answer", input: { cwd: "/work/tree", response: { action: "fix", findingIds: ["review-1"], instructions: "Small fix." } } }]);
    expect(state(t)).toBe("validating");
    expect(lastEvent(t)).toMatchObject({ event: "resolve", actor: "user" });
  });

  it("[U193] applies no resolve when the answer fails, and refuses an answer outside needs_decision", async () => {
    const { t, driver, validator } = await parked();
    validator.script("answer", [err("run is not at a gate")]);
    const result = await driver.answer("t1", { action: "approve" }, "user");
    expect(result).toEqual({ ok: false, message: expect.stringContaining("run is not at a gate") });
    expect(state(t)).toBe("needs_decision");
    const working = await withDispatchedTask();
    const other = driverFor(working);
    expect((await other.driver.answer("t1", { action: "approve" }, "user")).ok).toBe(false);
  });
});

describe("ValidationDriver loops", () => {
  it("[U185] starts one loop for a validating task, and a second ensure starts none", async () => {
    const t = await withDispatchedTask();
    t.bb.envPaths.set("env-thr-w1", "/work/tree");
    await t.runtime.apply("t1", { type: "handoff", actor: "worker", evidence: "Committed." });
    const slow = testRuntimeWithSleep(t);
    const validator = new FakeValidator();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    validator.start = async (input) => {
      validator.calls.push({ operation: "start", input });
      await gate;
      return ok(done("failed", { error: "x" }));
    };
    const { driver } = driverFor(slow, validator);
    driver.ensure("t1");
    driver.ensure("t1");
    await settle(() => calls(validator, "start").length > 0);
    expect(calls(validator, "start")).toHaveLength(1);
    expect(driver.isRunning("t1")).toBe(true);
    release();
    await settle(() => !driver.isRunning("t1"));
    expect(calls(validator, "start")).toHaveLength(1);
    expect(state(slow)).toBe("failed");
  });

  it("[U194] never calls answer on its own while it follows a run through a gate", async () => {
    const t = await withDispatchedTask();
    t.bb.envPaths.set("env-thr-w1", "/work/tree");
    await t.runtime.apply("t1", { type: "handoff", actor: "worker", evidence: "Committed." });
    const slow = testRuntimeWithSleep(t);
    const { driver, validator } = driverFor(slow);
    validator.script("start", [ok(view()), ok(gateView("review-1"))]);
    validator.script("status", [ok(gateView("review-1"))]);
    driver.ensure("t1");
    await settle(() => calls(validator, "status").length >= 3);
    driver.dispose();
    expect(calls(validator, "status").length).toBeGreaterThanOrEqual(3);
    expect(calls(validator, "answer")).toEqual([]);
    expect(calls(validator, "cancel")).toEqual([]);
    expect(state(slow)).toBe("needs_decision");
  });

  it("[U201] keeps waiting through the injected sleep while the run is running", async () => {
    const t = await withDispatchedTask();
    t.bb.envPaths.set("env-thr-w1", "/work/tree");
    await t.runtime.apply("t1", { type: "handoff", actor: "worker", evidence: "Committed." });
    const slow = testRuntimeWithSleep(t);
    const { driver, validator } = driverFor(slow);
    validator.script("start", [ok(view()), ok(view()), ok(done("checks-passed", { prUrl: PR }))]);
    driver.ensure("t1");
    await settle(() => state(slow) === "review_ready");
    expect(state(slow)).toBe("review_ready");
    expect(calls(validator, "start")).toHaveLength(3);
    expect(slow.sleeps.length).toBeGreaterThanOrEqual(2);
  });

  it("[U202] resumeAll starts loops for validating and needs_decision tasks only", async () => {
    const t = await withDispatchedTask();
    t.bb.envPaths.set("env-thr-w1", "/work/tree");
    await t.runtime.apply("t1", { type: "handoff", actor: "worker", evidence: "Committed." });
    for (let n = 2; n <= 4; n += 1) {
      const made = await dispatch(t.runtime, SUPERVISOR, DISPATCH_ARGS);
      expect(made.ok).toBe(true);
    }
    t.bb.envPaths.set("env-thr-w2", "/work/tree2");
    t.bb.envPaths.set("env-thr-w3", "/work/tree3");
    await t.runtime.apply("t2", { type: "handoff", actor: "worker", evidence: "Committed." });
    await t.runtime.apply("t2", { type: "finding", actor: "system", evidence: "Gate." });
    await t.runtime.apply("t3", { type: "block", actor: "worker", evidence: "Waiting." });
    const slow = testRuntimeWithSleep(t);
    const { driver, validator } = driverFor(slow);
    validator.script("start", [ok(done("failed", { error: "x" }))]);
    validator.script("status", [ok(gateView("review-1"))]);
    driver.resumeAll();
    await settle(() => calls(validator, "start").length >= 1 && calls(validator, "status").length >= 1);
    driver.dispose();
    expect(calls(validator, "start").map((c) => (c.input as { cwd: string }).cwd)).toEqual(["/work/tree"]);
    expect(calls(validator, "status").map((c) => (c.input as { cwd: string }).cwd)).toContain("/work/tree2");
    expect(state(slow)).toBe("failed");
  });

  it("[U203] never starts a loop for a task in a delivery mode without the validator, while a no-mistakes task in the same runtime does", async () => {
    const t = await withDispatchedTask({ mode: "direct-PR" });
    t.bb.envPaths.set("env-thr-w1", "/work/direct");
    const { driver, validator } = driverFor(t);
    validator.script("start", [ok(done("checks-passed", { prUrl: PR }))]);
    await t.runtime.apply("t1", { type: "ready", actor: "worker", evidence: "PR open.", prUrl: PR });
    driver.ensure("t1");
    expect(driver.isRunning("t1")).toBe(false);

    // Positive control: a no-mistakes task handed off in the same runtime is followed.
    t.runtime.deps.store.putProjectConfig({ ...defaultProjectConfig("proj-1"), deliveryMode: "no-mistakes" });
    expect((await dispatch(t.runtime, SUPERVISOR, DISPATCH_ARGS)).ok).toBe(true);
    t.bb.envPaths.set("env-thr-w2", "/work/validated");
    await t.runtime.apply("t2", { type: "handoff", actor: "worker", evidence: "Committed." });
    driver.resumeAll();
    await settle(() => state2(t) === "review_ready");
    expect(state2(t)).toBe("review_ready");
    const cwds = calls(validator, "start").map((call) => (call.input as { cwd: string }).cwd);
    expect(cwds).toEqual(["/work/validated"]);
  });

  it("[U204] dispose stops every loop and cancels no run", async () => {
    const t = await withDispatchedTask();
    t.bb.envPaths.set("env-thr-w1", "/work/tree");
    await t.runtime.apply("t1", { type: "handoff", actor: "worker", evidence: "Committed." });
    const slow = testRuntimeWithSleep(t);
    const { driver, validator } = driverFor(slow);
    validator.script("start", [ok(view())]);
    driver.ensure("t1");
    await settle(() => calls(validator, "start").length >= 2);
    driver.dispose();
    await settle(() => !driver.isRunning("t1"));
    expect(driver.isRunning("t1")).toBe(false);
    const seen = validator.calls.length;
    driver.ensure("t1");
    expect(driver.isRunning("t1")).toBe(false);
    expect(validator.calls).toHaveLength(seen);
    expect(calls(validator, "cancel")).toEqual([]);
  });

  it("[U205] ends the loop when the task leaves its two states", async () => {
    const t = await withDispatchedTask();
    t.bb.envPaths.set("env-thr-w1", "/work/tree");
    await t.runtime.apply("t1", { type: "handoff", actor: "worker", evidence: "Committed." });
    const slow = testRuntimeWithSleep(t);
    const { driver, validator } = driverFor(slow);
    validator.script("start", [ok(view())]);
    driver.ensure("t1");
    await settle(() => calls(validator, "start").length >= 1);
    await t.runtime.apply("t1", { type: "fail", actor: "system", evidence: "Worker thread was deleted." });
    await settle(() => !driver.isRunning("t1"));
    expect(driver.isRunning("t1")).toBe(false);
  });

  it("[U836] passes the task's remote host to the validator, and none for a task on the clone host", async () => {
    const t = await withDispatchedTask();
    t.bb.machines.push({ id: "host_gpu", name: "gpu-box", status: "connected", phase: "active", online: true });
    t.bb.sources.push({ hostId: "host_gpu", path: "/work/gpu", isDefault: false });
    t.bb.envPaths.set("env-thr-w1", "/work/tree");
    t.bb.envPaths.set("env-thr-w2", "/work/gpu/tree");
    await t.runtime.apply("t1", { type: "handoff", actor: "worker", evidence: "Committed." });
    const remote = await dispatch(t.runtime, SUPERVISOR, { ...DISPATCH_ARGS, machine: "gpu-box" });
    expect(remote.ok).toBe(true);
    await t.runtime.apply("t2", { type: "handoff", actor: "worker", evidence: "Committed." });
    const { driver, validator } = driverFor(t);
    validator.script("start", [ok(view())]);
    await driver.step("t1");
    await driver.step("t2");
    const hosts = validator.calls.map((call) => (call.input as { host?: string | null }).host ?? null);
    expect(hosts).toEqual([null, "host_gpu"]);
  });
});

/** The same runtime with a sleep that yields a macrotask, so a loop cannot starve the test. */
function testRuntimeWithSleep(t: TestRuntime): TestRuntime {
  const sleeps: number[] = [];
  const runtime = Object.create(Object.getPrototypeOf(t.runtime)) as typeof t.runtime;
  Object.assign(runtime, t.runtime, { deps: { ...t.runtime.deps, sleep: async (ms: number) => { sleeps.push(ms); await slowSleep(); } } });
  return { ...t, runtime, sleeps };
}

