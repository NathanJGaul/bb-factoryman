import { FakeBbPort } from "./bb-port";
import { FakeFiles } from "./files";
import { fakeClock } from "./store";
import type { Exec, ExecResult } from "../../src/exec";
import { RulesTableResolver } from "../../src/dispatch/resolver";
import { Runtime, type Logger, type RuntimeDeps, type Settings } from "../../src/runtime";
import { createMemoryStore } from "../../src/store/memory";

export interface LogLine {
  level: "debug" | "info" | "warn" | "error";
  message: string;
}

export interface TestRuntime {
  runtime: Runtime;
  bb: FakeBbPort;
  files: FakeFiles;
  lines: LogLine[];
  execCalls: Array<{ command: string; args: readonly string[]; cwd?: string }>;
  /** Script exec results by command line; the default is a successful empty run. */
  execHandler: (command: string, args: readonly string[]) => ExecResult;
  settings: Settings;
  clock: () => string;
  /** Every delay the code asked for, in order. */
  sleeps: number[];
}

/** A runtime over the memory store, a fake clock, sequential IDs, and a fake port. */
export function testRuntime(overrides: Partial<RuntimeDeps> = {}): TestRuntime {
  const bb = new FakeBbPort();
  const files = new FakeFiles();
  const lines: LogLine[] = [];
  const log: Logger = {
    debug: (message) => lines.push({ level: "debug", message }),
    info: (message) => lines.push({ level: "info", message }),
    warn: (message) => lines.push({ level: "warn", message }),
    error: (message) => lines.push({ level: "error", message }),
  };
  const execCalls: TestRuntime["execCalls"] = [];
  const state = { execHandler: ((): ExecResult => ({ code: 0, stdout: "", stderr: "" })) as TestRuntime["execHandler"] };
  const exec: Exec = async (command, args, options) => {
    execCalls.push({ command, args, cwd: options?.cwd });
    return state.execHandler(command, args);
  };
  const settings: Settings = { mergeMethod: "squash", approvalTimeoutMs: 600_000, machinePollMs: 30_000, maxWorkers: 0 };
  const clock = fakeClock();
  const sleeps: number[] = [];
  let next = 1;
  const runtime = new Runtime({
    store: createMemoryStore(),
    bb,
    exec,
    files,
    resolver: new RulesTableResolver(),
    log,
    now: clock,
    newId: () => `t${next++}`,
    sleep: async (ms) => void sleeps.push(ms),
    settings: () => settings,
    ...overrides,
  });
  return {
    runtime,
    bb,
    files,
    lines,
    execCalls,
    get execHandler() {
      return state.execHandler;
    },
    set execHandler(handler) {
      state.execHandler = handler;
    },
    settings,
    clock,
    sleeps,
  };
}

export const SUPERVISOR = { threadId: "thr-sup", projectId: "proj-1" } as const;
export const WORKER = { threadId: "thr-w1", projectId: "proj-1" } as const;
export const DISPATCH_ARGS = {
  kind: "ship",
  description: "Add a --json flag to the status command.\nKeep the change small.",
  profile: { provider: "claude", model: "opus", reasoningLevel: "high", permissionMode: "accept-edits" },
} as const;

/** A runtime with a supervisor thread and one dispatched task `t1` whose worker is `thr-w1`. */
export async function withDispatchedTask(options: { kind?: "ship" | "scout"; mode?: "no-mistakes" | "direct-PR" | "local-only"; baseBranch?: string | null } = {}) {
  const { dispatch } = await import("../../src/tools/dispatch");
  const { defaultProjectConfig } = await import("../../src/store/store");
  const t = testRuntime();
  t.bb.addThread({ id: SUPERVISOR.threadId });
  t.runtime.deps.store.putProjectConfig({
    ...defaultProjectConfig("proj-1"),
    deliveryMode: options.mode ?? "no-mistakes",
    baseBranch: options.baseBranch ?? null,
  });
  const outcome = await dispatch(t.runtime, SUPERVISOR, { ...DISPATCH_ARGS, kind: options.kind ?? "ship" });
  if (!outcome.ok) throw new Error(`fixture dispatch failed: ${outcome.text}`);
  return t;
}

export const PR_URL = "https://github.com/acme/widgets/pull/7";

/** Move task `t1` from `working` to `review_ready` in a `no-mistakes` project. */
export async function toReviewReady(t: TestRuntime): Promise<void> {
  for (const event of [
    { type: "handoff", actor: "worker", evidence: "Committed." },
    { type: "validated", actor: "system", evidence: "Pipeline finished.", prUrl: PR_URL, pipelineFinished: true },
  ]) {
    const outcome = await t.runtime.apply("t1", event);
    if (!outcome.ok) throw new Error(`fixture ${event.type} refused: ${outcome.refusal.message}`);
  }
}

/** Move task `t1` from `review_ready` to `merged` by the yolo path, which needs no form. */
export async function toMerged(t: TestRuntime): Promise<void> {
  await toReviewReady(t);
  for (const event of [
    { type: "request_approval", actor: "supervisor" },
    { type: "merge", actor: "supervisor", yolo: true },
  ]) {
    const outcome = await t.runtime.apply("t1", event);
    if (!outcome.ok) throw new Error(`fixture ${event.type} refused: ${outcome.refusal.message}`);
  }
}

/** Script `git status` and `git rev-list --count` for the worktree report. */
export function scriptGit(t: TestRuntime, facts: { status?: string; count?: string; code?: number } = {}): void {
  t.bb.envPaths.set("env-thr-w1", "/work/tree");
  t.execHandler = (command, args) => {
    if (facts.code !== undefined && facts.code !== 0) return { code: facts.code, stdout: "", stderr: "fatal: not a git repository" };
    if (command === "git" && args[0] === "status") return { code: 0, stdout: facts.status ?? "", stderr: "" };
    if (command === "git" && args[0] === "rev-list") return { code: 0, stdout: facts.count ?? "0\n", stderr: "" };
    return { code: 0, stdout: "", stderr: "" };
  };
}
