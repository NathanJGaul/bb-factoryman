import { describe, expect, it } from "vitest";
import type { Logger } from "../runtime";
import type { TaskEventRow, TaskRow } from "../store/types";
import { WebhookNotifier, type FetchLike } from "./webhook";

const TASK: TaskRow = { taskId: "t1", projectId: "proj-1", kind: "ship", mode: "direct-PR", state: "review_ready", workerThreadId: "thr-w1", branch: "fm/t1", machine: "host_gpu", pullRequestUrl: "https://github.com/acme/widgets/pull/7" };
const EVENT: TaskEventRow = { seq: 5, taskId: "t1", at: "2026-11-07T12:00:05.000Z", fromState: "working", toState: "review_ready", event: "ready", actor: "worker", evidence: "Pushed.", payload: {}, outcome: "applied", reasonCode: null, reasonMessage: null };

function setup(url = "https://hooks.example.com/services/T000/B000/SECRET", fetchResult: { ok: boolean; status: number } | Error = { ok: true, status: 200 }) {
  const calls: Array<{ url: string; init: Parameters<FetchLike>[1] }> = [];
  const warnings: string[] = [];
  const log: Logger = { debug: () => undefined, info: () => undefined, warn: (m) => void warnings.push(m), error: () => undefined };
  const fetch: FetchLike = async (u, init) => {
    calls.push({ url: u, init });
    if (fetchResult instanceof Error) throw fetchResult;
    return fetchResult;
  };
  return { notifier: new WebhookNotifier({ fetch, log, url: () => url }), calls, warnings };
}

describe("WebhookNotifier", () => {
  it("[U1017] posts a JSON body with the event name, the task facts, and clipped evidence", async () => {
    const { notifier, calls } = setup();
    await notifier.post(TASK, { ...EVENT, evidence: "e".repeat(2000) });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.headers["content-type"]).toBe("application/json");
    const body = JSON.parse(calls[0]?.init.body ?? "{}");
    expect(body).toMatchObject({
      event: "task.attention",
      at: "2026-11-07T12:00:05.000Z",
      task: { taskId: "t1", projectId: "proj-1", kind: "ship", mode: "direct-PR", state: "review_ready", workerThreadId: "thr-w1", branch: "fm/t1", machine: "host_gpu", pullRequestUrl: "https://github.com/acme/widgets/pull/7" },
    });
    expect(body.evidence.length).toBeLessThanOrEqual(600);
    expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    ["a blank URL", ""],
    ["a URL with spaces only", "   "],
    ["a file URL", "file:///etc/passwd"],
    ["a javascript URL", "javascript:alert(1)"],
    ["text that is not a URL", "not a url"],
  ])("[U1018] posts nothing for %s", async (_label, url) => {
    const { notifier, calls } = setup(url);
    await notifier.post(TASK, EVENT);
    expect(calls).toEqual([]);
  });

  it("[U1018] posts to http and https URLs", async () => {
    for (const url of ["http://localhost:9999/hook", "https://hooks.example.com/x"]) {
      const { notifier, calls } = setup(url);
      await notifier.post(TASK, EVENT);
      expect(calls[0]?.url, url).toBe(url);
    }
  });

  it("[U1019] logs a warning with the host and never the URL, for a thrown error or a bad status", async () => {
    for (const result of [new Error("connect ECONNREFUSED"), { ok: false, status: 500 }]) {
      const { notifier, warnings } = setup("https://hooks.example.com/services/T000/B000/SECRET?token=abc", result);
      await notifier.post(TASK, EVENT);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("hooks.example.com");
      expect(warnings[0]).not.toContain("SECRET");
      expect(warnings[0]).not.toContain("token=abc");
    }
  });
});
