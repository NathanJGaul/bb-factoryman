import { describe, expect, it } from "vitest";
import { context, parsedEvent } from "../../test/fixtures/machine";
import { GUARDS } from "./guards";

describe("evidenceProvided", () => {
  it.each(["", "   ", "\n\t", undefined])("refuses evidence %j", (evidence) => {
    const refusal = GUARDS.evidenceProvided(context(), parsedEvent("fail", { evidence }));
    expect(refusal?.code).toBe("evidence_required");
    expect(refusal?.message.length).toBeGreaterThan(0);
  });

  it.each(["x", "  x  ", "tests pass; pull request open"])("accepts evidence %j", (evidence) => {
    expect(GUARDS.evidenceProvided(context(), parsedEvent("fail", { evidence }))).toBeNull();
  });
});

describe("profileResolved", () => {
  it.each([null, undefined])("refuses a start event with profile %j", (profile) => {
    expect(GUARDS.profileResolved(context(), parsedEvent("start", { profile }))?.code).toBe("profile_required");
  });

  it("accepts a start event with a complete profile", () => {
    expect(GUARDS.profileResolved(context(), parsedEvent("start"))).toBeNull();
  });
});

describe("notWorker and ownerOnly", () => {
  it("notWorker refuses only the worker actor", () => {
    expect(GUARDS.notWorker(context(), parsedEvent("merge", { actor: "worker" }))?.code).toBe("actor_forbidden");
    for (const actor of ["supervisor", "user", "system"]) {
      expect(GUARDS.notWorker(context(), parsedEvent("merge", { actor }))).toBeNull();
    }
  });

  it("ownerOnly accepts only the user actor", () => {
    expect(GUARDS.ownerOnly(context(), parsedEvent("record_approval", { actor: "user" }))).toBeNull();
    for (const actor of ["worker", "supervisor", "system"]) {
      expect(GUARDS.ownerOnly(context(), parsedEvent("record_approval", { actor }))?.code).toBe("actor_forbidden");
    }
  });
});
