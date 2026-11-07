import { createFakePluginHost } from "@get-bb/plugin-sdk/testing";
import { describe, expect, it } from "vitest";
import { createMemoryStore } from "../store/memory";
import type { Store } from "../store/store";
import { TaskLog } from "../store/task-log";
import { registerReadRpc, RPC_VERSION } from "./read";

const PLUGIN_CALLER = { experimental_caller: { kind: "plugin", pluginId: "board" } } as never;

function setup(store: Store = createMemoryStore()) {
  const host = createFakePluginHost({ pluginId: "factoryman" });
  registerReadRpc(host.bb, store);
  const log = new TaskLog(store, { now: (() => { let n = 0; return () => new Date(Date.UTC(2026, 10, 7, 12, 0, n++)).toISOString(); })() });
  const call = (method: string, input?: unknown) => host.harness.behavior.callRpc(method, input, PLUGIN_CALLER) as Promise<Record<string, unknown>>;
  const make = (taskId: string, projectId = "proj-1", kind: "ship" | "scout" = "ship") => {
    const created = log.create({ type: "create", actor: "supervisor", taskId, projectId, kind, mode: "no-mistakes" });
    if (!created.ok) throw new Error(created.refusal.message);
  };
  const start = (taskId: string) =>
    log.apply(taskId, { type: "start", actor: "supervisor", profile: { provider: "claude", model: "opus", reasoningLevel: "high", permissionMode: "auto" }, threadId: `thr-${taskId}`, branch: `fm/${taskId}`, evidence: "Do it." });
  return { host, store, call, make, start, log };
}

describe("the read RPC", () => {
  it("[U929] lists task rows, filtered by project and by states", async () => {
    const { call, make, start } = setup();
    make("a", "proj-1");
    make("b", "proj-2");
    make("c", "proj-1");
    start("c");
    const all = await call("listTasks", {});
    expect((all["tasks"] as Array<{ taskId: string }>).map((task) => task.taskId)).toEqual(["a", "b", "c"]);
    const project = await call("listTasks", { projectId: "proj-1" });
    expect((project["tasks"] as Array<{ taskId: string }>).map((task) => task.taskId)).toEqual(["a", "c"]);
    const working = await call("listTasks", { states: ["working"] });
    expect(working["tasks"]).toEqual([{ taskId: "c", projectId: "proj-1", kind: "ship", mode: "no-mistakes", state: "working", workerThreadId: "thr-c", branch: "fm/c", machine: null, pullRequestUrl: null }]);
  });

  it("[U930] returns a task, and null for an unknown task", async () => {
    const { call, make } = setup();
    make("a");
    expect(await call("getTask", { taskId: "a" })).toMatchObject({ apiVersion: 1, task: { taskId: "a", state: "queued" } });
    expect(await call("getTask", { taskId: "nope" })).toEqual({ apiVersion: 1, task: null });
  });

  it("[U931] lists events after `since`, for one task or all, up to a limit, in order", async () => {
    const { call, make, start } = setup();
    make("a");
    make("b");
    start("a");
    start("b");
    const everything = (await call("listEvents", {})) as { events: Array<{ seq: number; taskId: string; event: string; actor: string }> };
    expect(everything.events.map((event) => `${event.taskId}:${event.event}`)).toEqual(["a:create", "b:create", "a:start", "b:start"]);
    const seqs = everything.events.map((event) => event.seq);
    expect(seqs).toEqual([...seqs].sort((x, y) => x - y));
    const after = (await call("listEvents", { since: seqs[1] })) as { events: Array<{ taskId: string; event: string }> };
    expect(after.events.map((event) => `${event.taskId}:${event.event}`)).toEqual(["a:start", "b:start"]);
    const oneTask = (await call("listEvents", { taskId: "b" })) as { events: Array<{ event: string }> };
    expect(oneTask.events.map((event) => event.event)).toEqual(["create", "start"]);
    const limited = (await call("listEvents", { limit: 2 })) as { events: unknown[] };
    expect(limited.events).toHaveLength(2);
    expect(everything.events[0]).toMatchObject({ actor: "supervisor", outcome: "applied" });
    expect(Object.keys(everything.events[0] as object)).not.toContain("payload");
  });

  it("[U932] answers apiVersion 1, and every answer carries it", async () => {
    const { call, make } = setup();
    make("a");
    expect(RPC_VERSION).toBe(1);
    expect(await call("apiVersion", {})).toEqual({ apiVersion: 1 });
    for (const [method, input] of [["listTasks", {}], ["getTask", { taskId: "a" }], ["listEvents", {}]] as const) {
      expect((await call(method, input))["apiVersion"], method).toBe(1);
    }
  });

  it("[U933] registers exactly four methods, all discoverable and described", () => {
    const { host } = setup();
    const { rpcMethods, experimental_publishedRpcMethods: published } = host.harness.inspection.registrations;
    expect([...rpcMethods].sort()).toEqual(["apiVersion", "getTask", "listEvents", "listTasks"]);
    expect(published.map((entry) => entry.method).sort()).toEqual(["apiVersion", "getTask", "listEvents", "listTasks"]);
    for (const entry of published) expect(entry.registrationDescription ?? entry.methodDescription, entry.method).toBeTruthy();
  });

  it("[U934] never calls a write method of the store", async () => {
    const real = createMemoryStore();
    const writes: string[] = [];
    const guarded = new Proxy(real, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value !== "function") return value;
        if (["appendEvent", "putTask", "clearTasks", "addApproval", "putProjectConfig", "transaction"].includes(String(prop))) {
          return (...args: unknown[]) => {
            writes.push(String(prop));
            return (value as (...a: unknown[]) => unknown).apply(target, args);
          };
        }
        return value.bind(target);
      },
    }) as Store;
    const { call, make } = setup(guarded);
    make("a");
    writes.length = 0;
    await call("listTasks", {});
    await call("getTask", { taskId: "a" });
    await call("listEvents", {});
    await call("apiVersion", {});
    expect(writes).toEqual([]);
  });

  it("[U935] rejects input outside the contract", async () => {
    const { call } = setup();
    await expect(call("listTasks", { extra: 1 })).rejects.toThrow();
    await expect(call("listEvents", { limit: 0 })).rejects.toThrow();
    await expect(call("listEvents", { limit: 1001 })).rejects.toThrow();
    await expect(call("listEvents", { since: -1 })).rejects.toThrow();
    await expect(call("getTask", {})).rejects.toThrow();
    await expect(call("listTasks", { states: ["nope"] })).rejects.toThrow();
  });
});
