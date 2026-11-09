import { z } from "zod";
import { DELIVERY_MODES, TASK_KINDS } from "../machine/types";
import { DEFAULT_REASONING_LEVELS, type DispatchConfig } from "./types";

export type ParseConfigResult = { ok: true; config: DispatchConfig } | { ok: false; message: string };

export { DEFAULT_REASONING_LEVELS, ladderFor } from "./types";

const nonBlank = z.string().refine((value) => value.trim() !== "", "must not be blank");

const profile = z.strictObject({
  provider: nonBlank,
  model: nonBlank,
  reasoningLevel: nonBlank,
  permissionMode: z.enum(["accept-edits", "auto", "full"]),
});

const when = z
  .strictObject({
    kind: z.enum(TASK_KINDS).optional(),
    mode: z.enum(DELIVERY_MODES).optional(),
    tags: z.array(nonBlank).min(1, "tags needs at least one tag").optional(),
    keywords: z.array(nonBlank).min(1, "keywords needs at least one keyword").optional(),
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), "a rule needs at least one condition");

const rule = z.strictObject({ id: nonBlank, when, profile: nonBlank, machine: nonBlank.optional() });

const levelList = z.array(nonBlank).min(1);

const configSchema = z
  .strictObject({
    version: z.literal(1),
    profiles: z.record(nonBlank, profile),
    default: nonBlank.optional(),
    rules: z.array(rule),
    reasoningLevels: z.union([levelList, z.record(nonBlank, levelList)]).default([...DEFAULT_REASONING_LEVELS]),
    standingPermission: z.strictObject({ lowerReasoning: z.boolean() }).default({ lowerReasoning: false }),
  })
  .superRefine((value, ctx) => {
    if (value.default !== undefined && !(value.default in value.profiles)) {
      ctx.addIssue({ code: "custom", path: ["default"], message: `default names the undefined profile \`${value.default}\`` });
    }
    const seen = new Set<string>();
    value.rules.forEach((entry, index) => {
      if (seen.has(entry.id)) ctx.addIssue({ code: "custom", path: ["rules", index, "id"], message: `duplicate rule ID \`${entry.id}\`` });
      seen.add(entry.id);
      if (!(entry.profile in value.profiles)) {
        ctx.addIssue({ code: "custom", path: ["rules", index, "profile"], message: `rule \`${entry.id}\` names the undefined profile \`${entry.profile}\`` });
      }
    });
    const ladders = Array.isArray(value.reasoningLevels) ? [{ path: ["reasoningLevels"], levels: value.reasoningLevels }] : Object.entries(value.reasoningLevels).map(([provider, levels]) => ({ path: ["reasoningLevels", provider], levels }));
    for (const { path, levels } of ladders) {
      if (new Set(levels).size !== levels.length) {
        ctx.addIssue({ code: "custom", path, message: "reasoningLevels repeats a level (duplicate entries have no rank)" });
      }
    }
  });

/** The config for a project with no `dispatch.json`: no profiles, no rules, no permissions. */
export function emptyDispatchConfig(): DispatchConfig {
  return {
    version: 1,
    profiles: {},
    default: null,
    rules: [],
    reasoningLevels: [...DEFAULT_REASONING_LEVELS],
    standingPermission: { lowerReasoning: false },
  };
}

/** Validate a parsed `dispatch.json`. Never throws. */
export function parseDispatchConfig(raw: unknown): ParseConfigResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, message: "the file must hold a JSON object" };
  }
  const parsed = configSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue && issue.path.length > 0 ? ` at \`${issue.path.join(".")}\`` : "";
    return { ok: false, message: `${issue?.message ?? "unreadable"}${path}` };
  }
  const { default: defaultName, ...rest } = parsed.data;
  return { ok: true, config: { ...rest, default: defaultName ?? null } };
}
