import { describe, expect, it } from "vitest";
import { parseArgs, USAGE } from "./args.ts";

const ok = (argv: string[]) => {
  const parsed = parseArgs(argv);
  if (!parsed.ok) throw new Error(`expected ok, got: ${parsed.message}`);
  return parsed.args;
};
const message = (argv: string[]) => {
  const parsed = parseArgs(argv);
  if (parsed.ok) throw new Error("expected a refusal");
  return parsed.message;
};

describe("parseArgs", () => {
  it("[U1321] reads --tier 1 and fills the defaults for the lab directory, offline, and ports", () => {
    const args = ok(["--tier", "1"]);
    expect(args).toMatchObject({ tier: "1", harness: null, scenarios: null, offline: false, bbAppDir: null });
    expect(args.labDir).toBe("/var/tmp/bblab-conformance");
    expect(args.resultsDir).toBe("conformance/results");
    expect(args.ports).toEqual({ server: null, daemon: null, model: null });
  });

  it("[U1322] needs --harness at tier 1.5 and refuses one at tier 1", () => {
    expect(message(["--tier", "1.5"])).toMatch(/--harness/);
    expect(message(["--tier", "1", "--harness", "pi"])).toMatch(/--harness/);
    expect(ok(["--tier", "1.5", "--harness", "pi"]).harness).toBe("pi");
  });

  it("[U1323] refuses an unknown tier, an unknown flag, and a flag with no value, and shows the usage text", () => {
    expect(message(["--tier", "2"])).toMatch(/tier 2/i);
    expect(message(["--tier", "1", "--bogus"])).toMatch(/--bogus/);
    expect(message(["--tier"])).toMatch(/--tier/);
    expect(message([])).toMatch(/--tier/);
    expect(USAGE).toContain("--tier");
    expect(message(["--tier", "9"])).toContain(USAGE.split("\n")[0] as string);
  });

  it("[U1324] limits the run to the ids of --scenario and refuses an unknown id", () => {
    expect(ok(["--tier", "1", "--scenario", "S3,S4"]).scenarios).toEqual(["S3", "S4"]);
    expect(message(["--tier", "1", "--scenario", "S3,S99"])).toMatch(/S99/);
    expect(message(["--tier", "1", "--scenario", "S0"])).toMatch(/S0/);
  });

  it("[U1325] makes tier 1.5 offline by default, and --no-offline turns it off", () => {
    expect(ok(["--tier", "1.5", "--harness", "pi"]).offline).toBe(true);
    expect(ok(["--tier", "1.5", "--harness", "pi", "--no-offline"]).offline).toBe(false);
    expect(ok(["--tier", "1", "--offline"]).offline).toBe(true);
  });

  it("[U1326] refuses a lab directory that contains firstmate or is the root", () => {
    expect(message(["--tier", "1", "--lab-dir", "/home/x/Projects/firstmate/lab"])).toMatch(/firstmate/);
    expect(message(["--tier", "1", "--lab-dir", "/"])).toMatch(/lab-dir/);
    expect(ok(["--tier", "1", "--lab-dir", "/var/tmp/other"]).labDir).toBe("/var/tmp/other");
  });
});
