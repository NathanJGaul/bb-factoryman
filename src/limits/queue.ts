import { pickMachine } from "../dispatch/placement";
import { checkProfile } from "../dispatch/availability";
import type { DeliveryMode, TaskKind, TaskState } from "../machine/types";
import { preflightOnce } from "../machines/preflight";
import { errorText, type Runtime } from "../runtime";
import type { TaskRow } from "../store/types";
import { launchWorker, previewStart } from "../tools/launch";
import { loadWorkflowFor } from "../workflow/load";
import { decodeRequest, encodeRequest, type QueuedRequest } from "./request";

/** The states in which a worker is running or waiting on someone (D-084). */
export const RUNNING_STATES: readonly TaskState[] = ["working", "blocked", "validating", "needs_decision"];

export interface Caps {
  /** The project's cap from `workflow.json`, or null for none. */
  project: number | null;
  /** The global cap from the plugin settings, or null for none. */
  global: number | null;
}

/** Running workers, plus workers that are starting right now. Pass a project ID to count one project. */
export function runningCount(rt: Runtime, projectId?: string): number {
  return rt.deps.store
    .listTasks(projectId === undefined ? {} : { projectId })
    .filter((task) => RUNNING_STATES.includes(task.state) || (task.state === "queued" && rt.launching.has(task.taskId))).length;
}

/** The reason that a new worker must wait, or null when a slot is free. */
export function capReached(rt: Runtime, projectId: string, caps: Caps): string | null {
  if (caps.project !== null && runningCount(rt, projectId) >= caps.project) {
    return `the project cap of ${caps.project} running ${caps.project === 1 ? "worker" : "workers"} is reached`;
  }
  if (caps.global !== null && runningCount(rt) >= caps.global) {
    return `the global cap of ${caps.global} running ${caps.global === 1 ? "worker" : "workers"} is reached`;
  }
  return null;
}

/** The global cap from the settings. `0` means none. */
export const globalCap = (rt: Runtime): number | null => (rt.deps.settings().maxWorkers > 0 ? rt.deps.settings().maxWorkers : null);

/** Create a task in `queued` with its request in the log. It starts when a slot frees. */
export function enqueue(rt: Runtime, input: { projectId: string; kind: TaskKind; mode: DeliveryMode; request: QueuedRequest }): { ok: true; taskId: string } | { ok: false; message: string } {
  const taskId = rt.deps.newId();
  const created = rt.log.create({ type: "create", actor: "supervisor", taskId, projectId: input.projectId, kind: input.kind, mode: input.mode, request: encodeRequest(input.request) });
  return created.ok ? { ok: true, taskId } : { ok: false, message: created.refusal.message };
}

type Stored = { kind: "none" } | { kind: "request"; value: unknown };

/** The request in a task's `create` row, with the row's order. */
function storedRequest(rt: Runtime, taskId: string): { seq: number; stored: Stored } | null {
  const row = rt.deps.store.listEvents({ taskId }).find((entry) => entry.event === "create" && entry.outcome === "applied");
  if (row === undefined) return null;
  return { seq: row.seq, stored: "request" in row.payload ? { kind: "request", value: row.payload["request"] } : { kind: "none" } };
}

const state = new WeakMap<Runtime, { active: boolean; again: boolean }>();

/**
 * Start queued tasks, oldest first, while a slot is free. A task whose machine
 * is offline, whose provider is gone, or whose project file is invalid stays
 * queued. A task whose request cannot be read fails. Two overlapping calls
 * start each task once. Returns how many tasks started.
 */
export async function drain(rt: Runtime): Promise<number> {
  const mine = state.get(rt) ?? { active: false, again: false };
  state.set(rt, mine);
  if (mine.active) {
    mine.again = true;
    return 0;
  }
  mine.active = true;
  let started = 0;
  try {
    do {
      mine.again = false;
      const queued = rt.deps.store
        .listTasks({ states: ["queued"] })
        .map((task) => ({ task, found: storedRequest(rt, task.taskId) }))
        .filter((entry): entry is { task: TaskRow; found: { seq: number; stored: Stored } } => entry.found !== null && entry.found.stored.kind === "request")
        .sort((a, b) => a.found.seq - b.found.seq);
      for (const { task, found } of queued) {
        if (rt.launching.has(task.taskId)) continue;
        if (await startOne(rt, task, (found.stored as { value: unknown }).value)) started += 1;
      }
    } while (mine.again);
  } catch (error) {
    rt.deps.log.error(`The queue drain stopped: ${errorText(error)}`);
  } finally {
    mine.active = false;
  }
  return started;
}

async function startOne(rt: Runtime, task: TaskRow, raw: unknown): Promise<boolean> {
  const { bb, log } = rt.deps;
  const decoded = decodeRequest(raw);
  if (!decoded.ok) {
    await rt.apply(task.taskId, { type: "fail", actor: "system", evidence: `The queued request is unreadable: ${decoded.message}` });
    return false;
  }
  const request = decoded.request;
  const workflow = await loadWorkflowFor(rt, task.projectId);
  if (!workflow.ok) {
    log.warn(`Task ${task.taskId} stays queued: ${workflow.message}`);
    return false;
  }
  if (capReached(rt, task.projectId, { project: workflow.config.limits.maxWorkers ?? null, global: globalCap(rt) }) !== null) return false;

  try {
    const sources = await bb.getProjectSources(task.projectId);
    let host = null;
    if (request.machine !== null) {
      const placement = pickMachine({ explicit: request.machine }, await bb.listMachines(), sources);
      if (placement.status !== "chosen") {
        log.warn(`Task ${task.taskId} stays queued: ${placement.status === "blocked" ? placement.message : "its machine cannot be found"}`);
        return false;
      }
      host = placement.machine;
    }
    const problem = checkProfile(request.profile, await bb.listProviders(host?.id));
    if (problem !== null) {
      log.warn(`Task ${task.taskId} stays queued: ${problem}`);
      return false;
    }
    const sourcePath = host === null ? null : (sources.find((source) => source.hostId === host.id)?.path ?? null);
    if (host !== null && sourcePath !== null && host.id !== request.cloneHost) {
      const problems = await preflightOnce({ bb, exec: rt.deps.exec }, rt.preflightPassed, task.projectId, { host, sourcePath, mode: task.mode, provider: request.profile.provider });
      if (problems.length > 0) {
        log.warn(`Task ${task.taskId} stays queued: the preflight of ${host.name} found ${problems.map((p) => p.check).join(", ")}`);
        return false;
      }
    }
    const facts = { profile: request.profile, machine: host?.id ?? null, cloneMachine: request.cloneHost };
    const refusal = previewStart({ projectId: task.projectId, kind: task.kind, mode: task.mode, branchPrefix: request.branchPrefix, facts });
    if (refusal !== null) {
      await rt.apply(task.taskId, { type: "fail", actor: "system", evidence: `The queued task can no longer start: ${refusal.message}` });
      return false;
    }
    const launched = await launchWorker(rt, {
      taskId: task.taskId,
      projectId: task.projectId,
      kind: task.kind,
      mode: task.mode,
      description: request.description,
      facts,
      parentThreadId: request.parentThreadId,
      branchPrefix: request.branchPrefix,
      baseBranch: request.baseBranch,
    });
    if (!launched.ok) log.warn(`Queued task ${task.taskId} did not start: ${launched.text}`);
    return launched.ok;
  } catch (error) {
    log.warn(`Task ${task.taskId} stays queued: ${errorText(error)}`);
    return false;
  }
}

/** Drain the queue when a worker leaves the running states. */
export function registerQueue(rt: Runtime): void {
  rt.onApplied(async ({ task, event }) => {
    if (event.fromState !== null && RUNNING_STATES.includes(event.fromState) && !RUNNING_STATES.includes(task.state)) await drain(rt);
  });
}
