// The contract between factoryman_merge and the form that the owner sees.
// This module has no imports. It runs in the browser bundle and on the server,
// so it must not pull a schema library or any server code into the bundle.

/** The renderer id that factoryman_merge passes to bb, and that the frontend registers under. */
export const MERGE_RENDERER_ID = "factoryman-merge-approval";

/** What the form shows the owner. Empty strings are valid: a local-only task has no pull request. */
// A type alias, not an interface: bb's requestInput() takes JSON, and only an alias is assignable to a JSON object type.
export type MergeRequestPayload = {
  taskId: string;
  branch: string;
  prUrl: string;
  evidence: string;
};

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

/** The renderer id that factoryman_decide passes to bb, and that the frontend registers under. */
export const DECISION_RENDERER_ID = "factoryman-decision-approval";

/** One finding of the pipeline's gate, as the validator wrote it. */
// Type aliases, not interfaces: bb's requestInput() takes JSON, and only an alias is assignable to a JSON object type.
export type DecisionFinding = { id: string; severity: string; file: string; action: string; description: string };

/** The exact answer that the owner approves: `findingIds` and `instructions` belong to `fix` only, and `rerun` belongs to a finished run. */
export type DecisionAnswer = { action: "approve" | "skip" | "fix" | "rerun"; findingIds: string[]; instructions: string };

/** What the decision form shows the owner. Empty strings are valid where a field does not apply. */
export type DecisionRequestPayload = {
  taskId: string;
  key: string;
  kind: "gate" | "finished";
  step: string;
  status: string;
  outcome: string;
  findings: DecisionFinding[];
  answer: DecisionAnswer;
};

const PAYLOAD_KEYS = ["answer", "findings", "key", "kind", "outcome", "status", "step", "taskId"];
const FINDING_KEYS = ["action", "description", "file", "id", "severity"];
const ANSWER_KEYS = ["action", "findingIds", "instructions"];
const KINDS = ["gate", "finished"];
const ACTIONS = ["approve", "skip", "fix", "rerun"];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const hasExactKeys = (value: Record<string, unknown>, keys: string[]): boolean => {
  const found = Object.keys(value).sort();
  return found.length === keys.length && found.every((key, index) => key === keys[index]);
};
const isStrings = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string");

function readFinding(value: unknown): DecisionFinding | null {
  if (!isRecord(value) || !hasExactKeys(value, FINDING_KEYS)) return null;
  const { id, severity, file, action, description } = value;
  if (typeof id !== "string" || typeof severity !== "string" || typeof file !== "string" || typeof action !== "string" || typeof description !== "string") return null;
  return { id, severity, file, action, description };
}

function readAnswer(value: unknown): DecisionAnswer | null {
  if (!isRecord(value) || !hasExactKeys(value, ANSWER_KEYS)) return null;
  const { action, findingIds, instructions } = value;
  if (typeof action !== "string" || !ACTIONS.includes(action) || !isStrings(findingIds) || typeof instructions !== "string") return null;
  return { action: action as DecisionAnswer["action"], findingIds, instructions };
}

/**
 * Return the payload when it is a plain object of exactly the right shape and it contradicts itself nowhere, and null otherwise.
 * The checks beyond the shape keep the form honest: an answer may name only findings that the form shows, `fix` needs at least one
 * of them, IDs and instructions belong to `fix` only, and `rerun` belongs to a finished run that shows no findings.
 */
export function readDecisionPayload(value: unknown): DecisionRequestPayload | null {
  if (!isRecord(value) || !hasExactKeys(value, PAYLOAD_KEYS)) return null;
  const { taskId, key, kind, step, status, outcome } = value;
  if (typeof taskId !== "string" || typeof key !== "string" || typeof step !== "string" || typeof status !== "string" || typeof outcome !== "string") return null;
  if (typeof kind !== "string" || !KINDS.includes(kind) || !Array.isArray(value["findings"])) return null;
  const findings: DecisionFinding[] = [];
  for (const item of value["findings"]) {
    const finding = readFinding(item);
    if (finding === null) return null;
    findings.push(finding);
  }
  const answer = readAnswer(value["answer"]);
  if (answer === null) return null;

  const shown = new Set(findings.map((finding) => finding.id));
  if (new Set(answer.findingIds).size !== answer.findingIds.length || !answer.findingIds.every((id) => shown.has(id))) return null;
  if (answer.action === "fix") {
    if (answer.findingIds.length === 0 || kind !== "gate") return null;
  } else if (answer.findingIds.length > 0 || answer.instructions !== "") {
    return null;
  }
  if (kind === "finished" && (answer.action !== "rerun" || findings.length > 0)) return null;
  if (kind === "gate" && answer.action === "rerun") return null;
  return { taskId, key, kind: kind as DecisionRequestPayload["kind"], step, status, outcome, findings, answer };
}
