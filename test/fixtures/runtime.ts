import { FakeBbPort } from "./bb-port";
import { fakeClock } from "./store";
import type { Exec, ExecResult } from "../../src/exec";
import { Runtime, type Logger, type RuntimeDeps, type Settings } from "../../src/runtime";
import { createMemoryStore } from "../../src/store/memory";

export interface LogLine {
  level: "debug" | "info" | "warn" | "error";
  message: string;
}

export interface TestRuntime {
  runtime: Runtime;
  bb: FakeBbPort;
  lines: LogLine[];
  execCalls: Array<{ command: string; args: readonly string[]; cwd?: string }>;
  /** Script exec results by command line; the default is a successful empty run. */
  execHandler: (command: string, args: readonly string[]) => ExecResult;
  settings: Settings;
  clock: () => string;
}

/** A runtime over the memory store, a fake clock, sequential IDs, and a fake port. */
export function testRuntime(overrides: Partial<RuntimeDeps> = {}): TestRuntime {
  const bb = new FakeBbPort();
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
  const settings: Settings = { mergeMethod: "squash", approvalTimeoutMs: 600_000 };
  const clock = fakeClock();
  let next = 1;
  const runtime = new Runtime({
    store: createMemoryStore(),
    bb,
    exec,
    log,
    now: clock,
    newId: () => `t${next++}`,
    settings: () => settings,
    ...overrides,
  });
  return {
    runtime,
    bb,
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
  };
}
