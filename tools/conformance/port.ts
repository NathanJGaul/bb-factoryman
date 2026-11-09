/** One thing a scenario asserts. The id has the form `S<number>.<name>` so a known gap can name it. */
export interface Check {
  id: string;
  title: string;
  ok: boolean;
  /** What the scenario read to decide, in plain words. Never model text. */
  evidence: string;
  /** A fact about the harness that the support document should show next to a passing scenario. */
  note?: string;
}

/** What one scenario returned, before the known gaps are applied. */
export interface ScenarioOutcome {
  id: string;
  /** True when the scenario does not run at this tier. */
  skipped?: boolean;
  checks: Check[];
  /** Set when the scenario threw. */
  error?: string;
}

export interface TaskRow {
  taskId: string;
  projectId: string;
  kind: "ship" | "scout";
  mode: string;
  state: string;
  workerThreadId: string | null;
  branch: string | null;
  machine: string | null;
  pullRequestUrl: string | null;
}

/** One row of the plugin's event log, as the read RPC returns it. */
export interface EventRow {
  seq: number;
  taskId: string;
  at: string;
  fromState: string | null;
  toState: string | null;
  event: string;
  actor: string;
  evidence: string | null;
  outcome: "applied" | "refused";
  reasonCode: string | null;
  reasonMessage: string | null;
}

/** One provider as `bb.sdk.system.providerStates()` reports it. */
export interface ProviderState {
  id: string;
  status: string;
  message: string | null;
  installedVersion: string | null;
  minimumSupportedVersion: string | null;
  loginCommand: string | null;
}

/** What bb records about a thread when it spawns it. */
export interface ThreadFacts {
  id: string;
  providerId: string;
  status: string;
  parentThreadId: string | null;
  model: string | null;
  reasoningLevel: string | null;
  permissionMode: string | null;
}

/** The plugin tools and skills a thread's model was offered, by any route. Tool names are the plugin's (`factoryman_report`). */
export interface Offers {
  tools: string[];
  skills: string[];
}

export interface ToolResult {
  text: string;
  isError: boolean;
}

export interface Wake {
  seq: number;
  text: string;
  /** True when a turn of the thread was running when the wake arrived. */
  busy: boolean;
}

/** Who a thread is for, in a brain's log: a task's worker, or a supervisor by label. */
export type Who = { kind: "worker"; taskId: string } | { kind: "supervisor"; label: string };

export interface DispatchOptions {
  /** A profile that replaces the driver's. */
  profile?: import("./drivers/types.ts").Profile;
  /** A behavior flag, written into the task description as `[brain:<flag>]`. */
  flag?: string;
}

/**
 * The lab, as the scenarios see it. Every method reads plugin events, bb state, git state, or a process list.
 * No method returns what a model said, so a scenario cannot depend on model text.
 */
export interface Lab {
  readonly tier: "1" | "1.5";
  readonly driver: import("./drivers/types.ts").Driver;
  /** The longest a scenario waits for something that should happen. */
  readonly patienceMs: number;
  /** The longest a scenario waits for a harness to give up on a failing model, which can take minutes on some harnesses. */
  readonly failurePatienceMs: number;
  /** How long a scenario waits after something happened, to see that it does not happen twice. */
  readonly settleMs: number;

  tasks(): Promise<TaskRow[]>;
  events(taskId?: string): Promise<EventRow[]>;
  /** Poll the plugin until the task is in one of the states. Returns null when the time runs out. */
  waitForState(taskId: string, states: string[], timeoutMs: number): Promise<TaskRow | null>;

  /** Call a plugin tool through the driver supervisor (the stub) and return the tool's own text. */
  callTool(tool: string, args: Record<string, unknown>): Promise<ToolResult>;
  /** Dispatch through the driver supervisor with the harness's profile. `taskId` is the one new task, or null. */
  dispatch(kind: "scout" | "ship", description: string, options?: DispatchOptions): Promise<{ result: ToolResult; taskId: string | null }>;

  providerStates(): Promise<ProviderState[]>;
  thread(id: string): Promise<ThreadFacts>;
  /** The wake messages the plugin sent to the thread, in order. */
  wakes(threadId: string): Promise<Wake[]>;
  /** The thread that spawned the task's worker. */
  parentOf(taskId: string): Promise<string | null>;
  offers(who: Who): Promise<Offers>;

  /** Spawn the supervisor under test (the harness at tier 1.5, the stub at tier 1). Returns its thread id. Does not stamp it. */
  spawnSupervisor(label: string): Promise<string>;
  /** Send the supervisor a prompt (the label marker is added) and wait for the turn to end. */
  tell(threadId: string, label: string, directives: string[], options?: { wait?: boolean }): Promise<void>;
  waitIdle(threadId: string, timeoutMs: number): Promise<boolean>;
  /** `bb factoryman supervisor <thread>`: the command's exit code and text. */
  stamp(threadId: string): Promise<{ code: number; text: string }>;
  /** `bb factoryman supervisor start ...`: the command's exit code and text. */
  startSupervisor(label: string): Promise<{ code: number; text: string }>;
  clear(threadId: string): Promise<void>;
  reloadPlugin(): Promise<void>;

  /** The path of the task's worktree, or null when it is gone. */
  worktree(taskId: string): Promise<string | null>;
  /** Run a shell command inside the lab. */
  sh(command: string): Promise<{ code: number; stdout: string }>;
  /** Lines of the process list inside the lab that match the pattern. */
  processes(pattern: string): Promise<string[]>;
  /** The project's clone directory. */
  readonly clone: string;
}

/** A scenario returns checks. It never decides a verdict; the runner does. */
export interface Scenario {
  id: string;
  title: string;
  /** The tiers the scenario runs at. */
  tiers: Array<"1" | "1.5">;
  run(lab: Lab): Promise<Check[]>;
}

export const pass = (id: string, title: string, evidence: string): Check => ({ id, title, ok: true, evidence });
export const check = (id: string, title: string, ok: boolean, evidence: string): Check => ({ id, title, ok, evidence });
