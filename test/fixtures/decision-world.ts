import { FakeValidator } from "../../src/validator/fake";
import { decisionKey } from "../../src/validator/key";
import type { Finding, Outcome, RunView } from "../../src/validator/types";
import { DISPATCH, loadWorld, settle, type World, type WorldOptions } from "./plugin-host";

/** Builders and a parked world for the tests of `factoryman_decide` and its form. */
export const PR = "https://github.com/acme/widgets/pull/7";
export const w1 = { threadId: "thr-w1" };
export const finding = (id: string): Finding => ({ id, severity: "error", file: "sum.js", action: id === "review-2" ? "ask-user" : "auto-fix", description: `Problem ${id}, with "quotes" and \`ticks\`.` });
export const view = (overrides: Partial<RunView> = {}): RunView => ({ runId: "r1", branch: "fm/t1", phase: "running", gate: null, outcome: null, prUrl: null, error: null, ...overrides });
export const gate = (status: string, ...ids: string[]): RunView => view({ phase: "gate", gate: { step: "review", status, findings: ids.map(finding) } });
export const finished = (outcome: Outcome, overrides: Partial<RunView> = {}): RunView => view({ phase: "finished", outcome, ...overrides });
export const ok = (value: RunView) => ({ ok: true as const, value });
export const err = (message: string) => ({ ok: false as const, error: { kind: "command_failed" as const, message } });

/** The gate that the tests park on: two findings, one of them `ask-user`. */
export const GATE = gate("awaiting_approval", "review-1", "review-2");
export const KEY = decisionKey(GATE);

const worlds: World[] = [];

/** Register a world that a test made itself, so `disposeWorlds` disposes it too. */
export function track(world: World): World {
  worlds.push(world);
  return world;
}

/** Dispose every world that this module made. Call it from `afterEach`. */
export async function disposeWorlds(): Promise<void> {
  for (const world of worlds.splice(0)) await world.host.harness.lifecycle.dispose();
}

/** A no-mistakes ship task that the real driver parks in needs_decision, on a validator that the caller supplies. */
export async function parkedOn(validator: FakeValidator, options: { yolo?: boolean; worldOptions?: WorldOptions } = {}): Promise<World> {
  const world = track(await loadWorld({ validator, ...options.worldOptions }));
  world.setProject({ deliveryMode: "no-mistakes", yolo: options.yolo ?? false });
  world.paths.set("env-thr-w1", "/work/tree");
  await world.call("factoryman_dispatch", DISPATCH);
  await world.call("factoryman_report", { outcome: "done", evidence: "Committed abc123." }, w1);
  await settle(() => world.store.getTask("t1")?.state === "needs_decision");
  if (world.store.getTask("t1")?.state !== "needs_decision") throw new Error("the task did not park in needs_decision");
  world.sent("thr-sup").length = 0;
  return world;
}

export interface Parked {
  world: World;
  validator: FakeValidator;
}

/** A parked world on `live` (the gate by default). The first `start` parks the task, and every later `start` reports a running pipeline. */
export async function parked(options: { live?: RunView; yolo?: boolean; worldOptions?: WorldOptions } = {}): Promise<Parked> {
  const live = options.live ?? GATE;
  const validator = new FakeValidator();
  validator.script("start", [ok(live), ok(view())]);
  validator.script("status", [ok(live)]);
  return { world: await parkedOn(validator, options), validator };
}
