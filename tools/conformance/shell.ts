import { spawn } from "node:child_process";

export interface Exec {
  code: number;
  stdout: string;
  stderr: string;
}

/** After the command exits, how long to wait for output that a background child still holds open. */
const GRACE_MS = 300;

/**
 * Run a command and collect its output. It never throws for a non-zero exit.
 * It returns when the command exits, and not when every pipe closes, because a command that starts a server
 * in the background leaves a child that holds the pipes open for as long as the server runs.
 */
export function exec(command: string, args: string[], options: { env?: Record<string, string>; cwd?: string; input?: string; timeoutMs?: number } = {}): Promise<Exec> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env: options.env ?? {}, cwd: options.cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const timer =
      options.timeoutMs === undefined
        ? null
        : setTimeout(() => {
            timedOut = true;
            child.kill("SIGKILL");
          }, options.timeoutMs);
    const finish = (code: number | null) => {
      if (settled) return;
      settled = true;
      if (timer !== null) clearTimeout(timer);
      const note = timedOut ? `${stderr === "" ? "" : "\n"}The command timed out after ${options.timeoutMs} ms and was stopped.` : "";
      resolve({ code: timedOut ? 124 : (code ?? 1), stdout, stderr: stderr + note });
    };
    child.stdout.on("data", (chunk) => (stdout += String(chunk)));
    child.stderr.on("data", (chunk) => (stderr += String(chunk)));
    child.on("error", (error) => {
      if (timer !== null) clearTimeout(timer);
      settled = true;
      reject(error);
    });
    child.on("close", (code) => finish(code));
    child.on("exit", (code) => setTimeout(() => finish(code), GRACE_MS));
    child.stdin.on("error", () => {}); // the command may exit before it reads its input
    child.stdin.end(options.input ?? "");
  });
}

const ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/** Remove the colour codes that bb and the lab scripts print. */
export const ansi = (text: string): string => text.replace(ESCAPE, "");
