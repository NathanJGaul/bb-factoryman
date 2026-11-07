import { join } from "node:path";
import type { Files } from "../files";
import { errorText, type Runtime } from "../runtime";
import { CONFIG_DIR } from "../dispatch/load";
import { emptyWorkflowConfig, parseWorkflowConfig } from "./config";
import type { WorkflowConfig } from "./types";

export type LoadWorkflowResult = { ok: true; config: WorkflowConfig } | { ok: false; message: string };

/**
 * Read `<checkout>/.bb/factoryman/workflow.json`. A missing file or an unknown
 * checkout gives the empty config. Anything unreadable or invalid blocks, and
 * nothing replaces it (hard rule 8).
 */
export async function loadWorkflowConfig(files: Files, checkout: string | null): Promise<LoadWorkflowResult> {
  if (checkout === null) return { ok: true, config: emptyWorkflowConfig() };
  let text: string | null;
  try {
    text = await files.readText(join(checkout, CONFIG_DIR, "workflow.json"));
  } catch (error) {
    return { ok: false, message: `could not read workflow.json: ${errorText(error)}` };
  }
  if (text === null) return { ok: true, config: emptyWorkflowConfig() };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { ok: false, message: `workflow.json is not valid JSON: ${errorText(error)}` };
  }
  const parsed = parseWorkflowConfig(raw);
  return parsed.ok ? parsed : { ok: false, message: `workflow.json is invalid: ${parsed.message}` };
}

/** The workflow config of a project, read from its checkout. A failed project read blocks too. */
export async function loadWorkflowFor(rt: Runtime, projectId: string): Promise<LoadWorkflowResult> {
  let checkout: string | null;
  try {
    checkout = await rt.deps.bb.getProjectCheckout(projectId);
  } catch (error) {
    return { ok: false, message: `could not read the project to find workflow.json: ${errorText(error)}` };
  }
  return loadWorkflowConfig(rt.deps.files, checkout);
}
