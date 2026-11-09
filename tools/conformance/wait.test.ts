import { describe, expect, it } from "vitest";
import { waitUntil } from "./wait.ts";

/** A read that answers from a script and a sleep that records its delays in the same log, so the order of the two shows. */
function script(answers: Array<boolean | Error>) {
  const log: string[] = [];
  let i = 0;
  const read = async (): Promise<boolean> => {
    const next = answers[Math.min(i, answers.length - 1)];
    i += 1;
    log.push("read");
    if (next instanceof Error) throw next;
    return next as boolean;
  };
  const sleep = async (ms: number): Promise<void> => void log.push(`sleep ${ms}`);
  return { read, sleep, log };
}

describe("waitUntil", () => {
  it("[U1720] returns true as soon as a read says so, with the delay between reads and none before the first", async () => {
    const first = script([true]);
    expect(await waitUntil(first.read, { attempts: 5, delayMs: 2000, sleep: first.sleep })).toBe(true);
    expect(first.log).toEqual(["read"]);
    const third = script([false, false, true]);
    expect(await waitUntil(third.read, { attempts: 5, delayMs: 2000, sleep: third.sleep })).toBe(true);
    expect(third.log).toEqual(["read", "sleep 2000", "read", "sleep 2000", "read"]);
  });

  it("[U1721] returns false after the attempts run out, with one read per attempt and a sleep between them, and counts a throwing read as not yet", async () => {
    const never = script([false]);
    expect(await waitUntil(never.read, { attempts: 3, delayMs: 500, sleep: never.sleep })).toBe(false);
    expect(never.log).toEqual(["read", "sleep 500", "read", "sleep 500", "read"]);
    const flaky = script([new Error("bb is busy"), true]);
    expect(await waitUntil(flaky.read, { attempts: 3, delayMs: 500, sleep: flaky.sleep })).toBe(true);
    expect(flaky.log).toEqual(["read", "sleep 500", "read"]);
    const broken = script([new Error("bb is down")]);
    expect(await waitUntil(broken.read, { attempts: 2, delayMs: 500, sleep: broken.sleep })).toBe(false);
  });
});
