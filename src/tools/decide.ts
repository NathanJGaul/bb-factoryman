import { z } from "zod";
import type { DecisionAnswer, DecisionRequestPayload } from "../approval/contract";
import { refuse } from "../machine/refusal";
import type { Actor } from "../machine/types";
import type { Runtime } from "../runtime";
import type { AnswerResult } from "../validator/driver";
import type { Answer, RunView } from "../validator/types";
import { identify } from "./access";
import type { Caller } from "./dispatch";
import { failure, refusalOutcome, type ToolOutcome } from "./results";

/** What the tool needs from the validation driver. The driver implements it, and tests pass a fake. */
export interface Decider {
  current(taskId: string): Promise<{ ok: true; view: RunView } | { ok: false; message: string }>;
  answer(taskId: string, response: Answer, actor: Actor, evidence?: string): Promise<AnswerResult>;
  rerun(taskId: string, actor: Actor, evidence: string): Promise<AnswerResult>;
}

/**
 * One flat object, so that every harness accepts the schema. The tool checks the rules that tie the fields together (D-137).
 * `findingIds` and `instructions` belong to `fix` only.
 */
export const decideSchema = z.strictObject({
  taskId: z.string().min(1),
  key: z.string().min(1),
  action: z.enum(["approve", "skip", "fix", "rerun"]),
  findingIds: z.array(z.string().min(1)).optional(),
  instructions: z.string().optional(),
});

/** Answer a pending pipeline finding after the owner approves the exact answer in a form. */
export async function decide(rt: Runtime, _decider: Decider, caller: Caller, raw: unknown): Promise<ToolOutcome> {
  if (identify(rt.deps.store, caller.threadId).role === "worker") {
    return refusalOutcome(refuse("actor_forbidden", "A worker cannot answer a pipeline finding."));
  }
  const parsed = decideSchema.safeParse(raw);
  if (!parsed.success) {
    return refusalOutcome(refuse("invalid_event", `Invalid decide arguments: ${parsed.error.issues[0]?.message ?? "unreadable"}.`));
  }
  return failure("factoryman_decide does not answer yet.");
}

export type DecideCall = z.infer<typeof decideSchema>;

/** What the tool will do once the owner approves: send an answer to a gate, or start a new run. */
export type AnswerPlan = { kind: "answer"; answer: Answer } | { kind: "rerun" };
export type Planned = { ok: true; plan: AnswerPlan } | { ok: false; message: string };

/** The finished runs that park a task (D-141). A run that failed or was cancelled fails the task by itself, and a clean pass moves it on. */
function parkedFinished(view: RunView): boolean {
  if (view.phase !== "finished") return false;
  return view.outcome === "passed" || view.outcome === "passed-with-override" || view.outcome === "passed-with-skips" || (view.outcome === "checks-passed" && view.prUrl === null);
}

/** Instructions that are blank count as no instructions. Other text is kept exactly as the supervisor gave it. */
const instructionsOf = (call: DecideCall): string | undefined => (call.instructions === undefined || call.instructions.trim() === "" ? undefined : call.instructions);

function planGate(call: DecideCall, gate: NonNullable<RunView["gate"]>): Planned {
  const ids = call.findingIds ?? [];
  const instructions = instructionsOf(call);
  if (call.action === "rerun") {
    return { ok: false, message: "rerun is for a run that finished without a gate. A pending gate takes approve, skip, or fix." };
  }
  if (call.action !== "fix") {
    if (ids.length > 0 || instructions !== undefined) return { ok: false, message: `${call.action} takes no finding IDs and no instructions.` };
    return { ok: true, plan: { kind: "answer", answer: { action: call.action } } };
  }
  if (ids.length === 0) return { ok: false, message: "fix needs at least one finding ID from the gate." };
  const shown = gate.findings.map((finding) => finding.id);
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) return { ok: false, message: `fix names finding ID ${id} twice.` };
    seen.add(id);
    if (!shown.includes(id)) return { ok: false, message: `fix names finding ID ${id}, which is not in the gate (${shown.join(", ") || "no findings"}).` };
  }
  return { ok: true, plan: { kind: "answer", answer: instructions === undefined ? { action: "fix", findingIds: ids } : { action: "fix", findingIds: ids, instructions } } };
}

/** Decide whether the call is an answer that the live view allows, and what the tool will send. Every refusal says why. */
export function planAnswer(call: DecideCall, view: RunView): Planned {
  if (view.phase === "gate" && view.gate !== null) return planGate(call, view.gate);
  if (parkedFinished(view)) {
    if (call.action !== "rerun") return { ok: false, message: `No gate is pending: the run finished as ${view.outcome}. The only decision is rerun.` };
    return { ok: true, plan: { kind: "rerun" } };
  }
  const where = view.outcome === null ? `the run is ${view.phase}` : `the run ended as ${view.outcome}`;
  return { ok: false, message: `The pipeline is not waiting for a decision (${where}). The plugin follows it by itself.` };
}

/** The form's payload, built from the live view and the planned answer. */
export function decisionRequest(taskId: string, key: string, view: RunView, plan: AnswerPlan): DecisionRequestPayload {
  const answer: DecisionAnswer =
    plan.kind === "rerun"
      ? { action: "rerun", findingIds: [], instructions: "" }
      : { action: plan.answer.action, findingIds: plan.answer.action === "fix" ? [...plan.answer.findingIds] : [], instructions: plan.answer.action === "fix" ? (plan.answer.instructions ?? "") : "" };
  if (plan.kind === "rerun") {
    return { taskId, key, kind: "finished", step: "", status: "", outcome: view.outcome ?? "", findings: [], answer };
  }
  const gate = view.gate!;
  return { taskId, key, kind: "gate", step: gate.step, status: gate.status, outcome: "", findings: gate.findings.map((finding) => ({ ...finding })), answer };
}

/** The evidence of the `resolve` event: the exact answer, and that the owner approved it. */
export function decisionEvidence(plan: AnswerPlan, key: string, view: RunView, comment: string | undefined): string {
  const note = comment === undefined || comment === "" ? "" : `\nComment: ${comment}`;
  if (plan.kind === "rerun") {
    return `The owner approved a new no-mistakes run in the decision form (key ${key}; the last run finished as ${view.outcome ?? "unknown"}).${note}`;
  }
  const { answer } = plan;
  const detail =
    answer.action === "fix" ? ` ${answer.findingIds.join(", ")}${answer.instructions === undefined ? "" : ` (instructions: ${answer.instructions})`}` : "";
  return `answered the gate: ${answer.action}${detail}. The owner approved this answer in the decision form (key ${key}).${note}`;
}
