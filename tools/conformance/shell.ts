import { spawn } from "node:child_process";

export interface Exec {
  code: number;
  stdout: string;
  stderr: string;
}

/** Run a command and collect its output. It never throws for a non-zero exit. */
export function exec(command: string, args: string[], options: { env?: Record<string, string>; cwd?: string; input?: string; timeoutMs?: number } = {}): Promise<Exec> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: options.env ?? {}, cwd: options.cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = options.timeoutMs === undefined ? null : setTimeout(() => child.kill("SIGKILL"), options.timeoutMs);
    child.stdout.on("data", (chunk) => (stdout += String(chunk)));
    child.stderr.on("data", (chunk) => (stderr += String(chunk)));
    child.on("error", (error) => (timer && clearTimeout(timer), reject(error)));
    child.on("close", (code) => (timer && clearTimeout(timer), resolve({ code: code ?? 1, stdout, stderr })));
    child.stdin.end(options.input ?? "");
  });
}

const ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/** Remove the colour codes that bb and the lab scripts print. */
export const ansi = (text: string): string => text.replace(ESCAPE, "");
