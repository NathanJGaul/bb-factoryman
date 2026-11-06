import { getNextSnapshot } from "xstate";
import { describe, expect, it } from "vitest";
import { EVENT_TYPES, parsedEvent, snapshot, validEvent } from "../../test/fixtures/machine";
import { GUARDS_OF, LEGAL, modeFor, satisfied } from "../../test/fixtures/legal-set";
import { GUARD_NAMES } from "./guards";
import { MACHINES } from "./machines";
import { TABLES } from "./table";
import type { TaskKind, TaskState } from "./types";

const KINDS = ["ship", "scout"] as const;

/** Reduce a lane to `{ state: { event: value } }`, dropping states with no rows. */
function project<T, V>(lane: Partial<Record<string, Partial<Record<string, T>>>>, pick: (row: T) => V) {
  return Object.fromEntries(
    Object.entries(lane)
      .map(([state, rows]) => [state, Object.fromEntries(Object.entries(rows ?? {}).map(([event, row]) => [event, pick(row as T)]))] as const)
      .filter(([, rows]) => Object.keys(rows).length > 0),
  );
}

describe("transition tables", () => {
  it.each(KINDS)("lists exactly the legal pairs and targets for %s tasks", (kind) => {
    expect(project(TABLES[kind], (row) => row.target)).toEqual(LEGAL[kind]);
  });

  it.each(KINDS)("lists each %s row's guards in the documented order, and every guard exists", (kind) => {
    expect(project(TABLES[kind], (row) => row.guards)).toEqual(GUARDS_OF[kind]);
    for (const rows of Object.values(TABLES[kind])) {
      for (const row of Object.values(rows ?? {})) {
        for (const guard of row.guards) expect(GUARD_NAMES).toContain(guard);
      }
    }
  });
});

describe("xstate machines", () => {
  const SHIP_STATES: TaskState[] = [
    "queued", "working", "blocked", "validating", "needs_decision", "review_ready", "awaiting_approval", "merged", "torn_down", "failed",
  ];
  const SCOUT_STATES: TaskState[] = ["queued", "working", "blocked", "report_ready", "torn_down", "failed"];

  it("gives the ship machine exactly the ship states", () => {
    expect(Object.keys(MACHINES.ship.config.states ?? {}).sort()).toEqual([...SHIP_STATES].sort());
  });

  it("gives the scout machine exactly the scout states", () => {
    expect(Object.keys(MACHINES.scout.config.states ?? {}).sort()).toEqual([...SCOUT_STATES].sort());
  });

  it.each(KINDS)("accepts exactly the table's transitions in the %s machine", (kind: TaskKind) => {
    const machine = MACHINES[kind];
    const states = Object.keys(machine.config.states ?? {}) as TaskState[];
    for (const state of states) {
      for (const type of EVENT_TYPES) {
        const target = LEGAL[kind][state]?.[type];
        if (target !== undefined) {
          const { snapshot: before, event } = satisfied(kind, state, type);
          const from = machine.resolveState({ value: state, context: before.context });
          const parsed = parsedEvent(type, event);
          expect(from.can(parsed), `${kind}/${state}/${type} should be possible`).toBe(true);
          expect(getNextSnapshot(machine, from, parsed).value, `${kind}/${state}/${type}`).toBe(target);
        } else {
          // A guard could also make `can()` false, so check the machine's configured events too:
          // an extra row must fail here even when a guard would have refused it.
          const configured = Object.keys((machine.config.states?.[state] as { on?: object } | undefined)?.on ?? {});
          expect(configured, `${kind}/${state} must not configure ${type}`).not.toContain(type);
          const before = snapshot(state, { kind, mode: modeFor(type) });
          const from = machine.resolveState({ value: state, context: before.context });
          expect(from.can(parsedEvent(type, validEvent(type))), `${kind}/${state}/${type} should be impossible`).toBe(false);
        }
      }
    }
  });
});
