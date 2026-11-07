import { decode } from "@toon-format/toon";
import { OUTCOMES, type Finding, type Gate, type Outcome, type RunView, type ValidatorResult } from "./types";

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : "");

const unreadable = (message: string): { ok: false; error: { kind: "unreadable"; message: string } } => ({ ok: false, error: { kind: "unreadable", message } });

function decodeStdout(stdout: string): { ok: true; value: Json } | { ok: false; message: string } {
  if (stdout.trim() === "") return { ok: false, message: "no-mistakes printed nothing on standard output." };
  try {
    const value = decode(stdout) as unknown;
    return isRecord(value) ? { ok: true, value } : { ok: false, message: "no-mistakes output is not a TOON object." };
  } catch (error) {
    return { ok: false, message: `no-mistakes output is not valid TOON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/** The columns come from the header, so a column that a version adds or drops cannot shift the values. */
function readFindings(value: unknown): Finding[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const findings: Finding[] = [];
  for (const row of value) {
    if (!isRecord(row) || text(row["id"]) === "") return null;
    findings.push({ id: text(row["id"]), severity: text(row["severity"]), file: text(row["file"]), action: text(row["action"]), description: text(row["description"]) });
  }
  return findings;
}

function readGate(root: Json): { ok: true; gate: Gate | null } | { ok: false } {
  const raw = root["gate"];
  if (raw === undefined) return { ok: true, gate: null };
  // The documented shape writes `gate: review` with `findings` beside it. The real output nests them.
  const body: Json = isRecord(raw) ? raw : root;
  const step = isRecord(raw) ? text(raw["step"]) : text(raw);
  const findings = readFindings(body["findings"]);
  if (step === "" || findings === null) return { ok: false };
  return { ok: true, gate: { step, status: text(body["status"]), findings } };
}

/** Read the output of `axi run`, `axi respond`, or `axi status` as a run. */
export function parseRun(stdout: string): ValidatorResult<RunView> {
  const decoded = decodeStdout(stdout);
  if (!decoded.ok) return unreadable(decoded.message);
  const root = decoded.value;

  const runValue = root["run"] ?? root["other_branch_run"];
  const run = isRecord(runValue) ? runValue : null;
  const gate = readGate(root);
  if (!gate.ok) return unreadable("The gate in the no-mistakes output has no step or unreadable findings.");

  const outcomeText = text(root["outcome"]);
  if (outcomeText !== "" && !(OUTCOMES as readonly string[]).includes(outcomeText)) {
    return unreadable(`Unknown no-mistakes outcome \`${outcomeText}\`.`);
  }
  const outcome: Outcome | null = outcomeText === "" ? null : (outcomeText as Outcome);
  const error = text(root["error"]);

  if (run === null && gate.gate === null && outcome === null) {
    return error !== "" ? { ok: false, error: { kind: "command_failed", message: error } } : unreadable("The no-mistakes output names no run, gate, or outcome.");
  }
  return {
    ok: true,
    value: {
      runId: run ? text(run["id"]) || null : null,
      branch: run ? text(run["branch"]) || null : null,
      phase: gate.gate !== null ? "gate" : outcome !== null ? "finished" : "running",
      gate: gate.gate,
      outcome,
      prUrl: run ? text(run["pr"]) || null : null,
      error: error === "" ? null : error,
    },
  };
}

/** Read the output of `axi abort`. */
export function parseAbort(stdout: string): ValidatorResult<void> {
  const decoded = decodeStdout(stdout);
  if (!decoded.ok) return unreadable(decoded.message);
  if (decoded.value["aborted"] === true) return { ok: true, value: undefined };
  const error = text(decoded.value["error"]);
  return error !== "" ? { ok: false, error: { kind: "command_failed", message: error } } : unreadable("The no-mistakes abort output does not say `aborted: true`.");
}
