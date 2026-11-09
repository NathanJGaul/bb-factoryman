import { claudeCode } from "./claude-code.ts";
import { codex } from "./codex.ts";
import { omp } from "./omp.ts";
import { pi } from "./pi.ts";
import { stub } from "./stub.ts";
import type { Driver } from "./types.ts";

const HARNESS_DRIVERS: readonly Driver[] = [claudeCode, codex, pi, omp];

/** The ids that `--harness` accepts. Adding a harness means adding one driver file and one entry here. */
export const HARNESS_IDS: readonly string[] = HARNESS_DRIVERS.map((driver) => driver.id);

export type ResolvedDriver = { ok: true; driver: Driver } | { ok: false; message: string };

export function resolveDriver(id: string): ResolvedDriver {
  if (id === stub.id) return { ok: true, driver: stub };
  const found = HARNESS_DRIVERS.find((driver) => driver.id === id);
  if (found === undefined) return { ok: false, message: `No driver for the harness "${id}". Known harnesses: ${HARNESS_IDS.join(", ")}.` };
  return { ok: true, driver: found };
}
