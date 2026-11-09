import { z } from "zod";
import type { ScenarioVerdict } from "./verdict.ts";

const checkSchema = z.strictObject({
  id: z.string().regex(/^S\d+\.[a-z0-9-]+$/),
  title: z.string(),
  ok: z.boolean(),
  evidence: z.string(),
  note: z.string().optional(),
  gap: z.strictObject({ task: z.string(), reason: z.string() }).optional(),
});

const scenarioSchema = z.strictObject({
  id: z.string().regex(/^S\d+$/),
  verdict: z.enum(["pass", "fail", "known-gap", "skipped"]),
  checks: z.array(checkSchema),
  message: z.string().optional(),
});

const resultSchema = z.strictObject({
  version: z.literal(1),
  tier: z.enum(["1", "1.5"]),
  harness: z.string().min(1),
  cli: z.strictObject({ name: z.string().min(1), version: z.string().min(1) }),
  bb: z.strictObject({ version: z.string().min(1) }),
  plugin: z.strictObject({ commit: z.string().min(1), dirty: z.boolean() }),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
  offline: z.boolean(),
  isolation: z.strictObject({ clean: z.boolean(), report: z.string() }),
  scenarios: z.array(scenarioSchema),
});

/** The record of one run. The support document is generated from these files and from nothing else. */
export interface ResultFile {
  version: 1;
  tier: "1" | "1.5";
  harness: string;
  cli: { name: string; version: string };
  bb: { version: string };
  plugin: { commit: string; dirty: boolean };
  startedAt: string;
  finishedAt: string;
  offline: boolean;
  isolation: { clean: boolean; report: string };
  scenarios: ScenarioVerdict[];
}

/** `1-stub.json` for tier 1, and `1.5-<harness>.json` for tier 1.5. */
export function resultFileName(tier: string, harness: string): string {
  return `${tier}-${harness}.json`;
}

/** Read a result from its JSON text. A missing or wrongly typed field throws with its path. */
export function parseResult(text: string): ResultFile {
  const parsed = resultSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue === undefined || issue.path.length === 0 ? "" : ` at \`${issue.path.join(".")}\``;
    throw new Error(`The result file is invalid${where}: ${issue?.message ?? "unreadable"}`);
  }
  return parsed.data as ResultFile;
}

export function serializeResult(result: ResultFile): string {
  return `${JSON.stringify(resultSchema.parse(result), null, 2)}\n`;
}
