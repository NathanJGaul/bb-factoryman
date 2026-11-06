import { describe, expect, it } from "vitest";
import { transition } from "../../src/machine/transition";
import { EVENT_TYPES, snapshot, validEvent } from "../fixtures/machine";
import { LEGAL, modeFor, satisfied, STATES } from "../fixtures/legal-set";

describe("state and event matrix", () => {
  const pairs = (["ship", "scout"] as const).flatMap((kind) =>
    STATES.flatMap((state) => EVENT_TYPES.map((type) => ({ kind, state, type }))),
  );

  it("covers every kind, state, and event type once", () => {
    expect(pairs).toHaveLength(2 * 11 * 15);
  });

  it("has 33 legal pairs and 297 illegal pairs", () => {
    const legal = pairs.filter(({ kind, state, type }) => LEGAL[kind][state]?.[type] !== undefined);
    expect(legal).toHaveLength(33);
    expect(pairs.length - legal.length).toBe(297);
  });

  it("refuses every illegal pair with illegal_transition and leaves the snapshot unchanged", () => {
    const illegal = pairs.filter(({ kind, state, type }) => LEGAL[kind][state]?.[type] === undefined);
    for (const { kind, state, type } of illegal) {
      const before = snapshot(state, { kind, mode: modeFor(type) });
      const copy = structuredClone(before);
      const result = transition(before, validEvent(type));
      expect(result.ok, `${kind}/${state}/${type} should be refused`).toBe(false);
      if (!result.ok) {
        expect(result.refusal.code, `${kind}/${state}/${type}`).toBe("illegal_transition");
        expect(result.refusal.message.length).toBeGreaterThan(0);
      }
      expect(before, `${kind}/${state}/${type} must not mutate its input`).toEqual(copy);
    }
  });

  it("accepts every legal pair, with its gates satisfied, and lands on the expected state", () => {
    const legal = pairs.filter(({ kind, state, type }) => LEGAL[kind][state]?.[type] !== undefined);
    for (const { kind, state, type } of legal) {
      const { snapshot: before, event } = satisfied(kind, state, type);
      const result = transition(before, event);
      expect(result.ok, `${kind}/${state}/${type} should be accepted`).toBe(true);
      if (result.ok) {
        expect(result.snapshot.state, `${kind}/${state}/${type}`).toBe(LEGAL[kind][state]?.[type]);
        expect(result.from).toBe(state);
        expect(result.to).toBe(LEGAL[kind][state]?.[type]);
      }
    }
  });
});
