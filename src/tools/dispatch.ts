import { z } from "zod";
import { checkProfile } from "../dispatch/availability";
import { loadDispatchConfig } from "../dispatch/load";
import type { MachineInfo } from "../bb/port";
import { pickMachine, type MachineChoice } from "../dispatch/placement";
import { preflightOnce, reportText } from "../machines/preflight";
import type { Resolution } from "../dispatch/types";
import { createTask, transition } from "../machine/transition";
import { refuse } from "../machine/refusal";
import { errorText, type Runtime } from "../runtime";
import { identify } from "./access";
import { buildWorkerPrompt } from "./prompt";
import { failure, refusalOutcome, success, type ToolOutcome } from "./results";

/** What bb tells a tool about its caller. */
export interface Caller {
  threadId: string;
  projectId: string;
  /** Aborts when bb cancels the call. */
  signal?: AbortSignal;
}

const nonBlank = z.string().refine((value) => value.trim() !== "", "must not be blank");

export const dispatchSchema = z
  .strictObject({
    kind: z.enum(["ship", "scout"]),
    description: nonBlank,
    /** Labels that the project's dispatch rules can match. */
    tags: z.array(nonBlank).max(10).optional(),
    /** An explicit override. Without it, the dispatch rules choose the profile. */
    profile: z
      .strictObject({
        provider: nonBlank,
        model: nonBlank,
        reasoningLevel: nonBlank,
        permissionMode: z.enum(["accept-edits", "auto", "full"]),
      })
      .optional(),
    /** The ID of one rule from an `ambiguous` result. */
    rule: nonBlank.optional(),
    /** The machine to run on, by name or ID. Without it, the rule, then the project default, then the default host decide. */
    machine: nonBlank.optional(),
  })
  .refine((value) => value.profile === undefined || value.rule === undefined, "pass either `profile` or `rule`, not both");

/** The branch prefix when a project config sets none (D-034). */
export const DEFAULT_BRANCH_PREFIX = "fm/";

function ambiguousText(resolution: Extract<Resolution, { status: "ambiguous" }>): string {
  const lines = resolution.candidates.map(
    (c) => `- rule "${c.ruleId}": ${c.profile.provider} ${c.profile.model} ${c.profile.reasoningLevel} ${c.profile.permissionMode}${c.machine === null ? "" : ` on ${c.machine}`}`,
  );
  return [
    `Dispatch not started: the choice is ambiguous. ${resolution.candidates.length} rules fit this task and differ in profile or machine.`,
    ...lines,
    "Call factoryman_dispatch again with `rule` set to one of these IDs, or with an explicit `profile`. No task was created.",
  ].join("\n");
}

type Placed = { ok: true; machine: MachineInfo | null; sourcePath: string | null; cloneHost: string | null } | { ok: false; text: string };

/** Read the project's sources and, when a machine is wanted, pick it. Returns the text to show when dispatch must stop. */
async function place(rt: Runtime, projectId: string, choice: MachineChoice): Promise<Placed> {
  const { bb } = rt.deps;
  try {
    const sources = await bb.getProjectSources(projectId);
    const cloneHost = sources.find((source) => source.isDefault)?.hostId ?? null;
    const wanted = choice.explicit ?? choice.rule ?? choice.projectDefault;
    if (wanted === null || wanted === undefined) return { ok: true, machine: null, sourcePath: null, cloneHost };
    const placement = pickMachine(choice, await bb.listMachines(), sources);
    if (placement.status === "blocked") return { ok: false, text: `Dispatch blocked (${placement.code}): ${placement.message} No task was created.` };
    if (placement.status === "none") return { ok: true, machine: null, sourcePath: null, cloneHost };
    return { ok: true, machine: placement.machine, sourcePath: sources.find((source) => source.hostId === placement.machine.id)?.path ?? null, cloneHost };
  } catch (error) {
    return { ok: false, text: `Dispatch failed: could not read bb's machines (${errorText(error)}). No task was created.` };
  }
}

const SOURCE_TEXT = { rule: "rule", default: "the configured default", builtin: "the built-in default" } as const;

/**
 * Create a task and its worker. The dispatch resolver picks the profile when
 * the caller gives none (milestone 7), and the worker runs on the default host
 * until machine placement exists (milestone 8). A blocked or ambiguous result
 * creates no task.
 */
export async function dispatch(rt: Runtime, caller: Caller, raw: unknown): Promise<ToolOutcome> {
  const { store, bb } = rt.deps;
  if (identify(store, caller.threadId).role === "worker") {
    return refusalOutcome(refuse("actor_forbidden", "A worker cannot dispatch tasks."));
  }
  const parsed = dispatchSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue && issue.path.length > 0 ? ` at \`${issue.path.join(".")}\`` : "";
    return refusalOutcome(refuse("invalid_event", `Invalid dispatch arguments${where}: ${issue?.message ?? "unreadable"}.`));
  }
  const { kind, description, tags, profile: explicit, rule, machine: pinned } = parsed.data;

  const config = store.getProjectConfig(caller.projectId);
  let resolution: Resolution;
  try {
    const loaded = await loadDispatchConfig(rt.deps.files, await bb.getProjectCheckout(caller.projectId));
    if (!loaded.ok) return failure(`Dispatch blocked (config_invalid): ${loaded.message}. No task was created.`);
    resolution = rt.deps.resolver.resolve(
      { kind, mode: config.deliveryMode, description, tags: tags ?? [] },
      loaded.config,
      { ...(explicit === undefined ? {} : { profile: explicit }), ...(rule === undefined ? {} : { rule }) },
    );
  } catch (error) {
    return failure(`Dispatch failed: could not read the dispatch rules (${errorText(error)}). No task was created.`);
  }
  if (resolution.status === "ambiguous") return failure(ambiguousText(resolution));
  if (resolution.status === "blocked") return failure(`Dispatch blocked (${resolution.code}): ${resolution.message} No task was created.`);
  const { profile } = resolution;

  // Choose the machine. A pinned machine that cannot take the work blocks the dispatch, and nothing falls back (hard rule 5).
  const placed = await place(rt, caller.projectId, { explicit: pinned, rule: resolution.machine, projectDefault: config.defaultMachine });
  if (!placed.ok) return failure(placed.text);
  const { machine: host, sourcePath, cloneHost } = placed;
  const hostId = host?.id ?? null;
  const hostName = host?.name ?? null;

  try {
    const problem = checkProfile(profile, await bb.listProviders(hostId ?? undefined));
    if (problem !== null) return failure(`Dispatch blocked (provider_unavailable): ${problem} No task was created.`);
  } catch (error) {
    return failure(`Dispatch failed: could not read bb's providers (${errorText(error)}). No task was created.`);
  }

  // A remote machine must pass the preflight first. The host that holds the clone is the server's own environment, so it skips it.
  if (host !== null && sourcePath !== null && host.id !== cloneHost) {
    try {
      const problems = await preflightOnce({ bb, exec: rt.deps.exec }, rt.preflightPassed, caller.projectId, { host, sourcePath, mode: config.deliveryMode, provider: profile.provider });
      if (problems.length > 0) return failure(`Dispatch blocked (preflight_failed): ${reportText(host, config.deliveryMode, problems)}\nNo task was created.`);
    } catch (error) {
      return failure(`Dispatch failed: the preflight of ${host.name} could not run (${errorText(error)}). No task was created.`);
    }
  }

  // Ask the state machine about the start before anything exists, so a refused start (such as a local-only task on another machine) spawns no worker.
  const branchFor = (id: string) => `${config.branchPrefix ?? DEFAULT_BRANCH_PREFIX}${id}`;
  const startFields = { profile, machine: hostId, cloneMachine: cloneHost };
  const draft = createTask({ type: "create", actor: "supervisor", taskId: "preview", projectId: caller.projectId, kind, mode: config.deliveryMode });
  if (draft.ok) {
    const preview = transition(draft.snapshot, { type: "start", actor: "supervisor", threadId: "preview", branch: branchFor("preview"), ...startFields });
    if (!preview.ok) return refusalOutcome(preview.refusal);
  }

  const taskId = rt.deps.newId();
  const branch = branchFor(taskId);
  const created = rt.log.create({ type: "create", actor: "supervisor", taskId, projectId: caller.projectId, kind, mode: config.deliveryMode });
  if (!created.ok) return refusalOutcome(created.refusal);

  let threadId: string;
  try {
    ({ threadId } = await bb.spawnWorker({
      projectId: caller.projectId,
      parentThreadId: caller.threadId,
      prompt: buildWorkerPrompt({ taskId, kind, mode: config.deliveryMode, branch, description }),
      profile,
      metadata: { role: "worker", taskId, kind },
      baseBranch: config.baseBranch,
      hostId,
    }));
  } catch (error) {
    await rt.apply(taskId, { type: "fail", actor: "system", evidence: `worker spawn failed: ${errorText(error)}` });
    return failure(`Dispatch failed: the worker could not start (${errorText(error)}). Task ${taskId} is failed.`);
  }

  const started = await rt.apply(taskId, { type: "start", actor: "supervisor", threadId, branch, evidence: description, ...startFields });
  if (!started.ok) return refusalOutcome(started.refusal);

  // The worker can fail before this record exists, and no event would reach us then.
  try {
    if ((await bb.getThread(threadId))?.status === "error") {
      await rt.apply(taskId, { type: "fail", actor: "system", evidence: "worker thread entered the error state right after it started" });
      return failure(`Task ${taskId} started, but its worker thread ${threadId} failed at once. Task ${taskId} is failed.`);
    }
  } catch (error) {
    rt.deps.log.warn(`Could not read worker thread ${threadId} after start: ${errorText(error)}`);
  }

  const chosen =
    resolution.source === "override"
      ? ""
      : `\nProfile: ${profile.provider} ${profile.model} ${profile.reasoningLevel} ${profile.permissionMode}, from ${SOURCE_TEXT[resolution.source]}${resolution.ruleId === null ? "" : ` "${resolution.ruleId}"`}.`;
  return success(`Dispatched ${kind} task ${taskId} in ${config.deliveryMode} mode. Worker thread ${threadId}, branch ${branch}.${hostName === null ? "" : ` Machine ${hostName} (${hostId}).`}${chosen}`);
}
