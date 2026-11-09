import type { BbPort, MachineInfo } from "../bb/port";
import type { DeliveryMode, Profile } from "../machine/types";
import { errorText } from "../runtime";
import { checkProfile } from "./availability";

export type GateResult =
  | { ok: true }
  | { ok: false; code: "provider_unavailable"; message: string; permanent: boolean }
  | { ok: false; code: "read_failed"; message: string };

type GateBb = Pick<BbPort, "listProviders" | "getProviderStates">;

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
export async function gateProfile(bb: GateBb, profile: Profile, _mode: DeliveryMode, host: MachineInfo | null): Promise<GateResult> {
  const hostId = host?.id;
  const [providers, states] = await Promise.all([read("providers", () => bb.listProviders(hostId)), read("provider states", () => bb.getProviderStates(hostId))]);
  if (!providers.ok) return { ok: false, code: "read_failed", message: providers.message };
  if (!states.ok) return { ok: false, code: "read_failed", message: states.message };
  const problem = checkProfile(profile, { host: host?.name ?? "the default host", providers: providers.value, states: states.value });
  return problem === null ? { ok: true } : { ok: false, code: "provider_unavailable", message: problem, permanent: false };
}
