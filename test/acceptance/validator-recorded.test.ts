import { afterEach, describe, expect, it } from "vitest";
import type { ExecResult } from "../../src/exec";
import { DISPATCH, loadWorld, settle, type World } from "../fixtures/plugin-host";
import { recordedNoMistakes } from "../fixtures/recorded";

const w1 = { threadId: "thr-w1" };
const worlds: World[] = [];
afterEach(async () => {
  for (const world of worlds.splice(0)) await world.host.harness.lifecycle.dispose();
});

/**
 * No forge was available in the spike, so `checks-passed` was never recorded.
 * This output is the recorded status of a run that opened a pull request, with the
 * outcome line changed to the value that the CLI's own documentation lists.
 */
const derivedChecksPassed = () =>
  recordedNoMistakes("status-pr-opened-ci-cancelled.toon").replace("outcome: cancelled", "outcome: checks-passed").replace(/^error: .*\n/m, "");

/** Serve `no-mistakes axi` output from a script, as the real CLI would print it on stdout. */
function scripted(world: World, script: { run: string[]; status: string[] }) {
  const seen: string[] = [];
  world.execHandler = (command, args): ExecResult => {
    if (command !== "no-mistakes") return { code: 0, stdout: "", stderr: "" };
    const verb = args[1] as "run" | "status";
    seen.push(args.join(" "));
    const queue = script[verb];
    const stdout = queue.length > 1 ? queue.shift()! : queue[0]!;
    return { code: stdout.includes("outcome: failed") ? 1 : 0, stdout, stderr: 'A new version of no-mistakes is available: v1.84.0 -> v1.106.1\nRun "no-mistakes update"' };
  };
  return seen;
}

async function handedOff() {
  const world = await loadWorld();
  worlds.push(world);
  world.paths.set("env-thr-w1", "/work/tree");
  await world.call("factoryman_dispatch", DISPATCH);
  world.sent("thr-sup").length = 0;
  return world;
}

describe("the real no-mistakes adapter over recorded output, through the plugin factory", () => {
  it("[A36] pauses the task at the recorded review gate, resumes when the view changes, and reaches review_ready on a finished run", async () => {
    const world = await handedOff();
    const seen = scripted(world, {
      run: [recordedNoMistakes("gate-review.toon"), derivedChecksPassed()],
      status: [recordedNoMistakes("gate-review.toon"), recordedNoMistakes("gate-fix-review.toon")],
    });
    await world.call("factoryman_report", { outcome: "done", evidence: "Committed abc123." }, w1);

    await settle(() => world.store.getTask("t1")?.state === "needs_decision");
    expect(world.store.getTask("t1")?.state).toBe("needs_decision");
    await settle(() => world.sent("thr-sup").length > 0);
    const message = world.sent("thr-sup")[0]!;
    expect(message).toContain("- review-1 [error] sum.js: auto-fix: Off-by-one in loop:");
    expect(message).toContain("- review-2 [error] sum.js: auto-fix: SQL injection:");

    await settle(() => world.store.getTask("t1")?.state === "review_ready");
    expect(world.store.getTask("t1")).toMatchObject({ state: "review_ready", pullRequestUrl: "https://github.com/NathanJGaul/bb-factoryman/pull/1" });
    expect(seen[0]).toMatch(/^axi run --intent Add a --json flag/);
    expect(seen.every((line) => !/\s(--yes|-y)(\s|$)/.test(line))).toBe(true);
    expect(world.execCalls.every((call) => call.cwd === "/work/tree" || call.command !== "no-mistakes")).toBe(true);
  });
});
