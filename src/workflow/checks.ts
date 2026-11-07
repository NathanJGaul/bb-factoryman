import type { Exec } from "../exec";
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

export async function runChecks(_exec: Exec, _checks: readonly Check[], _where: { cwd: string; host: string | null }): Promise<CheckRun> {
  return { facts: [], failures: [] };
}

export function failureText(_run: CheckRun): string {
  return "";
}
