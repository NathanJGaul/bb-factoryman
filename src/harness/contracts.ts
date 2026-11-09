// This module is data only. It imports nothing, so no bb change can reach it (lint enforces this, see eslint.config.js).
// The values come from the scout report data/bb-factoryman-harness-independence/report.md, section 6.2, run against bb 0.49.0.

export type PermissionMode = "accept-edits" | "auto" | "full";
export type DeliveryModeId = "no-mistakes" | "direct-PR" | "local-only";

/** The pinned facts about one bb provider. */
export interface HarnessContract {
  /** The bb provider ID. The generic row uses `*`. */
  readonly provider: string;
  /** The CLI and bb versions the report ran. Null for the generic row. */
  readonly testedWith: { readonly cli: string; readonly bb: string } | null;
  /** The permission modes bb offered when tested. Information only: the runtime reads bb. */
  readonly workerModes: readonly PermissionMode[];
  /** `none` when the harness offers no sandboxed mode. */
  readonly sandbox: "available" | "none" | "unknown";
  /** The delivery modes in which dispatch refuses the harness. */
  readonly refusedModes: readonly DeliveryModeId[];
  /** The sentence that explains the refusal. Null exactly when `refusedModes` is empty. */
  readonly refusalReason: string | null;
  /** Whether the harness accepts a model ID that bb does not list. */
  readonly unlistedModels: "accepted" | "refused";
  /** How the model sees `factoryman_report`. */
  readonly toolRoute: "function" | "mcp-deferred" | "xd-device" | "unknown";
  /** The one-line hint for a worker. Null for `function` and `unknown`. */
  readonly toolHint: string | null;
  /** How the model sees the role skill. */
  readonly skillDelivery: "native-list" | "system-prompt-list" | "prompt-list";
  /** When a stamped role reaches a live thread. */
  readonly roleChange: "next-turn" | "clear";
  /** Where bb records the cause of a failure. */
  readonly failureCause: readonly ("provider/error" | "system/error" | "turn.failed")[];
  /** How fast a start failure surfaces. */
  readonly failureLatency: "immediate" | "retries" | "unknown";
  /** The steering strategy. */
  readonly steer: "inject" | "queue" | "unknown";
  /** Whether bb gets a cost from the harness. */
  readonly cost: "reported" | "null" | "unknown";
}

const MCP_HINT =
  "In this harness the tool factoryman_report is listed as mcp__bb-bridge__factoryman_report and loads on demand: search for it with ToolSearch before you call it.";
const XD_HINT =
  "In this harness factoryman_report has no function tool: write its JSON arguments to the device that your system prompt lists under MCP Tool Routes for factoryman_report.";
const PI_REASON =
  "It runs workers with no sandbox (it offers only the permission mode `full`), so a worker can answer the owner's merge form with `bb thread interactions respond` (D-030), and local-only mode has no pull request backstop.";

const TESTED_BB = "0.49.0";

/** Freezes a value and everything inside it, so no caller of `contractFor` can change the shared table. */
function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export const CONTRACTS: readonly HarnessContract[] = deepFreeze([
  {
    provider: "claude-code",
    testedWith: { cli: "2.1.316", bb: TESTED_BB },
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
  },
  {
    provider: "codex",
    testedWith: { cli: "0.166.0", bb: TESTED_BB },
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
  },
  {
    provider: "pi",
    testedWith: { cli: "1.4.0", bb: TESTED_BB },
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
  },
  {
    provider: "acp-omp",
    testedWith: { cli: "18.14.1", bb: TESTED_BB },
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
  },
]);

/** The row for every provider that is in no other row. It makes no claim, so the runtime gate decides alone. */
export const GENERIC_CONTRACT: HarnessContract = deepFreeze({
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
});

const BY_PROVIDER: ReadonlyMap<string, HarnessContract> = new Map(CONTRACTS.map((row) => [row.provider, row]));

/** The row for a provider ID, or the generic row. It matches the ID exactly and never throws. */
export function contractFor(providerId: string): HarnessContract {
  return BY_PROVIDER.get(providerId) ?? GENERIC_CONTRACT;
}
