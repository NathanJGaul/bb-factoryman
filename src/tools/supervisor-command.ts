import { pickMachine } from "../dispatch/placement";
import { reportText, runPreflight } from "../machines/preflight";
import { errorText, type Runtime } from "../runtime";
import { identify } from "./access";

export interface CommandResult {
  exitCode: number;
  stdout?: string;
  stderr?: string;
}

const USAGE = "Usage: bb factoryman supervisor <thread-id>\nUsage: bb factoryman preflight <machine> --project <project-id> [--provider <provider-id>]\n";

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
 */
export async function runFactorymanCommand(rt: Runtime, argv: string[], ctx: CommandContext = {}): Promise<CommandResult> {
  const [command, ...rest] = argv;
  if (command === "supervisor") return supervisor(rt, rest);
  if (command === "preflight") return preflight(rt, rest, ctx);
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
