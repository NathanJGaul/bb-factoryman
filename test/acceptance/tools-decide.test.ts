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
