import { z } from "zod";
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
