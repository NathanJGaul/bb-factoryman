import type { BbPort, MachineInfo } from "../bb/port";
import type { Exec } from "../exec";
import type { DeliveryMode } from "../machine/types";

export interface Problem {
  check: string;
  message: string;
}

export interface PreflightInput {
  host: MachineInfo;
  sourcePath: string;
  mode: DeliveryMode;
  /** The provider the task will use, or null to ask for any available provider. */
  provider: string | null;
}

export async function runPreflight(_deps: { bb: Pick<BbPort, "listProviders">; exec: Exec }, _input: PreflightInput): Promise<Problem[]> {
  return [];
}

export function reportText(_host: MachineInfo, _mode: DeliveryMode, _problems: readonly Problem[]): string {
  return "";
}

export async function preflightOnce(
  _deps: { bb: Pick<BbPort, "listProviders">; exec: Exec },
  _cache: Set<string>,
  _projectId: string,
  _input: PreflightInput,
): Promise<Problem[]> {
  return [];
}
