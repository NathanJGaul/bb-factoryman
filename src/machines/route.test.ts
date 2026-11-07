import { describe, expect, it } from "vitest";
import { FakeBbPort } from "../../test/fixtures/bb-port";
import { hostFor } from "./route";

function setup() {
  const bb = new FakeBbPort();
  bb.sources = [
    { hostId: "host_local", path: "/work/repo", isDefault: true },
    { hostId: "host_gpu", path: "/work/gpu", isDefault: false },
  ];
  return bb;
}

describe("hostFor", () => {
  it("[U833] returns null for a task with no machine and for the machine that holds the clone", async () => {
    const bb = setup();
    expect(await hostFor(bb, { machine: null, projectId: "proj-1" })).toBeNull();
    expect(await hostFor(bb, { machine: "host_local", projectId: "proj-1" })).toBeNull();
  });

  it("[U834] returns the machine ID for a remote machine", async () => {
    expect(await hostFor(setup(), { machine: "host_gpu", projectId: "proj-1" })).toBe("host_gpu");
  });

  it("reads nothing from bb when the task has no machine", async () => {
    const bb = setup();
    await hostFor(bb, { machine: null, projectId: "proj-1" });
    expect(bb.callsTo("getProjectSources")).toEqual([]);
  });
});
