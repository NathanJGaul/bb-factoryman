import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { Gap } from "./verdict.ts";

const nonBlank = (name: string) => z.string().refine((value) => value.trim() !== "", `${name} must not be blank`);

const gapSchema = z.strictObject({
  check: z.string().regex(/^S\d+\.[a-z0-9-]+$/, "check must look like S1.remedy"),
  harness: nonBlank("harness"),
  task: z.string().regex(/^H\d+$/, "task must name a report task such as H1"),
  reason: nonBlank("reason"),
});

const fileSchema = z.strictObject({ version: z.literal(1), gaps: z.array(gapSchema) });

/** Read the known-gap list from its JSON text. A bad entry throws with the field that is wrong. */
export function parseGaps(text: string): Gap[] {
  const parsed = fileSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue === undefined || issue.path.length === 0 ? "" : ` at \`${issue.path.join(".")}\``;
    throw new Error(`known-gaps.json is invalid${where}: ${issue?.message ?? "unreadable"}`);
  }
  const seen = new Set<string>();
  for (const gap of parsed.data.gaps) {
    const key = `${gap.check}|${gap.harness}`;
    if (seen.has(key)) throw new Error(`known-gaps.json has a duplicate entry for ${gap.check} and ${gap.harness}`);
    seen.add(key);
  }
  return parsed.data.gaps;
}

/** Read the file. A missing file is an error, because an empty list would hide every gap. */
export async function loadGaps(path: string): Promise<Gap[]> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`Cannot read known-gaps.json at ${path}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  return parseGaps(text);
}
