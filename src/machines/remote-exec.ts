import type { BbPort } from "../bb/port";
import type { Exec, ExecOptions, ExecResult } from "../exec";

export type RemoteRunner = (host: string, command: string, args: readonly string[], options?: ExecOptions) => Promise<ExecResult>;

const DEFAULT_POLL_MS = 1000;
/** `no-mistakes axi run` can wait four minutes by itself, so the default leaves room for a few of those waits. */
const DEFAULT_TIMEOUT_MS = 15 * 60_000;
const TAIL_CHARS = 200;

/**
 * A terminal is a PTY: it merges standard error into standard output and ends
 * each line with a carriage return. This wrapper runs the command with both
 * streams in temporary files, then prints one line, `FMX1 <code> <stdout
 * base64> <stderr base64>`, so the plugin can read the exit code and the two
 * streams apart (spike item 8).
 */
export const WRAPPER =
  'o=$(mktemp) && e=$(mktemp) && "$@" >"$o" 2>"$e"; c=$?; ' +
  "printf 'FMX1 %s %s %s\\n' \"$c\" \"$(base64 <\"$o\" | tr -d '\\n')\" \"$(base64 <\"$e\" | tr -d '\\n')\"; " +
  'rm -f "$o" "$e"';

const FRAME = /^FMX1 (-?\d+) (\S*) (\S*)\s*$/;

const failed = (error: string): ExecResult => ({ code: null, stdout: "", stderr: "", error });

function decodeFrame(output: string): ExecResult | null {
  const lines = output.split(/\r?\n/);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const match = FRAME.exec(lines[index] as string);
    if (match) {
      return {
        code: Number.parseInt(match[1] as string, 10),
        stdout: Buffer.from(match[2] as string, "base64").toString("utf8"),
        stderr: Buffer.from(match[3] as string, "base64").toString("utf8"),
      };
    }
  }
  return null;
}

/**
 * Run one command on a host through a host terminal. It never throws: a
 * terminal that cannot start, does not exit in time, truncates its output, or
 * prints no result frame is an `ExecResult` with `code: null` and an error, and
 * every caller already treats that as a failed command.
 */
export function createRemoteRunner(
  bb: Pick<BbPort, "startTerminal" | "readTerminal" | "closeTerminal">,
  sleep: (ms: number) => Promise<void>,
  options: { pollMs?: number; timeoutMs?: number } = {},
): RemoteRunner {
  const pollMs = options.pollMs ?? DEFAULT_POLL_MS;
  return async (host, command, args, execOptions = {}) => {
    const timeoutMs = execOptions.timeoutMs ?? options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxPolls = Math.max(1, Math.ceil(timeoutMs / pollMs));
    let terminalId: string | null = null;
    try {
      ({ terminalId } = await bb.startTerminal(host, execOptions.cwd ?? null, ["sh", "-c", WRAPPER, "sh", command, ...args]));
      for (let poll = 0; poll < maxPolls; poll += 1) {
        const read = await bb.readTerminal(terminalId);
        if (read.status === "running" || read.status === "starting") {
          await sleep(pollMs);
          continue;
        }
        if (read.truncated) return failed("the terminal output was truncated, so the result cannot be trusted");
        if (read.status === "disconnected") return failed("the terminal disconnected before the command finished");
        const result = decodeFrame(read.output);
        return result ?? failed(`the terminal printed no result frame. Its output ended with: ${JSON.stringify(read.output.slice(-TAIL_CHARS))}`);
      }
      return failed(`the command timed out after ${timeoutMs} ms on host ${host}`);
    } catch (error) {
      return failed(`could not run the command on host ${host}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (terminalId !== null) {
        try {
          await bb.closeTerminal(terminalId);
        } catch {
          // A terminal that is already gone needs no cleanup.
        }
      }
    }
  };
}

/** Run on the server when the options name no host, and through the remote runner when they do. */
export function routeExec(local: Exec, remote: RemoteRunner): Exec {
  return (command, args, options) => {
    const host = options?.host;
    return host === undefined || host === null ? local(command, args, options) : remote(host, command, args, options);
  };
}
