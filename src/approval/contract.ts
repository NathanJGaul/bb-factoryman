// The contract between factoryman_merge and the form that the owner sees.
// This module has no imports. It runs in the browser bundle and on the server,
// so it must not pull a schema library or any server code into the bundle.

/** The renderer id that factoryman_merge passes to bb, and that the frontend registers under. */
export const MERGE_RENDERER_ID = "factoryman-merge-approval";

/** What the form shows the owner. Empty strings are valid: a local-only task has no pull request. */
export interface MergeRequestPayload {
  taskId: string;
  branch: string;
  prUrl: string;
  evidence: string;
}

/** The only answer that factoryman_merge accepts. The server checks it again with a strict schema. */
// A type alias, not an interface: bb's submit() takes JSON, and only an alias is assignable to a JSON object type.
export type ApprovalAnswer = {
  decision: "approved" | "denied";
  comment?: string;
};

const PAYLOAD_FIELD_COUNT = 4;

/** Return the payload when the value is a plain object with exactly the four string fields, and null otherwise. */
export function readMergePayload(value: unknown): MergeRequestPayload | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  if (Object.keys(value).length !== PAYLOAD_FIELD_COUNT) return null;
  const { taskId, branch, prUrl, evidence } = value as Record<string, unknown>;
  if (typeof taskId !== "string" || typeof branch !== "string" || typeof prUrl !== "string" || typeof evidence !== "string") return null;
  return { taskId, branch, prUrl, evidence };
}

/** Build the answer for a decision. A blank comment is left out, and any other comment is trimmed. */
export function answerFor(decision: ApprovalAnswer["decision"], comment?: string): ApprovalAnswer {
  const trimmed = comment?.trim() ?? "";
  return trimmed === "" ? { decision } : { decision, comment: trimmed };
}
