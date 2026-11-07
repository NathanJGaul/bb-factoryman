import type { MachineInfo, ProjectSource } from "../bb/port";

export interface MachineChoice {
  explicit?: string | null;
  rule?: string | null;
  projectDefault?: string | null;
}

export type PlacementBlock = "machine_unknown" | "machine_ambiguous" | "machine_offline" | "machine_no_source";

export type Placement =
  | { status: "none" }
  | { status: "chosen"; machine: MachineInfo; source: "explicit" | "rule" | "default"; isClone: boolean }
  | { status: "blocked"; code: PlacementBlock; message: string };

const blocked = (code: PlacementBlock, message: string): Placement => ({ status: "blocked", code, message });

/** The first non-blank value in precedence order: the call, the matching rule, then the project default. */
function firstValue(choice: MachineChoice): { value: string; source: "explicit" | "rule" | "default" } | null {
  const ranked = [
    ["explicit", choice.explicit],
    ["rule", choice.rule],
    ["default", choice.projectDefault],
  ] as const;
  for (const [source, value] of ranked) {
    if (typeof value === "string" && value.trim() !== "") return { value: value.trim(), source };
  }
  return null;
}

/**
 * Pick the machine for a task and check that it can take the work. There is no
 * fallback (hard rule 5): when the chosen machine is unusable, the result is a
 * block that names that machine and no other, so no caller can try another.
 */
export function pickMachine(choice: MachineChoice, machines: readonly MachineInfo[], sources: readonly ProjectSource[]): Placement {
  const picked = firstValue(choice);
  if (picked === null) return { status: "none" };
  const { value, source } = picked;

  const byId = machines.find((candidate) => candidate.id === value);
  const named = machines.filter((candidate) => candidate.name.toLowerCase() === value.toLowerCase());
  if (byId === undefined && named.length === 0) {
    const known = machines.map((candidate) => candidate.name).join(", ") || "none";
    return blocked("machine_unknown", `No machine matches \`${value}\`. Known machines: ${known}.`);
  }
  if (byId === undefined && named.length > 1) {
    return blocked("machine_ambiguous", `More than one machine is named \`${value}\`. Use the machine ID (${named.map((candidate) => candidate.id).join(", ")}).`);
  }
  const machine = byId ?? (named[0] as MachineInfo);

  if (!machine.online) {
    return blocked(
      "machine_offline",
      `The machine \`${machine.name}\` (${machine.id}) is offline (status ${machine.status}, phase ${machine.phase}). The task stays pinned to it, so it was not started anywhere else.`,
    );
  }
  if (!sources.some((candidate) => candidate.hostId === machine.id)) {
    return blocked("machine_no_source", `The machine \`${machine.name}\` (${machine.id}) holds no copy of this project, so a worker cannot start there.`);
  }
  return { status: "chosen", machine, source, isClone: sources.some((candidate) => candidate.isDefault && candidate.hostId === machine.id) };
}
