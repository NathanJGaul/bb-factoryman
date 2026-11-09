import { gateReadiness } from "../dispatch/gate";
import { loadDispatchConfig } from "../dispatch/load";
import { errorText, type Runtime } from "../runtime";
import type { CommandContext, CommandResult } from "./supervisor-command";

export const START_USAGE = "Usage: bb factoryman supervisor start [--project <id>] [--profile <name>] [--prompt <text>]\n";

/** The first prompt when the owner gives none. It is the text of `docs/LIVE-CHECK.md`. */
const DEFAULT_PROMPT = "You are the factoryman supervisor. Wait for instructions.";

const NOTHING_SPAWNED = "Nothing was spawned.";

interface StartArgs {
  projectId: string;
  profile: string | null;
  prompt: string | null;
}

/** Each flag takes one value, appears once, and is not blank. Anything else is a usage error. */
function parseStartArgs(args: string[], ctx: CommandContext): StartArgs | null {
  const seen = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i] as string;
    const value = args[i + 1];
    if (!["--project", "--profile", "--prompt"].includes(flag) || seen.has(flag) || value === undefined || value.trim() === "") return null;
    seen.set(flag, value);
  }
  const projectId = seen.get("--project") ?? ctx.projectId;
  if (projectId === undefined || projectId.trim() === "") return null;
  return { projectId, profile: seen.get("--profile") ?? null, prompt: seen.get("--prompt") ?? null };
}

const refuse = (message: string): CommandResult => ({ exitCode: 1, stderr: `${message}\n${NOTHING_SPAWNED}\n` });
const names = (profiles: Readonly<Record<string, unknown>>): string => Object.keys(profiles).join(", ") || "none";

/**
 * `bb factoryman supervisor start` spawns the supervisor thread with `role: supervisor` in the spawn call, so the role
 * exists at the thread's first session (decision D4 option B, report task H4). The profile is `--profile`, then
 * `roles.supervisor.profile`, and never `default`, which is the worker's (D-124). The profile passes the readiness,
 * mode, model, and level checks of dispatch and not the worker admission rule (D-125). Every refusal spawns nothing.
 */
export async function runSupervisorStart(rt: Runtime, args: string[], ctx: CommandContext = {}): Promise<CommandResult> {
  const parsed = parseStartArgs(args, ctx);
  if (parsed === null) return { exitCode: 2, stderr: START_USAGE };
  const { bb, files } = rt.deps;

  let checkout: string | null;
  try {
    checkout = await bb.getProjectCheckout(parsed.projectId);
  } catch (error) {
    return refuse(`Cannot start a supervisor: could not read the project (${errorText(error)}).`);
  }
  const loaded = await loadDispatchConfig(files, checkout);
  if (!loaded.ok) return refuse(`Cannot start a supervisor: ${loaded.message}.`);
  const { profiles, roles } = loaded.config;

  const name = parsed.profile ?? roles.supervisor.profile;
  if (name === null) {
    return refuse(
      `No supervisor profile is set for project ${parsed.projectId}. Pass --profile <name> or set roles.supervisor.profile in .bb/factoryman/dispatch.json. ` +
        `The profile "default" is the worker's and is not used. Defined profiles: ${names(profiles)}.`,
    );
  }
  if (!Object.hasOwn(profiles, name)) {
    return refuse(`The supervisor profile "${name}" is not defined in dispatch.json. Defined profiles: ${names(profiles)}.`);
  }
  const profile = profiles[name] as (typeof profiles)[string];

  // The project's default host runs the supervisor, so the gate reads that host (no host ID).
  const gate = await gateReadiness(bb, profile, null);
  if (!gate.ok) return refuse(`Cannot start a supervisor: ${gate.message}`);

  try {
    const { threadId } = await bb.spawnSupervisor({
      projectId: parsed.projectId,
      prompt: parsed.prompt ?? DEFAULT_PROMPT,
      profile,
      metadata: { role: "supervisor" },
      baseBranch: null,
    });
    return {
      exitCode: 0,
      stdout:
        `Started factoryman supervisor thread ${threadId} with the profile ${name} (${profile.provider}, ${profile.model}).\n` +
        "The role is set at spawn, so the thread has the four supervisor tools and the factoryman-supervisor skill from its first turn.\n",
    };
  } catch (error) {
    return { exitCode: 1, stderr: `Could not start the supervisor: ${errorText(error)}\n` };
  }
}
