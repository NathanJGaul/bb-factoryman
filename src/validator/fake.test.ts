import { describe, expect, it } from "vitest";
import { FakeValidator } from "./fake";
import type { RunView, Validator } from "./types";

const view = (overrides: Partial<RunView> = {}): RunView => ({ runId: "r1", branch: "fm/t1", phase: "running", gate: null, outcome: null, prUrl: null, error: null, ...overrides });
const gate = { step: "review", status: "awaiting_approval", findings: [{ id: "review-1", severity: "error", file: "a.js", action: "auto-fix", description: "Bug." }] };

describe("FakeValidator", () => {
  it("[U161] offers the five operations and returns its scripted views in order", async () => {
    const fake = new FakeValidator();
    const validator: Validator = fake;
    for (const operation of ["start", "status", "findings", "answer", "cancel"] as const) expect(typeof validator[operation]).toBe("function");
    fake.script("start", [{ ok: true, value: view() }, { ok: true, value: view({ phase: "gate", gate }) }]);
    expect(await fake.start({ cwd: "/w", intent: "x" })).toEqual({ ok: true, value: view() });
    expect(await fake.start({ cwd: "/w", intent: "x" })).toEqual({ ok: true, value: view({ phase: "gate", gate }) });
  });

  it("[U162] records every call with its input", async () => {
    const fake = new FakeValidator();
    fake.script("start", [{ ok: true, value: view() }]);
    fake.script("status", [{ ok: true, value: view() }]);
    await fake.start({ cwd: "/w", intent: "do it", wait: "1m" });
    await fake.status({ cwd: "/w", runId: "r1" });
    expect(fake.calls).toEqual([
      { operation: "start", input: { cwd: "/w", intent: "do it", wait: "1m" } },
      { operation: "status", input: { cwd: "/w", runId: "r1" } },
    ]);
  });

  it("[U163] returns a scripted error as a result and repeats the last scripted result", async () => {
    const fake = new FakeValidator();
    fake.script("status", [{ ok: false, error: { kind: "command_failed", message: "no-mistakes is not installed" } }]);
    expect(await fake.status({ cwd: "/w" })).toEqual({ ok: false, error: { kind: "command_failed", message: "no-mistakes is not installed" } });
    expect(await fake.status({ cwd: "/w" })).toEqual({ ok: false, error: { kind: "command_failed", message: "no-mistakes is not installed" } });
    expect(await new FakeValidator().cancel({ cwd: "/w" })).toEqual({ ok: false, error: { kind: "no_run", message: "The fake has no scripted result for cancel." } });
  });
});
