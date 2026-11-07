import { describe, expect, it } from "vitest";
import { transition } from "../../src/machine/transition";
import { TABLES } from "../../src/machine/table";
import { EVENT_TYPES, snapshot, validEvent } from "../fixtures/machine";
import type { EventType, TaskKind, TaskState } from "../../src/machine/types";

describe("a task keeps its machine (hard rule 5)", () => {
  it("[A812] no event after start changes the task's machine, in either lane and any state", () => {
    let exercised = 0;
    for (const kind of ["ship", "scout"] as TaskKind[]) {
      const lane = TABLES[kind];
      for (const [state, row] of Object.entries(lane) as Array<[TaskState, Record<string, unknown>]>) {
        for (const type of Object.keys(row) as EventType[]) {
          if (type === "start") continue;
          const result = transition(
            snapshot(state, { kind, machine: "host_gpu", approvals: { merge: "approved", promote: "approved" } }),
            validEvent(type, { actor: type === "record_approval" ? "user" : "supervisor" }),
          );
          if (!result.ok) continue;
          exercised += 1;
          expect(result.snapshot.context.machine, `${kind} ${state} + ${type}`).toBe("host_gpu");
        }
      }
    }
    expect(exercised).toBeGreaterThanOrEqual(15);
    expect(EVENT_TYPES).toContain("start");
  });
});
