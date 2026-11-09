import { join } from "node:path";
import { parseArgs, type RunArgs } from "./args.ts";
import { resolveDriver } from "./drivers/index.ts";
import type { Driver } from "./drivers/types.ts";
import type { Lab, ScenarioOutcome } from "./port.ts";
import { resultFileName, serializeResult } from "./result.ts";
import { SCENARIOS } from "./scenarios/index.ts";
import { judge, type Gap, type RunVerdict } from "./verdict.ts";

export interface Isolation {
  clean: boolean;
  report: string;
}

/** An open lab. `close` stops it and reports whether the real machine is unchanged. */
export interface LabSession {
  lab: Lab;
  cli: { name: string; version: string };
  bbVersion: string;
  offline: boolean;
  close(): Promise<Isolation>;
}

export interface RunDeps {
  which(command: string): string | null;
  openLab(args: RunArgs, driver: Driver, binds: string[]): Promise<LabSession>;
  loadGaps(): Promise<Gap[]>;
  plugin(): Promise<{ commit: string; dirty: boolean }>;
  now(): string;
  writeFile(path: string, text: string): Promise<void>;
  out(line: string): void;
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** One line per scenario, then the detail of every gap and failure. */
function printTable(out: (line: string) => void, run: RunVerdict): void {
  for (const scenario of run.scenarios) {
    const title = SCENARIOS.find((s) => s.id === scenario.id)?.title ?? "";
    out(`${scenario.id.padEnd(4)}${scenario.verdict.padEnd(11)}${title}`);
    if (scenario.message !== undefined) out(`      ${scenario.message}`);
    for (const check of scenario.checks) {
      if (check.gap !== undefined) out(`      known gap ${check.id} (${check.gap.task}): ${check.gap.reason}. Failed: ${check.evidence}`);
      else if (!check.ok) out(`      FAIL ${check.id}: ${check.title}. ${check.evidence}`);
    }
  }
  for (const gap of run.staleGaps) out(`stale gap ${gap.check} (${gap.task}): the check passes, so remove the entry from conformance/known-gaps.json`);
}

/** The runner. Returns the exit code: 0 for a clean run, 1 for a failed run, 2 for a refused command line. */
export async function main(argv: string[], deps: RunDeps): Promise<number> {
  const parsed = parseArgs(argv);
  if (!parsed.ok) {
    deps.out(parsed.message);
    return 2;
  }
  const { args } = parsed;
  const resolved = resolveDriver(args.harness ?? "stub");
  if (!resolved.ok) {
    deps.out(resolved.message);
    return 2;
  }
  const { driver } = resolved;
  const bound = driver.bindCli(deps.which);
  if (!bound.ok) {
    deps.out(`Cannot run ${driver.id}: ${bound.message}`);
    return 1;
  }
  const gaps = await deps.loadGaps();
  const startedAt = deps.now();
  deps.out(`tier ${args.tier}, harness ${driver.id}${args.offline ? ", offline" : ""}`);

  let session: LabSession;
  try {
    session = await deps.openLab(args, driver, bound.binds);
  } catch (error) {
    deps.out(`The lab did not start: ${errorText(error)}`);
    return 1;
  }
  const outcomes: ScenarioOutcome[] = [];
  let isolation: Isolation;
  try {
    for (const scenario of SCENARIOS) {
      if (args.scenarios !== null && !args.scenarios.includes(scenario.id)) continue;
      if (!scenario.tiers.includes(args.tier)) {
        outcomes.push({ id: scenario.id, skipped: true, checks: [] });
        continue;
      }
      try {
        outcomes.push({ id: scenario.id, checks: await scenario.run(session.lab) });
      } catch (error) {
        outcomes.push({ id: scenario.id, checks: [], error: errorText(error) });
      }
    }
  } finally {
    isolation = await session.close().catch((error: unknown) => ({ clean: false, report: `The isolation check failed: ${errorText(error)}` }));
  }

  const run = judge(outcomes, gaps, driver.id);
  printTable(deps.out, run);
  deps.out(`isolation: ${isolation.clean ? "clean" : "CHANGED"}. ${isolation.report}`);
  if (args.scenarios === null) {
    const plugin = await deps.plugin();
    const path = join(args.resultsDir, resultFileName(args.tier, driver.id));
    await deps.writeFile(
      path,
      serializeResult({
        version: 1,
        tier: args.tier,
        harness: driver.id,
        cli: session.cli,
        bb: { version: session.bbVersion },
        plugin,
        startedAt,
        finishedAt: deps.now(),
        offline: session.offline,
        isolation,
        scenarios: run.scenarios,
      }),
    );
    deps.out(`result: ${path}`);
  } else {
    deps.out("A partial run (--scenario) writes no result file.");
  }
  return run.exitCode === 0 && isolation.clean ? 0 : 1;
}
