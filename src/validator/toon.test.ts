import { describe, expect, it } from "vitest";
import { recordedNoMistakes } from "../../test/fixtures/recorded";
import { parseAbort, parseRun } from "./toon";

describe("parseRun on recorded no-mistakes output", () => {
  it("[U164] decodes the review gate into step, status, and two findings with their five fields", () => {
    const result = parseRun(recordedNoMistakes("gate-review.toon"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ runId: "01M6SKG1YZY54AJVFKK02MVXWH", phase: "gate", outcome: null, error: null, prUrl: null });
    expect(result.value.gate?.step).toBe("review");
    expect(result.value.gate?.status).toBe("awaiting_approval");
    expect(result.value.gate?.findings).toHaveLength(2);
    expect(result.value.gate?.findings[0]).toEqual({
      id: "review-1",
      severity: "error",
      file: "sum.js",
      action: "auto-fix",
      description: "Off-by-one in loop: `i <= values.length` reads values[values.length] which is undefined, so total becomes NaN for every input (sum([1,2,3]) returns NaN; sum([]) returns NaN). Fix: use `i < values.length`.",
    });
    expect(result.value.gate?.findings[1]?.description).toContain("`' OR '1'='1`");
  });

  it("[U165] decodes the fix-review gate as one finding in phase gate", () => {
    const result = parseRun(recordedNoMistakes("gate-fix-review.toon"));
    expect(result.ok && result.value.phase).toBe("gate");
    expect(result.ok && result.value.gate?.status).toBe("fix_review");
    expect(result.ok && result.value.gate?.findings.map((f) => f.id)).toEqual(["review-2"]);
  });

  it("[U166] decodes the cancelled status as finished with the outcome, the error, and the run ID", () => {
    const result = parseRun(recordedNoMistakes("status-cancelled.toon"));
    expect(result).toMatchObject({ ok: true, value: { runId: "01M6SKG1YZY54AJVFKK02MVXWH", phase: "finished", outcome: "cancelled", error: "cancelled: aborted by user", gate: null } });
  });

  it("[U167] decodes a run under other_branch_run with its pull request URL and outcome", () => {
    const result = parseRun(recordedNoMistakes("status-pr-opened-ci-cancelled.toon"));
    expect(result).toMatchObject({ ok: true, value: { runId: "01M6RB7JXA4SDHNQDR11DKA39W", branch: "fm/bb-factoryman-milestones-1-3", prUrl: "https://github.com/NathanJGaul/bb-factoryman/pull/1", outcome: "cancelled", phase: "finished" } });
  });

  it("[U168] decodes the abort output as an abort result and refuses it as a run", () => {
    const abort = recordedNoMistakes("abort.toon");
    expect(parseAbort(abort)).toEqual({ ok: true, value: undefined });
    expect(parseRun(abort).ok).toBe(false);
    expect(parseAbort(recordedNoMistakes("gate-review.toon")).ok).toBe(false);
  });

  it("[U169] decodes the error output as a command failure with its message", () => {
    expect(parseRun(recordedNoMistakes("error-run-not-found.toon"))).toEqual({ ok: false, error: { kind: "command_failed", message: 'run "bogus" not found' } });
  });
});

describe("parseRun on other shapes", () => {
  it("[U170] reads empty output and undecodable output as unreadable", () => {
    for (const text of ["", "   \n", "just: [unterminated\n  nonsense", "key: value\n\tbad indent: x\n   : :"]) {
      const result = parseRun(text);
      expect(result.ok, JSON.stringify(text)).toBe(false);
      expect(!result.ok && result.error.kind, JSON.stringify(text)).toBe("unreadable");
    }
  });

  it("[U171] reads an outcome outside the six known values as unreadable", () => {
    const text = recordedNoMistakes("status-cancelled.toon").replace("outcome: cancelled", "outcome: merged-by-magic");
    const result = parseRun(text);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.kind).toBe("unreadable");
    for (const known of ["checks-passed", "passed", "passed-with-override", "passed-with-skips", "failed", "cancelled"]) {
      expect(parseRun(recordedNoMistakes("status-cancelled.toon").replace("outcome: cancelled", `outcome: ${known}`)).ok, known).toBe(true);
    }
  });

  it("[U172] takes finding columns from the header, so an extra line column and a reordered header both decode", () => {
    const withLine = ['run:', '  id: "r1"', '  status: running', 'gate:', '  step: review', '  status: awaiting_approval', '  findings[1]{id,severity,file,line,action,description}:', '    r1,warning,main.go,,auto-fix,Error from os.Remove is ignored'].join("\n");
    expect(parseRun(withLine)).toMatchObject({ ok: true, value: { gate: { findings: [{ id: "r1", severity: "warning", file: "main.go", action: "auto-fix", description: "Error from os.Remove is ignored" }] } } });
    const reordered = ['run:', '  id: "r1"', 'gate:', '  step: review', '  findings[1]{description,id,action,file,severity}:', '    Bad thing,r9,ask-user,x.ts,error'].join("\n");
    expect(parseRun(reordered)).toMatchObject({ ok: true, value: { gate: { findings: [{ id: "r9", severity: "error", file: "x.ts", action: "ask-user", description: "Bad thing" }] } } });
  });

  it("[U173] decodes a gate written as a bare step name with top-level findings", () => {
    const text = ['gate: review', 'note: Review auto-fix is disabled by default.', 'findings[2]{id,severity,file,line,action,description}:', '  r1,warning,internal/pipeline/executor.go,,auto-fix,Error from os.Remove is ignored', '  r2,error,cmd/no-mistakes/main.go,,ask-user,New --force flag bypasses the confirm prompt'].join("\n");
    const result = parseRun(text);
    expect(result.ok && result.value.phase).toBe("gate");
    expect(result.ok && result.value.gate?.step).toBe("review");
    expect(result.ok && result.value.gate?.findings.map((f) => `${f.id}:${f.action}`)).toEqual(["r1:auto-fix", "r2:ask-user"]);
  });

  it("[U174] decodes a status with neither a gate nor an outcome as phase running", () => {
    const text = ['run:', '  id: "r1"', '  branch: fm/t1', '  status: running', '  head: abc'].join("\n");
    expect(parseRun(text)).toMatchObject({ ok: true, value: { runId: "r1", branch: "fm/t1", phase: "running", gate: null, outcome: null } });
  });

  it("[U175] keeps finding text with commas, quotes, and backticks unchanged", () => {
    const description = 'He said "hi, there", then used `rm -rf`, and left: really';
    const text = ['run:', '  id: "r1"', 'gate:', '  step: review', '  findings[1]{id,severity,file,action,description}:', `    r1,error,a.ts,ask-user,${JSON.stringify(description)}`].join("\n");
    const result = parseRun(text);
    expect(result.ok && result.value.gate?.findings[0]?.description).toBe(description);
  });
});
