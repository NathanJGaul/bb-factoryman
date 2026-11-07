import { join } from "node:path";
import type { Files } from "../files";
import { errorText } from "../runtime";
import { emptyDispatchConfig, parseDispatchConfig } from "./config";
import type { DispatchConfig } from "./types";

export type LoadResult = { ok: true; config: DispatchConfig } | { ok: false; message: string };

/** The config directory, relative to a project checkout. */
export const CONFIG_DIR = join(".bb", "factoryman");

/**
 * Read `<checkout>/.bb/factoryman/dispatch.json`. A missing file or an unknown
 * checkout gives the empty config. Anything unreadable or invalid blocks, and
 * no default replaces it (hard rule 8).
 */
export async function loadDispatchConfig(files: Files, checkout: string | null): Promise<LoadResult> {
  if (checkout === null) return { ok: true, config: emptyDispatchConfig() };
  let text: string | null;
  try {
    text = await files.readText(join(checkout, CONFIG_DIR, "dispatch.json"));
  } catch (error) {
    return { ok: false, message: `could not read dispatch.json: ${errorText(error)}` };
  }
  if (text === null) return { ok: true, config: emptyDispatchConfig() };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { ok: false, message: `dispatch.json is not valid JSON: ${errorText(error)}` };
  }
  const parsed = parseDispatchConfig(raw);
  return parsed.ok ? parsed : { ok: false, message: `dispatch.json is invalid: ${parsed.message}` };
}
