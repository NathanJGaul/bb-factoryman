/**
 * Call `read` until it says true, up to `attempts` times, with `delayMs` between reads and none before the first.
 * A read that throws counts as "not yet". Returns whether a read said true.
 */
export async function waitUntil(read: () => Promise<boolean>, options: { attempts: number; delayMs: number; sleep: (ms: number) => Promise<unknown> }): Promise<boolean> {
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    const ready = await read().catch(() => false);
    if (ready) return true;
    if (attempt < options.attempts) await options.sleep(options.delayMs);
  }
  return false;
}
