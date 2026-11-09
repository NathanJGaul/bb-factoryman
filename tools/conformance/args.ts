export type Tier = "1" | "1.5";

export interface RunArgs {
  tier: Tier;
  harness: string | null;
  scenarios: string[] | null;
  labDir: string;
  bbAppDir: string | null;
  resultsDir: string;
  offline: boolean;
  ports: { server: number | null; daemon: number | null; model: number | null };
}

export type ParsedArgs = { ok: true; args: RunArgs } | { ok: false; message: string };

export const USAGE = [
  "Usage: pnpm run conformance -- --tier <1|1.5> [--harness <id>] [options]",
  "  --tier <1|1.5>        1 runs the stub agent. 1.5 runs a real harness CLI against a fake model.",
  "  --harness <id>        Required at tier 1.5: claude-code, codex, pi, or omp.",
  "  --scenario <ids>      Run only these scenarios, for example S3,S4.",
  "  --lab-dir <path>      The lab directory. Default /var/tmp/bblab-conformance. Never under /tmp or firstmate.",
  "  --bb-app-dir <path>   A pinned bb-app install. Default <lab-dir>/pin/node_modules/bb-app.",
  "  --results-dir <path>  Where result files go. Default conformance/results.",
  "  --offline             Run the lab with no network. The default at tier 1.5.",
  "  --no-offline          Share the network, for debugging.",
  "  --server-port, --daemon-port, --model-port <n>   Fixed ports. Default: free ports.",
].join("\n");

const SCENARIO_ID = /^S([1-9]|1[0-2])$/;
const VALUE_FLAGS = new Set(["--tier", "--harness", "--scenario", "--lab-dir", "--bb-app-dir", "--results-dir", "--server-port", "--daemon-port", "--model-port"]);
const BOOLEAN_FLAGS = new Set(["--offline", "--no-offline"]);

function refuse(message: string): ParsedArgs {
  return { ok: false, message: `${message}\n${USAGE}` };
}

function port(value: string | undefined): number | null | "bad" {
  if (value === undefined) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1024 && n <= 65535 ? n : "bad";
}

/** Read the command line of `pnpm run conformance`. A refusal carries the usage text. */
export function parseArgs(argv: string[]): ParsedArgs {
  const values = new Map<string, string>();
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i] as string;
    if (BOOLEAN_FLAGS.has(flag)) {
      flags.add(flag);
    } else if (VALUE_FLAGS.has(flag)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) return refuse(`The flag ${flag} needs a value.`);
      values.set(flag, value);
      i += 1;
    } else {
      return refuse(`Unknown argument ${flag}.`);
    }
  }
  const tier = values.get("--tier");
  if (tier === undefined) return refuse("The flag --tier is required.");
  if (tier === "2") return refuse("Tier 2 is not part of this tool: it needs a credential that only the captain holds.");
  if (tier !== "1" && tier !== "1.5") return refuse(`Unknown tier ${tier}. Use 1 or 1.5.`);
  const harness = values.get("--harness") ?? null;
  if (tier === "1.5" && harness === null) return refuse("Tier 1.5 needs --harness <id>.");
  if (tier === "1" && harness !== null) return refuse("Tier 1 runs the stub agent and takes no --harness.");

  let scenarios: string[] | null = null;
  const requested = values.get("--scenario");
  if (requested !== undefined) {
    scenarios = requested.split(",").map((id) => id.trim());
    const unknown = scenarios.find((id) => !SCENARIO_ID.test(id));
    if (unknown !== undefined) return refuse(`Unknown scenario ${unknown}. Use S1 to S12.`);
  }

  const labDir = values.get("--lab-dir") ?? "/var/tmp/bblab-conformance";
  if (labDir === "/" || labDir.toLowerCase().includes("firstmate")) return refuse(`The --lab-dir ${labDir} is refused: it is the root or sits under firstmate.`);

  const ports = { server: port(values.get("--server-port")), daemon: port(values.get("--daemon-port")), model: port(values.get("--model-port")) };
  if (ports.server === "bad" || ports.daemon === "bad" || ports.model === "bad") return refuse("A port must be a whole number from 1024 to 65535.");

  const offline = flags.has("--no-offline") ? false : flags.has("--offline") ? true : tier === "1.5";
  return {
    ok: true,
    args: {
      tier,
      harness,
      scenarios,
      labDir,
      bbAppDir: values.get("--bb-app-dir") ?? null,
      resultsDir: values.get("--results-dir") ?? "conformance/results",
      offline,
      ports: { server: ports.server, daemon: ports.daemon, model: ports.model },
    },
  };
}
