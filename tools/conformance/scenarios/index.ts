import type { Scenario } from "../port.ts";
import { s1 } from "./s01-readiness.ts";
import { s2 } from "./s02-profile.ts";
import { s3 } from "./s03-scout.ts";
import { s4 } from "./s04-ship.ts";
import { s5 } from "./s05-confinement.ts";
import { s6 } from "./s06-silence.ts";
import { s7 } from "./s07-failure.ts";
import { s8 } from "./s08-refusals.ts";
import { s9 } from "./s09-role-change.ts";
import { s10 } from "./s10-restart.ts";
import { s11 } from "./s11-teardown.ts";
import { s12 } from "./s12-wake-while-busy.ts";

export const SCENARIOS: readonly Scenario[] = [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12];

/** The scenarios that run at a tier, in order, limited to the ids in `only` when it is set. */
export function scenariosFor(tier: "1" | "1.5", only: string[] | null): Scenario[] {
  return SCENARIOS.filter((s) => s.tiers.includes(tier) && (only === null || only.includes(s.id)));
}
