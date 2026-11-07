export interface RegistryEntry {
  name: string;
  registeredMode: string;
  mode: "no-mistakes" | "direct-PR" | "local-only" | null;
  yolo: boolean;
  branchPrefix: string;
  forge: string;
  description: string;
  flags: string[];
  notes: string[];
}

export function parseRegistry(_text: string): { entries: RegistryEntry[]; skipped: number } {
  return { entries: [], skipped: 0 };
}
