import { deliveryModeOf, type DeliveryMode, type Driver } from "../../tools/conformance/drivers/types.ts";
import { resolveDriver } from "../../tools/conformance/drivers/index.ts";
import { roleAdvice } from "../../src/harness/advice";
import { contractFor } from "../../src/harness/contracts";
import type { DispatchOptions, EventRow, Lab, Offers, ProviderState, TaskRow, ThreadFacts, ToolResult, Wake, Who } from "../../tools/conformance/port.ts";

/** Ways to make the fake lab misbehave, so a scenario test can show that the scenario notices. */
export interface Faults {
  /** The plugin does not block a provider that is not ready (today's behavior without report task H1). */
  noReadinessGate?: boolean;
  /** The blocked text names no status and no login command. */
  noRemedy?: boolean;
  /** The plugin never sends a wake. */
  noWake?: boolean;
  /** The plugin sends every wake twice. */
  doubleWake?: boolean;
  /** A worker that should report never does. */
  neverReports?: boolean;
  /** The worker's report carries empty evidence. */
  emptyEvidence?: boolean;
  /** The failure evidence drops the cause text (today's behavior without report task H3). */
  noCause?: boolean;
  /** Refusals are not written to the log. */
  silentRefusals?: boolean;
  /** An empty report is accepted. */
  acceptEmpty?: boolean;
  /** Teardown ignores a dirty worktree. */
  teardownIgnoresDirt?: boolean;
  /** A process stays after teardown. */
  processLeft?: boolean;
  /** The thread row shows another model. */
  wrongModel?: boolean;
  /** A ship branch has no commit. */
  noCommit?: boolean;
  /** An unsupported profile is not blocked. */
  noProfileGate?: boolean;
  /** The worker is offered the supervisor's tools. */
  workerSeesSupervisorTools?: boolean;
  /** The supervisor is offered the worker's skill. */
  supervisorSeesWorkerSkill?: boolean;
  /** A stamped supervisor never gets its tools. */
  stampNeverArrives?: boolean;
  /** `bb factoryman supervisor start` does not exist. */
  noStartCommand?: boolean;
  /** A plugin reload adds a reconcile event. */
  reloadAddsEvent?: boolean;
  /** A wake sent while the supervisor is busy is lost. */
  busyWakeLost?: boolean;
  /** The wake arrives after the supervisor's turn ends. */
  wakeAfterTurn?: boolean;
  /** The provider under test is not ready. */
  providerNotReady?: boolean;
  /** The thread row shows another reasoning level or permission mode or provider. */
  wrongLevel?: boolean;
  wrongMode?: boolean;
  wrongProvider?: boolean;
  /** Every provider is ready, so there is none to probe (S1). */
  allProvidersReady?: boolean;
  /** The worker is offered the supervisor's skill. */
  workerSeesSupervisorSkill?: boolean;
  /** A silent task changes state. */
  silentMoves?: boolean;
  /** A supervisor with no role is offered the supervisor tools. */
  unstampedHasTools?: boolean;
  /** A plugin reload changes a task's state. */
  reloadChangesState?: boolean;
  /** The worktree stays after a teardown. */
  worktreeStaysAfterTeardown?: boolean;
  /** The stamp text says "next turn" for every harness, so a harness that needs a clear gets no clear advice. */
  noClearAdvice?: boolean;
  /** The stamp command fails. */
  stampFails?: boolean;
  /** A supervisor that `supervisor start` made lacks one of the four tools. */
  startedLacksTool?: boolean;
  /** A supervisor that `supervisor start` made lacks its skill. */
  startedLacksSkill?: boolean;
  /** A supervisor that `supervisor start` made is offered the worker's report tool. */
  startedSeesWorkerTool?: boolean;
  /** A supervisor that `supervisor start` made gets its tools only after a clear. */
  startedNeedsClear?: boolean;
  /** The lab project uses this mode and not the driver's, so a test can reproduce a run that PR 5's admission rule refuses. */
  projectMode?: DeliveryMode;
  /** The worker never reports a pull request, so a `direct-PR` ship task cannot reach `review_ready`. */
  noPullRequest?: boolean;
}

/** The reasoning levels that bb lists for the lab model of a provider, from the live check. A provider that is not here lists every level. */
const LISTED_LEVELS: Record<string, readonly string[]> = { "acp-omp": ["off", "auto"] };

interface Task extends TaskRow {
  dirty: boolean;
  /** The worker committed on the task branch. */
  committed: boolean;
  flag: string;
  profile: { provider: string; model: string; reasoningLevel: string; permissionMode: string };
}

const SUPERVISOR_TOOLS = ["factoryman_dispatch", "factoryman_merge", "factoryman_status", "factoryman_teardown"];

/** An in-memory lab that behaves like a correct plugin on a correct harness, unless a fault says otherwise. */
export class FakeLab implements Lab {
  readonly tier: "1" | "1.5";
  readonly driver: Driver;
  readonly clone = "/lab/repos/work";
  readonly patienceMs = 60;
  readonly failurePatienceMs = 80;
  readonly settleMs = 0;
  private readonly faults: Faults;
  private readonly rows = new Map<string, Task>();
  private log: EventRow[] = [];
  private wakeLog = new Map<string, Wake[]>();
  private nextTask = 1;
  private nextThread = 1;
  private readonly supervisors = new Map<string, { label: string; stamped: boolean; cleared: boolean; turns: number; seeded: boolean }>();
  private readonly extraProviders: ProviderState[] = [
    { id: "acp-cursor", status: "not_installed", message: "cursor-agent was not found", installedVersion: null, minimumSupportedVersion: null, loginCommand: null },
  ];
  /** Every call the scenarios made, so a test can assert on the order. */
  readonly calls: string[] = [];

  /** The delivery mode of the lab project. */
  get projectMode(): DeliveryMode {
    return this.faults.projectMode ?? deliveryModeOf(this.driver);
  }

  constructor(driverId = "pi", faults: Faults = {}, tier: "1" | "1.5" = "1.5", overrides: Partial<Driver> = {}) {
    const resolved = resolveDriver(tier === "1" ? "stub" : driverId);
    if (!resolved.ok) throw new Error(resolved.message);
    this.driver = { ...resolved.driver, ...overrides };
    this.tier = tier;
    this.faults = faults;
  }

  private add(row: Omit<EventRow, "seq" | "at" | "outcome" | "reasonCode" | "reasonMessage"> & Partial<Pick<EventRow, "outcome" | "reasonCode" | "reasonMessage">>): void {
    const outcome = row.outcome ?? "applied";
    if (outcome === "refused" && this.faults.silentRefusals === true) return;
    this.log.push({ seq: this.log.length + 1, at: "2026-11-08T00:00:00.000Z", outcome, reasonCode: row.reasonCode ?? null, reasonMessage: row.reasonMessage ?? null, ...row });
  }

  private wake(threadId: string, text: string, busy = false): void {
    if (this.faults.noWake === true) return;
    if (busy && this.faults.busyWakeLost === true) return;
    const list = this.wakeLog.get(threadId) ?? [];
    const wake: Wake = { seq: list.length + 1, text, busy: busy && this.faults.wakeAfterTurn !== true };
    list.push(wake);
    if (this.faults.doubleWake === true) list.push({ ...wake, seq: list.length + 1 });
    this.wakeLog.set(threadId, list);
  }

  private transition(task: Task, event: string, to: string, evidence: string | null, actor = "worker"): void {
    this.add({ taskId: task.taskId, fromState: task.state, toState: to, event, actor, evidence });
    task.state = to;
  }

  private refuse(task: Task, event: string, code: string, message: string, actor: string): void {
    this.add({ taskId: task.taskId, fromState: task.state, toState: task.state, event, actor, evidence: null, outcome: "refused", reasonCode: code, reasonMessage: message });
  }

  async tasks(): Promise<TaskRow[]> {
    return [...this.rows.values()].map((task) => ({
      taskId: task.taskId,
      projectId: task.projectId,
      kind: task.kind,
      mode: task.mode,
      state: task.state,
      workerThreadId: task.workerThreadId,
      branch: task.branch,
      machine: task.machine,
      pullRequestUrl: task.pullRequestUrl,
    }));
  }
  async events(taskId?: string): Promise<EventRow[]> {
    return this.log.filter((e) => taskId === undefined || e.taskId === taskId);
  }
  async waitForState(taskId: string, states: string[]): Promise<TaskRow | null> {
    const task = this.rows.get(taskId);
    return task !== undefined && states.includes(task.state) ? ((await this.tasks()).find((t) => t.taskId === taskId) ?? null) : null;
  }

  async providerStates(): Promise<ProviderState[]> {
    const own: ProviderState = { id: this.driver.provider, status: this.faults.providerNotReady === true ? "unauthenticated" : "ready", message: null, installedVersion: "1.0.0", minimumSupportedVersion: null, loginCommand: this.faults.providerNotReady === true ? "run login" : null };
    return [own, ...(this.faults.allProvidersReady === true ? [] : this.extraProviders)];
  }

  async callTool(tool: string, args: Record<string, unknown>): Promise<ToolResult> {
    this.calls.push(`callTool ${tool}`);
    if (tool === "factoryman_teardown") return this.teardown(String(args["taskId"]));
    return { text: `unknown tool ${tool}`, isError: true };
  }

  private teardown(taskId: string): ToolResult {
    const task = this.rows.get(taskId);
    if (task === undefined) return { text: "No such task.", isError: true };
    if (!["report_ready", "merged", "failed"].includes(task.state)) {
      this.refuse(task, "teardown", "illegal_transition", `teardown is not legal in ${task.state}`, "supervisor");
      return { text: `Refused (illegal_transition): teardown is not legal in ${task.state}`, isError: true };
    }
    if (task.dirty && this.faults.teardownIgnoresDirt !== true) {
      this.refuse(task, "teardown", "unlanded_work", "the worktree has uncommitted changes", "supervisor");
      return { text: "Refused (unlanded_work): the worktree has uncommitted changes.", isError: true };
    }
    this.transition(task, "teardown", "torn_down", null, "supervisor");
    return { text: `Task ${taskId} is torn down.`, isError: false };
  }

  async dispatch(kind: "scout" | "ship", description: string, options: DispatchOptions = {}): Promise<{ result: ToolResult; taskId: string | null }> {
    const profile = options.profile ?? (kind === "ship" ? this.driver.shipProfile : this.driver.profile);
    this.calls.push(`dispatch ${kind} ${profile.provider}/${profile.model}/${profile.reasoningLevel}/${profile.permissionMode}`);
    // The plugin checks the harness contract first, before readiness (the live check, section 4.4).
    const contract = contractFor(profile.provider);
    if (contract.refusedModes.includes(this.projectMode)) {
      return { result: { text: `Dispatch blocked (provider_not_admitted): The provider \`${profile.provider}\` is not admitted for ${this.projectMode} projects. ${contract.refusalReason ?? ""} No task was created.`, isError: true }, taskId: null };
    }
    const known = (await this.providerStates()).find((p) => p.id === profile.provider);
    if (known !== undefined && known.status !== "ready" && this.faults.noReadinessGate !== true) {
      const remedy = this.faults.noRemedy === true ? "" : ` Status ${known.status}${known.loginCommand === null ? "" : `; run \`${known.loginCommand}\``}.`;
      return { result: { text: `Dispatch blocked (provider_unavailable): the provider ${profile.provider} is not ready.${remedy} No task was created.`, isError: true }, taskId: null };
    }
    if (profile.provider === this.driver.provider && JSON.stringify(profile) === JSON.stringify(this.driver.unsupportedProfile) && this.faults.noProfileGate !== true) {
      const what = profile.permissionMode !== this.driver.profile.permissionMode ? `the permission mode \`${profile.permissionMode}\`` : `the reasoning level \`${profile.reasoningLevel}\``;
      return { result: { text: `Dispatch blocked (provider_unavailable): the provider ${profile.provider} does not offer ${what}. No task was created.`, isError: true }, taskId: null };
    }
    const listed = LISTED_LEVELS[profile.provider];
    if (listed !== undefined && !listed.includes(profile.reasoningLevel)) {
      return { result: { text: `Dispatch blocked (provider_unavailable): The model \`${profile.model}\` of the provider \`${profile.provider}\` does not list the reasoning level \`${profile.reasoningLevel}\`. It lists: ${listed.join(", ")}. No task was created.`, isError: true }, taskId: null };
    }
    const taskId = `t-${String(this.nextTask++).padStart(4, "0")}`;
    const flag = /\[brain:([^\]]+)\]/.exec(description)?.[1] ?? options.flag ?? "normal";
    const worker = `thr_w${this.nextThread++}`;
    const task: Task = { taskId, projectId: "proj", kind, mode: this.projectMode, state: "queued", workerThreadId: worker, branch: `fm/${taskId}`, machine: null, pullRequestUrl: null, dirty: false, committed: false, flag, profile };
    this.rows.set(taskId, task);
    this.add({ taskId, fromState: null, toState: "queued", event: "create", actor: "supervisor", evidence: null });
    this.transition(task, "start", "working", null, "supervisor");
    this.play(task);
    return { result: { text: `Dispatched ${kind} task ${taskId}.`, isError: false }, taskId };
  }

  private play(task: Task): void {
    const parent = "thr_driver";
    const flag = task.flag;
    const text = (phrase: string) => `[factoryman] Task ${task.taskId} (${task.kind}, ${task.mode}) ${phrase}.`;
    if (this.faults.neverReports === true || flag === "hold") return;
    if (flag === "silent") {
      if (this.faults.silentMoves === true) this.transition(task, "report", "report_ready", "moved");
      return void this.wake(parent, text("reports: the worker finished a turn without reporting"));
    }
    if (flag.startsWith("fail=") && this.driver.failure.mode === "ends-turn") return void this.wake(parent, text("reports: the worker finished a turn without reporting"));
    if (flag.startsWith("fail=")) {
      const code = flag.slice(5);
      this.transition(task, "fail", "failed", `worker thread failed: provider error (category x, HTTP ${code})${this.faults.noCause === true ? "" : ` CONFORMANCE-CAUSE-${code}`}`, "system");
      return void this.wake(parent, text("is now failed"));
    }
    if (flag === "empty-evidence") {
      for (let i = 0; i < 2; i += 1) this.refuse(task, "report", "evidence_required", "A report event needs non-empty evidence.", "worker");
      if (this.faults.acceptEmpty === true) this.log.pop();
    }
    if (task.kind === "ship") {
      if (this.faults.noCommit !== true) {
        task.dirty = flag === "dirty";
        task.committed = true;
      }
      if (task.mode === "direct-PR") {
        // `direct-PR` is review ready only when a pull request is open (src/machine/guards.ts, readyModeCheck).
        const pr = flag.startsWith("pr=") && this.faults.noPullRequest !== true ? flag.slice(3) : null;
        if (pr === null) return void this.refuse(task, "ready", "mode_check_failed", "A `direct-PR` task is review ready only when a pull request is open.", "worker");
        task.pullRequestUrl = pr;
      }
      if (task.mode === "local-only" && flag.startsWith("pr=")) {
        // A worker that reports a pull request and no landed commits does not meet the `local-only` check (src/machine/guards.ts, readyModeCheck).
        return void this.refuse(task, "ready", "mode_check_failed", "A `local-only` task is review ready only when its branch holds landed commits.", "worker");
      }
      this.transition(task, "ready", "review_ready", "committed 1 commit");
      return void this.wake(parent, text("is now review_ready"));
    }
    task.dirty = flag === "dirty";
    this.transition(task, "report", "report_ready", this.faults.emptyEvidence === true ? "" : `scout report for ${task.taskId}`);
    this.wake(parent, text("is now report_ready"));
    if (flag === "double-report") this.refuse(task, "report", "illegal_transition", "report is not legal in report_ready", "worker");
  }

  async thread(id: string): Promise<ThreadFacts> {
    const task = [...this.rows.values()].find((t) => t.workerThreadId === id);
    if (task === undefined) return { id, providerId: this.driver.provider, status: "idle", parentThreadId: null, model: null, reasoningLevel: null, permissionMode: null };
    return {
      id,
      providerId: this.faults.wrongProvider === true ? "other-provider" : task.profile.provider,
      status: "idle",
      parentThreadId: "thr_driver",
      model: this.faults.wrongModel === true ? "other-model" : task.profile.model,
      reasoningLevel: this.faults.wrongLevel === true ? "other-level" : task.profile.reasoningLevel,
      permissionMode: this.faults.wrongMode === true ? "other-mode" : task.profile.permissionMode,
    };
  }
  async wakes(threadId: string): Promise<Wake[]> {
    return this.wakeLog.get(threadId) ?? [];
  }
  async parentOf(taskId: string): Promise<string | null> {
    return this.rows.has(taskId) ? "thr_driver" : null;
  }

  async offers(who: Who): Promise<Offers> {
    if (who.kind === "worker") {
      return { tools: this.faults.workerSeesSupervisorTools === true ? ["factoryman_report", ...SUPERVISOR_TOOLS] : ["factoryman_report"], skills: this.faults.workerSeesSupervisorSkill === true ? ["factoryman-worker", "factoryman-supervisor"] : ["factoryman-worker"] };
    }
    const sup = [...this.supervisors.values()].find((s) => s.label === who.label);
    if (sup?.seeded === true) {
      // The role was set in the spawn call, so a stamp fault does not reach it.
      if (this.faults.startedNeedsClear === true && !sup.cleared) return { tools: [], skills: [] };
      const tools = SUPERVISOR_TOOLS.filter((tool) => !(this.faults.startedLacksTool === true && tool === "factoryman_merge"));
      if (this.faults.startedSeesWorkerTool === true) tools.push("factoryman_report");
      return { tools: tools.sort(), skills: this.faults.startedLacksSkill === true ? [] : ["factoryman-supervisor"] };
    }
    const has = sup !== undefined && sup.stamped && this.faults.stampNeverArrives !== true && (this.driver.roleChangeStep === "next-turn" || sup.cleared) && sup.turns > 0;
    if (!has && sup !== undefined && !sup.stamped && this.faults.unstampedHasTools === true) return { tools: SUPERVISOR_TOOLS, skills: [] };
    return has ? { tools: SUPERVISOR_TOOLS, skills: this.faults.supervisorSeesWorkerSkill === true ? ["factoryman-supervisor", "factoryman-worker"] : ["factoryman-supervisor"] } : { tools: [], skills: [] };
  }

  async spawnSupervisor(label: string): Promise<string> {
    const id = `thr_s${this.nextThread++}`;
    this.supervisors.set(id, { label, stamped: false, cleared: false, turns: 1, seeded: false });
    return id;
  }
  async tell(threadId: string, _label: string, directives: string[]): Promise<void> {
    const sup = this.supervisors.get(threadId);
    if (sup === undefined) throw new Error(`no supervisor ${threadId}`);
    sup.turns += 1;
    this.calls.push(`tell ${directives.join("|")}`);
    for (const line of directives) {
      const call = /^CALL factoryman_dispatch (.*)$/.exec(line);
      if (call === null) continue;
      const args = JSON.parse(call[1] as string) as { kind: "scout" | "ship"; description: string };
      const out = await this.dispatch(args.kind, args.description);
      if (out.taskId !== null) {
        const busy = directives.some((d) => d.startsWith("SLEEP"));
        // The scripted worker finishes while the supervisor sleeps, so the wake arrives mid-turn.
        const parent = this.wakeLog;
        const list = parent.get("thr_driver") ?? [];
        parent.delete("thr_driver");
        for (const wake of list) this.wake(threadId, wake.text, busy);
      }
    }
  }
  async waitIdle(): Promise<boolean> {
    return true;
  }
  async stamp(threadId: string): Promise<{ code: number; text: string }> {
    const sup = this.supervisors.get(threadId);
    if (sup === undefined) return { code: 1, text: "no such thread" };
    if (this.faults.stampFails === true) return { code: 1, text: `Could not stamp thread ${threadId}: HTTP 500` };
    sup.stamped = true;
    // The real advice for the driver's provider. The fault models a plugin that says "next turn" to every harness.
    const provider = this.driver.provider;
    const contract = this.faults.noClearAdvice === true ? { provider, roleChange: "next-turn" as const } : contractFor(provider);
    return { code: 0, text: `Thread ${threadId} is now a factoryman supervisor.\n${roleAdvice(threadId, provider, contract)}` };
  }
  async startSupervisor(label: string): Promise<{ code: number; text: string; threadId: string | null }> {
    if (this.faults.noStartCommand === true) return { code: 2, text: "Usage: bb factoryman supervisor <thread-id>", threadId: null };
    const id = `thr_s${this.nextThread++}`;
    this.supervisors.set(id, { label, stamped: true, cleared: false, turns: 1, seeded: true });
    const { provider, model } = this.driver.profile;
    return {
      code: 0,
      text: `Started factoryman supervisor thread ${id} with the profile harness (${provider}, ${model}).\nThe role is set at spawn, so the thread has the four supervisor tools and the factoryman-supervisor skill from its first turn.`,
      threadId: id,
    };
  }
  async clear(threadId: string): Promise<void> {
    const sup = this.supervisors.get(threadId);
    if (sup !== undefined) sup.cleared = true;
  }
  async reloadPlugin(): Promise<void> {
    this.calls.push("reload");
    if (this.faults.reloadChangesState === true) {
      const task = [...this.rows.values()][0];
      if (task !== undefined) task.state = "failed";
    }
    if (this.faults.reloadAddsEvent === true) this.add({ taskId: [...this.rows.keys()][0] ?? "t-0000", fromState: null, toState: null, event: "reconcile", actor: "system", evidence: "mismatch" });
  }

  async worktree(taskId: string): Promise<string | null> {
    const task = this.rows.get(taskId);
    return task === undefined || (task.state === "torn_down" && this.faults.worktreeStaysAfterTeardown !== true) ? null : `/lab/worktrees/${taskId}`;
  }
  async sh(command: string): Promise<{ code: number; stdout: string }> {
    this.calls.push(`sh ${command}`);
    const clean = /^rm -f (\S+)\/UNTRACKED\.txt/.exec(command);
    if (clean !== null) {
      const task = [...this.rows.values()].find((t) => `/lab/worktrees/${t.taskId}` === clean[1]);
      if (task !== undefined) task.dirty = false;
    }
    const count = /rev-list --count (\S+)\.\.(\S+)/.exec(command);
    if (count !== null) {
      const task = [...this.rows.values()].find((t) => t.branch === count[2]);
      return { code: 0, stdout: task?.committed === true ? "1\n" : "0\n" };
    }
    return { code: 0, stdout: "" };
  }
  async processes(pattern: string): Promise<string[]> {
    return this.faults.processLeft === true ? [`1234 harness ${pattern}`] : [];
  }
}
