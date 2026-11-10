import { afterEach, describe, expect, it } from "vitest";
import { DECISION_RENDERER_ID, readDecisionPayload } from "../../src/approval/contract";
import type { ExecResult } from "../../src/exec";
import { FakeValidator } from "../../src/validator/fake";
import { decisionKey } from "../../src/validator/key";
import type { Finding, RunView } from "../../src/validator/types";
import { DISPATCH, loadWorld, nextForm, settle, type World, type WorldOptions } from "../fixtures/plugin-host";
import { recordedNoMistakes } from "../fixtures/recorded";

const w1 = { threadId: "thr-w1" };
const finding = (id: string): Finding => ({ id, severity: "error", file: "sum.js", action: id === "review-2" ? "ask-user" : "auto-fix", description: `Problem ${id}, with "quotes" and \`ticks\`.` });
const view = (overrides: Partial<RunView> = {}): RunView => ({ runId: "r1", branch: "fm/t1", phase: "running", gate: null, outcome: null, prUrl: null, error: null, ...overrides });
const gate = (status: string, ...ids: string[]): RunView => view({ phase: "gate", gate: { step: "review", status, findings: ids.map(finding) } });
const ok = (value: RunView) => ({ ok: true as const, value });
const err = (message: string) => ({ ok: false as const, error: { kind: "command_failed" as const, message } });

const GATE = gate("awaiting_approval", "review-1", "review-2");
const KEY = decisionKey(GATE);

const worlds: World[] = [];
afterEach(async () => {
  for (const world of worlds.splice(0)) await world.host.harness.lifecycle.dispose();
});

interface Parked {
  world: World;
  validator: FakeValidator;
}

/** A no-mistakes ship task that the real driver parked in needs_decision on `live`. */
async function parked(options: { live?: RunView; yolo?: boolean; worldOptions?: WorldOptions } = {}): Promise<Parked> {
  const live = options.live ?? GATE;
  const validator = new FakeValidator();
  // The first `start` parks the task. Every later `start` (after a resolve) reports a running pipeline.
  validator.script("start", [ok(live), ok(view())]);
  validator.script("status", [ok(live)]);
  const world = await loadWorld({ validator, ...options.worldOptions });
  worlds.push(world);
  world.setProject({ deliveryMode: "no-mistakes", yolo: options.yolo ?? false });
  world.paths.set("env-thr-w1", "/work/tree");
  await world.call("factoryman_dispatch", DISPATCH);
  await world.call("factoryman_report", { outcome: "done", evidence: "Committed abc123." }, w1);
  await settle(() => world.store.getTask("t1")?.state === "needs_decision");
  expect(world.store.getTask("t1")?.state).toBe("needs_decision");
  world.sent("thr-sup").length = 0;
  return { world, validator };
}

const state = (world: World) => world.store.getTask("t1")?.state;
const answers = (validator: FakeValidator) => validator.calls.filter((call) => call.operation === "answer");
const rows = (world: World) => world.store.listEvents({ taskId: "t1" });
const FIX = { taskId: "t1", key: KEY, action: "fix", findingIds: ["review-2"], instructions: "Use a parameterized query." } as const;

/** Call the tool, answer the form with `value`, and return the tool's result. */
async function decideWith(world: World, args: Record<string, unknown>, value: unknown) {
  const call = world.call("factoryman_decide", args);
  world.host.harness.behavior.submitInteraction(await nextForm(world), value as never);
  return call;
}

describe("the Decision key line", () => {
  it("[A1813] is in the evidence of the finding event that parks the task, and the wake message shows it", async () => {
    const validator = new FakeValidator();
    validator.script("start", [ok(GATE)]);
    validator.script("status", [ok(GATE)]);
    const world = await loadWorld({ validator });
    worlds.push(world);
    world.setProject({ deliveryMode: "no-mistakes" });
    world.paths.set("env-thr-w1", "/work/tree");
    await world.call("factoryman_dispatch", DISPATCH);
    world.sent("thr-sup").length = 0;
    await world.call("factoryman_report", { outcome: "done", evidence: "Committed abc123." }, w1);
    await settle(() => world.sent("thr-sup").length > 0);
    const park = rows(world).find((row) => row.event === "finding" && row.outcome === "applied");
    expect(park?.evidence?.split("\n").at(-1)).toBe(`Decision key: ${KEY}`);
    expect(world.sent("thr-sup")).toEqual([expect.stringContaining(`Decision key: ${KEY}`)]);
  });
});

describe("factoryman_decide through the plugin factory", () => {
  it("[A1801] opens one form, sends the fix answer only after the owner approves, and records resolve with the answer and the approval", async () => {
    const { world, validator } = await parked();
    validator.script("answer", [ok(view())]);
    const call = world.call("factoryman_decide", FIX);
    const formId = await nextForm(world);
    expect(answers(validator)).toEqual([]);
    const form = world.host.harness.inspection.pendingInteractions.find((pending) => pending.id === formId);
    expect(form?.rendererId).toBe(DECISION_RENDERER_ID);
    expect(readDecisionPayload(form?.payload)).toMatchObject({
      taskId: "t1",
      key: KEY,
      kind: "gate",
      step: "review",
      status: "awaiting_approval",
      findings: GATE.gate!.findings,
      answer: { action: "fix", findingIds: ["review-2"], instructions: "Use a parameterized query." },
    });
    expect(world.host.harness.inspection.pendingInteractions).toHaveLength(1);
    world.host.harness.behavior.submitInteraction(formId, { decision: "approved", comment: "Go ahead." });
    const result = await call;
    expect(result.isError, result.text).toBe(false);
    expect(answers(validator)).toEqual([{ operation: "answer", input: { cwd: "/work/tree", host: null, response: { action: "fix", findingIds: ["review-2"], instructions: "Use a parameterized query." } } }]);
    expect(state(world)).toBe("validating");
    const resolve = rows(world).findLast((row) => row.event === "resolve" && row.outcome === "applied");
    expect(resolve).toMatchObject({ actor: "supervisor" });
    expect(resolve?.evidence).toContain("answered the gate: fix review-2 (instructions: Use a parameterized query.)");
    expect(resolve?.evidence).toMatch(/owner approved this answer in the decision form/);
    expect(resolve?.evidence).toContain(KEY);
    expect(resolve?.evidence).toContain("Comment: Go ahead.");
  });

  it.each([
    ["approve", { action: "approve" }],
    ["skip", { action: "skip" }],
  ] as const)("[A1802] sends %s with that action and no finding IDs after the owner approves", async (_name, response) => {
    const { world, validator } = await parked();
    validator.script("answer", [ok(view())]);
    const result = await decideWith(world, { taskId: "t1", key: KEY, action: response.action }, { decision: "approved" });
    expect(result.isError, result.text).toBe(false);
    expect(answers(validator)).toEqual([{ operation: "answer", input: { cwd: "/work/tree", host: null, response } }]);
    expect(state(world)).toBe("validating");
  });

  it("[A1803] leaves the task in needs_decision, records no resolve, and gives the reason when the validator rejects an approved answer", async () => {
    const { world, validator } = await parked();
    validator.script("answer", [err("run is not at a gate")]);
    const before = rows(world).length;
    const result = await decideWith(world, FIX, { decision: "approved" });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("run is not at a gate");
    expect(state(world)).toBe("needs_decision");
    expect(rows(world).slice(before).map((row) => row.event)).toEqual([]);
  });
});

describe("factoryman_decide over the real no-mistakes adapter", () => {
  /** The plugin's own adapter, with the recorded gate output behind a recording command runner. */
  async function realParked(): Promise<{ world: World; lines: string[] }> {
    const lines: string[] = [];
    const gateOutput = recordedNoMistakes("gate-review.toon");
    const world = await loadWorld({
      exec: (command, args) => {
        if (command !== "no-mistakes") return undefined;
        lines.push([command, ...args].join(" "));
        const verb = args[1];
        const stdout = verb === "respond" ? recordedNoMistakes("gate-fix-review.toon") : gateOutput;
        return Promise.resolve<ExecResult>({ code: 0, stdout, stderr: "" });
      },
    });
    worlds.push(world);
    world.setProject({ deliveryMode: "no-mistakes" });
    world.paths.set("env-thr-w1", "/work/tree");
    await world.call("factoryman_dispatch", DISPATCH);
    await world.call("factoryman_report", { outcome: "done", evidence: "Committed abc123." }, w1);
    await settle(() => world.store.getTask("t1")?.state === "needs_decision");
    return { world, lines };
  }

  it("[A1804] runs axi respond with the action, the finding IDs, and the instructions, and no command of the run holds --yes or -y", async () => {
    const { world, lines } = await realParked();
    const park = rows(world).find((row) => row.event === "finding" && row.outcome === "applied");
    const key = /Decision key: (\S+)$/.exec(park?.evidence ?? "")?.[1] ?? "";
    expect(key).toMatch(/^nm-01M6SKG1YZY54AJVFKK02MVXWH-review-[0-9a-f]{8}$/);
    const result = await decideWith(world, { taskId: "t1", key, action: "fix", findingIds: ["review-2"], instructions: "Use a parameterized query." }, { decision: "approved" });
    expect(result.isError, result.text).toBe(false);
    const respond = lines.filter((line) => line.includes(" respond "));
    expect(respond).toEqual(["no-mistakes axi respond --action fix --findings review-2 --instructions Use a parameterized query. --wait 4m"]);
    for (const line of lines) expect(line.split(" ")).not.toEqual(expect.arrayContaining(["--yes"]));
    for (const line of lines) expect(line.split(" ")).not.toContain("-y");
  });
});

describe("factoryman_decide refuses before it opens a form", () => {
  /** Every refusal leaves the validator without an answer, opens no form, and changes neither the state nor the log. */
  async function refused(world: World, validator: FakeValidator, args: unknown, caller?: { threadId: string; projectId?: string }, expected?: RegExp) {
    const before = rows(world).length;
    const stateBefore = state(world);
    const result = await world.call("factoryman_decide", args, caller);
    expect(result.isError, result.text).toBe(true);
    if (expected !== undefined) expect(result.text).toMatch(expected);
    expect(answers(validator)).toEqual([]);
    expect(world.host.harness.inspection.pendingInteractions).toEqual([]);
    expect(state(world)).toBe(stateBefore);
    expect(rows(world)).toHaveLength(before);
    return result;
  }

  it.each([
    ["an unknown action", { taskId: "t1", key: KEY, action: "maybe" }, /invalid_event/],
    ["an unknown argument", { taskId: "t1", key: KEY, action: "approve", yes: true }, /invalid_event/],
    ["a missing key", { taskId: "t1", action: "approve" }, /invalid_event/],
    ["a key that does not match the live gate", { taskId: "t1", key: "nm-r1-review-00000000", action: "approve" }, new RegExp(`live key is ${KEY}.*review-1, review-2`)],
    ["a fix that names a finding that is not in the gate", { taskId: "t1", key: KEY, action: "fix", findingIds: ["review-9"] }, /review-9.*not in the gate/],
    ["a fix with no finding IDs", { taskId: "t1", key: KEY, action: "fix" }, /at least one finding ID/],
    ["a fix with a duplicate ID", { taskId: "t1", key: KEY, action: "fix", findingIds: ["review-1", "review-1"] }, /twice/],
    ["instructions with approve", { taskId: "t1", key: KEY, action: "approve", instructions: "text" }, /approve takes no finding IDs and no instructions/],
    ["instructions with skip", { taskId: "t1", key: KEY, action: "skip", instructions: "text" }, /skip takes no finding IDs and no instructions/],
    ["a rerun on a gate", { taskId: "t1", key: KEY, action: "rerun" }, /rerun is for a run that finished/],
    ["an unknown task", { taskId: "t9", key: KEY, action: "approve" }, /No task t9 exists/],
  ])("[A1805] refuses %s", async (_name, args, expected) => {
    const { world, validator } = await parked();
    await refused(world, validator, args, undefined, expected);
  });

  it("[A1805] refuses a worker caller as actor_forbidden", async () => {
    const { world, validator } = await parked();
    await refused(world, validator, { taskId: "t1", key: KEY, action: "approve" }, w1, /actor_forbidden/);
  });

  it("[A1805] refuses a task of another project", async () => {
    const { world, validator } = await parked();
    await refused(world, validator, { taskId: "t1", key: KEY, action: "approve" }, { threadId: "thr-sup", projectId: "proj-other" }, /No task t1 exists in this project/);
  });

  it("[A1805] refuses a task that is not in needs_decision, and a scout task", async () => {
    const working = await loadWorld({ validator: new FakeValidator() });
    worlds.push(working);
    working.setProject({ deliveryMode: "no-mistakes" });
    await working.call("factoryman_dispatch", DISPATCH);
    await refused(working, new FakeValidator(), { taskId: "t1", key: KEY, action: "approve" }, undefined, /illegal_transition.*working.*needs_decision/);

    const scout = await loadWorld({ validator: new FakeValidator() });
    worlds.push(scout);
    await scout.call("factoryman_dispatch", { ...DISPATCH, kind: "scout" });
    await refused(scout, new FakeValidator(), { taskId: "t1", key: KEY, action: "approve" }, undefined, /illegal_transition.*ship task/);
  });

  it("[A1806] opens the form under yolo, and sends the answer only after the owner approves", async () => {
    const { world, validator } = await parked({ yolo: true });
    validator.script("answer", [ok(view())]);
    const call = world.call("factoryman_decide", { taskId: "t1", key: KEY, action: "approve" });
    const formId = await nextForm(world);
    expect(answers(validator)).toEqual([]);
    expect(state(world)).toBe("needs_decision");
    world.host.harness.behavior.submitInteraction(formId, { decision: "approved" });
    expect((await call).isError).toBe(false);
    expect(answers(validator)).toHaveLength(1);
  });

  it("[A1806] sends nothing under yolo when the owner denies", async () => {
    const { world, validator } = await parked({ yolo: true });
    const result = await decideWith(world, { taskId: "t1", key: KEY, action: "skip" }, { decision: "denied" });
    expect(result.isError).toBe(true);
    expect(answers(validator)).toEqual([]);
  });
});

describe("factoryman_decide when the form does not approve", () => {
  it.each([
    ["a denial", { decision: "denied", comment: "Not yet." }, /owner denied the answer: Not yet\./],
    ["an approval with an extra field", { decision: "approved", extra: 1 }, /unreadable/],
    ["the word yes", { decision: "yes" }, /unreadable/],
    ["a bare string", "approved", /unreadable/],
    ["null", null, /unreadable/],
  ])("[A1807] sends nothing and changes nothing for %s", async (_name, value, expected) => {
    const { world, validator } = await parked();
    const before = rows(world).length;
    const result = await decideWith(world, FIX, value);
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(expected);
    expect(answers(validator)).toEqual([]);
    expect(state(world)).toBe("needs_decision");
    expect(rows(world)).toHaveLength(before);
  });

  it("[A1807] sends nothing and changes nothing for a cancelled form and for a timed-out form", async () => {
    const cancelled = await parked();
    const call = cancelled.world.call("factoryman_decide", FIX);
    cancelled.world.host.harness.behavior.cancelInteraction(await nextForm(cancelled.world));
    const result = await call;
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/did not answer the decision form/);
    expect(answers(cancelled.validator)).toEqual([]);

    const timedOut = await parked({ worldOptions: { settings: { approvalTimeoutMinutes: 0.0005 } } });
    const before = rows(timedOut.world).length;
    const late = await timedOut.world.call("factoryman_decide", FIX);
    expect(late.isError).toBe(true);
    expect(late.text).toContain("timeout");
    expect(answers(timedOut.validator)).toEqual([]);
    expect(state(timedOut.world)).toBe("needs_decision");
    expect(rows(timedOut.world)).toHaveLength(before);
  });
});

describe("factoryman_decide when the gate moves or cannot be read", () => {
  /** A validator whose status the test can change, so the polling loop and the tool both read the current view. */
  function movable(initial: RunView) {
    const fake = new FakeValidator();
    const box = { view: initial, failStatus: false };
    fake.script("start", [ok(initial), ok(view())]);
    fake.status = async (input) => {
      fake.calls.push({ operation: "status", input });
      return box.failStatus ? err("daemon is restarting") : ok(box.view);
    };
    return { fake, box };
  }

  async function parkedOn(validator: FakeValidator) {
    const world = await loadWorld({ validator });
    worlds.push(world);
    world.setProject({ deliveryMode: "no-mistakes" });
    world.paths.set("env-thr-w1", "/work/tree");
    await world.call("factoryman_dispatch", DISPATCH);
    await world.call("factoryman_report", { outcome: "done", evidence: "Committed abc123." }, w1);
    await settle(() => world.store.getTask("t1")?.state === "needs_decision");
    return world;
  }

  it("[A1808] sends nothing when the gate has another key after the owner approves", async () => {
    const { fake, box } = movable(GATE);
    const world = await parkedOn(fake);
    const call = world.call("factoryman_decide", { taskId: "t1", key: KEY, action: "approve" });
    const formId = await nextForm(world);
    // A fix round in no-mistakes dropped a finding: same run, same step, new status and findings.
    box.view = gate("fix_review", "review-2");
    world.host.harness.behavior.submitInteraction(formId, { decision: "approved" });
    const result = await call;
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/gate changed while the form was open.*Nothing was sent/);
    expect(answers(fake)).toEqual([]);
  });

  it("[A1808] sends nothing when the task has left needs_decision while the form was open", async () => {
    const { fake, box } = movable(GATE);
    const world = await parkedOn(fake);
    const call = world.call("factoryman_decide", { taskId: "t1", key: KEY, action: "approve" });
    const formId = await nextForm(world);
    // A person answered in no-mistakes: the pipeline runs again, and the driver resolves the task by itself.
    box.view = view();
    await settle(() => state(world) === "validating");
    expect(state(world)).toBe("validating");
    world.host.harness.behavior.submitInteraction(formId, { decision: "approved" });
    const result = await call;
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/gate changed while the form was open.*Nothing was sent/);
    expect(answers(fake)).toEqual([]);
  });

  it("[A1809] refuses a second call for a task whose form is open, opens no second form, and opens a new one after the first closes", async () => {
    const { world, validator } = await parked();
    validator.script("answer", [ok(view())]);
    const first = world.call("factoryman_decide", { taskId: "t1", key: KEY, action: "approve" });
    const formId = await nextForm(world);
    const second = await world.call("factoryman_decide", { taskId: "t1", key: KEY, action: "approve" });
    expect(second.isError).toBe(true);
    expect(second.text).toMatch(/already waiting for the owner/);
    expect(world.host.harness.inspection.pendingInteractions).toHaveLength(1);
    world.host.harness.behavior.cancelInteraction(formId);
    expect((await first).isError).toBe(true);
    const third = world.call("factoryman_decide", { taskId: "t1", key: KEY, action: "approve" });
    world.host.harness.behavior.submitInteraction(await nextForm(world), { decision: "approved" });
    expect((await third).isError).toBe(false);
  });

  it("[A1810] fails closed with no form and no answer when the validator cannot report the gate", async () => {
    const { fake, box } = movable(GATE);
    const world = await parkedOn(fake);
    box.failStatus = true;
    const result = await world.call("factoryman_decide", { taskId: "t1", key: KEY, action: "approve" });
    expect(result.isError).toBe(true);
    expect(result.text).toMatch(/live state cannot be read.*daemon is restarting.*Nothing was sent/);
    expect(world.host.harness.inspection.pendingInteractions).toEqual([]);
    expect(answers(fake)).toEqual([]);
    expect(state(world)).toBe("needs_decision");
  });
});
