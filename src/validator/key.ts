import { createHash } from "node:crypto";
import type { RunView } from "./types";

/**
 * Two views are equal when their phase, gate, finding IDs, outcome, and run ID are equal.
 * The driver compares signatures to tell whether a person has moved the pipeline on.
 */
export function viewSignature(view: RunView): string {
  return JSON.stringify([view.phase, view.gate?.step ?? null, view.gate?.status ?? null, view.gate?.findings.map((f) => f.id) ?? null, view.outcome, view.runId]);
}

const HASH_LENGTH = 8;

/**
 * The key that names one state of the pipeline's view: `nm-<run>-<step or outcome>-<8 hex>`.
 * A supervisor copies it into `factoryman_decide`, and the tool accepts the call only while the live view still has this key.
 * The hex covers the whole signature, so a `fix` round that keeps the run and the step but drops findings changes the key.
 */
export function decisionKey(view: RunView): string {
  const hash = createHash("sha256").update(viewSignature(view)).digest("hex").slice(0, HASH_LENGTH);
  return `nm-${view.runId ?? "unknown"}-${view.gate?.step ?? view.outcome ?? "running"}-${hash}`;
}
