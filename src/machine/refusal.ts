/** Stable reason codes for a refused event. Callers match on `code`, never on `message`. */
export const REASON_CODES = [
  "invalid_event",
  "unknown_event",
  "unknown_task",
  "task_exists",
  "illegal_transition",
  "evidence_required",
  "profile_required",
  "approval_required",
  "approval_scope_mismatch",
  "actor_forbidden",
  "mode_mismatch",
  "mode_check_failed",
  "unlanded_work",
  "machine_mismatch",
  "check_failed",
  "internal_mismatch",
  "corrupt_log",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export interface Refusal {
  readonly code: ReasonCode;
  readonly message: string;
}

export function refuse(code: ReasonCode, message: string): Refusal {
  return { code, message };
}
