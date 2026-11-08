import { describe, expect, it } from "vitest";
import type { MachineInfo, ProjectSource } from "../bb/port";
import { pickMachine } from "./placement";

const machine = (id: string, name: string, overrides: Partial<MachineInfo> = {}): MachineInfo => ({
  id,
  name,
  status: "connected",
  phase: "active",
  online: true,
  ...overrides,
});
const alpha = machine("host_a", "alpha");
const beta = machine("host_b", "beta");
const gamma = machine("host_c", "gamma");
const ALL = [alpha, beta, gamma];
const SOURCES: ProjectSource[] = [
  { hostId: "host_a", path: "/work/a", isDefault: true },
  { hostId: "host_b", path: "/work/b", isDefault: false },
  { hostId: "host_c", path: "/work/c", isDefault: false },
];

describe("pickMachine", () => {
  it("[U801] prefers the explicit value, then the rule, then the project default", () => {
    const all = pickMachine({ explicit: "beta", rule: "gamma", projectDefault: "alpha" }, ALL, SOURCES);
    expect(all).toMatchObject({ status: "chosen", source: "explicit", machine: { id: "host_b" } });
    expect(pickMachine({ rule: "gamma", projectDefault: "alpha" }, ALL, SOURCES)).toMatchObject({ status: "chosen", source: "rule", machine: { id: "host_c" } });
    expect(pickMachine({ projectDefault: "beta" }, ALL, SOURCES)).toMatchObject({ status: "chosen", source: "default", machine: { id: "host_b" } });
    expect(pickMachine({ explicit: null, rule: null, projectDefault: null }, ALL, SOURCES)).toEqual({ status: "none" });
  });

  it("[U802] resolves a name or an ID, and ignores case in a name", () => {
    expect(pickMachine({ explicit: "host_b" }, ALL, SOURCES)).toMatchObject({ status: "chosen", machine: { id: "host_b" } });
    expect(pickMachine({ explicit: "BETA" }, ALL, SOURCES)).toMatchObject({ status: "chosen", machine: { id: "host_b" } });
    expect(pickMachine({ explicit: "  beta " }, ALL, SOURCES)).toMatchObject({ status: "chosen", machine: { id: "host_b" } });
  });

  it("[U803] blocks a value that matches no host and lists the known machines", () => {
    const result = pickMachine({ explicit: "delta" }, ALL, SOURCES);
    expect(result).toMatchObject({ status: "blocked", code: "machine_unknown" });
    expect(result.status === "blocked" ? result.message : "").toMatch(/alpha.*beta.*gamma/);
  });

  it("[U804] blocks a name that two hosts share, and lets an ID win over a name", () => {
    const twin = machine("host_d", "beta");
    expect(pickMachine({ explicit: "beta" }, [...ALL, twin], SOURCES)).toMatchObject({ status: "blocked", code: "machine_ambiguous" });
    expect(pickMachine({ explicit: "host_b" }, [...ALL, twin], SOURCES)).toMatchObject({ status: "chosen", machine: { id: "host_b" } });
    const named = machine("host_e", "host_b");
    expect(pickMachine({ explicit: "host_b" }, [...ALL, named], SOURCES)).toMatchObject({ status: "chosen", machine: { id: "host_b" } });
  });

  it("[U805] blocks a disconnected host", () => {
    const down = machine("host_b", "beta", { status: "disconnected", online: false });
    expect(pickMachine({ explicit: "beta" }, [alpha, down], SOURCES)).toMatchObject({ status: "blocked", code: "machine_offline" });
  });

  it("[U806] blocks a connected host whose phase is not active", () => {
    const suspended = machine("host_b", "beta", { phase: "suspended", online: false });
    expect(pickMachine({ explicit: "beta" }, [alpha, suspended], SOURCES)).toMatchObject({ status: "blocked", code: "machine_offline" });
  });

  it("[U807] blocks a host with no source of the project", () => {
    expect(pickMachine({ explicit: "beta" }, ALL, [SOURCES[0] as ProjectSource])).toMatchObject({ status: "blocked", code: "machine_no_source" });
  });

  it("[U808] names no other host in a blocked result, so no caller can fall back", () => {
    const down = machine("host_b", "beta", { status: "disconnected", online: false });
    const result = pickMachine({ explicit: "beta", rule: "gamma", projectDefault: "alpha" }, [alpha, down, gamma], SOURCES);
    expect(result).toMatchObject({ status: "blocked", code: "machine_offline" });
    expect(Object.keys(result).sort()).toEqual(["code", "message", "status"]);
    expect(result.status === "blocked" ? result.message : "").toContain("beta");
  });

  it("[U809] gives none, and reads no host, when no value is set", () => {
    expect(pickMachine({}, ALL, SOURCES)).toEqual({ status: "none" });
    expect(pickMachine({ explicit: " ", rule: "", projectDefault: null }, ALL, SOURCES)).toEqual({ status: "none" });
  });

  it("[U868] marks the host that holds the clone", () => {
    expect(pickMachine({ explicit: "alpha" }, ALL, SOURCES)).toMatchObject({ status: "chosen", isClone: true });
    expect(pickMachine({ explicit: "beta" }, ALL, SOURCES)).toMatchObject({ status: "chosen", isClone: false });
  });
});
