import { INIT_USAGE, runDispatchInit } from "../dispatch/init";
import { pickMachine } from "../dispatch/placement";
import { reportText, runPreflight } from "../machines/preflight";
import { protectionSteps } from "../limits/protection";
import { parseRegistry, type RegistryEntry } from "../limits/registry";
import { errorText, type Runtime } from "../runtime";
import { identify } from "./access";

export interface CommandResult {
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

const USAGE =
  "Usage: bb factoryman supervisor <thread-id>\n" +
  "Usage: bb factoryman preflight <machine> --project <project-id> [--provider <provider-id>]\n" +
  INIT_USAGE +
  "Usage: bb factoryman protection <owner/repo> [--branch <branch>] [--check <name>]\n" +
  "Usage: bb factoryman import-registry --file <path>\n";

/** What bb tells a command about where it was called. */
export interface CommandContext {
  projectId?: string;
}

/**
 * `bb factoryman supervisor <thread-id>` stamps the supervisor role on a
 * thread, so bb offers it the four supervisor tools. The stamp only chooses
 * which tools bb offers. Each tool still decides the caller from the store.
 *
 * `bb factoryman preflight <machine> --project <id>` reports what a remote
 * machine is missing, and changes nothing.
 *
 * `bb factoryman dispatch init --provider <id>` writes a starter dispatch.json
 * for a project, and writes nothing when one exists (D-104).
 */
export async function runFactorymanCommand(rt: Runtime, argv: string[], ctx: CommandContext = {}): Promise<CommandResult> {
  const [command, ...rest] = argv;
  if (command === "supervisor") return supervisor(rt, rest);
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
  return { exitCode: 0, stdout: `Thread ${threadId} is now a factoryman supervisor. It sees the four supervisor tools from its next session.\n` };
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
    const problems = await runPreflight({ bb, exec }, { host: machine, sourcePath, mode, provider: parsed.provider });
    return { exitCode: problems.length === 0 ? 0 : 1, stdout: `${reportText(machine, mode, problems)}\n` };
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

const DRY_RUN_ONLY = "bb factoryman import-registry is a dry run. --apply is not implemented in this release, so nothing was read or written.\n";

function reportLine(entry: RegistryEntry, projectId: string | undefined): string {
  return [entry.name, entry.registeredMode, entry.mode ?? "unknown", entry.yolo ? "on" : "off", entry.branchPrefix, entry.forge, projectId ?? "not found in bb"].join(" | ");
}

/** Read firstmate's registry and print what each project would become. It writes nothing (D-088). */
async function importRegistry(rt: Runtime, args: string[]): Promise<CommandResult> {
  let file: string | null = null;
  let apply = false;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--apply") apply = true;
    else if (args[i] === "--file" && args[i + 1] !== undefined && !(args[i + 1] as string).startsWith("--")) {
      file = args[i + 1] as string;
      i += 1;
    } else return { exitCode: 2, stderr: USAGE };
  }
  if (apply) return { exitCode: 2, stderr: DRY_RUN_ONLY };
  if (file === null) return { exitCode: 2, stderr: USAGE };

  let text: string | null;
  try {
    text = await rt.deps.files.readText(file);
  } catch (error) {
    return { exitCode: 1, stderr: `Could not read ${file}: ${errorText(error)}\n` };
  }
  if (text === null) return { exitCode: 1, stderr: `Could not read ${file}: the file does not exist.\n` };

  const { entries, skipped } = parseRegistry(text);
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
