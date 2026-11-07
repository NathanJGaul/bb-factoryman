import { describe, expect, it } from "vitest";
import { DISPATCH_ARGS, SUPERVISOR, testRuntime, type TestRuntime } from "../../test/fixtures/runtime";
import type { MachineInfo } from "../bb/port";
import { dispatch } from "../tools/dispatch";
import { MACHINE_OFFLINE, MachineMonitor } from "./monitor";

const gpu = (overrides: Partial<MachineInfo> = {}): MachineInfo => ({ id: "host_gpu", name: "gpu-box", status: "connected", phase: "active", online: true, ...overrides });
const OFFLINE = { status: "disconnected", online: false } as const;

/** A runtime with a clone host and a remote host, and one `working` task `t1` pinned to the remote host. */
async function remoteTask(): Promise<TestRuntime> {
  const t = testRuntime();
  t.bb.addThread({ id: SUPERVISOR.threadId });
  t.bb.machines.push(gpu());
  t.bb.sources.push({ hostId: "host_gpu", path: "/work/gpu", isDefault: false });
  const outcome = await dispatch(t.runtime, SUPERVISOR, { ...DISPATCH_ARGS, machine: "gpu-box" });
  if (!outcome.ok) throw new Error(`fixture dispatch failed: ${outcome.text}`);
  return t;
}

const setGpu = (t: TestRuntime, machine: MachineInfo | null) => {
  t.bb.machines = [t.bb.machines[0] as MachineInfo, ...(machine === null ? [] : [machine])];
};
const rows = (t: TestRuntime, taskId = "t1") => t.runtime.deps.store.listEvents({ taskId });
const lastApplied = (t: TestRuntime, taskId = "t1") => rows(t, taskId).findLast((row) => row.outcome === "applied")!;
const state = (t: TestRuntime, taskId = "t1") => t.runtime.deps.store.getTask(taskId)?.state;

describe("MachineMonitor.tick", () => {
  it("[U846] blocks a working task whose host is offline, with system evidence that starts `machine offline:`", async () => {
    const t = await remoteTask();
    setGpu(t, gpu(OFFLINE));
    await new MachineMonitor(t.runtime).tick();
    expect(state(t)).toBe("blocked");
    expect(lastApplied(t)).toMatchObject({ event: "block", actor: "system" });
    expect(lastApplied(t).evidence?.startsWith(MACHINE_OFFLINE)).toBe(true);
    expect(lastApplied(t).evidence).toContain("gpu-box");
  });

  it("[U847] applies nothing more on a second tick with the same host state", async () => {
    const t = await remoteTask();
    setGpu(t, gpu(OFFLINE));
    const monitor = new MachineMonitor(t.runtime);
    await monitor.tick();
    const count = rows(t).length;
    await monitor.tick();
    await monitor.tick();
    expect(rows(t)).toHaveLength(count);
  });

  it("[U848] unblocks a task whose latest applied row is its own block, once the host is online again", async () => {
    const t = await remoteTask();
    const monitor = new MachineMonitor(t.runtime);
    setGpu(t, gpu(OFFLINE));
    await monitor.tick();
    expect(state(t)).toBe("blocked");
    setGpu(t, gpu());
    await monitor.tick();
    expect(state(t)).toBe("working");
    expect(lastApplied(t)).toMatchObject({ event: "unblock", actor: "system" });
    setGpu(t, gpu(OFFLINE));
    await monitor.tick();
    expect(state(t)).toBe("blocked");
  });

  it("[U849] leaves a block that the worker reported alone, whether the host is online or went offline and came back", async () => {
    const t = await remoteTask();
    const monitor = new MachineMonitor(t.runtime);
    await t.runtime.apply("t1", { type: "block", actor: "worker", evidence: "Waiting for a decision." });
    await monitor.tick();
    expect(state(t)).toBe("blocked");
    setGpu(t, gpu(OFFLINE));
    await monitor.tick();
    setGpu(t, gpu());
    await monitor.tick();
    expect(state(t)).toBe("blocked");
    expect(lastApplied(t)).toMatchObject({ event: "block", actor: "worker" });
  });

  it("[U850] ignores tasks with no machine, terminal tasks, and tasks on online hosts", async () => {
    const t = await remoteTask();
    const plain = await dispatch(t.runtime, SUPERVISOR, DISPATCH_ARGS);
    expect(plain.ok).toBe(true);
    const monitor = new MachineMonitor(t.runtime);
    await monitor.tick();
    expect([state(t, "t1"), state(t, "t2")]).toEqual(["working", "working"]);
    await t.runtime.apply("t1", { type: "fail", actor: "system", evidence: "Gave up." });
    setGpu(t, gpu(OFFLINE));
    const before = rows(t).length + rows(t, "t2").length;
    await monitor.tick();
    expect(rows(t).length + rows(t, "t2").length).toBe(before);
    expect(state(t, "t2")).toBe("working");
    expect(t.lines.filter((line) => line.level === "warn" && line.message.includes("Task t1"))).toEqual([]);
  });

  it("[U851] counts a host that listMachines omits as offline", async () => {
    const t = await remoteTask();
    setGpu(t, null);
    await new MachineMonitor(t.runtime).tick();
    expect(state(t)).toBe("blocked");
    expect(lastApplied(t).evidence).toContain("host_gpu");
  });

  it("[U852] logs, and changes nothing, when the machines cannot be listed", async () => {
    const t = await remoteTask();
    setGpu(t, gpu(OFFLINE));
    t.bb.machinesError = new Error("bb is down");
    const count = rows(t).length;
    await new MachineMonitor(t.runtime).tick();
    expect(rows(t)).toHaveLength(count);
    expect(t.lines.some((line) => line.level === "warn" && line.message.includes("bb is down"))).toBe(true);
  });

  it("[U854] only logs a warning for a task in a state other than working, and warns once", async () => {
    const t = await remoteTask();
    await t.runtime.apply("t1", { type: "handoff", actor: "worker", evidence: "Committed." });
    expect(state(t)).toBe("validating");
    setGpu(t, gpu(OFFLINE));
    const monitor = new MachineMonitor(t.runtime);
    const count = rows(t).length;
    await monitor.tick();
    await monitor.tick();
    expect(rows(t)).toHaveLength(count);
    const warnings = t.lines.filter((line) => line.level === "warn" && line.message.includes("t1"));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toMatch(/validating/);
  });
});

describe("MachineMonitor.hostDeleted", () => {
  it("[U853] blocks the working tasks on a deleted host at once, leaves other hosts alone, and never unblocks them", async () => {
    const t = await remoteTask();
    const plain = await dispatch(t.runtime, SUPERVISOR, DISPATCH_ARGS);
    expect(plain.ok).toBe(true);
    const monitor = new MachineMonitor(t.runtime);
    await monitor.hostDeleted("host_gpu", "gpu-box");
    expect(state(t, "t1")).toBe("blocked");
    expect(lastApplied(t).evidence).toMatch(/^machine offline: .*gpu-box.*removed/);
    expect(state(t, "t2")).toBe("working");
    setGpu(t, null);
    await monitor.tick();
    expect(state(t, "t1")).toBe("blocked");
    await monitor.hostDeleted("host_gpu", "gpu-box");
    expect(rows(t).filter((row) => row.event === "block")).toHaveLength(1);
  });
});
