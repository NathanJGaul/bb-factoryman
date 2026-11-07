import { describe, expect, it } from "vitest";
import { loadWorld } from "../fixtures/plugin-host";

const TASK = { kind: "ship", description: "Add a --json flag to the status command." } as const;
const SIBLING = { experimental_caller: { kind: "plugin", pluginId: "board" } } as never;

describe("the thread metadata and the read RPC through the plugin factory", () => {
  it("[A913] keeps the worker thread's metadata in step with its task, and keeps the role", async () => {
    const world = await loadWorld();
    await world.call("factoryman_dispatch", TASK);
    expect(world.metadata.get("thr-w1")).toEqual({ role: "worker", taskId: "t1", kind: "ship", mode: "no-mistakes", state: "working", machine: null });
    await world.call("factoryman_report", { outcome: "done", evidence: "Committed." }, { threadId: "thr-w1" });
    expect(world.metadata.get("thr-w1")).toMatchObject({ role: "worker", state: "validating" });
  });

  it("[A914] leaves the transition in place, and logs a warning, when bb fails the metadata write", async () => {
    const world = await loadWorld();
    await world.call("factoryman_dispatch", TASK);
    world.failMetadata = new Error("bb is down");
    const result = await world.call("factoryman_report", { outcome: "done", evidence: "Committed." }, { threadId: "thr-w1" });
    expect(result.isError).toBe(false);
    expect(world.store.getTask("t1")?.state).toBe("validating");
    expect(world.host.harness.inspection.logEntries.some((entry) => entry.level === "warn" && entry.message.includes("bb is down"))).toBe(true);
  });

  it("[A915] lets a sibling plugin read tasks and events through callRpc, with since, and every answer carries apiVersion 1", async () => {
    const world = await loadWorld();
    await world.call("factoryman_dispatch", TASK);
    await world.call("factoryman_report", { outcome: "done", evidence: "Committed." }, { threadId: "thr-w1" });
    const call = (method: string, input?: unknown) => world.host.harness.behavior.callRpc(method, input, SIBLING) as Promise<Record<string, unknown> & { events?: Array<{ seq: number }>; tasks?: unknown; task?: unknown }>;
    const tasks = await call("listTasks", { projectId: "proj-1" });
    expect(tasks["apiVersion"]).toBe(1);
    expect(tasks["tasks"]).toEqual(world.store.listTasks({ projectId: "proj-1" }).map((row) => ({ ...row })));
    expect((await call("getTask", { taskId: "t1" }))["task"]).toMatchObject({ taskId: "t1", state: "validating" });
    const events = (await call("listEvents", {})).events ?? [];
    expect(events.map((event) => event.seq)).toEqual(world.store.listEvents().map((row) => row.seq));
    const first = events[0]?.seq ?? -1;
    const later = (await call("listEvents", { since: first })).events ?? [];
    expect(later).toHaveLength(events.length - 1);
    expect(await call("apiVersion", {})).toEqual({ apiVersion: 1 });
  });

  it("[A916] changes nothing for any call, and has no method that could write", async () => {
    const world = await loadWorld();
    await world.call("factoryman_dispatch", TASK);
    const before = JSON.stringify([world.store.listEvents(), world.store.listTasks()]);
    const call = (method: string, input?: unknown) => world.host.harness.behavior.callRpc(method, input, SIBLING);
    for (const method of ["apply", "transition", "merge", "teardown", "approve", "putTask", "fail"]) {
      await expect(call(method, { taskId: "t1", type: "fail", actor: "user", evidence: "x" }), method).rejects.toThrow();
    }
    await call("listTasks", {});
    await call("getTask", { taskId: "t1" });
    await call("listEvents", {});
    expect(JSON.stringify([world.store.listEvents(), world.store.listTasks()])).toBe(before);
  });

  it("[A917] registers exactly the four read methods, each discoverable with a description", async () => {
    const world = await loadWorld();
    const { rpcMethods, experimental_publishedRpcMethods: published } = world.host.harness.inspection.registrations;
    expect([...rpcMethods].sort()).toEqual(["apiVersion", "getTask", "listEvents", "listTasks"]);
    expect(published).toHaveLength(4);
    for (const entry of published) expect(entry.registrationDescription ?? entry.methodDescription).toBeTruthy();
  });
});
