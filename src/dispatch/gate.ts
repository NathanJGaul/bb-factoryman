import type { BbPort, MachineInfo } from "../bb/port";
import { contractFor } from "../harness/contracts";
import { DELIVERY_MODES, type DeliveryMode, type Profile } from "../machine/types";
import { errorText } from "../runtime";
import { checkProfile } from "./availability";

export type GateResult =
  | { ok: true }
  | { ok: false; code: "provider_unavailable" | "provider_not_admitted"; message: string; permanent: boolean }
  | { ok: false; code: "read_failed"; message: string };

/**
 * Whether the harness may run workers in a project's delivery mode, from its contract row alone. A string is the
 * refusal, and null means admitted. A provider with no row, and a row with no refused mode, are always admitted:
 * the readiness and mode checks judge them.
 */
export function admit(providerId: string, mode: DeliveryMode): string | null {
  const contract = contractFor(providerId);
  if (!contract.refusedModes.includes(mode)) return null;
  const allowed = DELIVERY_MODES.filter((candidate) => !contract.refusedModes.includes(candidate));
  const reason = contract.refusalReason === null ? "" : `${contract.refusalReason} `;
  return `The provider \`${providerId}\` is not admitted for ${mode} projects. ${reason}It is allowed in: ${allowed.join(", ") || "none"}. No other provider was tried.`;
}

type GateBb = Pick<BbPort, "listProviders" | "getProviderStates" | "listModels">;

type Read<T> = { ok: true; value: T } | { ok: false; message: string };

/** Run one bb read. A throw becomes the text the caller shows, and the gate does not pass. */
async function read<T>(what: string, run: () => Promise<T>): Promise<Read<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return { ok: false, message: `could not read bb's ${what} (${errorText(error)})` };
  }
}

/**
 * The one function that applies every profile check. Dispatch and the queue start both call it, so no path to a
 * spawn skips a gate. It reads what bb says about the provider on the host that will run the worker, and fails
 * closed on anything it cannot read (hard rule 8).
 */
export async function gateProfile(bb: GateBb, profile: Profile, mode: DeliveryMode, host: MachineInfo | null): Promise<GateResult> {
  // Admission needs no bb call and never changes for a project, so it comes first and is permanent.
  const refusal = admit(profile.provider, mode);
  if (refusal !== null) return { ok: false, code: "provider_not_admitted", message: refusal, permanent: true };
  const hostId = host?.id;
  const [providers, states, models] = await Promise.all([
    read("providers", () => bb.listProviders(hostId)),
    read("provider states", () => bb.getProviderStates(hostId)),
    read("models", () => bb.listModels(profile.provider, hostId)),
  ]);
  if (!providers.ok) return { ok: false, code: "read_failed", message: providers.message };
  if (!states.ok) return { ok: false, code: "read_failed", message: states.message };
  if (!models.ok) return { ok: false, code: "read_failed", message: models.message };
  const problem = checkProfile(profile, { host: host?.name ?? "the default host", providers: providers.value, states: states.value, models: models.value });
  return problem === null ? { ok: true } : { ok: false, code: "provider_unavailable", message: problem, permanent: false };
}
