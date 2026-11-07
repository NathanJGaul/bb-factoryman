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

export function pickMachine(_choice: MachineChoice, _machines: readonly MachineInfo[], _sources: readonly ProjectSource[]): Placement {
  return { status: "none" };
}
