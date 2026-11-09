import type { BindResult } from "./types.ts";

/**
 * The directory to bind read-only for a CLI. A mise install keeps each version in its own directory,
 * so the whole version directory is bound. Any other install binds the directory of the binary.
 */
export function installRoot(realPath: string): string {
  const mise = /^(.*\/installs\/[^/]+\/[^/]+)\//.exec(realPath);
  if (mise?.[1] !== undefined) return mise[1];
  return realPath.slice(0, Math.max(realPath.lastIndexOf("/"), 1));
}

export function bindCli(command: string, which: (command: string) => string | null): BindResult {
  const real = which(command);
  if (real === null) return { ok: false, message: `${command} is not installed on this machine, so its harness cannot run.` };
  return { ok: true, binds: [installRoot(real)], links: [{ name: command, target: real }] };
}
