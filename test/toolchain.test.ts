import Database from "better-sqlite3";
import { createMachine } from "xstate";
import { describe, expect, it } from "vitest";
import { z } from "zod";

describe("toolchain", () => {
  it("resolves xstate and creates a machine", () => {
    const machine = createMachine({ id: "smoke", initial: "a", states: { a: {} } });
    expect(machine.id).toBe("smoke");
  });

  it("resolves zod and parses a value", () => {
    expect(z.string().min(1).parse("ok")).toBe("ok");
  });

  it("loads the better-sqlite3 native module and opens an in-memory database", () => {
    const db = new Database(":memory:");
    const row = db.prepare("select 1 as one").get() as { one: number };
    db.close();
    expect(row.one).toBe(1);
  });
});
