import type { DeliveryMode } from "../machine/types";

/** One line of firstmate's project registry, read with the rules of `bin/fm-project-mode.sh` (D-088). */
export interface RegistryEntry {
  name: string;
  /** The mode as registered, or `no-mistakes` for a line with no bracket. */
  registeredMode: string;
  /** The mode this plugin uses, or null when the registered mode is unknown. */
  mode: DeliveryMode | null;
  yolo: boolean;
  branchPrefix: string;
  forge: string;
  description: string;
  /** Things a person must look at before the cutover. */
  flags: string[];
  /** Things that are fine but worth knowing. */
  notes: string[];
}

const MODES: Record<string, DeliveryMode | undefined> = {
  "no-mistakes": "no-mistakes",
  "direct-PR": "direct-PR",
  "local-only": "local-only",
  // A conditional policy, not a task mode: the registry tool maps it to its most rigorous leg.
  "no-mistakes-prod-only": "no-mistakes",
};

const DEFAULT_PREFIX = "fm/";

/** The first ` [` or ` - ` after the name ends the name. */
function split(line: string): { name: string; bracket: string | null; description: string } | null {
  const body = line.slice(2);
  const bracketAt = body.indexOf(" [");
  const dashAt = body.indexOf(" - ");
  if (dashAt === -1 && bracketAt === -1) return null;
  if (bracketAt !== -1 && (dashAt === -1 || bracketAt < dashAt)) {
    const close = body.indexOf("]", bracketAt);
    if (close === -1) return null;
    const after = body.slice(close + 1);
    const description = after.startsWith(" - ") ? after.slice(3) : after.trim();
    return { name: body.slice(0, bracketAt).trim(), bracket: body.slice(bracketAt + 2, close), description };
  }
  return { name: body.slice(0, dashAt).trim(), bracket: null, description: body.slice(dashAt + 3) };
}

function entryOf(parts: { name: string; bracket: string | null; description: string }): RegistryEntry {
  const flags: string[] = [];
  const notes: string[] = [];
  let yolo = false;
  let branchPrefix = DEFAULT_PREFIX;
  let forge = "none";
  const leftover: string[] = [];
  for (const token of (parts.bracket ?? "").split(/\s+/).filter((entry) => entry !== "")) {
    if (token === "+yolo") yolo = true;
    else if (token.startsWith("branch=")) branchPrefix = token.slice("branch=".length);
    else if (token.startsWith("forge=")) forge = token.slice("forge=".length) || "none";
    else leftover.push(token);
  }
  const registeredMode = leftover[0] ?? "no-mistakes";
  const mode = MODES[registeredMode] ?? null;
  if (mode === null) flags.push(`unknown mode \`${registeredMode}\`: the plugin does not guess a mode`);
  for (const extra of leftover.slice(1)) flags.push(`unexpected token \`${extra}\``);
  if (registeredMode === "no-mistakes-prod-only") notes.push("a conditional policy in firstmate; it maps to no-mistakes, the most rigorous leg");
  if (forge === "gerrit") notes.push("forge gerrit: the plugin's merge path uses gh and does not support it");
  return { name: parts.name, registeredMode, mode, yolo, branchPrefix, forge, description: parts.description, flags, notes };
}

/** Parse the registry text. A line that does not start with `- ` is skipped and counted. */
export function parseRegistry(text: string): { entries: RegistryEntry[]; skipped: number } {
  const entries: RegistryEntry[] = [];
  let skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line.trim() === "") continue;
    const parts = line.startsWith("- ") ? split(line) : null;
    if (parts === null) {
      skipped += 1;
      continue;
    }
    entries.push(entryOf(parts));
  }
  return { entries, skipped };
}
