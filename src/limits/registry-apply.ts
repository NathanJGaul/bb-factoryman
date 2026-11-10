import type { ProjectConfig } from "../store/types";
import type { RegistryEntry } from "./registry";

export type ApplyRefusalCode = "no_entry" | "ambiguous_entry" | "flagged" | "unknown_project" | "ambiguous_project";
export type ApplyRefusal = { ok: false; code: ApplyRefusalCode; message: string };
export type FieldChange = { field: "deliveryMode" | "yolo" | "branchPrefix"; from: unknown; to: unknown; changed: boolean };
export type ApplyPlan = {
  ok: true;
  projectId: string;
  entryName: string;
  changes: FieldChange[];
  untouched: Array<{ field: "baseBranch" | "defaultMachine"; value: string | null }>;
  notes: string[];
  forge: string;
  next: ProjectConfig | null;
};

export interface ApplyInput {
  /** The `--project` value. It names a registry line and a bb project. */
  name: string;
  entries: readonly RegistryEntry[];
  projects: ReadonlyArray<{ id: string; name: string }>;
  /** The stored config of a bb project, or the default when it has no row. */
  stored: (projectId: string) => ProjectConfig;
}

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

function refuse(code: ApplyRefusalCode, message: string): ApplyRefusal {
  return { ok: false, code, message };
}

/**
 * Decide what applying one registry line to one bb project would do (D-148).
 * It reads nothing and writes nothing. It refuses on any doubt: a missing or repeated
 * line, a flagged line, and a missing or repeated bb project.
 */
export function planApply(input: ApplyInput): ApplyPlan | ApplyRefusal {
  const matches = input.entries.filter((entry) => same(entry.name, input.name));
  if (matches.length === 0) return refuse("no_entry", `The registry has no project named ${input.name}.`);
  if (matches.length > 1) return refuse("ambiguous_entry", `The registry has ${matches.length} lines named ${input.name}, so it is unclear which one to apply.`);
  const entry = matches[0] as RegistryEntry;
  if (entry.flags.length > 0 || entry.mode === null) {
    return refuse("flagged", `The registry line for ${input.name} is flagged, so nothing was written: ${entry.flags.join("; ")}.`);
  }
  const bbProjects = input.projects.filter((project) => same(project.name, input.name));
  if (bbProjects.length === 0) return refuse("unknown_project", `bb has no project named ${input.name}.`);
  if (bbProjects.length > 1) return refuse("ambiguous_project", `bb has ${bbProjects.length} projects named ${input.name}, so it is unclear which one to apply.`);
  const project = bbProjects[0] as { id: string; name: string };

  const current = input.stored(project.id);
  const target = { deliveryMode: entry.mode, yolo: entry.yolo, branchPrefix: entry.branchPrefix === "" ? null : entry.branchPrefix };
  const change = (field: FieldChange["field"]): FieldChange => ({ field, from: current[field], to: target[field], changed: current[field] !== target[field] });
  const changes = [change("deliveryMode"), change("yolo"), change("branchPrefix")];
  const notes = [...entry.notes];
  return {
    ok: true,
    projectId: project.id,
    entryName: entry.name,
    changes,
    untouched: [
      { field: "baseBranch", value: current.baseBranch },
      { field: "defaultMachine", value: current.defaultMachine },
    ],
    notes,
    forge: entry.forge,
    next: changes.some((entryChange) => entryChange.changed) ? { ...current, projectId: project.id, ...target } : null,
  };
}
