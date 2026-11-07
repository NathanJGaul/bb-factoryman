import { spawn } from "node:child_process";

export interface ExecResult {
  /** The exit code, or null when the process never ran or was killed. */
  code: number | null;
  stdout: string;
  stderr: string;
  /** Set when the process could not start. */
  error?: string;
}

export interface ExecOptions {
  cwd?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Run on this host ID through a host terminal. Absent or null runs on the server. */
  host?: string | null;
}

/** Runs one command with literal arguments. It never throws for an expected failure. */
export type Exec = (command: string, args: readonly string[], options?: ExecOptions) => Promise<ExecResult>;

export const runCommand: Exec = (command, args, options = {}) =>
  new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const finish = (result: ExecResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const child = spawn(command, [...args], {
      cwd: options.cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: options.timeoutMs,
      signal: options.signal,
    });
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
    child.on("error", (error) => finish({ code: null, stdout, stderr, error: error.message }));
    child.on("close", (code) => finish({ code, stdout, stderr }));
  });
