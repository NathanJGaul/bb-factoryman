import type { BbPort, InputRequest, InputResult, MachineInfo, ProjectSource, ModelEntry, ModelList, ProviderAvailability, ProviderState, SpawnWorkerRequest, TerminalRead, ThreadInfo } from "../../src/bb/port";

export interface RecordedCall {
  method: string;
  args: unknown[];
}

/** A model for a test. The default lists the levels low to max, all known. */
export function modelEntry(id: string, overrides: Partial<ModelEntry> = {}): ModelEntry {
  return { id, model: id, isDefault: false, defaultReasoningLevel: "", reasoningLevels: ["low", "medium", "high", "xhigh", "max"], reasoningKnown: true, ...overrides };
}

/** The model IDs that the existing tests dispatch with. A fake provider lists them by default, so a test that names no model list keeps its meaning. */
export const DEFAULT_MODEL_IDS = ["opus", "sonnet", "haiku", "claude-sonnet-5-5", "stub-model", "m", "b", "other", "opus-strict"];

/** A provider state for a test. The default is a ready provider with no versions and no login command. */
export function providerState(providerId: string, overrides: Partial<ProviderState> = {}): ProviderState {
  return { providerId, status: "ready", installedVersion: null, minimumSupportedVersion: null, localLoginCommand: null, statusMessage: null, ...overrides };
}

/** A hand-written `BbPort` that records calls and returns scripted results. */
export class FakeBbPort implements BbPort {
  calls: RecordedCall[] = [];
  threads = new Map<string, ThreadInfo>();
  envPaths = new Map<string, string>();
  checkouts = new Map<string, string>();
  /** A project missing from this map has the default remote. Set null for an unreadable remote. */
  remotes = new Map<string, string | null>();
  metadata = new Map<string, Record<string, unknown>>();
  /** What `listProviders` returns. The default lists `claude` and `claude-code`, each with every mode and the usual levels. */
  providers: ProviderAvailability[] = ["claude", "claude-code"].map((id) => ({
    id,
    available: true,
    permissionModes: ["accept-edits", "auto", "full"],
    reasoningLevels: ["low", "medium", "high", "xhigh", "max"],
  }));
  /** What `listProviders` returns for a given host ID, instead of `providers`. */
  providersByHost = new Map<string, ProviderAvailability[]>();
  providersError: Error | null = null;
  /**
   * What `getProviderStates` returns. While it is null, every listed provider is `ready` when its `available` flag is
   * true and `not_installed` otherwise, so a test that scripts only `providers` keeps its meaning.
   */
  states: ProviderState[] | null = null;
  /** What `getProviderStates` returns for a given host ID, instead of `states`. */
  statesByHost = new Map<string, ProviderState[]>();
  statesError: Error | null = null;
  /** What `listModels` returns for a provider ID. A provider that is missing lists `DEFAULT_MODEL_IDS`. */
  models = new Map<string, ModelList>();
  /** What `listModels` returns for a host ID and a provider ID, keyed `<host>/<provider>`, instead of `models`. */
  modelsByHost = new Map<string, ModelList>();
  modelsError: Error | null = null;
  /** Every terminal that `startTerminal` opened. */
  terminalRuns: Array<{ hostId: string; cwd: string | null; argv: string[] }> = [];
  /** The reads `readTerminal` returns, in order. The last one repeats. */
  terminalReads: TerminalRead[] = [];
  terminalClosed: string[] = [];
  terminalStartError: Error | null = null;
  setMetadataError: Error | null = null;
  /** What `getThreadCost` returns per thread. A thread that is missing has no cost data. */
  costs = new Map<string, { amount: number; currency: string } | null>();
  costError: Error | null = null;
  /** What `listProjects` returns. */
  projectList: Array<{ id: string; name: string }> = [];
  projectsError: Error | null = null;
  terminalReadError: Error | null = null;
  /** What `listMachines` returns. The default is one online host, `host_local`. */
  machines: MachineInfo[] = [{ id: "host_local", name: "local-box", status: "connected", phase: "active", online: true }];
  machinesError: Error | null = null;
  sourcesError: Error | null = null;
  /** The project's sources. The default is one default source on `host_local`. */
  sources: ProjectSource[] = [{ hostId: "host_local", path: "/work/repo", isDefault: true }];
  spawnError: Error | null = null;
  sendError: Error | null = null;
  retireError: Error | null = null;
  getThreadError: Error | null = null;
  checkoutError: Error | null = null;
  envPathError: Error | null = null;
  /** Called for each form. Defaults to a timeout cancellation. */
  inputHandler: (request: InputRequest) => Promise<InputResult> = async () => ({ outcome: "cancelled", reason: "timeout" });
  private nextThread = 1;

  callsTo(method: string): unknown[][] {
    return this.calls.filter((call) => call.method === method).map((call) => call.args);
  }

  /** Register a thread as bb would know it. */
  addThread(info: Partial<ThreadInfo> & { id: string }): ThreadInfo {
    const thread: ThreadInfo = {
      projectId: "proj-1",
      status: "idle",
      parentThreadId: null,
      environmentId: null,
      deleted: false,
      ...info,
    };
    this.threads.set(thread.id, thread);
    return thread;
  }

  async spawnWorker(request: SpawnWorkerRequest): Promise<{ threadId: string }> {
    this.calls.push({ method: "spawnWorker", args: [request] });
    if (this.spawnError) throw this.spawnError;
    const threadId = `thr-w${this.nextThread++}`;
    this.addThread({
      id: threadId,
      projectId: request.projectId,
      parentThreadId: request.parentThreadId,
      environmentId: `env-${threadId}`,
      status: "active",
    });
    return { threadId };
  }

  async getThread(threadId: string): Promise<ThreadInfo | null> {
    this.calls.push({ method: "getThread", args: [threadId] });
    if (this.getThreadError) throw this.getThreadError;
    return this.threads.get(threadId) ?? null;
  }

  async sendMessage(threadId: string, text: string): Promise<void> {
    this.calls.push({ method: "sendMessage", args: [threadId, text] });
    if (this.sendError) throw this.sendError;
  }

  async getEnvironmentPath(environmentId: string): Promise<string | null> {
    this.calls.push({ method: "getEnvironmentPath", args: [environmentId] });
    if (this.envPathError) throw this.envPathError;
    return this.envPaths.get(environmentId) ?? null;
  }

  async retireWorker(threadId: string, environmentId: string): Promise<void> {
    this.calls.push({ method: "retireWorker", args: [threadId, environmentId] });
    if (this.retireError) throw this.retireError;
  }

  async getProjectCheckout(projectId: string): Promise<string | null> {
    this.calls.push({ method: "getProjectCheckout", args: [projectId] });
    if (this.checkoutError) throw this.checkoutError;
    return this.checkouts.get(projectId) ?? null;
  }

  async getProjectRemote(projectId: string): Promise<string | null> {
    this.calls.push({ method: "getProjectRemote", args: [projectId] });
    return this.remotes.has(projectId) ? (this.remotes.get(projectId) ?? null) : "git@github.com:acme/widgets.git";
  }

  async requestInput(request: InputRequest): Promise<InputResult> {
    this.calls.push({ method: "requestInput", args: [request] });
    return this.inputHandler(request);
  }

  async getThreadCost(threadId: string): Promise<{ amount: number; currency: string } | null> {
    this.calls.push({ method: "getThreadCost", args: [threadId] });
    if (this.costError) throw this.costError;
    return this.costs.get(threadId) ?? null;
  }

  async listProjects(): Promise<Array<{ id: string; name: string }>> {
    this.calls.push({ method: "listProjects", args: [] });
    if (this.projectsError) throw this.projectsError;
    return this.projectList;
  }

  async startTerminal(hostId: string, cwd: string | null, argv: string[]): Promise<{ terminalId: string }> {
    this.calls.push({ method: "startTerminal", args: [hostId, cwd, argv] });
    if (this.terminalStartError) throw this.terminalStartError;
    this.terminalRuns.push({ hostId, cwd, argv });
    return { terminalId: `term-${this.terminalRuns.length}` };
  }

  async readTerminal(terminalId: string): Promise<TerminalRead> {
    this.calls.push({ method: "readTerminal", args: [terminalId] });
    if (this.terminalReadError) throw this.terminalReadError;
    const next = this.terminalReads.length > 1 ? this.terminalReads.shift() : this.terminalReads[0];
    return next ?? { status: "exited", exitCode: 0, output: "", truncated: false };
  }

  async closeTerminal(terminalId: string): Promise<void> {
    this.calls.push({ method: "closeTerminal", args: [terminalId] });
    this.terminalClosed.push(terminalId);
  }

  async listProviders(hostId?: string): Promise<ProviderAvailability[]> {
    this.calls.push({ method: "listProviders", args: [hostId] });
    if (this.providersError) throw this.providersError;
    return (hostId === undefined ? undefined : this.providersByHost.get(hostId)) ?? this.providers;
  }

  async getProviderStates(hostId?: string): Promise<ProviderState[]> {
    this.calls.push({ method: "getProviderStates", args: [hostId] });
    if (this.statesError) throw this.statesError;
    const scripted = (hostId === undefined ? undefined : this.statesByHost.get(hostId)) ?? this.states;
    if (scripted !== null) return scripted;
    const listed = (hostId === undefined ? undefined : this.providersByHost.get(hostId)) ?? this.providers;
    return listed.map((provider) => providerState(provider.id, { status: provider.available ? "ready" : "not_installed" }));
  }

  async listModels(providerId: string, hostId?: string): Promise<ModelList> {
    this.calls.push({ method: "listModels", args: [providerId, hostId] });
    if (this.modelsError) throw this.modelsError;
    const scripted = (hostId === undefined ? undefined : this.modelsByHost.get(`${hostId}/${providerId}`)) ?? this.models.get(providerId);
    return scripted ?? { models: DEFAULT_MODEL_IDS.map((id) => modelEntry(id)), loadError: null };
  }

  async listMachines(): Promise<MachineInfo[]> {
    this.calls.push({ method: "listMachines", args: [] });
    if (this.machinesError) throw this.machinesError;
    return this.machines;
  }

  async getProjectSources(projectId: string): Promise<ProjectSource[]> {
    this.calls.push({ method: "getProjectSources", args: [projectId] });
    if (this.sourcesError) throw this.sourcesError;
    return this.sources;
  }

  async setThreadMetadata(threadId: string, metadata: Record<string, unknown>): Promise<void> {
    this.calls.push({ method: "setThreadMetadata", args: [threadId, metadata] });
    if (this.setMetadataError) throw this.setMetadataError;
    this.metadata.set(threadId, metadata);
  }

  /** Texts sent to one thread, in order. */
  sentTo(threadId: string): string[] {
    return this.callsTo("sendMessage")
      .filter(([id]) => id === threadId)
      .map(([, text]) => String(text));
  }
}
