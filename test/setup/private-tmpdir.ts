import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface PrivateTmpdir {
  /** The directory that `TMPDIR` points at. */
  dir: string;
  /** Put the earlier `TMPDIR` back and remove the directory. Calling it again does nothing. */
  restore(): void;
}

/**
 * Point `TMPDIR` at a new directory inside the current temporary directory.
 * `os.tmpdir()` reads `TMPDIR` on each call, so every temporary directory that the tests make afterwards lands inside it.
 * That includes the `bb-fake-plugin-host-*` directory of each fake plugin host, which the SDK removes only when a test disposes the host.
 */
export function createPrivateTmpdir(env: NodeJS.ProcessEnv = process.env): PrivateTmpdir {
  const earlier = env["TMPDIR"];
  const dir = mkdtempSync(join(earlier === undefined || earlier === "" ? tmpdir() : earlier, "bb-factoryman-test-"));
  env["TMPDIR"] = dir;
  let restored = false;
  return {
    dir,
    restore() {
      if (restored) return;
      restored = true;
      if (earlier === undefined) delete env["TMPDIR"];
      else env["TMPDIR"] = earlier;
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
