import { join } from "node:path";
import type { ModelEntry } from "../bb/port";
import type { Profile } from "../machine/types";
import { errorText, type Runtime } from "../runtime";
import { checkSupport } from "./availability";
import { parseDispatchConfig } from "./config";
import { CONFIG_DIR } from "./load";

export interface InitResult {
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

export const INIT_USAGE = "Usage: bb factoryman dispatch init --provider <id> [--project <id>] [--model <id>] [--level <id>] [--mode <mode>]\n";

const FLAGS = ["--provider", "--project", "--model", "--level", "--mode"] as const;
type Flag = (typeof FLAGS)[number];

/** The modes in the order that a starter profile prefers them: the middle privilege first, the least sandboxed last. */
const MODE_ORDER = ["auto", "accept-edits", "full"] as const;

const fail = (message: string): InitResult => ({ exitCode: 1, stderr: `${message}\n` });

/** Read `--flag value` pairs. A repeated, unknown, valueless, or blank flag makes the whole call invalid. */
function parseFlags(args: string[]): Partial<Record<Flag, string>> | null {
  const found: Partial<Record<Flag, string>> = {};
  if (args.length % 2 !== 0) return null;
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i] as Flag;
    const value = args[i + 1];
    if (!FLAGS.includes(flag) || flag in found || value === undefined || value.trim() === "" || value.startsWith("--")) return null;
    found[flag] = value;
  }
  return found;
}

const defaultLevel = (levels: readonly string[], fromModel: string): string | undefined => (fromModel !== "" ? fromModel : levels.includes("medium") ? "medium" : levels[0]);

/**
 * `bb factoryman dispatch init --provider <id>` writes a starter `dispatch.json` for a project (D-112). It reads
 * bb to build one profile, checks the profile the way dispatch does (minus readiness), and creates the file only
 * when none exists. `args` are the arguments after `dispatch init`.
 */
export async function runDispatchInit(rt: Runtime, args: string[], ctx: { projectId?: string }): Promise<InitResult> {
  const flags = parseFlags(args);
  const projectId = flags?.["--project"] ?? ctx.projectId;
  const providerId = flags?.["--provider"];
  if (flags === null || providerId === undefined || projectId === undefined || projectId.trim() === "") return { exitCode: 2, stderr: INIT_USAGE };
  const { bb, files } = rt.deps;

  let checkout: string | null;
  try {
    checkout = await bb.getProjectCheckout(projectId);
  } catch (error) {
    return fail(`Could not read the project ${projectId}: ${errorText(error)}.`);
  }
  if (checkout === null) return fail(`The project ${projectId} has no local checkout on the server, so no dispatch.json can be written there.`);

  let providers;
  try {
    providers = await bb.listProviders();
  } catch (error) {
    return fail(`Could not read bb's providers: ${errorText(error)}.`);
  }
  const provider = providers.find((candidate) => candidate.id === providerId);
  if (provider === undefined) return fail(`bb does not list the provider \`${providerId}\`. It lists: ${providers.map((candidate) => candidate.id).join(", ") || "none"}.`);

  let models;
  try {
    models = await bb.listModels(providerId);
  } catch (error) {
    return fail(`Could not read bb's models: ${errorText(error)}.`);
  }

  const model = flags["--model"] ?? (models.models.find((entry) => entry.isDefault) ?? models.models[0])?.id;
  if (model === undefined) return fail(`bb lists no models for \`${providerId}\`. Pass --model <id>.`);
  const entry: ModelEntry | undefined = models.models.find((candidate) => candidate.id === model || candidate.model === model);

  const levels = entry !== undefined && entry.reasoningKnown ? entry.reasoningLevels : provider.reasoningLevels;
  const level = flags["--level"] ?? defaultLevel(levels, entry?.defaultReasoningLevel ?? "");
  if (level === undefined) return fail("Pass --level <id>.");

  const mode = flags["--mode"] ?? MODE_ORDER.find((candidate) => provider.permissionModes.includes(candidate));
  if (mode === undefined) return fail("The provider offers no permission mode.");

  const profile = { provider: providerId, model, reasoningLevel: level, permissionMode: mode } as Profile;
  const problem = checkSupport(profile, { host: "the default host", providers, models });
  if (problem !== null) return fail(problem);

  const config = { version: 1, profiles: { [providerId]: profile }, default: providerId, rules: [] };
  const parsed = parseDispatchConfig(config);
  if (!parsed.ok) return fail(`The starter file would be invalid: ${parsed.message}.`);

  const path = join(checkout, CONFIG_DIR, "dispatch.json");
  try {
    if ((await files.writeNew(path, `${JSON.stringify(config, null, 2)}\n`)) === "exists") {
      return fail(`${path} already exists, so nothing was written. Set \`default\` in it instead.`);
    }
  } catch (error) {
    return fail(`Could not write ${path}: ${errorText(error)}.`);
  }
  return {
    exitCode: 0,
    stdout:
      `Wrote ${path}.\n` +
      `Profile "${providerId}": ${providerId} ${model} ${level} ${mode}. It is the default for this project.\n` +
      "Dispatch checks readiness, the model, and the delivery mode each time, so this file does not make the harness ready.\n",
  };
}
