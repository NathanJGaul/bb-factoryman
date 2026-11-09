import { describe, expect, it } from "vitest";
import { DISPATCH, loadWorld, type World } from "../fixtures/plugin-host";

// The four causes that the scout report saw on the four harnesses (section 5.1), word for word.
const CLAUDE_LOGIN = "Not logged in · Please run /login";
const OMP_NO_MODEL = "Internal error: No model selected. Use /login, set an API key, or pick a model with --model";
const PI_MODEL = "Failed to resolve Pi model openai/gpt-6-luna";
const CODEX_401 = "unexpected status 401 Unauthorized: Missing bearer or basic authentication in header";

const SIGN_IN_REMEDY = "Sign in to the provider on the machine that runs the worker, then dispatch the task again.";
const MODEL_REMEDY = "Pick a model that `bb provider models <provider>` lists for this provider, then dispatch the task again.";

async function oneTask(): Promise<World> {
  const world = await loadWorld();
  await world.call("factoryman_dispatch", DISPATCH);
  world.sent("thr-sup").length = 0;
  return world;
}

const fail = (world: World) => world.store.listEvents({ taskId: "t1" }).findLast((row) => row.event === "fail");
const logCause = (world: World, type: "provider/error" | "system/error", data: Record<string, unknown>, seq = 5) =>
  world.threadEvents.set("thr-w1", [...(world.threadEvents.get("thr-w1") ?? []), { type, seq, data }]);

describe("the cause of a failure through the plugin factory", () => {
  it("[A1339] puts the latest error event's detail in the evidence, after the evidence the plugin already had", async () => {
    const world = await oneTask();
    logCause(world, "provider/error", { message: "old", detail: "An older error" }, 2);
    logCause(world, "provider/error", { message: "Command failed", detail: "Overloaded, try later" }, 7);
    await world.emit("thread.failed", "thr-w1", { error: "Provider crashed" });
    expect(world.store.getTask("t1")?.state).toBe("failed");
    expect(fail(world)).toMatchObject({ actor: "system", evidence: 'worker thread failed: Provider crashed. Provider-reported cause: "Overloaded, try later"' });
  });

  it.each([
    ["Claude Code", "provider/error", CLAUDE_LOGIN, { error: null }],
    ["omp", "provider/error", OMP_NO_MODEL, { error: null }],
    ["Pi", "system/error", PI_MODEL, { error: "Command thread.start failed" }],
    ["Codex", "provider/error", CODEX_401, { error: null }],
  ] as const)("[A1340] puts the %s cause in the evidence word for word", async (_harness, type, cause, payload) => {
    const world = await oneTask();
    logCause(world, type, { message: "failed", detail: cause });
    await world.emit("thread.failed", "thr-w1", payload);
    expect(fail(world)?.evidence).toContain(`Provider-reported cause: "${cause}"`);
  });

  it("[A1340] keeps the category and HTTP status of a Codex turn failure next to the cause", async () => {
    const world = await oneTask();
    logCause(world, "provider/error", { message: "failed", detail: CODEX_401 });
    await world.host.harness.behavior.emitThreadEvent("turn.failed", { threadId: "thr-w1", errorInfo: { category: "connection-failed", httpStatusCode: 401 } } as never);
    await world.emit("thread.failed", "thr-w1", { error: null });
    expect(fail(world)?.evidence).toContain("provider error (category connection-failed, HTTP 401)");
    expect(fail(world)?.evidence).toContain(`Provider-reported cause: "${CODEX_401}"`);
  });

  it.each([CLAUDE_LOGIN, OMP_NO_MODEL, PI_MODEL, CODEX_401])("[A1341] sends the supervisor the cause %j whole", async (cause) => {
    const world = await oneTask();
    logCause(world, "provider/error", { message: "failed", detail: cause });
    await world.emit("thread.failed", "thr-w1", { error: "worker thread died with a long and chatty explanation ".repeat(4) });
    const [message] = world.sent("thr-sup");
    expect(world.sent("thr-sup")).toHaveLength(1);
    expect(message).toContain(`Provider-reported cause: "${cause}"`);
    expect(message).toContain("Remedy:");
  });

  it("[A1341] keeps a cause of 300 characters and its remedy whole in the wake message when the evidence is already long", async () => {
    const world = await oneTask();
    const cause = `Not logged in · ${"z".repeat(284)}`;
    expect(cause).toHaveLength(300);
    logCause(world, "provider/error", { message: "failed", detail: cause });
    await world.emit("thread.failed", "thr-w1", { error: "e".repeat(400) });
    const [message] = world.sent("thr-sup");
    expect(message?.length).toBeGreaterThan(800);
    expect(message).toContain(`Provider-reported cause: "${cause}"`);
    expect(message).toContain(`Remedy: ${SIGN_IN_REMEDY}`);
  });

  it.each([
    ["a sign-in cause", CLAUDE_LOGIN, SIGN_IN_REMEDY],
    ["a no-model cause", OMP_NO_MODEL, MODEL_REMEDY],
  ])("[A1342] adds a remedy line for %s, and the cause stays in the evidence unchanged", async (_label, cause, remedy) => {
    const world = await oneTask();
    logCause(world, "provider/error", { message: "failed", detail: cause });
    await world.emit("thread.failed", "thr-w1", { error: null });
    const lines = (fail(world)?.evidence ?? "").split("\n");
    expect(lines[0]).toContain(`Provider-reported cause: "${cause}"`);
    expect(lines[1]).toBe(`Remedy: ${remedy}`);
  });

  it("[A1343] keeps today's evidence when the log holds no error event, and still fails the task", async () => {
    const world = await oneTask();
    await world.emit("thread.failed", "thr-w1", { error: "Provider crashed" });
    expect(world.store.getTask("t1")?.state).toBe("failed");
    expect(fail(world)?.evidence).toBe("worker thread failed: Provider crashed");
  });

  it("[A1343] keeps today's evidence, still fails the task, and logs the problem when the read fails", async () => {
    const world = await loadWorld({ eventsError: new Error("HTTP 500") });
    await world.call("factoryman_dispatch", DISPATCH);
    await world.emit("thread.failed", "thr-w1", { error: "Provider crashed" });
    expect(world.store.getTask("t1")?.state).toBe("failed");
    expect(fail(world)?.evidence).toBe("worker thread failed: Provider crashed");
    expect(world.host.harness.inspection.logEntries.some((entry) => entry.level === "warn" && entry.message.includes("thr-w1") && entry.message.includes("HTTP 500"))).toBe(true);
  });

  it("[A1344] flattens and bounds a long cause with line breaks and control characters, and shows it as reported text", async () => {
    const world = await oneTask();
    logCause(world, "provider/error", { message: "failed", detail: `line one\r\nline two\u0000\u001b[0m ${"y".repeat(500)}` });
    await world.emit("thread.failed", "thr-w1", { error: "Provider crashed" });
    const evidence = fail(world)?.evidence ?? "";
    expect(evidence.split("\n")).toHaveLength(1);
    expect(evidence).not.toMatch(/\p{Cc}/u);
    expect(evidence).toContain('Provider-reported cause: "line one line two [0m yyy');
    expect(evidence.endsWith('..."')).toBe(true);
    expect(evidence.length).toBeLessThan(500);
  });
});
