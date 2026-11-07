import { describe, expect, it } from "vitest";
import { recordedNoMistakes } from "../../test/fixtures/recorded";
import type { Exec, ExecResult } from "../exec";
import { NoMistakesValidator } from "./no-mistakes";
import type { Answer } from "./types";

function harness(result: Partial<ExecResult> = {}) {
  const calls: Array<{ command: string; args: readonly string[]; cwd?: string }> = [];
  let next: Partial<ExecResult> = result;
  const exec: Exec = async (command, args, options) => {
    calls.push({ command, args, cwd: options?.cwd });
    return { code: 0, stdout: "", stderr: "", ...next };
  };
  return { validator: new NoMistakesValidator(exec, { wait: "4m" }), calls, reply: (r: Partial<ExecResult>) => void (next = r) };
}

const gate = () => ({ stdout: recordedNoMistakes("gate-review.toon") });

describe("NoMistakesValidator", () => {
  it("[U176] runs `no-mistakes axi run --intent <intent> --wait <wait>` in the given cwd and returns the decoded run", async () => {
    const { validator, calls } = harness(gate());
    const result = await validator.start({ cwd: "/work/tree", intent: "Add a --json flag." });
    expect(calls).toEqual([{ command: "no-mistakes", args: ["axi", "run", "--intent", "Add a --json flag.", "--wait", "4m"], cwd: "/work/tree" }]);
    expect(result).toMatchObject({ ok: true, value: { phase: "gate", runId: "01M6SKG1YZY54AJVFKK02MVXWH" } });
    await validator.start({ cwd: "/work/tree", intent: "x", wait: "30s" });
    expect(calls[1]?.args.slice(-2)).toEqual(["--wait", "30s"]);
  });

  it("[U177] runs `axi status` and adds `--run <id>` when given a run ID", async () => {
    const { validator, calls } = harness(gate());
    await validator.status({ cwd: "/w" });
    await validator.status({ cwd: "/w", runId: "r1" });
    expect(calls.map((call) => call.args)).toEqual([["axi", "status"], ["axi", "status", "--run", "r1"]]);
  });

  it("[U178] returns the gate's findings, and an empty list when there is no gate", async () => {
    const { validator, reply } = harness(gate());
    const found = await validator.findings({ cwd: "/w" });
    expect(found.ok && found.value.map((f) => f.id)).toEqual(["review-1", "review-2"]);
    reply({ stdout: recordedNoMistakes("status-cancelled.toon") });
    expect(await validator.findings({ cwd: "/w" })).toEqual({ ok: true, value: [] });
  });

  it("[U179] maps approve, skip, and fix with finding IDs and instructions to `axi respond` flags", async () => {
    const { validator, calls } = harness(gate());
    await validator.answer({ cwd: "/w", response: { action: "approve" } });
    await validator.answer({ cwd: "/w", response: { action: "skip" } });
    await validator.answer({ cwd: "/w", response: { action: "fix", findingIds: ["review-1", "review-2"], instructions: "Keep it small." } });
    await validator.answer({ cwd: "/w", response: { action: "fix", findingIds: ["review-1"] } });
    expect(calls.map((call) => call.args)).toEqual([
      ["axi", "respond", "--action", "approve", "--wait", "4m"],
      ["axi", "respond", "--action", "skip", "--wait", "4m"],
      ["axi", "respond", "--action", "fix", "--findings", "review-1,review-2", "--instructions", "Keep it small.", "--wait", "4m"],
      ["axi", "respond", "--action", "fix", "--findings", "review-1", "--wait", "4m"],
    ]);
  });

  it("[U180] never passes --yes or -y in any operation", async () => {
    const { validator, calls, reply } = harness(gate());
    await validator.start({ cwd: "/w", intent: "i" });
    await validator.status({ cwd: "/w", runId: "r" });
    await validator.findings({ cwd: "/w" });
    const responses: Answer[] = [{ action: "approve" }, { action: "skip" }, { action: "fix", findingIds: ["a"], instructions: "x" }];
    for (const response of responses) await validator.answer({ cwd: "/w", response });
    reply({ stdout: recordedNoMistakes("abort.toon") });
    await validator.cancel({ cwd: "/w", runId: "r" });
    expect(calls.length).toBeGreaterThan(6);
    for (const call of calls) {
      expect(call.command).toBe("no-mistakes");
      expect(call.args).not.toContain("--yes");
      expect(call.args).not.toContain("-y");
    }
  });

  it("[U181] runs `axi abort`, with `--run <id>` when given, and reads the abort result", async () => {
    const { validator, calls } = harness({ stdout: recordedNoMistakes("abort.toon") });
    expect(await validator.cancel({ cwd: "/w" })).toEqual({ ok: true, value: undefined });
    await validator.cancel({ cwd: "/w", runId: "r1" });
    expect(calls.map((call) => call.args)).toEqual([["axi", "abort"], ["axi", "abort", "--run", "r1"]]);
  });

  it("[U182] decodes standard output only and ignores banner text on standard error", async () => {
    const banner = 'A new version of no-mistakes is available: v1.84.0 -> v1.106.1\nRun "no-mistakes update"';
    const onlyStdout = harness({ ...gate(), stderr: banner });
    expect((await onlyStdout.validator.status({ cwd: "/w" })).ok).toBe(true);
    const onlyStderr = harness({ stdout: "", stderr: recordedNoMistakes("gate-review.toon") });
    const result = await onlyStderr.validator.status({ cwd: "/w" });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.kind).toBe("unreadable");
  });

  it("[U183] decodes a failed outcome printed with exit code 1 as a finished run, and exit code 2 as a command failure", async () => {
    const failed = harness({ code: 1, stdout: recordedNoMistakes("status-cancelled.toon").replace("outcome: cancelled", "outcome: failed") });
    expect(await failed.validator.status({ cwd: "/w" })).toMatchObject({ ok: true, value: { phase: "finished", outcome: "failed" } });
    const usage = harness({ code: 2, stdout: "", stderr: "unknown flag: --nope" });
    const result = await usage.validator.start({ cwd: "/w", intent: "x" });
    expect(result).toEqual({ ok: false, error: { kind: "command_failed", message: expect.stringContaining("unknown flag: --nope") } });
  });

  it("[U184] reports a missing binary as a command failure", async () => {
    const { validator } = harness({ code: null, error: "spawn no-mistakes ENOENT" });
    const result = await validator.status({ cwd: "/w" });
    expect(result).toEqual({ ok: false, error: { kind: "command_failed", message: expect.stringContaining("spawn no-mistakes ENOENT") } });
  });

  it("[U835] passes the host option to every no-mistakes command", async () => {
    const hosts: Array<string | null | undefined> = [];
    const exec: Exec = async (_command, _args, options) => {
      hosts.push(options?.host);
      return { code: 0, stdout: recordedNoMistakes("gate-review.toon"), stderr: "" };
    };
    const validator = new NoMistakesValidator(exec, { wait: "4m" });
    const host = "host_gpu";
    await validator.start({ cwd: "/w", intent: "x", host });
    await validator.status({ cwd: "/w", host });
    await validator.findings({ cwd: "/w", host });
    await validator.answer({ cwd: "/w", response: { action: "approve" }, host });
    await validator.cancel({ cwd: "/w", host });
    expect(hosts).toEqual([host, host, host, host, host]);
    hosts.length = 0;
    await validator.status({ cwd: "/w" });
    expect(hosts[0] ?? null).toBeNull();
  });
});
