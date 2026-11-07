import { describe, expect, it } from "vitest";
import { withDispatchedTask } from "../../test/fixtures/runtime";
import { runFactorymanCommand } from "./supervisor-command";

describe("bb factoryman supervisor", () => {
  it("[U117] stamps the supervisor role on a thread and prints a confirmation", async () => {
    const t = await withDispatchedTask();
    const result = await runFactorymanCommand(t.runtime, ["supervisor", "thr-new"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("thr-new");
    expect(t.bb.callsTo("setThreadMetadata")).toEqual([["thr-new", { role: "supervisor" }]]);
  });

  it("[U118] refuses a recorded worker thread and stamps nothing", async () => {
    const t = await withDispatchedTask();
    const result = await runFactorymanCommand(t.runtime, ["supervisor", "thr-w1"]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toMatch(/worker/i);
    expect(t.bb.callsTo("setThreadMetadata")).toEqual([]);
  });

  it("[U119] prints usage and exits non-zero without a thread ID or with an unknown command", async () => {
    const t = await withDispatchedTask();
    for (const argv of [["supervisor"], [], ["nope"]]) {
      const result = await runFactorymanCommand(t.runtime, argv);
      expect(result.exitCode, argv.join(" ")).not.toBe(0);
      expect(result.stderr).toContain("Usage: bb factoryman supervisor <thread-id>");
    }
    expect(t.bb.callsTo("setThreadMetadata")).toEqual([]);
  });
});
