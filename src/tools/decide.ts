import { z } from "zod";
import { DECISION_RENDERER_ID, type DecisionAnswer, type DecisionRequestPayload } from "../approval/contract";
import { refuse } from "../machine/refusal";
import type { Actor } from "../machine/types";
import type { Runtime } from "../runtime";
import type { TaskRow } from "../store/types";
import type { AnswerResult } from "../validator/driver";
import { decisionKey } from "../validator/key";
import type { Answer, RunView } from "../validator/types";
import { identify, sameProject } from "./access";
import { NOT_SHIP_TEXT, notWaitingText } from "./decide-text";
import type { Caller } from "./dispatch";
import { approvalAnswerSchema } from "./merge";
import { wouldAccept } from "./preview";
import { failure, refusalOutcome, stateText, success, type ToolOutcome } from "./results";

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

/**
 * Answer a pending pipeline finding after the owner approves the exact answer in a form (D-136).
 * Every check that can refuse runs before the form, and the live view is read again after the owner approves,
 * so an answer never reaches a gate that moved. The tool never reads the project's `yolo` flag (D-139).
 */
export async function decide(rt: Runtime, decider: Decider, caller: Caller, raw: unknown): Promise<ToolOutcome> {
  const { store } = rt.deps;
  if (identify(store, caller.threadId).role === "worker") {
    return refusalOutcome(refuse("actor_forbidden", "A worker cannot answer a pipeline finding."));
  }
  const parsed = decideSchema.safeParse(raw);
  if (!parsed.success) {
    return refusalOutcome(refuse("invalid_event", `Invalid decide arguments: ${parsed.error.issues[0]?.message ?? "unreadable"}.`));
  }
  const call = parsed.data;
  const task = store.getTask(call.taskId);
  if (task === null || !sameProject(task, caller.projectId)) return failure(`No task ${call.taskId} exists in this project.`);
  if (task.kind !== "ship") return refusalOutcome(refuse("illegal_transition", NOT_SHIP_TEXT));
  if (task.state !== "needs_decision") {
    return refusalOutcome(refuse("illegal_transition", notWaitingText(call.taskId, task.state)));
  }
  if (rt.openDecisionForms.has(task.taskId)) return failure(`A decision form for task ${task.taskId} is already waiting for the owner.`);
  rt.openDecisionForms.add(task.taskId);
  try {
    return await decideClaimed(rt, decider, caller, task, call);
  } finally {
    rt.openDecisionForms.delete(task.taskId);
  }
}

/** Say what the live view is, so a supervisor that holds an old key can read the new state. */
function describeView(view: RunView): string {
  if (view.gate !== null) return `The gate is ${view.gate.step} (${view.gate.status}), with findings ${view.gate.findings.map((finding) => finding.id).join(", ") || "none"}.`;
  return view.outcome === null ? `The run is ${view.phase}.` : `The run finished as ${view.outcome}.`;
}

/** What the owner approved, in a few words, for the tool's result. */
function describePlan(plan: AnswerPlan): string {
  if (plan.kind === "rerun") return "a new run";
  return plan.answer.action === "fix" ? `fix ${plan.answer.findingIds.join(", ")}` : plan.answer.action;
}

const CHANGED = "Decision refused: the gate changed while the form was open. Nothing was sent. Read the task again and ask again.";

async function decideClaimed(rt: Runtime, decider: Decider, caller: Caller, task: TaskRow, call: DecideCall): Promise<ToolOutcome> {
  const { store, bb } = rt.deps;
  const taskId = task.taskId;
  const live = await decider.current(taskId);
  if (!live.ok) return failure(`Decision refused: the pipeline's live state cannot be read (${live.message}). Nothing was sent.`);
  const key = decisionKey(live.view);
  if (call.key !== key) {
    return failure(`Decision refused: the key does not match the live gate. The live key is ${key}. ${describeView(live.view)} Nothing was sent.`);
  }
  const planned = planAnswer(call, live.view);
  if (!planned.ok) return failure(`Decision refused: ${planned.message} Nothing was sent.`);
  const { plan } = planned;

  const result = await bb.requestInput({
    threadId: caller.threadId,
    rendererId: DECISION_RENDERER_ID,
    title: `Approve the answer for task ${taskId}`,
    payload: decisionRequest(taskId, key, live.view, plan),
    timeoutMs: rt.deps.settings().approvalTimeoutMs,
    ...(caller.signal === undefined ? {} : { signal: caller.signal }),
  });
  if (result.outcome === "cancelled") {
    return failure(`The owner did not answer the decision form (${result.reason}). Nothing was sent, and task ${taskId} stays needs_decision. Call factoryman_decide again to ask again.`);
  }
  const reply = approvalAnswerSchema.safeParse(result.value);
  if (!reply.success) return failure(`The decision form came back with an unreadable answer, so nothing was sent. Task ${taskId} stays needs_decision.`);
  if (reply.data.decision === "denied") {
    return failure(`The owner denied the answer${reply.data.comment ? `: ${reply.data.comment}` : "."} Nothing was sent, and task ${taskId} stays needs_decision.`);
  }

  // The owner approved a particular answer for a particular key. Send it only if the gate is still that gate.
  const again = await decider.current(taskId);
  if (!again.ok || decisionKey(again.view) !== key) return failure(CHANGED);
  const evidence = decisionEvidence(plan, key, live.view, reply.data.comment);
  const preview = wouldAccept(store, taskId, { type: "resolve", actor: "supervisor", evidence });
  if (!preview.ok) return failure(CHANGED);

  const sent = plan.kind === "rerun" ? await decider.rerun(taskId, "supervisor", evidence) : await decider.answer(taskId, plan.answer, "supervisor", evidence);
  const now = store.getTask(taskId);
  if (!sent.ok) {
    if (now !== null && now.state !== "needs_decision") {
      return failure(`The task moved on to ${now.state} while the answer was sent (${sent.message}). Read factoryman_status before doing anything else.`);
    }
    return failure(`The pipeline did not accept the answer: ${sent.message}. Task ${taskId} stays needs_decision.`);
  }
  return success(`${now === null ? `Task ${taskId}` : stateText(now)} The pipeline got the owner-approved answer (${describePlan(plan)}). The plugin wakes you at the next gate or outcome.`);
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
