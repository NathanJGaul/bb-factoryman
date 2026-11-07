import { describe, expect, it } from "vitest";
import { loadWorld, type World } from "../fixtures/plugin-host";

const TASK = { kind: "ship", description: "Add a --json flag to the status command." } as const;
const URL = "https://hooks.example.com/services/T000/B000/SECRET";
const bodies = (world: World) => world.webhook.calls.map((call) => JSON.parse(call.init.body) as { event: string; task: { taskId: string; state: string }; evidence: string | null });

describe("the webhook through the plugin factory", () => {
  it("[A1013] posts one JSON body when a task enters each attention state", async () => {
    const world = await loadWorld({ settings: { webhookUrl: URL } });
    world.setProject({ deliveryMode: "direct-PR" });
    await world.call("factoryman_dispatch", TASK);
    expect(world.webhook.calls).toEqual([]);
    await world.call("factoryman_report", { outcome: "blocked", evidence: "Need a decision." }, { threadId: "thr-w1" });
    await world.call("factoryman_dispatch", TASK);
    await world.call("factoryman_report", { outcome: "done", evidence: "Pushed.", prUrl: "https://github.com/acme/widgets/pull/7" }, { threadId: "thr-w2" });
    await world.call("factoryman_dispatch", TASK);
    await world.call("factoryman_report", { outcome: "failed", evidence: "Gave up." }, { threadId: "thr-w3" });
    await world.call("factoryman_dispatch", { ...TASK, kind: "scout" });
    await world.call("factoryman_report", { outcome: "done", evidence: "Findings." }, { threadId: "thr-w4" });
    expect(bodies(world).map((body) => `${body.task.taskId}:${body.task.state}`)).toEqual(["t1:blocked", "t2:review_ready", "t3:failed", "t4:report_ready"]);
    expect(world.webhook.calls[0]?.url).toBe(URL);
    expect(bodies(world)[0]).toMatchObject({ event: "task.attention", evidence: "Need a decision." });
  });

  it("[A1014] posts nothing for a state that needs no attention", async () => {
    const world = await loadWorld({ settings: { webhookUrl: URL } });
    await world.call("factoryman_dispatch", TASK);
    await world.call("factoryman_report", { outcome: "done", evidence: "Committed." }, { threadId: "thr-w1" });
    expect(world.store.getTask("t1")?.state).toBe("validating");
    expect(world.webhook.calls).toEqual([]);
  });

  it("[A1015] keeps the transition, and logs the host and not the URL, when the post fails", async () => {
    const world = await loadWorld({ settings: { webhookUrl: URL } });
    world.webhook.result = new Error("connect ECONNREFUSED");
    await world.call("factoryman_dispatch", TASK);
    const result = await world.call("factoryman_report", { outcome: "failed", evidence: "Gave up." }, { threadId: "thr-w1" });
    expect(result.isError).toBe(false);
    expect(world.store.getTask("t1")?.state).toBe("failed");
    const warnings = world.host.harness.inspection.logEntries.filter((entry) => entry.level === "warn" && entry.message.includes("webhook"));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toContain("hooks.example.com");
    expect(warnings[0]?.message).not.toContain("SECRET");
  });

  it.each([
    ["no URL", ""],
    ["a file URL", "file:///etc/passwd"],
    ["text that is not a URL", "not a url"],
  ])("[A1016] posts nothing for %s", async (_label, webhookUrl) => {
    const world = await loadWorld({ settings: { webhookUrl } });
    await world.call("factoryman_dispatch", TASK);
    await world.call("factoryman_report", { outcome: "failed", evidence: "Gave up." }, { threadId: "thr-w1" });
    expect(world.webhook.calls).toEqual([]);
    expect(world.store.getTask("t1")?.state).toBe("failed");
  });
});
