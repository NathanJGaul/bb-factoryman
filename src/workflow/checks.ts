import type { Exec, ExecResult } from "../exec";
import type { Check } from "./types";

export interface CheckFact {
  name: string;
  passed: boolean;
}

export interface CheckRun {
  facts: CheckFact[];
  /** One block of text per failed check, with the tail of its output. */
  failures: string[];
}

const TAIL_CHARS = 600;
/** A check with no timeout of its own still ends, so a hung command cannot hang a report (D-079). */
export const DEFAULT_CHECK_TIMEOUT_MS = 600_000;

function detail(result: ExecResult): string {
  if (result.code === null) return result.error ?? "the command could not run";
  const output = result.stderr.trim() || result.stdout.trim();
  return output === "" ? `exit code ${result.code}` : output.length <= TAIL_CHARS ? output : `…${output.slice(-TAIL_CHARS)}`;
}

/**
 * Run each check in the worktree, with no shell, on the host of the task.
 * Every check runs, even after one fails, so the worker sees all the problems
 * at once. A check passes only on exit code 0 (FR-907).
 */
export async function runChecks(exec: Exec, checks: readonly Check[], where: { cwd: string; host: string | null }): Promise<CheckRun> {
  const run: CheckRun = { facts: [], failures: [] };
  for (const check of checks) {
    const [command, ...args] = check.argv as [string, ...string[]];
    const result = await exec(command, args, {
      cwd: where.cwd,
      host: where.host,
      timeoutMs: check.timeoutSeconds === undefined ? DEFAULT_CHECK_TIMEOUT_MS : check.timeoutSeconds * 1000,
    });
    const passed = result.code === 0;
    run.facts.push({ name: check.name, passed });
    if (!passed) run.failures.push(`- ${check.name}: ${detail(result)}`);
  }
  return run;
}

export function failureText(run: CheckRun): string {
  return run.failures.join("\n");
}
