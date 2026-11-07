import { describe, expect, it } from "vitest";
import { validEvent } from "../../test/fixtures/machine";
import { createEvent } from "../../test/fixtures/store";
import { testRuntime } from "../../test/fixtures/runtime";
import { wouldAccept } from "./preview";

async function awaitingApproval() {
  const t = testRuntime();
  t.runtime.log.create(createEvent({ taskId: "k1" }));
  for (const type of ["start", "handoff", "validated", "request_approval"] as const) {
    await t.runtime.apply("k1", validEvent(type));
  }
  return t;
}

describe("wouldAccept", () => {
  it("[U23] says ok for a legal event and writes no row", async () => {
    const t = await awaitingApproval();
    await t.runtime.apply("k1", validEvent("record_approval"));
    const before = t.runtime.deps.store.listEvents().length;
    const preview = wouldAccept(t.runtime.deps.store, "k1", validEvent("merge", { yolo: false }));
    expect(preview).toEqual({ ok: true, to: "merged" });
    expect(t.runtime.deps.store.listEvents().length).toBe(before);
    expect(t.runtime.deps.store.getTask("k1")?.state).toBe("awaiting_approval");
  });

  it("[U24] returns the machine's refusal for an illegal event and writes no row", async () => {
    const t = await awaitingApproval();
    const before = t.runtime.deps.store.listEvents().length;
    const preview = wouldAccept(t.runtime.deps.store, "k1", validEvent("merge", { yolo: false }));
    expect(preview.ok).toBe(false);
    expect(!preview.ok && preview.refusal.code).toBe("approval_required");
    expect(t.runtime.deps.store.listEvents().length).toBe(before);
  });

  it("[U25] refuses an unknown task", () => {
    const t = testRuntime();
    const preview = wouldAccept(t.runtime.deps.store, "nope", validEvent("merge", { yolo: true }));
    expect(preview.ok).toBe(false);
    expect(!preview.ok && preview.refusal.code).toBe("unknown_task");
  });
});
