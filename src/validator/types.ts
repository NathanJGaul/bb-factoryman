/** The validator interface (contracts/validator.md). No bb imports. */

export const OUTCOMES = ["checks-passed", "passed", "passed-with-override", "passed-with-skips", "failed", "cancelled"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export interface Finding {
  id: string;
  severity: string;
  file: string;
  action: string;
  description: string;
}

export interface Gate {
  step: string;
  status: string;
  findings: Finding[];
}

export interface RunView {
  runId: string | null;
  branch: string | null;
  phase: "running" | "gate" | "finished";
  gate: Gate | null;
  outcome: Outcome | null;
  prUrl: string | null;
  error: string | null;
}

export type ValidatorErrorKind = "unreadable" | "command_failed" | "no_run";

export type ValidatorResult<T> = { ok: true; value: T } | { ok: false; error: { kind: ValidatorErrorKind; message: string } };

export type Answer = { action: "approve" } | { action: "skip" } | { action: "fix"; findingIds: string[]; instructions?: string };

/** Where a validator command runs. `host` is the host ID of a remote machine, and null or absent means the server. */
export interface Where {
  cwd: string;
  host?: string | null;
}

export interface Validator {
  start(input: Where & { intent: string; wait?: string }): Promise<ValidatorResult<RunView>>;
  status(input: Where & { runId?: string }): Promise<ValidatorResult<RunView>>;
  findings(input: Where & { runId?: string }): Promise<ValidatorResult<Finding[]>>;
  answer(input: Where & { response: Answer }): Promise<ValidatorResult<RunView>>;
  cancel(input: Where & { runId?: string }): Promise<ValidatorResult<void>>;
}
