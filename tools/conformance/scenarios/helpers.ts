import type { Check, Lab, Wake } from "../port.ts";

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Call `read` until it returns a value, or until the lab's patience runs out. */
export async function until<T>(lab: Lab, read: () => Promise<T | null>, patienceMs = lab.patienceMs): Promise<T | null> {
  const deadline = Date.now() + patienceMs;
  const step = Math.max(5, Math.min(1000, Math.floor(patienceMs / 10)));
  for (;;) {
    const value = await read();
    if (value !== null) return value;
    if (Date.now() >= deadline) return null;
    await sleep(step);
  }
}

/** The wakes in a thread that name a task and match the phrase. */
export const matching = (wakes: Wake[], taskId: string, phrase: RegExp): Wake[] => wakes.filter((w) => w.text.includes(`Task ${taskId} `) && phrase.test(w.text));

/**
 * Wait for the first wake that names the task, then wait the lab's settle time and read again,
 * so a second delivery would show. Returns every matching wake.
 */
export async function wakesAfter(lab: Lab, threadId: string | null, taskId: string, phrase: RegExp, patienceMs = lab.patienceMs): Promise<Wake[]> {
  if (threadId === null) return [];
  const first = await until(lab, async () => {
    const found = matching(await lab.wakes(threadId), taskId, phrase);
    return found.length > 0 ? found : null;
  }, patienceMs);
  if (first === null) return [];
  await sleep(lab.settleMs);
  return matching(await lab.wakes(threadId), taskId, phrase);
}

/** True when `wanted` appears in `seen` in order, with other items allowed between. */
export function inOrder(seen: string[], wanted: string[]): boolean {
  let at = 0;
  for (const item of seen) if (item === wanted[at]) at += 1;
  return at === wanted.length;
}

export const SUPERVISOR_TOOLS = ["factoryman_decide", "factoryman_dispatch", "factoryman_merge", "factoryman_status", "factoryman_teardown"];

export const hasAll = (have: string[], want: string[]) => want.every((item) => have.includes(item));
export const hasAny = (have: string[], other: string[]) => other.some((item) => have.includes(item));

export function dispatchFailure(id: string, title: string, text: string): Check {
  return { id, title, ok: false, evidence: `The dispatch created no task: ${text.slice(0, 300)}` };
}

/**
 * Spawn a supervisor, stamp it, take the driver's documented step, and give it one more turn.
 * Returns the thread and what the stamp command said.
 */
export async function supervisorWithRole(lab: Lab, label: string): Promise<{ threadId: string; stampText: string }> {
  const threadId = await lab.spawnSupervisor(label);
  await lab.waitIdle(threadId, lab.patienceMs);
  const stamp = await lab.stamp(threadId);
  if (lab.driver.roleChangeStep === "clear") await lab.clear(threadId);
  await lab.tell(threadId, label, []);
  await lab.waitIdle(threadId, lab.patienceMs);
  return { threadId, stampText: stamp.text };
}
