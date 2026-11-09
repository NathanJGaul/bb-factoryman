import type { RunArgs } from "../../tools/conformance/args.ts";
import type { Driver } from "../../tools/conformance/drivers/types.ts";
import type { Lab } from "../../tools/conformance/port.ts";
import type { Isolation, LabSession, RunDeps } from "../../tools/conformance/run.ts";
import type { Gap } from "../../tools/conformance/verdict.ts";
import { FakeLab, type Faults } from "./conformance-lab.ts";

export interface Recorded {
  out: string[];
  files: Map<string, string>;
  opened: Array<{ args: RunArgs; driver: string; binds: string[] }>;
  closed: number;
  events: string[];
  /** The fake labs that were opened, so a test can read what the scenarios did to them. */
  labs: FakeLab[];
}

export interface Options {
  faults?: Faults;
  gaps?: Gap[];
  isolation?: Isolation;
  missing?: string[];
  openError?: Error;
  /** Wrap the fake lab, for example to make one method throw. */
  wrap?: (lab: FakeLab) => Lab;
}

/** Deps for `main` with a fake lab behind them. */
export function fakeDeps(options: Options = {}): { deps: RunDeps; rec: Recorded } {
  const rec: Recorded = { out: [], files: new Map(), opened: [], closed: 0, events: [], labs: [] };
  const deps: RunDeps = {
    which: (command) => (options.missing?.includes(command) === true ? null : `/m/installs/${command}/9.9.9/${command}`),
    async openLab(args, driver: Driver, binds): Promise<LabSession> {
      rec.opened.push({ args, driver: driver.id, binds });
      rec.events.push("open");
      if (options.openError !== undefined) throw options.openError;
      const fake = new FakeLab(driver.id, options.faults ?? {}, args.tier);
      rec.labs.push(fake);
      return {
        lab: options.wrap?.(fake) ?? fake,
        cli: { name: driver.cli?.command ?? "stub-agent", version: "9.9.9" },
        bbVersion: "0.49.0",
        offline: args.offline,
        async close() {
          rec.closed += 1;
          rec.events.push("close");
          return options.isolation ?? { clean: true, report: "no change to the real home" };
        },
      };
    },
    loadGaps: async () => options.gaps ?? [],
    plugin: async () => ({ commit: "abc1234", dirty: false }),
    now: () => "2026-11-08T22:00:00.000Z",
    async writeFile(path, text) {
      rec.files.set(path, text);
    },
    out: (line) => rec.out.push(line),
  };
  return { deps, rec };
}
