import { z } from "zod";
import { DELIVERY_MODES } from "../machine/types";
import type { WorkflowConfig } from "./types";

export type ParseWorkflowResult = { ok: true; config: WorkflowConfig } | { ok: false; message: string };

/**
 * Keys that would loosen a gate if the file could set them. The scan rejects
 * them at any depth and names hard rule 7, so the message tells an agent that
 * wrote the file why it failed (D-078).
 */
export const GATE_KEYS: readonly string[] = [
  "yolo",
  "gates",
  "gate",
  "skip",
  "skipGates",
  "skipChecks",
  "approval",
  "approvals",
  "requireApproval",
  "disable",
  "disabled",
  "teardown",
  "evidence",
  "merge",
  "bypass",
  "override",
];

const nonBlank = z.string().refine((value) => value.trim() !== "", "must not be blank");

const check = z.strictObject({
  name: nonBlank,
  argv: z.array(nonBlank).min(1, "argv needs at least one entry"),
  timeoutSeconds: z.number().int().min(1).max(3600).optional(),
});

const checkList = z
  .array(check)
  .max(20, "at most 20 checks per mode")
  .superRefine((list, ctx) => {
    const seen = new Set<string>();
    list.forEach((entry, index) => {
      if (seen.has(entry.name)) ctx.addIssue({ code: "custom", path: [index, "name"], message: `duplicate check name \`${entry.name}\`` });
      seen.add(entry.name);
    });
  });

const configSchema = z.strictObject({
  version: z.literal(1),
  project: z
    .strictObject({
      deliveryMode: z.enum(DELIVERY_MODES).optional(),
      branchPrefix: nonBlank.optional(),
      defaultMachine: nonBlank.optional(),
    })
    .default({}),
  checks: z
    .strictObject({
      "no-mistakes": checkList.optional(),
      "direct-PR": checkList.optional(),
      "local-only": checkList.optional(),
    })
    .default({}),
});

/** The first key at any depth that the file may not carry, as a message, or null. */
function forbiddenKey(value: unknown, path: string): string | null {
  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      const found = forbiddenKey(entry, `${path}.${index}`);
      if (found !== null) return found;
    }
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  for (const [key, entry] of Object.entries(value)) {
    const where = path === "" ? key : `${path}.${key}`;
    if (GATE_KEYS.includes(key)) {
      return `workflow.json cannot loosen a gate: \`${key}\` is not allowed at \`${where}\`. Config can add checks and never remove a gate (hard rule 7)`;
    }
    if (key === "baseBranch") {
      return `\`baseBranch\` is not allowed in workflow.json at \`${where}\`: it decides the landed-work check on teardown, so only the stored project config sets it`;
    }
    const found = forbiddenKey(entry, where);
    if (found !== null) return found;
  }
  return null;
}

/** The config for a project with no `workflow.json`. */
export function emptyWorkflowConfig(): WorkflowConfig {
  return { version: 1, project: {}, checks: {} };
}

/** Validate a parsed `workflow.json`. Never throws. */
export function parseWorkflowConfig(raw: unknown): ParseWorkflowResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, message: "the file must hold a JSON object" };
  }
  const forbidden = forbiddenKey(raw, "");
  if (forbidden !== null) return { ok: false, message: forbidden };
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue && issue.path.length > 0 ? ` at \`${issue.path.join(".")}\`` : "";
    return { ok: false, message: `${issue?.message ?? "unreadable"}${path}` };
  }
  return { ok: true, config: parsed.data };
}
