import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const made: string[] = [];

/**
 * Make a temporary project checkout. A string `dispatch` is written as the raw
 * file text, any other value is written as JSON, and `undefined` writes no file.
 */
export function makeCheckout(files: { dispatch?: unknown; workflow?: unknown } = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "factoryman-checkout-"));
  made.push(dir);
  for (const [name, value] of [["dispatch.json", files.dispatch], ["workflow.json", files.workflow]] as const) {
    if (value === undefined) continue;
    mkdirSync(join(dir, ".bb", "factoryman"), { recursive: true });
    writeFileSync(join(dir, ".bb", "factoryman", name), typeof value === "string" ? value : JSON.stringify(value));
  }
  return dir;
}

/** Remove every checkout that `makeCheckout` made. Call it from `afterEach`. */
export function removeCheckouts(): void {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
}
