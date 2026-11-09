import type { Check, ScenarioOutcome } from "./port.ts";

export type Verdict = "pass" | "fail" | "known-gap" | "skipped";

/** A recorded reason that a check cannot pass yet. */
export interface Gap {
  check: string;
  /** A harness id, or `*` for every harness. */
  harness: string;
  /** The report task that closes the gap, for example `H1`. */
  task: string;
  reason: string;
}

export interface JudgedCheck extends Check {
  gap?: { task: string; reason: string };
}

export interface ScenarioVerdict {
  id: string;
  verdict: Verdict;
  checks: JudgedCheck[];
  message?: string;
}

export interface RunVerdict {
  scenarios: ScenarioVerdict[];
  /** Gaps whose check passed in this run. Each one fails the run until the entry is removed. */
  staleGaps: Gap[];
  exitCode: 0 | 1;
}

/** The gaps that apply to this harness: the ones that name it and the ones that name every harness. */
function applicable(gaps: Gap[], harness: string): Map<string, Gap> {
  const byCheck = new Map<string, Gap>();
  for (const gap of gaps) {
    if (gap.harness === "*" || gap.harness === harness) byCheck.set(gap.check, gap);
  }
  return byCheck;
}

function judgeScenario(outcome: ScenarioOutcome, gaps: Map<string, Gap>, stale: Gap[]): ScenarioVerdict {
  if (outcome.skipped === true) return { id: outcome.id, verdict: "skipped", checks: [] };
  const checks: JudgedCheck[] = outcome.checks.map((check) => {
    const gap = gaps.get(check.id);
    return !check.ok && gap !== undefined ? { ...check, gap: { task: gap.task, reason: gap.reason } } : check;
  });
  const staleHere = outcome.checks.flatMap((check) => {
    const gap = gaps.get(check.id);
    return check.ok && gap !== undefined ? [gap] : [];
  });
  stale.push(...staleHere);
  const removeNote = staleHere.length > 0 ? `Remove the known gap for ${staleHere.map((gap) => gap.check).join(", ")}: the check passes now.` : undefined;
  const withNote = (verdict: Verdict, message?: string): ScenarioVerdict => {
    const text = [message, removeNote].filter((part) => part !== undefined).join(" ");
    return { id: outcome.id, verdict, checks, ...(text === "" ? {} : { message: text }) };
  };
  if (outcome.error !== undefined) return withNote("fail", `The scenario threw: ${outcome.error}`);
  if (outcome.checks.length === 0) return withNote("fail", "The scenario returned no checks, so it proved nothing.");
  const failing = checks.filter((check) => !check.ok);
  if (failing.length === 0) return withNote("pass");
  return withNote(failing.every((check) => check.gap !== undefined) ? "known-gap" : "fail");
}

/**
 * Roll the checks of every scenario up to verdicts. A failing check that a gap
 * names does not fail the run, and a passing check that a gap names does, so a
 * gap cannot outlive the work that closes it.
 */
export function judge(outcomes: ScenarioOutcome[], gaps: Gap[], harness: string): RunVerdict {
  const byCheck = applicable(gaps, harness);
  const staleGaps: Gap[] = [];
  const scenarios = outcomes.map((outcome) => judgeScenario(outcome, byCheck, staleGaps));
  const failed = scenarios.some((scenario) => scenario.verdict === "fail");
  return { scenarios, staleGaps, exitCode: failed || staleGaps.length > 0 ? 1 : 0 };
}
