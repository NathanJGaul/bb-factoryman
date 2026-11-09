import { describe, expect, it } from "vitest";
import { modelEntry, providerState } from "../../test/fixtures/bb-port";
import { PROFILE_OK_FOR_QUEUE } from "../../test/fixtures/queue";
import { testRuntime, type TestRuntime } from "../../test/fixtures/runtime";
import { answerRead } from "../../test/fixtures/validator-read";
import type { TaskRow } from "../store/types";
import { RUNNING_STATES, capReached, drain, enqueue, registerQueue, runningCount } from "./queue";
import type { QueuedRequest } from "./request";

const REQUEST: QueuedRequest = {
  v: 1,
  description: "Add a --json flag to the status command.",
  tags: [],
  profile: PROFILE_OK_FOR_QUEUE,
  machine: null,
  cloneHost: "host_local",
  parentThreadId: "thr-sup",
  branchPrefix: null,
  baseBranch: null,
};

function setup(): TestRuntime {
  const t = testRuntime();
  t.bb.addThread({ id: "thr-sup" });
  return t;
}

const row = (taskId: string, state: TaskRow["state"], projectId = "proj-1"): TaskRow => ({ taskId, projectId, kind: "ship", mode: "no-mistakes", state, workerThreadId: null, branch: null, machine: null, pullRequestUrl: null });
const queue = (t: TestRuntime, request: QueuedRequest = REQUEST, projectId = "proj-1") => {
  const queued = enqueue(t.runtime, { projectId, kind: "ship", mode: "no-mistakes", request });
  if (!queued.ok) throw new Error(queued.message);
  return queued.taskId;
};
const state = (t: TestRuntime, id: string) => t.runtime.deps.store.getTask(id)?.state;
const warnings = (t: TestRuntime) => t.lines.filter((line) => line.level === "warn").map((line) => line.message);

describe("running workers and caps", () => {
  it("[U1005] counts working, blocked, validating, and needs_decision workers and nothing else", () => {
    const t = setup();
    const store = t.runtime.deps.store;
    const states = ["queued", "working", "blocked", "validating", "needs_decision", "review_ready", "awaiting_approval", "merged", "report_ready", "torn_down", "failed"] as const;
    states.forEach((s, i) => store.putTask(row(`t${i}`, s)));
    expect([...RUNNING_STATES]).toEqual(["working", "blocked", "validating", "needs_decision"]);
    expect(runningCount(t.runtime)).toBe(4);
    store.putTask(row("other", "working", "proj-2"));
    expect(runningCount(t.runtime)).toBe(5);
    expect(runningCount(t.runtime, "proj-1")).toBe(4);
    expect(runningCount(t.runtime, "proj-2")).toBe(1);
  });

  it("[U1006] lets the project cap and the global cap each decide, and treats null as no cap", () => {
    const t = setup();
    const store = t.runtime.deps.store;
    store.putTask(row("a", "working", "proj-1"));
    store.putTask(row("b", "working", "proj-2"));
    expect(capReached(t.runtime, "proj-1", { project: 1, global: null })).toMatch(/project/);
    expect(capReached(t.runtime, "proj-1", { project: 2, global: null })).toBeNull();
    expect(capReached(t.runtime, "proj-1", { project: null, global: 2 })).toMatch(/global/);
    expect(capReached(t.runtime, "proj-1", { project: null, global: 3 })).toBeNull();
    expect(capReached(t.runtime, "proj-1", { project: null, global: null })).toBeNull();
    expect(capReached(t.runtime, "proj-2", { project: 1, global: 5 })).toMatch(/project/);
  });

  it("counts a worker that is launching and not yet started", () => {
    const t = setup();
    t.runtime.launching.add("t9");
    t.runtime.deps.store.putTask(row("t9", "queued"));
    expect(runningCount(t.runtime)).toBe(1);
  });
});

describe("drain", () => {
  it("[U1007] starts queued tasks oldest first until a cap is reached", async () => {
    const t = setup();
    const first = queue(t);
    const second = queue(t);
    const third = queue(t);
    t.settings.maxWorkers = 2;
    expect(await drain(t.runtime)).toBe(2);
    expect([state(t, first), state(t, second), state(t, third)]).toEqual(["working", "working", "queued"]);
    expect(t.bb.callsTo("spawnWorker")).toHaveLength(2);
    t.settings.maxWorkers = 0;
    expect(await drain(t.runtime)).toBe(1);
    expect(state(t, third)).toBe("working");
  });

  it("[U1008] leaves a task queued while its machine is offline, and fails a task whose request is unreadable", async () => {
    const t = setup();
    t.bb.machines.push({ id: "host_gpu", name: "gpu-box", status: "disconnected", phase: "active", online: false });
    t.bb.sources.push({ hostId: "host_gpu", path: "/work/gpu", isDefault: false });
    const pinned = queue(t, { ...REQUEST, machine: "host_gpu" });
    const broken = t.runtime.log.create({ type: "create", actor: "supervisor", taskId: "bad", projectId: "proj-1", kind: "ship", mode: "no-mistakes", request: { nonsense: true } });
    expect(broken.ok).toBe(true);
    await drain(t.runtime);
    expect(state(t, pinned)).toBe("queued");
    expect(t.bb.callsTo("spawnWorker")).toEqual([]);
    expect(t.lines.some((line) => line.level === "warn" && line.message.includes(pinned))).toBe(true);
    expect(state(t, "bad")).toBe("failed");
    const fail = t.runtime.deps.store.listEvents({ taskId: "bad" }).find((r) => r.event === "fail");
    expect(fail?.evidence).toMatch(/unreadable/);
    t.bb.machines[1] = { id: "host_gpu", name: "gpu-box", status: "connected", phase: "active", online: true };
    await drain(t.runtime);
    expect(state(t, pinned)).toBe("working");
    expect(t.runtime.deps.store.getTask(pinned)?.machine).toBe("host_gpu");
  });

  it("leaves a task queued, and does not spawn, when the provider is no longer available", async () => {
    const t = setup();
    const id = queue(t);
    t.bb.providers = [];
    await drain(t.runtime);
    expect(state(t, id)).toBe("queued");
    expect(t.bb.callsTo("spawnWorker")).toEqual([]);
  });

  it("[U1351] leaves a task queued, spawns nothing, and logs the message when its provider is not signed in", async () => {
    const t = setup();
    const id = queue(t);
    t.bb.states = [providerState(PROFILE_OK_FOR_QUEUE.provider, { status: "unauthenticated", localLoginCommand: "claude login" })];
    await drain(t.runtime);
    expect(state(t, id)).toBe("queued");
    expect(t.bb.callsTo("spawnWorker")).toEqual([]);
    expect(warnings(t).join("\n")).toContain("stays queued");
    expect(warnings(t).join("\n")).toContain("Run `claude login` on that machine.");
    // The same task starts once the provider is ready.
    t.bb.states = null;
    await drain(t.runtime);
    expect(state(t, id)).toBe("working");
  });

  it("[U1352] leaves a task queued when the provider states cannot be read", async () => {
    const t = setup();
    const id = queue(t);
    t.bb.statesError = new Error("bb is down");
    await drain(t.runtime);
    expect(state(t, id)).toBe("queued");
    expect(t.bb.callsTo("spawnWorker")).toEqual([]);
    expect(warnings(t).join("\n")).toContain("could not read bb's provider states (bb is down)");
  });

  it("[U1367] fails a queued pi task in local-only mode with evidence, and spawns nothing", async () => {
    const t = setup();
    const queued = enqueue(t.runtime, { projectId: "proj-1", kind: "ship", mode: "local-only", request: { ...REQUEST, profile: { provider: "pi", model: "m", reasoningLevel: "medium", permissionMode: "full" } } });
    if (!queued.ok) throw new Error(queued.message);
    await drain(t.runtime);
    expect(state(t, queued.taskId)).toBe("failed");
    const failed = t.runtime.deps.store.listEvents({ taskId: queued.taskId }).findLast((row) => row.event === "fail");
    expect(failed?.evidence).toMatch(/^The queued task can no longer start: The provider `pi` is not admitted for local-only projects\./);
    expect(t.bb.callsTo("spawnWorker")).toEqual([]);
  });

  it("[U1368] does not fail a queued task whose provider fails a readiness check, which is transient", async () => {
    const t = setup();
    const id = queue(t);
    t.bb.states = [providerState(PROFILE_OK_FOR_QUEUE.provider, { status: "expired" })];
    await drain(t.runtime);
    expect(state(t, id)).toBe("queued");
  });

  it("[U1473] leaves a queued task queued, spawns nothing, and logs the message when bb no longer lists its model", async () => {
    const t = setup();
    const id = queue(t);
    t.bb.models.set(PROFILE_OK_FOR_QUEUE.provider, { models: [modelEntry("some-other-model")], loadError: null });
    await drain(t.runtime);
    expect(state(t, id)).toBe("queued");
    expect(t.bb.callsTo("spawnWorker")).toEqual([]);
    expect(warnings(t).join("\n")).toContain(`The model \`${PROFILE_OK_FOR_QUEUE.model}\` is not listed`);
    t.bb.models.clear();
    await drain(t.runtime);
    expect(state(t, id)).toBe("working");
  });

  it("[U1009] drains when a task leaves the running states, and not otherwise", async () => {
    const t = setup();
    registerQueue(t.runtime);
    t.settings.maxWorkers = 1;
    const running = queue(t);
    await drain(t.runtime);
    expect(state(t, running)).toBe("working");
    const waiting = queue(t);
    await drain(t.runtime);
    expect(state(t, waiting)).toBe("queued");
    // working -> validating stays in the running states: no drain.
    await t.runtime.apply(running, { type: "handoff", actor: "worker", evidence: "Committed." });
    expect(state(t, waiting)).toBe("queued");
    // validating -> failed leaves them: the queue drains.
    await t.runtime.apply(running, { type: "fail", actor: "system", evidence: "Gave up." });
    expect(state(t, waiting)).toBe("working");
  });

  it("[U1010] starts a queued task once when two drains overlap", async () => {
    const t = setup();
    queue(t);
    await Promise.all([drain(t.runtime), drain(t.runtime)]);
    expect(t.bb.callsTo("spawnWorker")).toHaveLength(1);
  });

  it("holds a queued task when a project's own cap is full, and starts one from another project", async () => {
    const t = setup();
    t.files.files.set("/work/repo/.bb/factoryman/workflow.json", JSON.stringify({ version: 1, limits: { maxWorkers: 1 } }));
    t.bb.checkouts.set("proj-1", "/work/repo");
    const a = queue(t, REQUEST, "proj-1");
    const b = queue(t, REQUEST, "proj-1");
    const c = queue(t, REQUEST, "proj-2");
    await drain(t.runtime);
    expect([state(t, a), state(t, b), state(t, c)]).toEqual(["working", "queued", "working"]);
  });
});

describe("drain re-checks and bookkeeping", () => {
  it("[U1057] leaves a task queued, and does not spawn, when the preflight of its remote machine fails at the drain", async () => {
    const t = setup();
    t.bb.machines.push({ id: "host_gpu", name: "gpu-box", status: "connected", phase: "active", online: true });
    t.bb.sources.push({ hostId: "host_gpu", path: "/work/gpu", isDefault: false });
    t.execHandler = (command) => (command === "gh" ? { code: 1, stdout: "", stderr: "not logged in" } : { code: 0, stdout: "", stderr: "" });
    const id = queue(t, { ...REQUEST, machine: "host_gpu" });
    await drain(t.runtime);
    expect(state(t, id)).toBe("queued");
    expect(t.bb.callsTo("spawnWorker")).toEqual([]);
    expect(t.lines.some((line) => line.level === "warn" && line.message.includes(id) && /preflight/.test(line.message))).toBe(true);
    t.execHandler = () => ({ code: 0, stdout: "", stderr: "" });
    await drain(t.runtime);
    expect(state(t, id)).toBe("working");
  });

  it("[U1698] leaves a task queued when the validator agent of its remote machine is not ready, as for any preflight problem", async () => {
    const t = setup();
    t.bb.machines.push({ id: "host_gpu", name: "gpu-box", status: "connected", phase: "active", online: true });
    t.bb.sources.push({ hostId: "host_gpu", path: "/work/gpu", isDefault: false });
    t.bb.statesByHost.set("host_gpu", [providerState("claude"), providerState("codex", { status: "unauthenticated" })]);
    t.execHandler = answerRead("agent: codex\n");
    const id = queue(t, { ...REQUEST, machine: "host_gpu" });
    await drain(t.runtime);
    expect(state(t, id)).toBe("queued");
    expect(t.bb.callsTo("spawnWorker")).toEqual([]);
    expect(t.lines.some((line) => line.level === "warn" && line.message.includes(id) && /preflight/.test(line.message))).toBe(true);
    t.bb.statesByHost.set("host_gpu", [providerState("claude"), providerState("codex")]);
    await drain(t.runtime);
    expect(state(t, id)).toBe("working");
  });

  it("[U1058] scans again when a drain was asked for during a drain, so a slot freed meanwhile is used", async () => {
    const t = setup();
    t.settings.maxWorkers = 2;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => void (release = resolve));
    const spawn = t.bb.spawnWorker.bind(t.bb);
    let first = true;
    t.bb.spawnWorker = async (request) => {
      if (first) {
        first = false;
        await gate;
      }
      return spawn(request);
    };
    const one = queue(t);
    const running = drain(t.runtime);
    const two = queue(t);
    expect(await drain(t.runtime)).toBe(0);
    release();
    expect(await running).toBe(2);
    expect([state(t, one), state(t, two)]).toEqual(["working", "working"]);
  });

  it("[U1059] leaves a queued task that has no stored request alone, without a warning", async () => {
    const t = setup();
    t.runtime.log.create({ type: "create", actor: "supervisor", taskId: "promoted", projectId: "proj-1", kind: "ship", mode: "no-mistakes" });
    const before = t.runtime.deps.store.listEvents().length;
    expect(await drain(t.runtime)).toBe(0);
    expect(state(t, "promoted")).toBe("queued");
    expect(t.runtime.deps.store.listEvents()).toHaveLength(before);
    expect(t.lines.filter((line) => line.level === "warn" || line.level === "error")).toEqual([]);
  });

  it("[U1060] clears the launching entry after a worker starts and after a spawn fails", async () => {
    const t = setup();
    queue(t);
    await drain(t.runtime);
    expect(t.runtime.launching.size).toBe(0);
    t.bb.spawnError = new Error("host is gone");
    const failing = queue(t);
    await drain(t.runtime);
    expect(state(t, failing)).toBe("failed");
    expect(t.runtime.launching.size).toBe(0);
  });
});
