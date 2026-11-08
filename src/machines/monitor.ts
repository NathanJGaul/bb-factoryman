import type { MachineInfo } from "../bb/port";
import { errorText, type Runtime } from "../runtime";
import type { TaskRow } from "../store/types";

/** The start of the evidence on a block that the monitor wrote. The monitor unblocks only blocks that start with it. */
export const MACHINE_OFFLINE = "machine offline: ";

/** The monitor reads the machines at most once a second, whatever the setting says. */
export function pollMsFrom(seconds: number): number {
  return Math.max(1000, Math.round(seconds * 1000));
}

/** States where a task has ended, so its machine no longer matters. */
const ENDED: readonly string[] = ["failed", "torn_down"];

/**
 * Watches the machines that tasks are pinned to (hard rule 5). bb sends no
 * disconnect event (spike item 7), so `tick` reads the machine list. A
 * `working` task on an offline machine becomes `blocked`, and the notifier
 * wakes the supervisor. The monitor unblocks only the blocks that it wrote. It
 * never moves a task to another machine: no event can change a task's machine.
 */
export class MachineMonitor {
  /** `taskId:state` pairs that already got a warning, so a long outage warns once. */
  private readonly warned = new Set<string>();
  /** Host IDs that bb removed while this process ran. Their tasks never come back. */
  private readonly removed = new Set<string>();

  constructor(private readonly rt: Runtime) {}

  async tick(): Promise<void> {
    const { bb, log, store } = this.rt.deps;
    let machines: MachineInfo[];
    try {
      machines = await bb.listMachines();
    } catch (error) {
      log.warn(`The machine monitor could not list the machines: ${errorText(error)}`);
      return;
    }
    for (const task of store.listTasks()) {
      if (task.machine === null || ENDED.includes(task.state)) continue;
      const machine = machines.find((candidate) => candidate.id === task.machine);
      if (machine?.online === true && !this.removed.has(machine.id)) {
        await this.recover(task, machine);
      } else {
        await this.lost(
          task,
          machine === undefined
            ? `machine ${task.machine} is missing from bb`
            : this.removed.has(machine.id)
              ? `${machine.name} (${machine.id}) was removed`
              : `${machine.name} (${machine.id}) is ${machine.status}, phase ${machine.phase}`,
        );
      }
    }
  }

  /** bb removed a machine: block its working tasks at once. */
  async hostDeleted(hostId: string, name: string): Promise<void> {
    this.removed.add(hostId);
    for (const task of this.rt.deps.store.listTasks()) {
      if (task.machine === hostId && !ENDED.includes(task.state)) await this.lost(task, `${name} (${hostId}) was removed`);
    }
  }

  private async lost(task: TaskRow, detail: string): Promise<void> {
    if (task.state === "blocked") return;
    if (task.state === "working") {
      await this.apply(task, { type: "block", actor: "system", evidence: `${MACHINE_OFFLINE}${detail}.` });
      return;
    }
    const key = `${task.taskId}:${task.state}`;
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.rt.deps.log.warn(`Task ${task.taskId} is ${task.state} on a machine that is offline (${detail}). The monitor can only block a working task, so it changed nothing.`);
  }

  private async recover(task: TaskRow, machine: MachineInfo): Promise<void> {
    this.forget(task.taskId);
    if (task.state !== "blocked") return;
    const last = this.rt.deps.store.listEvents({ taskId: task.taskId }).findLast((row) => row.outcome === "applied");
    if (last?.event !== "block" || last.actor !== "system" || !(last.evidence ?? "").startsWith(MACHINE_OFFLINE)) return;
    await this.apply(task, { type: "unblock", actor: "system", evidence: `The machine is back: ${machine.name} (${machine.id}) is online again.` });
  }

  private forget(taskId: string): void {
    for (const key of this.warned) if (key.startsWith(`${taskId}:`)) this.warned.delete(key);
  }

  private async apply(task: TaskRow, event: Record<string, unknown>): Promise<void> {
    const outcome = await this.rt.apply(task.taskId, event);
    if (!outcome.ok) this.rt.deps.log.error(`The machine monitor could not record ${String(event["type"])} for task ${task.taskId}: ${outcome.refusal.message}`);
  }
}
