import type { BbPort, MachineInfo } from "../bb/port";
import type { Exec, ExecResult } from "../exec";
import { readinessProblem } from "../dispatch/availability";
import type { DeliveryMode } from "../machine/types";
import { describeObservation, observeValidatorAgent, validatorProblem } from "../validator/agent";

export interface Problem {
  check: string;
  message: string;
}

export interface PreflightInput {
  host: MachineInfo;
  /** Where the project's copy sits on the host. */
  sourcePath: string;
  mode: DeliveryMode;
  /** The provider the task will use, or null to ask for any available provider. */
  provider: string | null;
}

type Deps = { bb: Pick<BbPort, "listProviders" | "getProviderStates">; exec: Exec };

const reason = (result: ExecResult): string => result.error ?? (result.stderr.trim() || `exit code ${String(result.code)}`);

export interface PreflightReport {
  problems: Problem[];
  /** Lines that are not problems but belong in the report, such as the validator agent when it is ready. */
  notes: string[];
}

/**
 * Check what a remote machine needs before the first dispatch (docs/DESIGN.md,
 * Machines): the agent CLI, git, the gate install and the validator's agent for
 * `no-mistakes` mode, and credentials for the pull request modes. It changes
 * nothing on the machine.
 */
export async function preflightReport(deps: Deps, input: PreflightInput): Promise<PreflightReport> {
  const { host, sourcePath, mode, provider } = input;
  const problems: Problem[] = [];
  const notes: string[] = [];
  const run = (command: string, args: string[]) => deps.exec(command, args, { cwd: sourcePath, host: host.id });
  const expectOk = async (check: string, command: string, args: string[], describe: (detail: string) => string) => {
    const result = await run(command, args);
    if (result.code !== 0) problems.push({ check, message: describe(reason(result)) });
  };

  try {
    const [providers, states] = await Promise.all([deps.bb.listProviders(host.id), deps.bb.getProviderStates(host.id)]);
    // A provider counts only when bb lists it and reports it ready on this host.
    const listed = new Set(providers.filter((candidate) => candidate.available).map((candidate) => candidate.id));
    const problem = provider === null ? null : readinessProblem(provider, states, host.name);
    const anyReady = states.some((state) => state.status === "ready" && listed.has(state.providerId));
    if (provider === null ? !anyReady : problem !== null || !listed.has(provider)) {
      problems.push({
        check: "agent_cli",
        message:
          provider === null
            ? `No agent CLI is available on ${host.name}. Install one and sign in on that machine.`
            : (problem ?? `The agent CLI for \`${provider}\` is not available on ${host.name}. Install it and sign in on that machine.`),
      });
    }
  } catch (error) {
    problems.push({ check: "agent_cli", message: `Could not read the providers of ${host.name}: ${error instanceof Error ? error.message : String(error)}` });
  }

  await expectOk("git", "git", ["--version"], (detail) => `git does not run on ${host.name} (${detail}).`);
  if (mode === "no-mistakes") {
    await expectOk("no_mistakes_installed", "sh", ["-c", "command -v no-mistakes"], () => `no-mistakes is not installed on ${host.name}. Install it, then run \`no-mistakes init\` in ${sourcePath}.`);
    await expectOk("no_mistakes_initialized", "git", ["remote", "get-url", "no-mistakes"], () => `no-mistakes is not initialized in ${sourcePath} on ${host.name}. Run \`no-mistakes init\` there.`);
    // The pipeline runs the agent that no-mistakes' own configuration names, which may not be the worker's provider (D-126).
    const observation = await observeValidatorAgent(deps, { hostId: host.id, hostName: host.name });
    const problem = validatorProblem(observation, host.name);
    if (problem === null) notes.push(describeObservation(observation, host.name));
    else problems.push({ check: "validator_agent", message: problem });
  }
  if (mode !== "local-only") {
    await expectOk("gh_credentials", "gh", ["auth", "status"], (detail) => `gh has no credentials on ${host.name} (${detail}). Run \`gh auth login\` there with a token scoped to this repository.`);
  }
  return { problems, notes };
}

/** The problems of `preflightReport`. Dispatch and the queue need no more. */
export async function runPreflight(deps: Deps, input: PreflightInput): Promise<Problem[]> {
  return (await preflightReport(deps, input)).problems;
}

/** Run the preflight once per host, project, mode, and provider until restart. A failure is never cached. */
export async function preflightOnce(deps: Deps, cache: Set<string>, projectId: string, input: PreflightInput): Promise<Problem[]> {
  const key = [input.host.id, projectId, input.mode, input.provider ?? "*"].join("|");
  if (cache.has(key)) return [];
  const problems = await runPreflight(deps, input);
  if (problems.length === 0) cache.add(key);
  return problems;
}

export function reportText(host: MachineInfo, mode: DeliveryMode, problems: readonly Problem[], notes: readonly string[] = []): string {
  const head =
    problems.length === 0
      ? [`Machine ${host.name} (${host.id}) is ready for ${mode} mode work.`]
      : [`Machine ${host.name} (${host.id}) is not ready for ${mode} mode work:`, ...problems.map((problem) => `- ${problem.check}: ${problem.message}`)];
  return [...head, ...notes].join("\n");
}
