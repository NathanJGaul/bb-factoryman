import type { BbPort } from "./bb/port";
import type { DispatchResolver } from "./dispatch/types";
import type { Exec } from "./exec";
import type { Files } from "./files";
import { TaskLog, type LogOutcome } from "./store/task-log";
import type { Store } from "./store/store";
import type { TaskEventRow, TaskRow } from "./store/types";

export interface Logger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface Settings {
  mergeMethod: "squash" | "merge" | "rebase";
  approvalTimeoutMs: number;
  /** How often the machine monitor reads the machines. */
  machinePollMs: number;
  /** The global cap on running workers. 0 means no cap. */
  maxWorkers: number;
}

export interface AppliedEvent {
  task: TaskRow;
  event: TaskEventRow;
}

export type AppliedListener = (applied: AppliedEvent) => void | Promise<void>;

export interface RuntimeDeps {
  store: Store;
  bb: BbPort;
  exec: Exec;
  /** Reads the project's `.bb/factoryman/` files. */
  files: Files;
  /** Turns task facts and the dispatch config into a profile. */
  resolver: DispatchResolver;
  log: Logger;
  now: () => string;
  newId: () => string;
  /** Waits `ms` milliseconds. Injected so that tests never wait. */
  sleep: (ms: number) => Promise<void>;
  settings: () => Settings;
}

/**
 * The deps bundle and the one apply path. Tools, event handlers, and the
 * validator driver all record events through `apply`, so every listener sees
 * every applied event exactly once.
 */
export class Runtime {
  readonly log: TaskLog;
  /** Task IDs whose merge approval form is open right now. */
  readonly openMergeForms = new Set<string>();
  /** Task IDs whose decision form is open right now. */
  readonly openDecisionForms = new Set<string>();
  /** Task IDs whose worker is starting right now. They count as running before `start` is recorded. */
  readonly launching = new Set<string>();
  /** Passed preflights, by host, project, mode, and provider. A restart clears it. */
  readonly preflightPassed = new Set<string>();
  private readonly listeners: AppliedListener[] = [];

  constructor(readonly deps: RuntimeDeps) {
    this.log = new TaskLog(deps.store, { now: deps.now });
  }

  /** Register a listener that runs after each applied event, in registration order. */
  onApplied(listener: AppliedListener): void {
    this.listeners.push(listener);
  }

  /**
   * Record one event for a task. Listeners run after the event is stored. A
   * listener that fails is logged and never undoes the event.
   */
  async apply(taskId: string, raw: unknown): Promise<LogOutcome> {
    const outcome = this.log.apply(taskId, raw);
    if (!outcome.ok) return outcome;
    for (const listener of this.listeners) {
      try {
        await listener({ task: outcome.task, event: outcome.event });
      } catch (error) {
        this.deps.log.error(`A listener failed after ${outcome.event.event} on ${taskId}: ${errorText(error)}`);
      }
    }
    return outcome;
  }
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
