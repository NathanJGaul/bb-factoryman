import { describe, expect, it } from "vitest";
import { CONTRACTS, GENERIC_CONTRACT, contractFor, type HarnessContract } from "./contracts";

const MCP_HINT =
  "In this harness the tool factoryman_report is listed as mcp__bb-bridge__factoryman_report and loads on demand: search for it with ToolSearch before you call it.";
const XD_HINT =
  "In this harness factoryman_report has no function tool: write its JSON arguments to the device that your system prompt lists under MCP Tool Routes for factoryman_report.";
const PI_REASON =
  "It runs workers with no sandbox (it offers only the permission mode `full`), so a worker can answer the owner's merge form with `bb thread interactions respond` (D-030), and local-only mode has no pull request backstop.";

// The expected rows are written out by hand from data-model.md, so a change to a fact is a deliberate edit of this file.
const CLAUDE_CODE: HarnessContract = {
  provider: "claude-code",
  testedWith: { cli: "2.1.316", bb: "0.49.0" },
  workerModes: ["accept-edits", "auto", "full"],
  sandbox: "available",
  refusedModes: [],
  refusalReason: null,
  unlistedModels: "accepted",
  toolRoute: "mcp-deferred",
  toolHint: MCP_HINT,
  skillDelivery: "native-list",
  roleChange: "next-turn",
  failureCause: ["provider/error"],
  failureLatency: "immediate",
  steer: "inject",
  cost: "null",
};

const CODEX: HarnessContract = {
  provider: "codex",
  testedWith: { cli: "0.166.0", bb: "0.49.0" },
  workerModes: ["accept-edits", "auto", "full"],
  sandbox: "available",
  refusedModes: [],
  refusalReason: null,
  unlistedModels: "accepted",
  toolRoute: "function",
  toolHint: null,
  skillDelivery: "native-list",
  roleChange: "clear",
  failureCause: ["provider/error", "turn.failed"],
  failureLatency: "retries",
  steer: "inject",
  cost: "unknown",
};

const PI: HarnessContract = {
  provider: "pi",
  testedWith: { cli: "1.4.0", bb: "0.49.0" },
  workerModes: ["full"],
  sandbox: "none",
  refusedModes: ["local-only"],
  refusalReason: PI_REASON,
  unlistedModels: "refused",
  toolRoute: "function",
  toolHint: null,
  skillDelivery: "system-prompt-list",
  roleChange: "next-turn",
  failureCause: ["system/error"],
  failureLatency: "immediate",
  steer: "inject",
  cost: "unknown",
};

const OMP: HarnessContract = {
  provider: "acp-omp",
  testedWith: { cli: "18.14.1", bb: "0.49.0" },
  workerModes: ["accept-edits", "full"],
  sandbox: "available",
  refusedModes: [],
  refusalReason: null,
  unlistedModels: "refused",
  toolRoute: "xd-device",
  toolHint: XD_HINT,
  skillDelivery: "prompt-list",
  roleChange: "clear",
  failureCause: ["provider/error"],
  failureLatency: "immediate",
  steer: "inject",
  cost: "unknown",
};

const GENERIC: HarnessContract = {
  provider: "*",
  testedWith: null,
  workerModes: [],
  sandbox: "unknown",
  refusedModes: [],
  refusalReason: null,
  unlistedModels: "refused",
  toolRoute: "unknown",
  toolHint: null,
  skillDelivery: "prompt-list",
  roleChange: "clear",
  failureCause: ["provider/error"],
  failureLatency: "unknown",
  steer: "unknown",
  cost: "unknown",
};

describe("the pinned rows", () => {
  it("[U1301] holds the claude-code row of data-model.md", () => {
    expect(contractFor("claude-code")).toEqual(CLAUDE_CODE);
  });

  it("[U1302] holds the codex row of data-model.md", () => {
    expect(contractFor("codex")).toEqual(CODEX);
  });

  it("[U1303] holds the pi row of data-model.md, with no sandbox and local-only refused", () => {
    expect(contractFor("pi")).toEqual(PI);
  });

  it("[U1304] holds the acp-omp row of data-model.md", () => {
    expect(contractFor("acp-omp")).toEqual(OMP);
  });

  it("[U1305] holds the generic row with the safe values", () => {
    expect(GENERIC_CONTRACT).toEqual(GENERIC);
  });
});

describe("row invariants", () => {
  const named = CONTRACTS;

  it("holds exactly the four named rows", () => {
    expect(named.map((row) => row.provider).sort()).toEqual(["acp-omp", "claude-code", "codex", "pi"]);
  });

  it("[U1306] marks sandbox none exactly when the only worker mode is full", () => {
    for (const row of named) {
      const onlyFull = row.workerModes.length > 0 && row.workerModes.every((mode) => mode === "full");
      expect(row.sandbox === "none", row.provider).toBe(onlyFull);
    }
  });

  it("[U1307] has a refusal reason exactly when it refuses a mode", () => {
    for (const row of [...named, GENERIC_CONTRACT]) {
      expect(row.refusedModes.length > 0, row.provider).toBe(row.refusalReason !== null);
    }
  });

  it("[U1308] has a tool hint exactly when the route is not function or unknown, and the hints are the two constants", () => {
    for (const row of [...named, GENERIC_CONTRACT]) {
      expect(row.toolHint !== null, row.provider).toBe(row.toolRoute !== "function" && row.toolRoute !== "unknown");
    }
    expect(named.filter((row) => row.toolHint !== null).map((row) => row.toolHint).sort()).toEqual([MCP_HINT, XD_HINT].sort());
  });
});

/** The path of every object or array under `value` (and `value` itself) that is not frozen. */
function unfrozenPaths(value: unknown, path: string): string[] {
  if (typeof value !== "object" || value === null) return [];
  const own = Object.isFrozen(value) ? [] : [path];
  return own.concat(Object.entries(value).flatMap(([key, child]) => unfrozenPaths(child, `${path}.${key}`)));
}

describe("frozen rows", () => {
  it("[U1478] freezes the table, every row, and everything inside the rows", () => {
    expect(unfrozenPaths(CONTRACTS, "CONTRACTS")).toEqual([]);
    expect(unfrozenPaths(GENERIC_CONTRACT, "GENERIC_CONTRACT")).toEqual([]);
  });

  it.each([
    ["claude-code", CLAUDE_CODE],
    ["pi", PI],
    ["no-such-provider", GENERIC],
  ])("[U1478] refuses a change to the row that contractFor returns for %s", (id, expected) => {
    const row = contractFor(id) as unknown as { sandbox: string; failureCause: string[] };
    expect(() => {
      row.sandbox = "available";
    }).toThrow(TypeError);
    expect(() => row.failureCause.push("system/error")).toThrow(TypeError);
    expect(contractFor(id)).toEqual(expected);
  });
});

describe("contractFor", () => {
  it("[U1309] returns the row whose provider equals the ID", () => {
    for (const row of [CLAUDE_CODE, CODEX, PI, OMP]) expect(contractFor(row.provider).provider).toBe(row.provider);
  });

  it.each(["acp-opencode", "", "Claude-Code", " pi"])("[U1310] returns the generic row for the ID %j", (id) => {
    expect(contractFor(id)).toBe(GENERIC_CONTRACT);
  });

  it.each(["__proto__", "constructor", "toString", "hasOwnProperty"])("[U1311] returns the generic row for the inherited key %s and does not throw", (id) => {
    expect(() => contractFor(id)).not.toThrow();
    expect(contractFor(id)).toBe(GENERIC_CONTRACT);
  });
});
