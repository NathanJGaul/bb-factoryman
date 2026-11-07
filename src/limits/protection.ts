export interface ProtectionInput {
  repo: string;
  branch: string;
  check: string;
}

export function protectionSteps(_input: ProtectionInput): { ok: true; text: string } | { ok: false; message: string } {
  return { ok: false, message: "not implemented" };
}
