import type { BbPort } from "../bb/port";
import type { Exec, ExecOptions, ExecResult } from "../exec";

export type RemoteRunner = (host: string, command: string, args: readonly string[], options?: ExecOptions) => Promise<ExecResult>;

export function createRemoteRunner(_bb: Pick<BbPort, "startTerminal" | "readTerminal" | "closeTerminal">, _sleep: (ms: number) => Promise<void>, _options: { pollMs?: number; timeoutMs?: number } = {}): RemoteRunner {
  return async () => ({ code: null, stdout: "", stderr: "", error: "not implemented" });
}

export function routeExec(local: Exec, _remote: RemoteRunner): Exec {
  return local;
}
