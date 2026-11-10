import { INIT_USAGE, runDispatchInit } from "../dispatch/init";
import { pickMachine } from "../dispatch/placement";
import { preflightReport, reportText } from "../machines/preflight";
import { protectionSteps } from "../limits/protection";
import { parseRegistry, type RegistryEntry } from "../limits/registry";
import { planApply, type ApplyPlan } from "../limits/registry-apply";
import { errorText, type Runtime } from "../runtime";
import { roleAdvice } from "../harness/advice";
import { GENERIC_CONTRACT, contractFor } from "../harness/contracts";
import { identify } from "./access";
import { runSupervisorStart, START_USAGE } from "./supervisor-start";

export interface CommandResult {
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

const IMPORT_USAGE = "Usage: bb factoryman import-registry --file <path>\n" + "Usage: bb factoryman import-registry --file <path> --apply --project <name>\n";

const USAGE =
  "Usage: bb factoryman supervisor <thread-id>\n" +
  START_USAGE +
  "Usage: bb factoryman preflight <machine> --project <project-id> [--provider <provider-id>]\n" +
  INIT_USAGE +
  "Usage: bb factoryman protection <owner/repo> [--branch <branch>] [--check <name>]\n" +
  IMPORT_USAGE;

/** What bb tells a command about where it was called. */
export interface CommandContext {
  projectId?: string;
}

/**
 * `bb factoryman supervisor <thread-id>` stamps the supervisor role on a
 * thread, so bb offers it the five supervisor tools. The stamp only chooses
 * which tools bb offers. Each tool still decides the caller from the store.
 *
 * `bb factoryman supervisor start` spawns a supervisor with the role set in the
 * spawn call, so the role exists at the thread's first session (report task H4).
 *
 * `bb factoryman preflight <machine> --project <id>` reports what a remote
 * machine is missing, and changes nothing.
 *
 * `bb factoryman dispatch init --provider <id>` writes a starter dispatch.json
 * for a project, and writes nothing when one exists (D-112).
 */
export async function runFactorymanCommand(rt: Runtime, argv: string[], ctx: CommandContext = {}): Promise<CommandResult> {
  const [command, ...rest] = argv;
  if (command === "supervisor") return rest[0] === "start" ? runSupervisorStart(rt, rest.slice(1), ctx) : supervisor(rt, rest);
  if (command === "preflight") return preflight(rt, rest, ctx);
  if (command === "dispatch") return rest[0] === "init" ? runDispatchInit(rt, rest.slice(1), ctx) : { exitCode: 2, stderr: USAGE };
  if (command === "protection") return protection(rest);
  if (command === "import-registry") return importRegistry(rt, rest);
  return { exitCode: 2, stderr: USAGE };
}

async function supervisor(rt: Runtime, args: string[]): Promise<CommandResult> {
  const [threadId, ...rest] = args;
  if (threadId === undefined || threadId.trim() === "" || rest.length > 0) return { exitCode: 2, stderr: USAGE };
  if (identify(rt.deps.store, threadId).role === "worker") {
    return { exitCode: 1, stderr: `Thread ${threadId} is a task worker, so it cannot be a supervisor.\n` };
  }
  try {
    await rt.deps.bb.setThreadMetadata(threadId, { role: "supervisor" });
  } catch (error) {
    return { exitCode: 1, stderr: `Could not stamp thread ${threadId}: ${errorText(error)}\n` };
  }
  // The stamp is done. Read the thread's harness for the advice: when bb cannot say, the advice is the generic one.
  let providerId: string | null = null;
  let unreadReason: string | undefined;
  try {
    const thread = await rt.deps.bb.getThread(threadId);
    providerId = thread?.providerId ?? null;
    if (thread === null) unreadReason = "bb does not know the thread";
  } catch (error) {
    unreadReason = errorText(error);
  }
  const contract = providerId === null ? GENERIC_CONTRACT : contractFor(providerId);
  return { exitCode: 0, stdout: `Thread ${threadId} is now a factoryman supervisor.\n${roleAdvice(threadId, providerId, contract, unreadReason)}\n` };
}

function parsePreflight(args: string[], ctx: CommandContext): { machine: string; projectId: string; provider: string | null } | null {
  const [machine, ...flags] = args;
  if (machine === undefined || machine.trim() === "" || machine.startsWith("--")) return null;
  let projectId = ctx.projectId ?? null;
  let provider: string | null = null;
  for (let i = 0; i < flags.length; i += 2) {
    const value = flags[i + 1];
    if (value === undefined || value.trim() === "") return null;
    if (flags[i] === "--project") projectId = value;
    else if (flags[i] === "--provider") provider = value;
    else return null;
  }
  return projectId === null || projectId.trim() === "" ? null : { machine, projectId, provider };
}

async function preflight(rt: Runtime, args: string[], ctx: CommandContext): Promise<CommandResult> {
  const parsed = parsePreflight(args, ctx);
  if (parsed === null) return { exitCode: 2, stderr: USAGE };
  const { bb, exec, store } = rt.deps;
  try {
    const sources = await bb.getProjectSources(parsed.projectId);
    const placement = pickMachine({ explicit: parsed.machine }, await bb.listMachines(), sources);
    if (placement.status === "blocked") return { exitCode: 1, stderr: `${placement.code}: ${placement.message}\n` };
    if (placement.status !== "chosen") return { exitCode: 2, stderr: USAGE };
    const { machine, isClone } = placement;
    if (isClone) return { exitCode: 0, stdout: `Machine ${machine.name} (${machine.id}) holds the project's clone, so no remote preflight applies.\n` };
    const mode = store.getProjectConfig(parsed.projectId).deliveryMode;
    const sourcePath = sources.find((source) => source.hostId === machine.id)?.path ?? "";
    const { problems, notes } = await preflightReport({ bb, exec }, { host: machine, sourcePath, mode, provider: parsed.provider });
    return { exitCode: problems.length === 0 ? 0 : 1, stdout: `${reportText(machine, mode, problems, notes)}\n` };
  } catch (error) {
    return { exitCode: 1, stderr: `Preflight could not run: ${errorText(error)}\n` };
  }
}

/** `bb factoryman protection <owner/repo>` prints the branch-protection steps. It runs nothing (hard rule 8, D-089). */
function protection(args: string[]): CommandResult {
  const [repo, ...flags] = args;
  if (repo === undefined || repo.startsWith("--") || flags.length % 2 !== 0) return { exitCode: 2, stderr: USAGE };
  let branch = "main";
  let check = "no-mistakes";
  for (let i = 0; i < flags.length; i += 2) {
    const value = flags[i + 1] as string;
    if (flags[i] === "--branch") branch = value;
    else if (flags[i] === "--check") check = value;
    else return { exitCode: 2, stderr: USAGE };
  }
  const steps = protectionSteps({ repo, branch, check });
  return steps.ok ? { exitCode: 0, stdout: steps.text } : { exitCode: 2, stderr: `${steps.message}\n${USAGE}` };
}

function reportLine(entry: RegistryEntry, projectId: string | undefined): string {
  return [entry.name, entry.registeredMode, entry.mode ?? "unknown", entry.yolo ? "on" : "off", entry.branchPrefix, entry.forge, projectId ?? "not found in bb"].join(" | ");
}

/** The arguments of `import-registry`, or null when the call is malformed. */
function parseImportArgs(args: string[]): { file: string; apply: boolean; project: string | null } | null {
  let file: string | null = null;
  let apply = false;
  let project: string | null = null;
  const valueAt = (i: number): string | null => {
    const value = args[i + 1];
    return value === undefined || value.trim() === "" || value.startsWith("--") ? null : value;
  };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--apply") apply = true;
    else if (args[i] === "--file" && valueAt(i) !== null) {
      file = args[i + 1] as string;
      i += 1;
    } else if (args[i] === "--project" && project === null && valueAt(i) !== null) {
      project = args[i + 1] as string;
      i += 1;
    } else return null;
  }
  // Apply names exactly one project. A project without --apply is a half-formed apply, not a filtered dry run (D-148).
  if (file === null || apply !== (project !== null)) return null;
  return { file, apply, project };
}

const show = (value: unknown): string => (value === null ? "(none)" : typeof value === "boolean" ? (value ? "on" : "off") : String(value));

function applyReport(plan: ApplyPlan): string {
  const written = plan.changes.filter((change) => change.changed);
  const kept = plan.changes.filter((change) => !change.changed);
  const lines = [`Applied registry line "${plan.entryName}" to bb project ${plan.projectId}.`];
  if (written.length > 0) lines.push("written:", ...written.map((change) => `  ${change.field}: ${show(change.from)} -> ${show(change.to)}`));
  lines.push("unchanged:", ...kept.map((change) => `  ${change.field}: ${show(change.from)}`), ...plan.untouched.map((item) => `  ${item.field}: ${show(item.value)} (not in the registry)`));
  if (written.length === 0) lines.push("Nothing was written.");
  if (plan.notes.length > 0) lines.push("Notes:", ...plan.notes.map((note) => `- ${plan.entryName}: ${note}`));
  lines.push(`Forge ${plan.forge} is not stored.`);
  return `${lines.join("\n")}\n`;
}

/**
 * `bb factoryman import-registry --file <path>` reads firstmate's registry and prints what each project would become.
 * With `--apply --project <name>` it also writes the stored config of that one project (D-148). Nothing else is written.
 */
async function importRegistry(rt: Runtime, args: string[]): Promise<CommandResult> {
  const parsed = parseImportArgs(args);
  if (parsed === null) return { exitCode: 2, stderr: IMPORT_USAGE };
  const { file, project: applyTo } = parsed;

  let text: string | null;
  try {
    text = await rt.deps.files.readText(file);
  } catch (error) {
    return { exitCode: 1, stderr: `Could not read ${file}: ${errorText(error)}\n` };
  }
  if (text === null) return { exitCode: 1, stderr: `Could not read ${file}: the file does not exist.\n` };

  const { entries, skipped } = parseRegistry(text);
  if (applyTo !== null) return applyRegistry(rt, applyTo, entries);
  let projects: Array<{ id: string; name: string }> = [];
  let projectsNote: string | null = null;
  try {
    projects = await rt.deps.bb.listProjects();
  } catch (error) {
    projectsNote = `The bb projects could not be listed (${errorText(error)}), so no project is matched by name.`;
    rt.deps.log.warn(`Could not list the bb projects for the registry report: ${errorText(error)}`);
  }
  const idOf = (name: string) => projects.find((project) => project.name.toLowerCase() === name.toLowerCase())?.id;
  const lines = [
    `Registry ${file}: ${entries.length} projects, ${skipped} other lines skipped.`,
    "Dry run: nothing was written. A project keeps its stored config (no-mistakes, yolo off) until a person sets it.",
    ...(projectsNote === null ? [] : [`Note: ${projectsNote}`]),
    "",
    "name | registered mode | plugin mode | yolo | branch prefix | forge | bb project",
    ...entries.map((entry) => reportLine(entry, idOf(entry.name))),
  ];
  const flagged = entries.flatMap((entry) => entry.flags.map((flag) => `- ${entry.name}: ${flag}`));
  const notes = entries.flatMap((entry) => entry.notes.map((note) => `- ${entry.name}: ${note}`));
  if (flagged.length > 0) lines.push("", "Flags (look at these before the cutover):", ...flagged);
  if (notes.length > 0) lines.push("", "Notes:", ...notes);
  return { exitCode: 0, stdout: `${lines.join("\n")}\n` };
}

/** Write the stored config of the one bb project named `name` from its registry line. It refuses on any doubt (D-148). */
async function applyRegistry(rt: Runtime, name: string, entries: RegistryEntry[]): Promise<CommandResult> {
  const { bb, store, log } = rt.deps;
  let projects: Array<{ id: string; name: string }>;
  try {
    projects = await bb.listProjects();
  } catch (error) {
    log.warn(`Could not list the bb projects for the registry apply: ${errorText(error)}`);
    return { exitCode: 1, stderr: `The bb projects could not be listed (${errorText(error)}), so nothing was written.\n` };
  }
  const plan = planApply({ name, entries, projects, stored: (id) => store.getProjectConfig(id) });
  if (!plan.ok) return { exitCode: 1, stderr: `${plan.message}\n` };
  const next = plan.next;
  if (next !== null) {
    try {
      store.transaction(() => store.putProjectConfig(next));
    } catch (error) {
      return { exitCode: 1, stderr: `Could not write the config of ${plan.projectId}: ${errorText(error)}\n` };
    }
    log.info(`Applied the registry line for ${plan.entryName} to bb project ${plan.projectId}.`);
  }
  return { exitCode: 0, stdout: applyReport(plan) };
}
