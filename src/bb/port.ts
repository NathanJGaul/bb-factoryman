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
  /** What bb says about each provider's readiness on `hostId`, or on the default host when it is absent. */
  getProviderStates(hostId?: string): Promise<ProviderState[]>;
  /** The models that bb lists for a provider on `hostId`, or on the default host when it is absent. */
  listModels(providerId: string, hostId?: string): Promise<ModelList>;
  /** Every machine bb knows. */
  listMachines(): Promise<MachineInfo[]>;
  /** The cost bb recorded for a thread, or null when the provider reports none. */
  getThreadCost(threadId: string): Promise<{ amount: number; currency: string } | null>;
  /** Every project bb knows, by ID and name. */
  listProjects(): Promise<Array<{ id: string; name: string }>>;
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

/** bb's readiness verdict for a provider. Only `ready` lets a worker start. */
export type ProviderStatus = "ready" | "not_installed" | "unauthenticated" | "expired" | "unsupported_version" | "unknown";

/** One provider's state on one host, cut to the fields that the dispatch gate reads. */
export interface ProviderState {
  providerId: string;
  status: ProviderStatus;
  installedVersion: string | null;
  minimumSupportedVersion: string | null;
  /** The command to run on the host that holds the CLI, or null when bb gives none. */
  localLoginCommand: string | null;
  statusMessage: string | null;
}

/** One model as bb lists it for a provider. */
export interface ModelEntry {
  id: string;
  /** The model name. A profile names a model by `id` or by this. */
  model: string;
  isDefault: boolean;
  /** The reasoning level bb picks for the model. May be empty. */
  defaultReasoningLevel: string;
  /** The levels the model lists. */
  reasoningLevels: string[];
  /** True when bb knows the model's levels. When false, only the provider-wide list applies. */
  reasoningKnown: boolean;
}

/** What bb answers when asked for a provider's models. An empty list with a load error means bb could not read the catalog. */
export interface ModelList {
  models: ModelEntry[];
  loadError: { code: string; detail: string | null } | null;
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
