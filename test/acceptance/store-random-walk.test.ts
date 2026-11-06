import { describe, expect, it } from "vitest";
import { createMemoryStore } from "../../src/store/memory";
import { rebuildCache, replayTask } from "../../src/store/replay";
import { taskRowOf } from "../../src/store/rows";
import { openSqliteStore } from "../../src/store/sqlite";
import type { Store } from "../../src/store/store";
import { TaskLog } from "../../src/store/task-log";
import { DELIVERY_MODES, TASK_KINDS } from "../../src/machine/types";
import { LEGAL } from "../fixtures/legal-set";
import { EVENT_TYPES, validEvent } from "../fixtures/machine";
import { createEvent, fakeClock } from "../fixtures/store";

const SEQUENCES = 200;
const STEPS = 30;

/** A small seeded generator, so a failing sequence can be replayed from its seed. */
function mulberry32(seed: number): () => number {
  let a = seed + 0x6d2b79f5;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)] as T;
}

/** A valid event of `type`, with some fields bent so that gates refuse it about half the time they could. */
function randomEvent(type: (typeof EVENT_TYPES)[number], rng: () => number): Record<string, unknown> {
  const overrides: Record<string, unknown> = {};
  if (rng() < 0.08) overrides.actor = pick(rng, ["worker", "supervisor", "user", "system"]);
  if (rng() < 0.06) overrides.evidence = pick(rng, ["", "   "]);
  if (type === "start" && rng() < 0.15) overrides.profile = null;
  if (type === "ready") {
    if (rng() < 0.3) overrides.prUrl = undefined;
    if (rng() < 0.3) overrides.landedCommits = pick(rng, [0, 1, 4]);
  }
  if (type === "validated" && rng() < 0.2) overrides.pipelineFinished = false;
  if (type === "merge") overrides.yolo = rng() < 0.3;
  if (type === "record_approval") {
    if (rng() < 0.3) overrides.decision = "denied";
    if (rng() < 0.2) overrides.scope = pick(rng, ["merge", "promote"]);
    if (rng() < 0.85) overrides.actor = "user";
  }
  if (type === "teardown" && rng() < 0.3) {
    overrides.worktree = { uncommittedChanges: rng() < 0.5, unpushedCommits: pick(rng, [0, 0, 2]) };
  }
  return validEvent(type, overrides);
}

function runWalk(store: Store, seed: number): void {
  const rng = mulberry32(seed);
  const log = new TaskLog(store, { now: fakeClock() });
  const taskId = `walk-${seed}`;
  log.create(createEvent({ taskId, kind: pick(rng, TASK_KINDS), mode: pick(rng, DELIVERY_MODES) }));
  for (let step = 0; step < STEPS; step++) {
    const task = store.getTask(taskId);
    if (task === null) throw new Error("task vanished");
    const legal = Object.keys(LEGAL[task.kind][task.state] ?? {}) as Array<(typeof EVENT_TYPES)[number]>;
    // Mostly walk forward: `fail` is legal almost everywhere, so it gets a small share.
    const forward = legal.filter((t) => t !== "fail");
    const type =
      rng() < 0.85 && legal.length > 0
        ? rng() < 0.93 && forward.length > 0
          ? pick(rng, forward)
          : pick(rng, legal)
        : pick(rng, EVENT_TYPES);
    log.apply(taskId, randomEvent(type, rng));
    // After every step, the cache row must equal what the log replays to.
    const replayed = replayTask(store, taskId);
    if (!replayed.ok) throw new Error(`seed ${seed} step ${step}: replay failed (${replayed.reason})`);
    expect(store.getTask(taskId), `seed ${seed} step ${step}`).toEqual(taskRowOf(replayed.snapshot));
  }
}

describe.each([
  ["memory", () => createMemoryStore()],
  ["sqlite", () => openSqliteStore(":memory:")],
] as const)("seeded random walks on the %s store", (_name, make) => {
  it(`keep incremental task rows equal to rebuilt rows over ${SEQUENCES} sequences`, () => {
    const reached = new Set<string>();
    let applied = 0;
    let refused = 0;
    for (let seed = 0; seed < SEQUENCES; seed++) {
      const store = make();
      runWalk(store, seed);

      const incremental = store.listTasks();
      const replayed = replayTask(store, `walk-${seed}`);
      expect(replayed.ok, `seed ${seed} replays`).toBe(true);
      if (replayed.ok) expect(taskRowOf(replayed.snapshot), `seed ${seed} row`).toEqual(incremental[0]);

      store.clearTasks();
      const report = rebuildCache(store);
      expect(report.corrupt, `seed ${seed} corrupt`).toEqual([]);
      expect(store.listTasks(), `seed ${seed} rebuilt`).toEqual(incremental);

      for (const row of store.listEvents()) {
        if (row.outcome === "applied") {
          applied++;
          if (row.toState !== null) reached.add(row.toState);
        } else {
          refused++;
        }
      }
      store.close();
    }
    // The walk must be rich enough to mean something.
    expect(applied).toBeGreaterThan(1200);
    expect(refused).toBeGreaterThan(500);
    for (const state of ["working", "blocked", "validating", "needs_decision", "review_ready", "awaiting_approval", "merged", "report_ready", "torn_down", "failed"]) {
      expect(reached.has(state), `never reached ${state}`).toBe(true);
    }
    // 200 sequences of 30 steps with a replay after each step take several seconds on SQLite.
  }, 60_000);
});
