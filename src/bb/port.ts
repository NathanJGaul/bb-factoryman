import type { Profile } from "../machine/types";

/** Plain JSON data, as bb accepts it in plugin metadata and form payloads. */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface SpawnWorkerRequest {
  projectId: string;
  parentThreadId: string;
  prompt: string;
  profile: Profile;
  /** Plugin metadata stamped on the new thread. */
  metadata: Record<string, Json>;
  /** The branch the worktree starts from, or null for the project default. */
  baseBranch: string | null;
  /** The host to run on. Absent or null means the project's default host. */
  hostId?: string | null;
}

export interface ThreadInfo {
  id: string;
  projectId: string;
  /** bb's thread status, for example `active`, `idle`, or `error`. */
  status: string;
  parentThreadId: string | null;
  environmentId: string | null;
  /** True when bb still serves the thread but has soft-deleted it. */
  deleted: boolean;
}

export interface InputRequest {
  threadId: string;
  rendererId: string;
  title: string;
  payload: Record<string, Json>;
  timeoutMs: number;
  signal?: AbortSignal;
}

/** The result of an input form, as `spike/RESULTS.md` item 20 records it. */
export type InputResult =
  | { outcome: "submitted"; value: unknown }
  | { outcome: "cancelled"; reason: string };

/** Every call the plugin makes to bb. Only `adapter.ts` implements it against the real SDK. */
export interface BbPort {
  spawnWorker(request: SpawnWorkerRequest): Promise<{ threadId: string }>;
  /** Returns null when bb does not know the thread. */
  getThread(threadId: string): Promise<ThreadInfo | null>;
  sendMessage(threadId: string, text: string): Promise<void>;
  getEnvironmentPath(environmentId: string): Promise<string | null>;
  /** Archive the worker thread, then delete its environment. */
  retireWorker(threadId: string, environmentId: string): Promise<void>;
  getProjectCheckout(projectId: string): Promise<string | null>;
  /** The project's git remote URL, or null when bb has none. */
  getProjectRemote(projectId: string): Promise<string | null>;
  requestInput(request: InputRequest): Promise<InputResult>;
  setThreadMetadata(threadId: string, metadata: Record<string, Json>): Promise<void>;
  /** Every provider bb knows, with its availability on `hostId`, or on the default host when it is absent. */
  listProviders(hostId?: string): Promise<ProviderAvailability[]>;
  /** Every machine bb knows. */
  listMachines(): Promise<MachineInfo[]>;
  /** The project's sources: the hosts that hold a copy of it. */
  getProjectSources(projectId: string): Promise<ProjectSource[]>;
  /** Start `argv` in a new terminal on a host, with no shell and no input. */
  startTerminal(hostId: string, cwd: string | null, argv: string[]): Promise<{ terminalId: string }>;
  readTerminal(terminalId: string): Promise<TerminalRead>;
  closeTerminal(terminalId: string): Promise<void>;
}

/** One provider as bb reports it, cut to the fields that the dispatch check reads (spike item 29). */
export interface ProviderAvailability {
  id: string;
  available: boolean;
  permissionModes: string[];
  /** Reasoning level IDs. An empty list means bb reported none. */
  reasoningLevels: string[];
}

/** A machine as bb reports it: an enrolled host (spike items 6 and 7). */
export interface MachineInfo {
  id: string;
  name: string;
  /** bb's connection status, `connected` or `disconnected`. */
  status: string;
  /** bb's lifecycle phase, for example `active`. */
  phase: string;
  /** True only when the host is connected and its phase is `active`. */
  online: boolean;
}

/** One place where the project's files live: a host and a path. */
export interface ProjectSource {
  hostId: string;
  path: string;
  isDefault: boolean;
}

/** What one read of a host terminal returns (spike item 8). */
export interface TerminalRead {
  /** bb's terminal status: `starting`, `running`, `exited`, or `disconnected`. */
  status: string;
  exitCode: number | null;
  /** The output so far, decoded to text. */
  output: string;
  truncated: boolean;
}
