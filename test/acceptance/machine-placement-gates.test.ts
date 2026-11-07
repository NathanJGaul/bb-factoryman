import { describe, expect, it } from "vitest";
import { TABLES } from "../../src/machine/table";
import { transition } from "../../src/machine/transition";
import type { EventType, TaskKind, TaskState } from "../../src/machine/types";
import { snapshot, validEvent } from "../fixtures/machine";

/** Every move in either lane except `start`, which is the one event that sets the machine. */
const ROWS: Array<[TaskKind, TaskState, EventType]> = (["ship", "scout"] as TaskKind[]).flatMap((kind) =>
  (Object.entries(TABLES[kind]) as Array<[TaskState, Record<string, unknown>]>).flatMap(([state, row]) =>
    (Object.keys(row) as EventType[]).filter((type) => type !== "start").map((type): [TaskKind, TaskState, EventType] => [kind, state, type]),
  ),
);

describe("a task keeps its machine (hard rule 5)", () => {
  it("[A812] covers every move of both lanes", () => {
    expect(ROWS.length).toBe(33);
  });

  it.each(ROWS)("[A812] %s task, %s + %s: the move is legal and the machine stays", (kind, state, type) => {
    // `ready` is the direct-PR move, and a scout takes a promote approval.
    const mode = type === "ready" ? ("direct-PR" as const) : ("no-mistakes" as const);
    const extra = type === "record_approval" && kind === "scout" ? { scope: "promote" } : {};
    const result = transition(
      snapshot(state, { kind, mode, machine: "host_gpu", approvals: { merge: "approved", promote: "approved" } }),
      validEvent(type, { actor: type === "record_approval" ? "user" : "supervisor", ...extra }),
    );
    expect(result.ok, `${kind} ${state} + ${type} must be exercised and not skipped`).toBe(true);
    if (result.ok) expect(result.snapshot.context.machine).toBe("host_gpu");
  });
});
