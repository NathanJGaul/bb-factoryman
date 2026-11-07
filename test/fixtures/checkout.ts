import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const made: string[] = [];

/**
 * Make a temporary project checkout. A string `dispatch` is written as the raw
 * file text, any other value is written as JSON, and `undefined` writes no file.
 */
export function makeCheckout(files: { dispatch?: unknown } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "factoryman-checkout-"));
  made.push(dir);
  if (files.dispatch !== undefined) {
    mkdirSync(join(dir, ".bb", "factoryman"), { recursive: true });
    const text = typeof files.dispatch === "string" ? files.dispatch : JSON.stringify(files.dispatch);
    writeFileSync(join(dir, ".bb", "factoryman", "dispatch.json"), text);
  }
  return dir;
}

/** Remove every checkout that `makeCheckout` made. Call it from `afterEach`. */
export function removeCheckouts(): void {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
}
